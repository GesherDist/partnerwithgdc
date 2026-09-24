/**
 * Base Provider Interface
 *
 * All integration providers must implement this interface.
 */

import type {
  IntegrationProvider,
  IntegrationType,
  OAuthInitiation,
  OAuthCallbackParams,
  IntegrationConnectionRow,
  ConnectionStatusResponse,
  SyncResult,
  SyncOptions,
} from '../types';

/**
 * Base configuration for all providers
 */
export interface BaseProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment?: 'sandbox' | 'production';
  encryptionKey: string;
}

/**
 * Provider metadata
 */
export interface ProviderMetadata {
  provider: IntegrationProvider;
  type: IntegrationType;
  name: string;
  description: string;
  iconUrl?: string;
  documentationUrl?: string;
  scopes: string[];
  supportedEntities: string[];
}

/**
 * Base provider interface that all providers must implement
 */
export interface IBaseProvider {
  /**
   * Provider metadata
   */
  readonly metadata: ProviderMetadata;

  /**
   * Initialize OAuth flow
   */
  initiateOAuth(): OAuthInitiation;

  /**
   * Handle OAuth callback and create connection
   */
  handleOAuthCallback(
    params: OAuthCallbackParams,
    userId?: string
  ): Promise<IntegrationConnectionRow>;

  /**
   * Disconnect and revoke access
   */
  disconnect(connectionId: string): Promise<void>;

  /**
   * Get connection status
   */
  getConnectionStatus(connectionId?: string): Promise<ConnectionStatusResponse>;

  /**
   * Check if provider is connected
   */
  isConnected(connectionId?: string): Promise<boolean>;

  /**
   * Refresh access token if needed
   */
  refreshTokenIfNeeded(connectionId: string): Promise<void>;

  /**
   * Get decrypted access token for API calls
   */
  getAccessToken(connectionId: string): Promise<{
    accessToken: string;
    externalAccountId: string;
    environment: string;
  } | null>;
}

/**
 * Provider with sync capabilities
 */
export interface ISyncableProvider extends IBaseProvider {
  /**
   * Perform sync operation
   */
  sync(connectionId: string, options?: SyncOptions): Promise<SyncResult[]>;

  /**
   * Get sync status/history
   */
  getSyncHistory(connectionId: string, limit?: number): Promise<unknown[]>;
}
