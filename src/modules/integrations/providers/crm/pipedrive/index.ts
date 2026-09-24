/**
 * Pipedrive CRM Provider
 *
 * Public exports for Pipedrive integration.
 */

// Provider Class & Instance
export { PipedriveProvider, pipedriveProvider } from './pipedrive.provider';

// Types
export type {
  PipedriveTokenResponse,
  PipedriveErrorResponse,
  PipedriveApiResponse,
  PipedrivePerson,
  PipedriveLead,
  PipedriveOrganization,
  PipedriveDeal,
  PipedriveActivity,
  PipedriveNote,
  PipedrivePipeline,
  PipedriveStage,
  PipedriveUser,
  PipedriveConfig,
  PipedriveConnectionMetadata,
  PipedriveStatusResponse,
} from './types';

// Constants
export {
  PIPEDRIVE_AUTH_URL,
  PIPEDRIVE_TOKEN_URL,
  PIPEDRIVE_REVOKE_URL,
  PIPEDRIVE_API_BASE,
  PIPEDRIVE_SCOPES,
  PIPEDRIVE_SCOPE_STRING,
  PIPEDRIVE_ERRORS,
  PIPEDRIVE_REDIRECT_PATHS,
  PIPEDRIVE_STATE_COOKIE_NAME,
  PIPEDRIVE_STATE_COOKIE_MAX_AGE,
  PIPEDRIVE_ENTITY_TYPES,
  PIPEDRIVE_DEFAULT_PAGE_SIZE,
  PIPEDRIVE_MAX_PAGE_SIZE,
  PIPEDRIVE_ACCESS_TOKEN_LIFETIME_SECONDS,
} from './constants';

// OAuth Utilities
export {
  getPipedriveConfig,
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  fetchUserInfo,
  calculateTokenExpiry,
} from './oauth';
