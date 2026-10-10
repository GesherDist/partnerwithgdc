/**
 * Pipedrive Server Actions
 *
 * Server actions for Pipedrive integration.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { pipedriveSyncService } from '../services/pipedrive-sync.service';
import { pipedrivePushService } from '../services/pipedrive-push.service';
import { createClient } from '@/shared/lib/supabase/server';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

/**
 * These actions are triggered from the Leads, Deals and Customers pages, all
 * gated by this permission. Server actions are callable directly, so they must
 * enforce it themselves.
 */
const PIPEDRIVE_ACTION_PERMISSION = 'customers.view_module';

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Resolve the current application user and verify a permission.
 */
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

interface SyncOptions {
  preview?: boolean;
  syncType: 'leads' | 'customers';
  selectedIds?: number[];
  onProgress?: (progress: number) => void;
}

interface SyncPreviewItem {
  id: number;
  name: string;
  email?: string;
  company?: string;
  status: 'new' | 'update' | 'skip';
  existingId?: string;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
  items?: SyncPreviewItem[];
}

// ============================================
// CONNECTION ACTIONS
// ============================================

/**
 * Get Pipedrive company domain for building URLs
 */
export async function getPipedriveCompanyDomain(): Promise<
  ActionResult<{ companyDomain: string | null }>
> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const status = await pipedriveSyncService.getConnectionStatus();
    return {
      success: true,
      data: { companyDomain: status.companyDomain || null },
    };
  } catch (error) {
    console.error('[getPipedriveCompanyDomain] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get Pipedrive domain',
    };
  }
}

/**
 * Check if Pipedrive is connected
 */
export async function checkPipedriveConnection(): Promise<
  ActionResult<{ connected: boolean }>
> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const isConnected = await pipedriveSyncService.isConnected();
    return { success: true, data: { connected: isConnected } };
  } catch (error) {
    console.error('[checkPipedriveConnection] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to check Pipedrive connection',
    };
  }
}

/**
 * Get available lead labels from Pipedrive
 */
export async function getPipedriveLeadLabels(): Promise<
  ActionResult<{ labels: Array<{ id: string; name: string }> }>
> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const labels = await pipedriveSyncService.getLeadLabels();
    return {
      success: true,
      data: { labels },
    };
  } catch (error) {
    console.error('[getPipedriveLeadLabels] Error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to get Pipedrive labels',
    };
  }
}

// ============================================
// SYNC ACTIONS
// ============================================

/**
 * Sync leads/customers from Pipedrive
 */
