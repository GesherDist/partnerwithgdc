/**
 * QuickBooks Constants
 *
 * URLs, scopes, and configuration for Intuit OAuth2.
 */

// ============================================
// OAUTH ENDPOINTS
// ============================================

/**
 * Intuit OAuth2 authorization endpoint
 */
export const INTUIT_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';

/**
 * Intuit OAuth2 token endpoint
 */
export const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

/**
 * Intuit OAuth2 revoke endpoint
 */
export const INTUIT_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';

// ============================================
// API BASE URLS
// ============================================

/**
 * QuickBooks sandbox API base URL
 */
export const QBO_SANDBOX_API_URL = 'https://sandbox-quickbooks.api.intuit.com';

/**
 * QuickBooks production API base URL
 */
export const QBO_PRODUCTION_API_URL = 'https://quickbooks.api.intuit.com';

// ============================================
// OAUTH SCOPES
// ============================================

/**
 * OAuth scopes for QuickBooks access
 * - com.intuit.quickbooks.accounting: Full access to QuickBooks data
 * - openid: OpenID Connect authentication
 * - profile: User profile information
 * - email: User email address
 */
export const QBO_SCOPES = [
  'com.intuit.quickbooks.accounting',
  'openid',
  'profile',
  'email',
] as const;

/**
 * Scopes as space-separated string for OAuth URL
 */
export const QBO_SCOPE_STRING = QBO_SCOPES.join(' ');

// ============================================
// TOKEN CONFIGURATION
// ============================================

/**
 * Access token lifetime in seconds (typically 1 hour)
 */
export const ACCESS_TOKEN_LIFETIME_SECONDS = 3600;

/**
 * Refresh token lifetime in days (typically 100 days)
 */
export const REFRESH_TOKEN_LIFETIME_DAYS = 100;

/**
 * State cookie name for CSRF protection
 */
export const STATE_COOKIE_NAME = 'qbo_oauth_state';

/**
 * State cookie max age in seconds (5 minutes)
 */
export const STATE_COOKIE_MAX_AGE = 5 * 60;

// ============================================
// API VERSION
// ============================================

/**
 * QuickBooks API minor version
 */
export const QBO_API_MINOR_VERSION = '73';

// ============================================
// ERROR MESSAGES
// ============================================

export const QBO_ERRORS = {
  MISSING_CONFIG: 'QuickBooks configuration is incomplete. Check environment variables.',
  INVALID_STATE: 'Invalid OAuth state. Please try connecting again.',
  TOKEN_EXCHANGE_FAILED: 'Failed to exchange authorization code for tokens.',
  COMPANY_INFO_FAILED: 'Failed to fetch company information from QuickBooks.',
  NOT_CONNECTED: 'No QuickBooks connection found.',
  REVOKE_FAILED: 'Failed to revoke QuickBooks access.',
  API_ERROR: 'QuickBooks API request failed.',
  TOKEN_REFRESH_FAILED: 'Failed to refresh access token.',
} as const;

// ============================================
// REDIRECT PATHS
// ============================================

export const QBO_REDIRECT_PATHS = {
  SUCCESS: '/settings?qb=connected',
  CANCELLED: '/settings?qb=cancelled',
  INVALID_STATE: '/settings?qb=invalid_state',
  TOKEN_ERROR: '/settings?qb=token_error',
  NETWORK_ERROR: '/settings?qb=network_error',
} as const;

// ============================================
// ENTITY TYPES
// ============================================

export const QBO_ENTITY_TYPES = {
  CUSTOMER: 'Customer',
  INVOICE: 'Invoice',
  PAYMENT: 'Payment',
  ITEM: 'Item',
  COMPANY_INFO: 'CompanyInfo',
} as const;

// ============================================
// DEFAULT PAGINATION
// ============================================

export const QBO_DEFAULT_PAGE_SIZE = 100;
export const QBO_MAX_PAGE_SIZE = 1000;
