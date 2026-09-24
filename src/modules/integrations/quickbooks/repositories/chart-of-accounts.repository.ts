/**
 * Chart of Accounts Repository
 *
 * Database operations for Chart of Accounts.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  ChartOfAccountsRow,
  ChartOfAccountsInsert,
  ChartOfAccountsUpdate,
  ChartOfAccount,
  ChartOfAccountsFilter,
  AccountOption,
  AccountsByClassification,
} from '../types/chart-of-accounts';

// ============================================
// ROW MAPPER
// ============================================

function mapRowToAccount(row: ChartOfAccountsRow): ChartOfAccount {
  return {
    id: row.id,
    qboAccountId: row.qbo_account_id,
    qboRealmId: row.qbo_realm_id,
    name: row.name,
    fullyQualifiedName: row.fully_qualified_name,
    accountType: row.account_type,
    accountSubType: row.account_sub_type,
    classification: row.classification,
    currentBalance: row.current_balance,
    currencyCode: row.currency_code,
    isActive: row.is_active,
    qboSyncToken: row.qbo_sync_token,
    qboSyncedAt: row.qbo_synced_at ? new Date(row.qbo_synced_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// ============================================
// FIND OPERATIONS
// ============================================

/**
 * Get all accounts with optional filtering
 */
export async function findAccounts(filter?: ChartOfAccountsFilter): Promise<ChartOfAccount[]> {
  const supabase = await createClient();

  let query = supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (filter?.classification) {
    query = query.eq('classification', filter.classification);
  }

  if (filter?.accountType) {
    query = query.eq('account_type', filter.accountType);
  }

  if (filter?.isActive !== undefined) {
    query = query.eq('is_active', filter.isActive);
  }

  if (filter?.search) {
    query = query.ilike('name', `%${filter.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching accounts:', error);
    throw error;
  }

  return (data || []).map(mapRowToAccount);
}

/**
 * Get account by ID
 */
export async function findAccountById(id: string): Promise<ChartOfAccount | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data ? mapRowToAccount(data) : null;
}

/**
 * Get account by QBO Account ID and Realm ID
 */
export async function findAccountByQboId(
  qboAccountId: string,
  qboRealmId: string
): Promise<ChartOfAccount | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('*')
    .eq('qbo_account_id', qboAccountId)
    .eq('qbo_realm_id', qboRealmId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data ? mapRowToAccount(data) : null;
}

/**
 * Get account name by QBO Account ID (for display purposes)
 * Returns the account name or null if not found
 */
export async function getAccountNameById(qboAccountId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('name')
    .eq('qbo_account_id', qboAccountId)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching account name:', error);
    return null;
  }

  return data?.name || null;
}

/**
 * Get multiple account names by QBO Account IDs
 * Returns a map of ID -> Name
 */
export async function getAccountNamesByIds(qboAccountIds: string[]): Promise<Record<string, string>> {
  if (qboAccountIds.length === 0) return {};

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('qbo_account_id, name')
    .in('qbo_account_id', qboAccountIds);

  if (error) {
    console.error('Error fetching account names:', error);
    return {};
  }

  const result: Record<string, string> = {};
  for (const row of data || []) {
    result[row.qbo_account_id] = row.name;
  }
  return result;
}

// ============================================
// INCOME ACCOUNTS (for Product sync)
// ============================================

/**
 * Get income accounts for dropdown
 * QuickBooks only allows "Sales of Product Income" sub-type for inventory products
 */
export async function getIncomeAccounts(qboRealmId?: string): Promise<AccountOption[]> {
  const supabase = await createClient();

  let query = supabase
    .from('chart_of_accounts')
    .select('qbo_account_id, name, account_type, account_sub_type')
    .eq('account_sub_type', 'SalesOfProductIncome')  // Only Sales of Product Income for inventory
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (qboRealmId) {
    query = query.eq('qbo_realm_id', qboRealmId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching income accounts:', error);
    return [];
  }

  return (data || []).map((row) => ({
    value: row.qbo_account_id,
    label: row.name,
    type: row.account_type,
    subType: row.account_sub_type,
  }));
}

/**
 * Get expense accounts for dropdown (COGS only - matches QuickBooks behavior)
 * QuickBooks only shows "Cost of Goods Sold" type accounts in product expense dropdown
 */
export async function getExpenseAccounts(qboRealmId?: string): Promise<AccountOption[]> {
  const supabase = await createClient();

  let query = supabase
    .from('chart_of_accounts')
    .select('qbo_account_id, name, account_type, account_sub_type')
    .eq('account_type', 'Cost of Goods Sold')  // Only COGS accounts, not all expenses
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (qboRealmId) {
    query = query.eq('qbo_realm_id', qboRealmId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching expense accounts:', error);
    return [];
  }

  return (data || []).map((row) => ({
    value: row.qbo_account_id,
    label: row.name,
    type: row.account_type,
    subType: row.account_sub_type,
  }));
}

/**
 * Get asset accounts for dropdown (Inventory Asset)
 * QuickBooks only shows accounts with sub_type = 'Inventory' for inventory asset dropdown
 */
export async function getAssetAccounts(qboRealmId?: string): Promise<AccountOption[]> {
  const supabase = await createClient();

  let query = supabase
    .from('chart_of_accounts')
    .select('qbo_account_id, name, account_type, account_sub_type')
    .eq('account_sub_type', 'Inventory')  // Only Inventory sub-type accounts
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (qboRealmId) {
    query = query.eq('qbo_realm_id', qboRealmId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching asset accounts:', error);
    return [];
  }

  return (data || []).map((row) => ({
    value: row.qbo_account_id,
    label: row.name,
    type: row.account_type,
    subType: row.account_sub_type,
  }));
}

/**
 * Get all accounts grouped by classification
 */
export async function getAccountsByClassification(qboRealmId?: string): Promise<AccountsByClassification> {
  const [income, expense, asset] = await Promise.all([
    getIncomeAccounts(qboRealmId),
    getExpenseAccounts(qboRealmId),
    getAssetAccounts(qboRealmId),
  ]);

  return { income, expense, asset };
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Upsert account (insert or update)
 * Uses admin client to bypass RLS for sync operations
 */
export async function upsertAccount(data: ChartOfAccountsInsert): Promise<ChartOfAccount> {
  // Use admin client to bypass RLS for sync operations
  const supabase = createAdminClient();

  const { data: result, error } = await supabase
    .from('chart_of_accounts')
    .upsert(data, {
      onConflict: 'qbo_account_id,qbo_realm_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting account:', error);
    throw error;
  }

  return mapRowToAccount(result);
}

/**
 * Batch upsert accounts
 * Uses admin client to bypass RLS for sync operations
 */
export async function upsertAccounts(accounts: ChartOfAccountsInsert[]): Promise<number> {
  if (accounts.length === 0) return 0;

  // Use admin client to bypass RLS for sync operations
  const supabase = createAdminClient();

  const { error, count } = await supabase
    .from('chart_of_accounts')
    .upsert(accounts, {
      onConflict: 'qbo_account_id,qbo_realm_id',
      count: 'exact',
    });

  if (error) {
    console.error('Error batch upserting accounts:', error);
    throw error;
  }

  return count || accounts.length;
}

/**
 * Update account
 * Uses admin client to bypass RLS
 */
export async function updateAccount(
  id: string,
  data: ChartOfAccountsUpdate
): Promise<ChartOfAccount> {
  const supabase = createAdminClient();

  const { data: result, error } = await supabase
    .from('chart_of_accounts')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating account:', error);
    throw error;
  }

  return mapRowToAccount(result);
}

/**
 * Delete all accounts for a realm (used before full re-sync)
 * Uses admin client to bypass RLS
 */
export async function deleteAccountsByRealm(qboRealmId: string): Promise<number> {
  const supabase = createAdminClient();

  const { error, count } = await supabase
    .from('chart_of_accounts')
    .delete({ count: 'exact' })
    .eq('qbo_realm_id', qboRealmId);

  if (error) {
    console.error('Error deleting accounts:', error);
    throw error;
  }

  return count || 0;
}

/**
 * Mark accounts as inactive for a realm
 * Uses admin client to bypass RLS
 */
export async function deactivateAccountsByRealm(qboRealmId: string): Promise<number> {
  const supabase = createAdminClient();

  const { error, count } = await supabase
    .from('chart_of_accounts')
    .update({ is_active: false })
    .eq('qbo_realm_id', qboRealmId)
    .eq('is_active', true);

  if (error) {
    console.error('Error deactivating accounts:', error);
    throw error;
  }

  return count || 0;
}

// ============================================
// SYNC HELPERS
// ============================================

/**
 * Get last sync timestamp for a realm
 */
export async function getLastSyncTime(qboRealmId: string): Promise<Date | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('chart_of_accounts')
    .select('qbo_synced_at')
    .eq('qbo_realm_id', qboRealmId)
    .order('qbo_synced_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data?.qbo_synced_at) {
    return null;
  }

  return new Date(data.qbo_synced_at);
}

/**
 * Count accounts by realm
 */
export async function countAccountsByRealm(qboRealmId: string): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from('chart_of_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('qbo_realm_id', qboRealmId)
    .eq('is_active', true);

  if (error) {
    console.error('Error counting accounts:', error);
    return 0;
  }

  return count || 0;
}
