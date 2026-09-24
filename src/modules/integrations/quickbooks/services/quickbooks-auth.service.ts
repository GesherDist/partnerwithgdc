/**
 * QuickBooks Auth Service
 *
 * Business logic for OAuth connection flow.
 */

import { encrypt, decrypt } from '../lib/encryption';
import {
  getQuickBooksConfig,
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  fetchCompanyInfo,
  revokeToken,
  calculateTokenExpiry,
} from '../lib/oauth';
import {
  getConnection,
  upsertConnection,
  disconnectConnection,
} from '../repositories/quickbooks-connection.repository';
import type {
  QuickBooksStatusResponse,
  QuickBooksConnectionRow,
  QuickBooksEnvironment,
} from '../types';

// ============================================
// AUTHORIZATION
// ============================================

/**
 * Initiate OAuth flow
 *
 * @returns Object containing state token and authorization URL
 */
export function initiateOAuth(): { state: string; authorizationUrl: string } {
  const state = generateState();
  const authorizationUrl = buildAuthorizationUrl(state);

  return { state, authorizationUrl };
}

// ============================================
// CALLBACK HANDLING
// ============================================

/**
 * Handle OAuth callback
 *
 * Exchanges code for tokens, fetches company info, and stores connection.
 *
 * @param code - Authorization code from Intuit
 * @param realmId - QuickBooks company ID
 * @param userId - ID of user who initiated the connection
 */
export async function handleOAuthCallback(
  code: string,
  realmId: string,
  userId?: string
): Promise<QuickBooksConnectionRow> {
  const config = getQuickBooksConfig();

  // Exchange code for tokens
  const tokenResponse = await exchangeCodeForTokens(code);

  // Fetch company info
  const companyInfo = await fetchCompanyInfo(
    tokenResponse.access_token,
    realmId,
    config.environment
  );

  // Encrypt tokens
  const accessTokenEncrypted = encrypt(tokenResponse.access_token);
  const refreshTokenEncrypted = encrypt(tokenResponse.refresh_token);

  // Calculate expiration
  const tokenExpiresAt = calculateTokenExpiry(tokenResponse.expires_in);

  // Store connection
  const connection = await upsertConnection({
    realm_id: realmId,
    company_name: companyInfo.CompanyInfo.CompanyName,
    access_token_encrypted: accessTokenEncrypted,
    refresh_token_encrypted: refreshTokenEncrypted,
    token_expires_at: tokenExpiresAt,
    environment: config.environment,
    status: 'connected',
    connected_by: userId,
  });

  return connection;
}

// ============================================
// DISCONNECTION
// ============================================

/**
 * Disconnect QuickBooks integration
 *
 * Revokes token at Intuit (best effort) and removes connection.
 */
export async function disconnect(): Promise<void> {
  const connection = await getConnection();

  if (!connection) {
    return; // Nothing to disconnect
  }

  // Try to revoke token at Intuit (best effort, don't fail if this fails)
  try {
    const refreshToken = decrypt(connection.refresh_token_encrypted);
    await revokeToken(refreshToken);
  } catch (error) {
    console.warn('Token revocation failed, continuing with disconnect:', error);
  }

  // Remove connection from database
  await disconnectConnection(connection.id);
}

// ============================================
// STATUS
// ============================================

/**
 * Get current connection status for UI
 */
export async function getConnectionStatus(): Promise<QuickBooksStatusResponse> {
  const connection = await getConnection();

  if (!connection) {
    return { connected: false };
  }

  return {
    connected: connection.status === 'connected',
    companyName: connection.company_name,
    realmId: connection.realm_id,
    environment: connection.environment as QuickBooksEnvironment,
    connectedAt: connection.connected_at,
    tokenExpiresAt: connection.token_expires_at,
    status: connection.status,
    errorMessage: connection.error_message ?? undefined,
  };
}

// ============================================
// TOKEN ACCESS (for future API calls)
// ============================================

/**
 * Get decrypted access token for making API calls
 *
 * This should only be used when actually calling QuickBooks API.
 */
export async function getAccessToken(): Promise<{
  accessToken: string;
  realmId: string;
  environment: QuickBooksEnvironment;
} | null> {
  const connection = await getConnection();

  if (!connection || connection.status !== 'connected') {
    return null;
  }

  // Check if token is expired
  const expiresAt = new Date(connection.token_expires_at);
  if (expiresAt <= new Date()) {
    // Token is expired, would need to refresh
    // For now, return null - token refresh can be implemented later
    return null;
  }

  const accessToken = decrypt(connection.access_token_encrypted);

  return {
    accessToken,
    realmId: connection.realm_id,
    environment: connection.environment as QuickBooksEnvironment,
  };
}
