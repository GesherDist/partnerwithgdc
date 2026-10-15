'use server';

/**
 * Chart of Accounts — server actions (Settings > QuickBooks)
 *
 * Lists the QuickBooks accounts synced for the connected company with their
 * dashboard category (saved choice, or the suggestion from the account type),
 * saves mapping changes, and re-syncs the accounts from QuickBooks.
 *
 * View: settings.view_module. Change mapping / sync: settings.edit.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { getConnectionByProvider } from '@/modules/integrations/core';
import {
  DASHBOARD_CATEGORIES,
  isDashboardCategory,
  suggestCategory,
  suggestOpexGroup,
  type DashboardCategory,
} from '../lib/account-mapping';

// ============================================
// TYPES
// ============================================

export interface MappedAccount {
  qboAccountId: string;
  name: string;
  fullName: string;
  accountType: string;
  accountSubType: string | null;
  balance: number | null;
  category: DashboardCategory;
  suggestedCategory: DashboardCategory;
  /** Only for OPEX */
  opexGroup: string | null;
  suggestedOpexGroup: string;
  /** A saved choice overrides the suggestion */
  isCustom: boolean;
}

export interface ChartOfAccountsView {
  connected: boolean;
  environment: string | null;
  realmId: string | null;
  accounts: MappedAccount[];
  lastSyncedAt: string | null;
  /** False until migration 161 is applied: suggestions only, nothing can be saved */
  mappingAvailable: boolean;
  /** Sum of QuickBooks balances per category, as of the last account sync */
  totals: Record<DashboardCategory, number>;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ============================================
// HELPERS
// ============================================

async function authorize(permission: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, error: 'Authentication required' };
  }
  if (!hasPermission(user, permission)) {
    return { ok: false as const, error: `Permission denied: ${permission}` };
  }
  return { ok: true as const, user };
}

async function activeQuickBooks() {
  const connection = await getConnectionByProvider('quickbooks');
  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    return null;
  }
  const metadata = (connection.metadata ?? {}) as { environment?: string };
  return {
    connectionId: connection.id,
    realmId: connection.external_account_id,
    environment: metadata.environment ?? null,
  };
}

const isMissingMappingColumn = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === '42703' || error.code === 'PGRST204') && /dashboard_category|opex_group/.test(error.message ?? ''));

interface AccountRow {
  qbo_account_id: string;
  name: string;
  fully_qualified_name: string | null;
  account_type: string;
  account_sub_type: string | null;
  current_balance: number | null;
  qbo_synced_at: string | null;
  dashboard_category?: string | null;
  opex_group?: string | null;
}

function toMapped(row: AccountRow): MappedAccount {
  const like = {
    accountType: row.account_type,
    accountSubType: row.account_sub_type,
    name: row.name,
    fullyQualifiedName: row.fully_qualified_name,
  };
  const suggestedCategory = suggestCategory(like);
  const suggestedOpexGroup = suggestOpexGroup(like);
  const category = isDashboardCategory(row.dashboard_category) ? row.dashboard_category : suggestedCategory;
  const savedGroup = row.opex_group?.trim() || null;
  return {
    qboAccountId: row.qbo_account_id,
    name: row.name,
    fullName: row.fully_qualified_name || row.name,
    accountType: row.account_type,
    accountSubType: row.account_sub_type,
    balance: row.current_balance === null ? null : Number(row.current_balance),
    category,
    suggestedCategory,
    opexGroup: category === 'opex' ? savedGroup ?? suggestedOpexGroup : null,
    suggestedOpexGroup,
    isCustom: isDashboardCategory(row.dashboard_category) || savedGroup !== null,
  };
}

// ============================================
// LIST
// ============================================

