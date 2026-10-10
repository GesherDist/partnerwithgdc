/**
 * GDC Pipedrive CRM server actions.
 *
 * Permissions:
 * - Integration setup, CSV import, purchase-history backfill (bulk writes to
 *   Pipedrive): integrations.manage (seeded by migration 157; until it is
 *   applied only Super Admin passes)
 * - Linking one customer / publishing its purchase history: customers.edit
 * - Rep report (read only): customers.view_module (Deals pages)
 * - Creating the ERP quote for a won deal: quotes.create
 * - Re-sending the SO number to Pipedrive: quotes.convert_to_order
 */

'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import { ensureGdcSetup, explainSetupPermissionError, GdcSetupRequiredError, type SetupReport } from './setup.service';
import {
  parseCustomerImportCsv,
  runCustomerImport,
  syncCustomerToPipedrive,
  type CustomerImportSummary,
  type CustomerSyncResult,
} from './customer-sync.service';
import { publishPurchaseHistory, type PurchaseHistoryPublishStatus } from './purchase-history.service';
import {
  handleWonDeal,
  writeBackSalesOrderNumber,
  type WonDealResult,
  type WriteBackResult,
} from './deal-erp.service';
import { getRepMonthlyReport, type RepMonthlyReport, type RepReportOptions } from './rep-report.service';

// ============================================
// TYPES & AUTH
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Expected states the UI can explain instead of showing a generic error */
  code?: 'setup_required' | 'not_connected';
}

type AuthorizeResult = { ok: true; user: AppUser } | { ok: false; result: ActionResult<never> };

async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }
  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }
  return { ok: true, user };
}

/** Bulk integration administration (migration 157) */
const INTEGRATIONS_MANAGE = 'integrations.manage';

/**
 * Failure result for a caught error. Expected states (GDC setup not applied,
 * Pipedrive not connected) are logged as one warning line and returned with a
 * code; anything else is logged with its stack.
 */
