/**
 * Pipedrive Constants
 *
 * URLs, scopes, and configuration for Pipedrive OAuth2.
 */

// ============================================
// OAUTH ENDPOINTS
// ============================================

/**
 * Pipedrive OAuth2 authorization endpoint
 */
export const PIPEDRIVE_AUTH_URL = 'https://oauth.pipedrive.com/oauth/authorize';

/**
 * Pipedrive OAuth2 token endpoint
 */
export const PIPEDRIVE_TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token';

/**
 * Pipedrive OAuth2 revoke endpoint
 */
export const PIPEDRIVE_REVOKE_URL = 'https://oauth.pipedrive.com/oauth/revoke';

// ============================================
// API BASE URL
// ============================================

/**
 * Pipedrive API base URL (domain is dynamic per company)
 */
export const PIPEDRIVE_API_BASE = 'https://api.pipedrive.com/v1';

// ============================================
// OAUTH SCOPES
// ============================================

/**
 * OAuth scopes for Pipedrive access
 */
export const PIPEDRIVE_SCOPES = [
  'base',
  'contacts:read',
  'contacts:full',
  'deals:read',
  'deals:full',
  'activities:read',
  'activities:full',
  'leads:read',
  'leads:full',
  'organizations:read',
  'organizations:full',
  'users:read',
] as const;

/**
 * Scopes as space-separated string for OAuth URL
 */
export const PIPEDRIVE_SCOPE_STRING = PIPEDRIVE_SCOPES.join(' ');

// ============================================
// TOKEN CONFIGURATION
// ============================================

/**
 * Access token lifetime in seconds (typically 1 hour)
 */
export const PIPEDRIVE_ACCESS_TOKEN_LIFETIME_SECONDS = 3600;

/**
 * State cookie name for CSRF protection
 */
export const PIPEDRIVE_STATE_COOKIE_NAME = 'pipedrive_oauth_state';

/**
 * State cookie max age in seconds (5 minutes)
 */
export const PIPEDRIVE_STATE_COOKIE_MAX_AGE = 5 * 60;

// ============================================
// ERROR MESSAGES
// ============================================

export const PIPEDRIVE_ERRORS = {
  MISSING_CONFIG: 'Pipedrive configuration is incomplete. Check environment variables.',
  INVALID_STATE: 'Invalid OAuth state. Please try connecting again.',
  TOKEN_EXCHANGE_FAILED: 'Failed to exchange authorization code for tokens.',
  USER_INFO_FAILED: 'Failed to fetch user information from Pipedrive.',
  NOT_CONNECTED: 'No Pipedrive connection found.',
  REVOKE_FAILED: 'Failed to revoke Pipedrive access.',
  API_ERROR: 'Pipedrive API request failed.',
  TOKEN_REFRESH_FAILED: 'Failed to refresh access token.',
} as const;

// ============================================
// REDIRECT PATHS
// ============================================

export const PIPEDRIVE_REDIRECT_PATHS = {
  SUCCESS: '/settings?pipedrive=connected',
  CANCELLED: '/settings?pipedrive=cancelled',
  INVALID_STATE: '/settings?pipedrive=invalid_state',
  TOKEN_ERROR: '/settings?pipedrive=token_error',
  NETWORK_ERROR: '/settings?pipedrive=network_error',
} as const;

// ============================================
// ENTITY TYPES
// ============================================

export const PIPEDRIVE_ENTITY_TYPES = {
  PERSON: 'persons',
  ORGANIZATION: 'organizations',
  DEAL: 'deals',
  ACTIVITY: 'activities',
  NOTE: 'notes',
  PIPELINE: 'pipelines',
  STAGE: 'stages',
  USER: 'users',
} as const;

// ============================================
// DEFAULT PAGINATION
// ============================================

export const PIPEDRIVE_DEFAULT_PAGE_SIZE = 100;
export const PIPEDRIVE_MAX_PAGE_SIZE = 500;
