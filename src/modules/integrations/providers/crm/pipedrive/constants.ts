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
 * OAuth scopes this integration needs.
 *
 * Pipedrive grants the scopes configured on the app in Developer Hub
 * (OAuth & access scopes); the authorize URL does not choose them. Keep this
 * list and the Developer Hub settings in sync. After changing scopes in
 * Developer Hub, disconnect and reconnect so the new token carries them.
 *
 * GDC setup (pipeline, stages, custom fields, activity types) needs 'admin'
 * and the connecting user must be a company admin. Products need
 * 'products:full'; deal products need 'products:read'.
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
  'products:read',
  'products:full',
  'search:read',
  'admin',
] as const;

/** Scopes required by GDC setup writes, by what they create */
export const GDC_SETUP_REQUIRED_SCOPES: Record<string, string> = {
  admin: 'GDC Sales pipeline, stages, custom fields and activity types',
  'products:full': '24s / 38s products',
};

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
  REAUTHORIZATION_REQUIRED:
    'Pipedrive rejected the stored credentials (access revoked or expired). Please reconnect Pipedrive in Settings.',
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
  UNAUTHORIZED: '/settings?pipedrive=unauthorized',
} as const;

// ============================================
// ACCESS CONTROL
// ============================================

/**
 * Permission required to view, connect and disconnect the Pipedrive integration.
 * Matches the permission that gates the Settings page hosting the Pipedrive card.
 */
export const PIPEDRIVE_MANAGE_PERMISSION = 'settings.view_module';

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

/**
 * Safety cap on pages fetched by a full-collection read (500 x 200 = 100,000 records).
 * Exceeding it aborts the read rather than returning a partial list.
 */
export const PIPEDRIVE_MAX_PAGES = 200;

// ============================================
// TOKEN REFRESH
// ============================================

/**
 * Refresh the access token when it expires within this window
 */
export const PIPEDRIVE_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
