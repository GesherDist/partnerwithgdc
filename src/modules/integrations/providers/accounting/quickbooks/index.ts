/**
 * QuickBooks Integration Provider
 *
 * Public exports for QuickBooks Online integration.
 */

// Provider Class & Instance
export { QuickBooksProvider, quickBooksProvider } from './quickbooks.provider';

// Types
export type {
  QuickBooksEnvironment,
  IntuitTokenResponse,
  IntuitErrorResponse,
  QuickBooksCompanyInfo,
  QuickBooksAddress,
  QuickBooksCustomer,
  QuickBooksInvoice,
  QuickBooksInvoiceLine,
  QuickBooksPayment,
  QuickBooksItem,
  QuickBooksQueryResponse,
  QuickBooksConfig,
  QuickBooksConnectionMetadata,
  QuickBooksStatusResponse,
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
  QBO_API_MINOR_VERSION,
  QBO_ENTITY_TYPES,
  QBO_DEFAULT_PAGE_SIZE,
  QBO_MAX_PAGE_SIZE,
  ACCESS_TOKEN_LIFETIME_SECONDS,
  REFRESH_TOKEN_LIFETIME_DAYS,
} from './constants';

// OAuth Utilities
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
} from './oauth';
