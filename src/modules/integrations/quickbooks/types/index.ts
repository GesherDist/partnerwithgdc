/**
 * QuickBooks Integration Types
 *
 * Type definitions for QuickBooks OAuth connection.
 */

// Re-export Chart of Accounts types
export * from './chart-of-accounts';

// ============================================
// DATABASE TYPES
// ============================================

export type QuickBooksEnvironment = 'sandbox' | 'production';

export type QuickBooksConnectionStatus = 'connected' | 'disconnected' | 'error';

/**
 * QuickBooks connection row from database
 */
export interface QuickBooksConnectionRow {
  id: string;
  realm_id: string;
  company_name: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  environment: QuickBooksEnvironment;
  status: QuickBooksConnectionStatus;
  error_message: string | null;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
}

/**
 * QuickBooks connection for insertion
 */
export interface QuickBooksConnectionInsert {
  realm_id: string;
  company_name: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  environment: QuickBooksEnvironment;
  status?: QuickBooksConnectionStatus;
  connected_by?: string;
}

/**
 * QuickBooks connection for update
 */
export interface QuickBooksConnectionUpdate {
  company_name?: string;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  token_expires_at?: string;
  status?: QuickBooksConnectionStatus;
  error_message?: string | null;
}

// ============================================
// OAUTH TYPES
// ============================================

/**
 * OAuth token response from Intuit
 */
export interface IntuitTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
}

/**
 * OAuth error response from Intuit
 */
export interface IntuitErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Company info from QuickBooks API
 */
export interface QuickBooksCompanyInfo {
  CompanyInfo: {
    CompanyName: string;
    LegalName?: string;
    CompanyAddr?: {
      Line1?: string;
      City?: string;
      CountrySubDivisionCode?: string;
      PostalCode?: string;
      Country?: string;
    };
  };
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Connection status response for API
 */
export interface QuickBooksStatusResponse {
  connected: boolean;
  companyName?: string;
  realmId?: string;
  environment?: QuickBooksEnvironment;
  connectedAt?: string;
  tokenExpiresAt?: string;
  status?: QuickBooksConnectionStatus;
  errorMessage?: string;
}

/**
 * OAuth callback query parameters
 */
export interface OAuthCallbackParams {
  code?: string;
  realmId?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * QuickBooks OAuth configuration
 */
export interface QuickBooksConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: QuickBooksEnvironment;
  encryptionKey: string;
}
