/**
 * QuickBooks OAuth Utilities
 *
 * State generation, URL building, and token exchange.
 */

import { randomBytes } from 'crypto';
import {
  INTUIT_AUTH_URL,
  INTUIT_TOKEN_URL,
  INTUIT_REVOKE_URL,
  QBO_SCOPE_STRING,
  QBO_SANDBOX_API_URL,
  QBO_PRODUCTION_API_URL,
  QBO_API_MINOR_VERSION,
  QBO_ERRORS,
} from './constants';
import type {
  QuickBooksConfig,
  QuickBooksEnvironment,
  IntuitTokenResponse,
  QuickBooksCompanyInfo,
} from './types';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get QuickBooks OAuth configuration from environment
 */
export function getQuickBooksConfig(): QuickBooksConfig {
  const clientId = process.env.NEXT_QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.NEXT_QUICKBOOKS_SECRET_ID;
  const redirectUri = process.env.NEXT_QUICKBOOKS_REDIRECT_URI;
  const environment = (process.env.NEXT_QUICKBOOKS_ENVIRONMENT ||
    'sandbox') as QuickBooksEnvironment;
  const encryptionKey =
    process.env.INTEGRATION_ENCRYPTION_KEY || process.env.QBO_ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    throw new Error(QBO_ERRORS.MISSING_CONFIG);
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
    encryptionKey,
  };
}

/**
 * Get QuickBooks API base URL for environment
 */
export function getApiBaseUrl(environment: QuickBooksEnvironment): string {
  return environment === 'production' ? QBO_PRODUCTION_API_URL : QBO_SANDBOX_API_URL;
}

// ============================================
// STATE MANAGEMENT
// ============================================

/**
 * Generate a cryptographically secure state token for CSRF protection
 *
 * @returns 32-character hex string
 */
export function generateState(): string {
  return randomBytes(16).toString('hex');
}

// ============================================
// URL BUILDING
// ============================================

/**
 * Build the Intuit OAuth authorization URL
 *
 * @param state - CSRF protection state token
 * @returns Full authorization URL
 */
export function buildAuthorizationUrl(state: string): string {
  const config = getQuickBooksConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: QBO_SCOPE_STRING,
    state,
  });

  return `${INTUIT_AUTH_URL}?${params.toString()}`;
}

// ============================================
// TOKEN OPERATIONS
// ============================================

/**
 * Exchange authorization code for tokens
 *
 * @param code - Authorization code from callback
 * @returns Token response from Intuit
 */
export async function exchangeCodeForTokens(code: string): Promise<IntuitTokenResponse> {
  const config = getQuickBooksConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    'base64'
  );

  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Token exchange failed:', response.status, errorBody);
    throw new Error(QBO_ERRORS.TOKEN_EXCHANGE_FAILED);
  }

  return response.json() as Promise<IntuitTokenResponse>;
}

/**
 * Refresh access token using refresh token
 *
 * @param refreshToken - Current refresh token
 * @returns New token response from Intuit
 */
export async function refreshAccessToken(refreshToken: string): Promise<IntuitTokenResponse> {
  const config = getQuickBooksConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    'base64'
  );

  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Token refresh failed:', response.status, errorBody);
    throw new Error(QBO_ERRORS.TOKEN_REFRESH_FAILED);
  }

  return response.json() as Promise<IntuitTokenResponse>;
}

/**
 * Revoke a token at Intuit
 *
 * @param token - Access or refresh token to revoke
 * @returns True if revocation succeeded
 */
export async function revokeToken(token: string): Promise<boolean> {
  const config = getQuickBooksConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    'base64'
  );

  try {
    const response = await fetch(INTUIT_REVOKE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ token }),
    });

    // Intuit returns 200 for successful revocation
    return response.ok;
  } catch (error) {
    console.error('Token revocation failed:', error);
    return false;
  }
}

// ============================================
// COMPANY INFO
// ============================================

/**
 * Fetch company info from QuickBooks API
 *
 * @param accessToken - Valid access token
 * @param realmId - QuickBooks company ID
 * @param environment - sandbox or production
 * @returns Company info including name
 */
export async function fetchCompanyInfo(
  accessToken: string,
  realmId: string,
  environment: QuickBooksEnvironment
): Promise<QuickBooksCompanyInfo> {
  const baseUrl = getApiBaseUrl(environment);
  const url = `${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}?minorversion=${QBO_API_MINOR_VERSION}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Company info fetch failed:', response.status, errorBody);
    throw new Error(QBO_ERRORS.COMPANY_INFO_FAILED);
  }

  return response.json() as Promise<QuickBooksCompanyInfo>;
}

/**
 * Calculate token expiration timestamp
 *
 * @param expiresIn - Token lifetime in seconds
 * @returns ISO timestamp string
 */
export function calculateTokenExpiry(expiresIn: number): string {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);
  return expiresAt.toISOString();
}