export async function getChartOfAccounts(): Promise<Result<ChartOfAccountsView>> {
  const auth = await authorize('settings.view_module');
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const emptyTotals = Object.fromEntries(DASHBOARD_CATEGORIES.map((c) => [c, 0])) as Record<DashboardCategory, number>;
  const qbo = await activeQuickBooks();
  if (!qbo) {
    return {
      success: true,
      data: { connected: false, environment: null, realmId: null, accounts: [], lastSyncedAt: null, mappingAvailable: false, totals: emptyTotals },
    };
  }

  const base = 'qbo_account_id, name, fully_qualified_name, account_type, account_sub_type, current_balance, qbo_synced_at';
  const load = (columns: string) =>
    db
      .from('chart_of_accounts')
      .select(columns)
      .eq('qbo_realm_id', qbo.realmId)
      .eq('is_active', true)
      .order('account_type', { ascending: true })
      .order('fully_qualified_name', { ascending: true });

  let mappingAvailable = true;
  let result = await load(`${base}, dashboard_category, opex_group`);
  if (result.error && isMissingMappingColumn(result.error)) {
    // Migration 161 not applied: suggestions only
    mappingAvailable = false;
    result = await load(base);
  }
  if (result.error) {
    console.error('[ChartOfAccounts] Load failed:', result.error);
    return { success: false, error: 'Failed to load the chart of accounts' };
  }

  const rows = (result.data ?? []) as unknown as AccountRow[];
  const accounts = rows.map(toMapped);
  const totals = { ...emptyTotals };
  for (const account of accounts) {
    totals[account.category] += account.balance ?? 0;
  }

  return {
    success: true,
    data: {
      connected: true,
      environment: qbo.environment,
      realmId: qbo.realmId,
      accounts,
      lastSyncedAt: rows.map((r) => r.qbo_synced_at).filter(Boolean).sort().pop() ?? null,
      mappingAvailable,
      totals,
    },
  };
}

// ============================================
// UPDATE MAPPING
// ============================================

export async function updateAccountMapping(input: {
  qboAccountId: string;
  category: DashboardCategory;
  opexGroup?: string | null;
}): Promise<Result<MappedAccount>> {
  const auth = await authorize('settings.edit');
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  if (!isDashboardCategory(input.category)) {
    return { success: false, error: 'Invalid category' };
  }
  const qbo = await activeQuickBooks();
  if (!qbo) {
    return { success: false, error: 'QuickBooks is not connected' };
  }

  const { data: row, error: loadError } = await db
    .from('chart_of_accounts')
    .select('qbo_account_id, name, fully_qualified_name, account_type, account_sub_type, current_balance, qbo_synced_at')
    .eq('qbo_realm_id', qbo.realmId)
    .eq('qbo_account_id', input.qboAccountId)
    .maybeSingle();
  if (loadError || !row) {
    return { success: false, error: 'Account not found' };
  }

  const current = toMapped(row as AccountRow);
  const group = input.category === 'opex' ? input.opexGroup?.trim().slice(0, 150) || null : null;
  // Store only real overrides: a value equal to the suggestion is saved as NULL,
  // so later improvements to the suggestions still apply to that account
  const dashboardCategory = input.category === current.suggestedCategory ? null : input.category;
  const opexGroup = group && group !== current.suggestedOpexGroup ? group : null;

  const { data: updated, error } = await db
    .from('chart_of_accounts')
    .update({
      dashboard_category: dashboardCategory,
      opex_group: opexGroup,
      mapping_updated_at: new Date().toISOString(),
      mapping_updated_by: auth.user.id,
    })
    .eq('qbo_realm_id', qbo.realmId)
    .eq('qbo_account_id', input.qboAccountId)
    .select('qbo_account_id, name, fully_qualified_name, account_type, account_sub_type, current_balance, qbo_synced_at, dashboard_category, opex_group')
    .single();

  if (error) {
    if (isMissingMappingColumn(error)) {
      return { success: false, error: 'Database migration 161 is required to save the account mapping' };
    }
    console.error('[ChartOfAccounts] Update failed:', error);
    return { success: false, error: 'Failed to save the account mapping' };
  }

  revalidatePath('/settings');
  return { success: true, data: toMapped(updated as AccountRow) };
}

// ============================================
// SYNC FROM QUICKBOOKS
// ============================================

export async function syncChartOfAccounts(): Promise<Result<{ synced: number }>> {
  const auth = await authorize('settings.edit');
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const qbo = await activeQuickBooks();
  if (!qbo) {
    return { success: false, error: 'QuickBooks is not connected' };
  }

  const { qboAccountSyncService } = await import('@/modules/integrations/quickbooks');
  const result = await qboAccountSyncService.syncAccounts(qbo.connectionId);
  if (!result.success) {
    return { success: false, error: result.errors[0]?.error ?? 'Sync failed' };
  }

  revalidatePath('/settings');
  return { success: true, data: { synced: result.created } };
}