function failure(label: string, error: unknown, fallback: string): ActionResult<never> {
  const denied = explainSetupPermissionError(error);
  if (denied) {
    console.warn(`[${label}] Pipedrive permission denied: ${(error as Error).message}`);
    return { success: false, error: denied };
  }
  if (error instanceof GdcSetupRequiredError) {
    console.warn(`[${label}] Skipped: GDC setup not applied to the connected Pipedrive account`);
    return { success: false, error: error.message, code: 'setup_required' };
  }
  if (error instanceof Error && error.message === 'Pipedrive is not connected') {
    console.warn(`[${label}] Skipped: Pipedrive is not connected`);
    return { success: false, error: error.message, code: 'not_connected' };
  }
  console.error(`[${label}] Failed:`, error);
  return { success: false, error: errorMessage(error, fallback) };
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

/** Largest CSV accepted in one request */
const MAX_CSV_BYTES = 2 * 1024 * 1024;

/** Customers per purchase-history backfill call */
const BACKFILL_BATCH_SIZE = 25;

// ============================================
// SETUP
// ============================================

export async function runGdcPipedriveSetup(dryRun: boolean): Promise<ActionResult<SetupReport>> {
  const auth = await authorize(INTEGRATIONS_MANAGE);
  if (!auth.ok) {return auth.result;}

  try {
    return { success: true, data: await ensureGdcSetup({ dryRun }) };
  } catch (error) {
    return failure('GDC setup', error, 'Setup failed');
  }
}

// ============================================
// CUSTOMERS
// ============================================

export async function importCustomersCsv(
  csvText: string,
  options: { dryRun: boolean; startRow?: number }
): Promise<ActionResult<CustomerImportSummary & { parseErrors: string[] }>> {
  const auth = await authorize(INTEGRATIONS_MANAGE);
  if (!auth.ok) {return auth.result;}

  if (Buffer.byteLength(csvText, 'utf8') > MAX_CSV_BYTES) {
    return { success: false, error: 'CSV is larger than 2 MB; split it into smaller files' };
  }

  try {
    const { rows, errors } = parseCustomerImportCsv(csvText);
    if (rows.length === 0) {
      return { success: false, error: errors.join('; ') || 'No rows to import' };
    }
    const summary = await runCustomerImport(rows, { dryRun: options.dryRun, startRow: options.startRow });
    if (!options.dryRun) {
      revalidatePath('/customers');
    }
    return { success: true, data: { ...summary, parseErrors: errors } };
  } catch (error) {
    return failure('GDC import', error, 'Import failed');
  }
}

export async function syncCustomerToPipedriveAction(
  customerId: string,
  dryRun = false
): Promise<ActionResult<CustomerSyncResult>> {
  const auth = await authorize('customers.edit');
  if (!auth.ok) {return auth.result;}

  try {
    const result = await syncCustomerToPipedrive(customerId, { dryRun });
    if (!dryRun) {
      revalidatePath('/customers');
    }
    return { success: true, data: result };
  } catch (error) {
    return failure('GDC customer sync', error, 'Sync failed');
  }
}

// ============================================
// PURCHASE HISTORY
// ============================================

export async function publishPurchaseHistoryAction(
  customerId: string
): Promise<ActionResult<{ status: PurchaseHistoryPublishStatus }>> {
  const auth = await authorize('customers.edit');
  if (!auth.ok) {return auth.result;}

  try {
    const result = await publishPurchaseHistory(customerId);
    return { success: true, data: { status: result.status } };
  } catch (error) {
    return failure('GDC purchase history', error, 'Publish failed');
  }
}

/**
 * Publish purchase history for every customer linked to Pipedrive, in batches.
 * Call again with `nextCursor` until it is null.
 */
export async function backfillPurchaseHistory(
  cursor: string | null
): Promise<ActionResult<{ processed: number; failed: Array<{ customerId: string; error: string }>; nextCursor: string | null }>> {
  const auth = await authorize(INTEGRATIONS_MANAGE);
  if (!auth.ok) {return auth.result;}

  try {
    let query = db
      .from('customers')
      .select('id')
      .not('pipedrive_org_id', 'is', null)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .limit(BACKFILL_BATCH_SIZE);
    if (cursor) {query = query.gt('id', cursor);}
    const { data: customers, error } = await query;
    if (error) {throw new Error(error.message);}

    const failed: Array<{ customerId: string; error: string }> = [];
    for (const customer of customers ?? []) {
      try {
        await publishPurchaseHistory(customer.id as string);
      } catch (publishError) {
        failed.push({ customerId: customer.id as string, error: errorMessage(publishError, 'failed') });
      }
    }

    const last = customers?.[customers.length - 1]?.id as string | undefined;
    return {
      success: true,
      data: {
        processed: customers?.length ?? 0,
        failed,
        nextCursor: (customers?.length ?? 0) === BACKFILL_BATCH_SIZE && last ? last : null,
      },
    };
  } catch (error) {
    return failure('GDC purchase history backfill', error, 'Backfill failed');
  }
}

// ============================================
// DEALS
// ============================================

/**
 * Create (or find) the ERP quote for a won Pipedrive deal, e.g. after linking
 * its organization to an ERP customer. Safe to call repeatedly.
 */
export async function createErpQuoteForWonDeal(pipedriveDealId: number): Promise<ActionResult<WonDealResult>> {
  const auth = await authorize('quotes.create');
  if (!auth.ok) {return auth.result;}

  if (!Number.isInteger(pipedriveDealId) || pipedriveDealId <= 0) {
    return { success: false, error: 'Invalid Pipedrive deal ID' };
  }
  try {
    const result = await handleWonDeal(pipedriveDealId);
    if (result.status === 'quote_created') {
      revalidatePath('/quotes');
    }
    return { success: result.status === 'quote_created' || result.status === 'already_processed', data: result, error: result.message };
  } catch (error) {
    return failure('GDC won deal', error, 'Quote creation failed');
  }
}

/**
 * Re-send the ERP sales order number of a converted quote to its Pipedrive
 * deal (e.g. after Pipedrive was unreachable at conversion time).
 */
export async function resendSalesOrderToPipedrive(quoteId: string): Promise<ActionResult<WriteBackResult>> {
  const auth = await authorize('quotes.convert_to_order');
  if (!auth.ok) {return auth.result;}

  try {
    const { data: order, error } = await db
      .from('sales_orders')
      .select('id')
      .eq('quote_id', quoteId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {throw new Error(error.message);}
    if (!order) {
      return { success: false, error: 'This quote has not been converted to a sales order' };
    }
    const result = await writeBackSalesOrderNumber(quoteId, String(order.id));
    const ok = result.status === 'written' || result.status === 'already_written';
    return { success: ok, data: result, error: ok ? undefined : result.message };
  } catch (error) {
    return failure('GDC SO write-back', error, 'Write-back failed');
  }
}

// ============================================
// REPORTS
// ============================================

export async function getRepMonthlyReportAction(
  month: string,
  options: Partial<RepReportOptions> = {}
): Promise<ActionResult<RepMonthlyReport>> {
  const auth = await authorize('customers.view_module');
  if (!auth.ok) {return auth.result;}

  try {
    const safeOptions: Partial<RepReportOptions> = {
      ...(options?.dateBasis === 'due' || options?.dateBasis === 'completed' ? { dateBasis: options.dateBasis } : {}),
      ...(typeof options?.includeLeadsInbox === 'boolean' ? { includeLeadsInbox: options.includeLeadsInbox } : {}),
    };
    return { success: true, data: await getRepMonthlyReport(month, safeOptions) };
  } catch (error) {
    return failure('GDC rep report', error, 'Report failed');
  }
}
