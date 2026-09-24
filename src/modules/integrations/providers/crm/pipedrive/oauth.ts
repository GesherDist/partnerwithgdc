/**
 * Pipedrive OAuth Utilities
 *
 * State generation, URL building, and token exchange.
 */

import { randomBytes } from 'crypto';
import {
  PIPEDRIVE_AUTH_URL,
  PIPEDRIVE_TOKEN_URL,
  PIPEDRIVE_REVOKE_URL,
  PIPEDRIVE_SCOPE_STRING,
  PIPEDRIVE_ERRORS,
} from './constants';
import type { PipedriveConfig, PipedriveTokenResponse, PipedriveUser } from './types';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get Pipedrive OAuth configuration from environment
 */
export function getPipedriveConfig(): PipedriveConfig {
  const clientId = process.env.PIPEDRIVE_CLIENT_ID;
  const clientSecret = process.env.PIPEDRIVE_CLIENT_SECRET;
  const redirectUri = process.env.PIPEDRIVE_REDIRECT_URI;
  const encryptionKey =
    process.env.INTEGRATION_ENCRYPTION_KEY || process.env.QBO_ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
    throw new Error(PIPEDRIVE_ERRORS.MISSING_CONFIG);
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    encryptionKey,
  };
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
 * Build the Pipedrive OAuth authorization URL
 *
 * @param state - CSRF protection state token
 * @returns Full authorization URL
 */
export function buildAuthorizationUrl(state: string): string {
  const config = getPipedriveConfig();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: PIPEDRIVE_SCOPE_STRING,
    state,
  });

  return `${PIPEDRIVE_AUTH_URL}?${params.toString()}`;
}

// ============================================
// TOKEN OPERATIONS
// ============================================

/**
 * Exchange authorization code for tokens
 *
 * @param code - Authorization code from callback
 * @returns Token response from Pipedrive
 */
export async function exchangeCodeForTokens(code: string): Promise<PipedriveTokenResponse> {
  const config = getPipedriveConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    'base64'
  );

  const response = await fetch(PIPEDRIVE_TOKEN_URL, {
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
    throw new Error(PIPEDRIVE_ERRORS.TOKEN_EXCHANGE_FAILED);
  }

  return response.json() as Promise<PipedriveTokenResponse>;
}

/**
 * Refresh access token using refresh token
 *
 * @param refreshToken - Current refresh token
 * @returns New token response from Pipedrive
 */
export async function refreshAccessToken(refreshToken: string): Promise<PipedriveTokenResponse> {
  const config = getPipedriveConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    'base64'
  );

  const response = await fetch(PIPEDRIVE_TOKEN_URL, {
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
    throw new Error(PIPEDRIVE_ERRORS.TOKEN_REFRESH_FAILED);
  }

  return response.json() as Promise<PipedriveTokenResponse>;
}

/**
 * Revoke a token at Pipedrive
 *
 * @param token - Access or refresh token to revoke
 * @returns True if revocation succeeded
 */
export async function revokeToken(token: string): Promise<boolean> {
  const config = getPipedriveConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
    'base64'
  );

  try {
    const response = await fetch(PIPEDRIVE_REVOKE_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ token }),
    });

    return response.ok;
  } catch (error) {
    console.error('Token revocation failed:', error);
    return false;
  }
}

// ============================================
// USER INFO
// ============================================

/**
 * Fetch current user info from Pipedrive API
 *
 * @param accessToken - Valid access token
 * @param apiDomain - API domain from token response
 * @returns User info
 */
export async function fetchUserInfo(
  accessToken: string,
  apiDomain: string
): Promise<PipedriveUser> {
  const url = `${apiDomain}/v1/users/me`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('User info fetch failed:', response.status, errorBody);
    throw new Error(PIPEDRIVE_ERRORS.USER_INFO_FAILED);
  }

  const data = await response.json();
  return data.data as PipedriveUser;
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
