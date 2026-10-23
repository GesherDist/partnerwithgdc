'use server';

/**
 * QuickBooks Financials — server actions for the management dashboard
 *
 * Read: the latest stored snapshot (dashboard.view_financials).
 * Sync now: refresh accounts + read the QuickBooks reports + store today's
 * snapshot (settings.edit or integrations.manage). Without migration 162 the
 * fresh figures are still returned, just not stored.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasAnyPermission, hasPermission } from '@/shared/lib/auth';
import { getConnectionByProvider } from '@/modules/integrations/core';
import {
  getLatestSnapshot,
  syncFinancials,
  type QboFinancials,
} from '@/modules/integrations/quickbooks/services/qbo-financials.service';

export interface QuickBooksFinancialsView {
  connected: boolean;
  environment: string | null;
  financials: QboFinancials | null;
  /** False until migration 162 is applied */
  storageAvailable: boolean;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

export async function getQuickBooksFinancials(): Promise<Result<QuickBooksFinancialsView>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, 'dashboard.view_financials')) {
    return { success: false, error: 'Permission denied: dashboard.view_financials' };
  }

  const connection = await getConnectionByProvider('quickbooks');
  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    return { success: true, data: { connected: false, environment: null, financials: null, storageAvailable: true } };
  }
  const environment = ((connection.metadata ?? {}) as { environment?: string }).environment ?? null;

  try {
    const { financials, storageAvailable } = await getLatestSnapshot(connection.external_account_id);
    return { success: true, data: { connected: true, environment, financials, storageAvailable } };
  } catch (error) {
    console.error('[QboFinancials] Load failed:', error);
    return { success: false, error: 'Failed to load QuickBooks figures' };
  }
}

/** One automatic sync at a time per server instance */
let autoSyncRunning: Promise<Result<{ financials: QboFinancials; stored: boolean } | null>> | null = null;

/**
 * Automatic daily refresh: when the latest stored snapshot is not from today
 * (business date), read QuickBooks once and store it. Any dashboard viewer
 * may trigger it — it only reads QuickBooks and runs at most once per day
 * (later calls see today's snapshot and return null).
 */
export async function ensureFreshQuickBooksFinancials(): Promise<Result<{ financials: QboFinancials; stored: boolean } | null>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, 'dashboard.view_financials')) {
    return { success: false, error: 'Permission denied: dashboard.view_financials' };
  }

  const connection = await getConnectionByProvider('quickbooks');
  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    return { success: true, data: null };
  }

  const { businessToday } = await import('@/features/dashboard/lib/periods');
  const { financials } = await getLatestSnapshot(connection.external_account_id);
  if (financials && financials.asOf >= businessToday() && financials.periods) {
    return { success: true, data: null }; // already fresh today
  }

  if (!autoSyncRunning) {
    autoSyncRunning = (async () => {
      try {
        const result = await syncFinancials();
        revalidatePath('/dashboard');
        return { success: true as const, data: result };
      } catch (error) {
        console.error('[QboFinancials] Auto sync failed:', error);
        return { success: false as const, error: error instanceof Error ? error.message : 'QuickBooks sync failed' };
      } finally {
        autoSyncRunning = null;
      }
    })();
  }
  return autoSyncRunning;
}

export async function syncQuickBooksFinancialsNow(): Promise<Result<{ financials: QboFinancials; stored: boolean }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasAnyPermission(user, ['settings.edit', 'integrations.manage'])) {
    return { success: false, error: 'Permission denied: settings.edit' };
  }

  try {
    const result = await syncFinancials();
    revalidatePath('/dashboard');
    return { success: true, data: result };
  } catch (error) {
    console.error('[QboFinancials] Sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'QuickBooks sync failed' };
  }
}
