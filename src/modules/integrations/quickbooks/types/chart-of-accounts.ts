/**
 * Chart of Accounts Types
 *
 * Type definitions for QuickBooks Chart of Accounts.
 */

// ============================================
// ENUMS
// ============================================

export type AccountClassification = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

// Common QBO Account Types
export type QboAccountType =
  | 'Income'
  | 'Expense'
  | 'Cost of Goods Sold'
  | 'Other Current Asset'
  | 'Fixed Asset'
  | 'Other Asset'
  | 'Accounts Receivable'
  | 'Bank'
  | 'Other Current Liability'
  | 'Long Term Liability'
  | 'Accounts Payable'
  | 'Equity'
  | 'Credit Card';

// Common QBO Account Sub-Types
export type QboAccountSubType =
  // Income
  | 'SalesOfProductIncome'
  | 'ServiceFeeIncome'
  | 'OtherPrimaryIncome'
  // Expense
  | 'SuppliesMaterialsCogs'
  | 'CostOfLaborCos'
  | 'EquipmentRentalCos'
  | 'OtherMiscServiceCost'
  | 'OfficeGeneralAdministrativeExpenses'
  // Asset
  | 'Inventory'
  | 'OtherCurrentAssets'
  | 'PrepaidExpenses'
  | string; // Allow other sub-types

// ============================================
// DATABASE ROW TYPES
// ============================================

export interface ChartOfAccountsRow {
  id: string;
  qbo_account_id: string;
  qbo_realm_id: string;
  name: string;
  fully_qualified_name: string | null;
  account_type: string;
  account_sub_type: string | null;
  classification: AccountClassification;
  current_balance: number | null;
  currency_code: string;
  is_active: boolean;
  qbo_sync_token: string | null;
  qbo_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartOfAccountsInsert {
  qbo_account_id: string;
  qbo_realm_id: string;
  name: string;
  fully_qualified_name?: string | null;
  account_type: string;
  account_sub_type?: string | null;
  classification: AccountClassification;
  current_balance?: number | null;
  currency_code?: string;
  is_active?: boolean;
  qbo_sync_token?: string | null;
  qbo_synced_at?: string | null;
}

export interface ChartOfAccountsUpdate {
  name?: string;
  fully_qualified_name?: string | null;
  account_type?: string;
  account_sub_type?: string | null;
  classification?: AccountClassification;
  current_balance?: number | null;
  is_active?: boolean;
  qbo_sync_token?: string | null;
  qbo_synced_at?: string | null;
}

// ============================================
// APPLICATION TYPES
// ============================================

export interface ChartOfAccount {
  id: string;
  qboAccountId: string;
  qboRealmId: string;
  name: string;
  fullyQualifiedName: string | null;
  accountType: string;
  accountSubType: string | null;
  classification: AccountClassification;
  currentBalance: number | null;
  currencyCode: string;
  isActive: boolean;
  qboSyncToken: string | null;
  qboSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// QUICKBOOKS API TYPES
// ============================================

export interface QboAccount {
  Id: string;
  Name: string;
  FullyQualifiedName?: string;
  AccountType: string;
  AccountSubType?: string;
  Classification?: string;
  CurrentBalance?: number;
  CurrencyRef?: {
    value: string;
    name?: string;
  };
  Active?: boolean;
  SyncToken?: string;
  MetaData?: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

export interface QboAccountQueryResponse {
  QueryResponse: {
    Account?: QboAccount[];
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
  time: string;
}

// ============================================
// FILTER/LIST TYPES
// ============================================

export interface ChartOfAccountsFilter {
  classification?: AccountClassification;
  accountType?: string;
  isActive?: boolean;
  search?: string;
}

export interface ChartOfAccountsListResult {
  data: ChartOfAccount[];
  total: number;
}

// ============================================
// SYNC TYPES
// ============================================

export interface ChartOfAccountsSyncResult {
  success: boolean;
  created: number;
  updated: number;
  errors: Array<{ accountId: string; error: string }>;
  syncedAt: Date;
}

// ============================================
// DROPDOWN OPTIONS
// ============================================

export interface AccountOption {
  value: string; // qbo_account_id
  label: string; // name
  type: string; // account_type
  subType: string | null;
}

export interface AccountsByClassification {
  income: AccountOption[];
  expense: AccountOption[];
  asset: AccountOption[];
}
