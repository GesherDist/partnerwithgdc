/**
 * QuickBooks Integration Module
 *
 * Public exports for QuickBooks OAuth integration.
 */

// Types
export type {
  QuickBooksEnvironment,
  QuickBooksConnectionStatus,
  QuickBooksConnectionRow,
  QuickBooksConnectionInsert,
  QuickBooksConnectionUpdate,
  QuickBooksStatusResponse,
  QuickBooksConfig,
  IntuitTokenResponse,
  QuickBooksCompanyInfo,
} from './types';

// Constants
export {
  INTUIT_AUTH_URL,
  INTUIT_TOKEN_URL,
  INTUIT_REVOKE_URL,
  QBO_SANDBOX_API_URL,
  QBO_PRODUCTION_API_URL,
  QBO_SCOPES,
  QBO_SCOPE_STRING,
  QBO_ERRORS,
  QBO_REDIRECT_PATHS,
  STATE_COOKIE_NAME,
  STATE_COOKIE_MAX_AGE,
} from './lib/constants';

// OAuth utilities
export {
  getQuickBooksConfig,
  getApiBaseUrl,
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  fetchCompanyInfo,
  calculateTokenExpiry,
} from './lib/oauth';

// Encryption
export {
  encrypt,
  decrypt,
  generateEncryptionKey,
} from './lib/encryption';

// Repository
export {
  getConnection,
  getConnectionByRealmId,
  upsertConnection,
  updateConnection,
  updateConnectionStatus,
  updateTokens,
  disconnectConnection,
  hasConnection,
} from './repositories/quickbooks-connection.repository';

// Auth Service
export {
  initiateOAuth,
  handleOAuthCallback,
  disconnect,
  getConnectionStatus,
  getAccessToken,
} from './services/quickbooks-auth.service';

// Customer Sync Service
export { qboCustomerSyncService } from './services/qbo-customer-sync.service';
export type { QboCustomerSyncService } from './services/qbo-customer-sync.service';

// Product Sync Service
export { qboProductSyncService } from './services/qbo-product-sync.service';
export type { QboProductSyncService } from './services/qbo-product-sync.service';

// Account Sync Service
export { qboAccountSyncService } from './services/qbo-account-sync.service';
export type { QboAccountSyncService } from './services/qbo-account-sync.service';

// Chart of Accounts Types
export type {
  ChartOfAccount,
  ChartOfAccountsRow,
  ChartOfAccountsInsert,
  ChartOfAccountsUpdate,
  ChartOfAccountsFilter,
  ChartOfAccountsSyncResult,
  AccountOption,
  AccountsByClassification,
  AccountClassification,
} from './types/chart-of-accounts';

// Chart of Accounts Repository
export {
  findAccounts,
  findAccountById,
  findAccountByQboId,
  getIncomeAccounts,
  getExpenseAccounts,
  getAssetAccounts,
  getAccountsByClassification,
  getAccountNameById,
  getAccountNamesByIds,
  upsertAccount,
  upsertAccounts,
  getLastSyncTime,
  countAccountsByRealm,
} from './repositories/chart-of-accounts.repository';