export async function syncFromPipedrive(
  options: SyncOptions
): Promise<ActionResult<SyncResult>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Check connection
    const isConnected = await pipedriveSyncService.isConnected();
    if (!isConnected) {
      return {
        success: false,
        error: 'Pipedrive is not connected. Please connect in Settings first.',
      };
    }

    if (options.preview) {
      // Preview mode - just fetch and show what would be synced (without actually syncing)
      const preview = await pipedriveSyncService.previewLeadsInboxSync();

      // Simple hash function to convert UUID to number for UI compatibility
      const hashUUID = (uuid: string): number => {
        let hash = 0;
        for (let i = 0; i < uuid.length; i++) {
          const char = uuid.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
      };

      return {
        success: true,
        data: {
          created: preview.newCount,
          updated: preview.updateCount,
          skipped: preview.skipCount,
          deleted: 0, // Preview doesn't delete
          errors: [],
          items: preview.items.map(item => ({
            id: hashUUID(item.id),
            name: item.name,
            email: item.email,
            company: item.company,
            status: item.status,
            existingId: item.existingId,
          })),
        },
      };
    } else {
      // Actual sync - includes cleanup of deleted leads
      // Use Leads Inbox sync (not Persons)
      const result = await pipedriveSyncService.syncLeadsInboxToLeads({
        skipExisting: false,
        cleanupDeleted: true, // Clean up leads deleted from Pipedrive
      });

      // Revalidate paths
      revalidatePath('/leads');
      if (options.syncType === 'customers') {
        revalidatePath('/customers');
      }

      return {
        success: true,
        data: {
          created: result.created,
          updated: result.updated,
          skipped: result.skipped,
          deleted: result.deleted,
          errors: result.errors.map(e => e.error),
        },
      };
    }
  } catch (error) {
    console.error('[syncFromPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Sync a specific deal to a lead
 */
export async function syncDealToLead(
  dealId: number
): Promise<ActionResult<{ leadId: string }>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await pipedriveSyncService.syncDealToLead(dealId);

    if (result && result.lead) {
      revalidatePath('/leads');
      const leadId = (result.lead as { id: string }).id;
      return { success: true, data: { leadId } };
    } else {
      return { success: false, error: 'Failed to sync deal' };
    }
  } catch (error) {
    console.error('[syncDealToLead] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Push a note to Pipedrive
 */
export async function pushNoteToPipedrive(
  leadId: string,
  content: string
): Promise<ActionResult<{ pipedriveNoteId: number }>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  const supabase = await createClient();

  try {
    // Get the lead to find Pipedrive IDs
    const { data: lead } = await supabase
      .from('leads')
      .select('pipedrive_person_id, pipedrive_deal_id, pipedrive_org_id')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    const noteId = await pipedriveSyncService.pushNoteToPipedrive(
      content,
      {
        personId: lead.pipedrive_person_id || undefined,
        dealId: lead.pipedrive_deal_id || undefined,
        orgId: lead.pipedrive_org_id || undefined,
      }
    );

    if (noteId) {
      return { success: true, data: { pipedriveNoteId: noteId } };
    } else {
      return { success: false, error: 'Failed to push note' };
    }
  } catch (error) {
    console.error('[pushNoteToPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

/**
 * Update deal value in Pipedrive (for quote sync)
 */
export async function updatePipedriveDealValue(
  dealId: number,
  value: number
): Promise<ActionResult<void>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    await pipedriveSyncService.updateDealValue(dealId, value);
    return { success: true };
  } catch (error) {
    console.error('[updatePipedriveDealValue] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
    };
  }
}

// ============================================
// PUSH ACTIONS (Gesher → Pipedrive)
// ============================================

/**
 * Sync a quote to Pipedrive deal
 * Updates deal value and adds activity note
 */
export async function syncQuoteToPipedrive(
  quoteId: string
): Promise<ActionResult<void>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await pipedrivePushService.syncQuoteToDeal(quoteId);

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[syncQuoteToPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Push order activity to Pipedrive
 * Creates a note with order details on the linked person/deal
 */
export async function pushOrderToPipedrive(
  orderId: string
): Promise<ActionResult<void>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await pipedrivePushService.pushOrderActivity(orderId);

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[pushOrderToPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

/**
 * Push customer LTV to Pipedrive
 * Adds a note with revenue, order count, average order value
 */
export async function pushCustomerLTVToPipedrive(
  customerId: string
): Promise<ActionResult<{ ltv: { totalRevenue: number; orderCount: number; averageOrderValue: number } }>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Get LTV data
    const ltv = await pipedrivePushService.calculateCustomerLTV(customerId);

    if (!ltv) {
      return { success: false, error: 'Failed to calculate LTV' };
    }

    // Push to Pipedrive
    const result = await pipedrivePushService.pushCustomerLTV(customerId);

    if (result.success) {
      return {
        success: true,
        data: {
          ltv: {
            totalRevenue: ltv.totalRevenue,
            orderCount: ltv.orderCount,
            averageOrderValue: ltv.averageOrderValue,
          }
        }
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('[pushCustomerLTVToPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

/**
 * Push a customer note to Pipedrive
 */
export async function pushCustomerNoteToPipedrive(
  customerId: string,
  noteContent: string
): Promise<ActionResult<{ pipedriveNoteId: number }>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await pipedrivePushService.pushCustomerNote(customerId, noteContent);

    if (result.success && result.pipedriveNoteId) {
      return { success: true, data: { pipedriveNoteId: result.pipedriveNoteId } };
    } else {
      return { success: false, error: result.error || 'Failed to push note' };
    }
  } catch (error) {
    console.error('[pushCustomerNoteToPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

/**
 * Push a lead note to Pipedrive
 */
export async function pushLeadNoteToPipedrive(
  leadId: string,
  noteContent: string
): Promise<ActionResult<{ pipedriveNoteId: number }>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await pipedrivePushService.pushLeadNote(leadId, noteContent);

    if (result.success && result.pipedriveNoteId) {
      return { success: true, data: { pipedriveNoteId: result.pipedriveNoteId } };
    } else {
      return { success: false, error: result.error || 'Failed to push note' };
    }
  } catch (error) {
    console.error('[pushLeadNoteToPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push failed',
    };
  }
}

// ============================================
// LEADS DIRECT SYNC ACTION
// ============================================

interface LeadSyncResult {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

/**
 * Sync leads from Pipedrive directly (no preview dialog)
 * Similar to syncDealsFromPipedrive - direct sync
 */
export async function syncLeadsFromPipedrive(): Promise<ActionResult<LeadSyncResult>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const isConnected = await pipedriveSyncService.isConnected();
    if (!isConnected) {
      return {
        success: false,
        error: 'Pipedrive is not connected. Please connect in Settings first.',
      };
    }

    const result = await pipedriveSyncService.syncLeadsInboxToLeads({
      skipExisting: false,
      cleanupDeleted: true,
    });

    // Revalidate leads page
    revalidatePath('/leads');

    return {
      success: true,
      data: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        deleted: result.deleted,
        errors: result.errors.map(e => e.error),
      },
    };
  } catch (error) {
    console.error('[syncLeadsFromPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

// ============================================
// DEALS SYNC ACTIONS
// ============================================

interface DealSyncPreviewItem {
  id: number;
  title: string;
  value?: number;
  currency?: string;
  status: 'new' | 'update' | 'skip';
  existingId?: string;
  pipelineName?: string;
  stageName?: string;
}

interface DealSyncResult {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
  items?: DealSyncPreviewItem[];
}

/**
 * Preview deals sync from Pipedrive
 */
export async function previewDealsFromPipedrive(): Promise<ActionResult<DealSyncResult>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const isConnected = await pipedriveSyncService.isConnected();
    if (!isConnected) {
      return {
        success: false,
        error: 'Pipedrive is not connected. Please connect in Settings first.',
      };
    }

    const preview = await pipedriveSyncService.previewDealsSync();

    return {
      success: true,
      data: {
        created: preview.newCount,
        updated: preview.updateCount,
        skipped: preview.skipCount,
        deleted: 0,
        errors: [],
        items: preview.items.map(item => ({
          id: item.id,
          title: item.title,
          value: item.value,
          currency: item.currency,
          status: item.status,
          existingId: item.existingId,
          pipelineName: item.pipelineName,
          stageName: item.stageName,
        })),
      },
    };
  } catch (error) {
    console.error('[previewDealsFromPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Preview failed',
    };
  }
}

/**
 * Sync deals from Pipedrive to local deals table
 */
export async function syncDealsFromPipedrive(): Promise<ActionResult<DealSyncResult>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const isConnected = await pipedriveSyncService.isConnected();
    if (!isConnected) {
      return {
        success: false,
        error: 'Pipedrive is not connected. Please connect in Settings first.',
      };
    }

    const result = await pipedriveSyncService.syncDealsToLocal({
      skipExisting: false,
      cleanupDeleted: true,
    });

    // Revalidate deals page
    revalidatePath('/deals');

    return {
      success: true,
      data: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        deleted: result.deleted,
        errors: result.errors.map(e => e.error),
      },
    };
  } catch (error) {
    console.error('[syncDealsFromPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Sync a single deal from Pipedrive (for webhook or manual sync)
 */
export async function syncSingleDealFromPipedrive(
  pipedriveDealId: number
): Promise<ActionResult<{ dealId: string; isNew: boolean }>> {
  const auth = await authorize(PIPEDRIVE_ACTION_PERMISSION);
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await pipedriveSyncService.syncSingleDeal(pipedriveDealId);

    if (result && result.deal) {
      revalidatePath('/deals');
      const dealId = (result.deal as { id: string }).id;
      return { success: true, data: { dealId, isNew: result.isNew } };
    } else {
      return { success: false, error: 'Failed to sync deal' };
    }
  } catch (error) {
    console.error('[syncSingleDealFromPipedrive] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}
