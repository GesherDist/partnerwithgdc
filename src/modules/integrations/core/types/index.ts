/**
 * Core Integration Framework Types
 *
 * Type definitions for the enterprise integration system.
 */

// ============================================
// DATABASE ENUMS (match migration)
// ============================================

export type IntegrationProvider =
  | 'quickbooks'
  | 'pipedrive'
  | 'monday'
  | 'xero'
  | 'hubspot'
  | 'salesforce'
  | 'shipstation'
  | 'easypost';

export type IntegrationType =
  | 'accounting'
  | 'crm'
  | 'project_management'
  | 'shipping'
  | 'tracking'
  | 'inventory'
  | 'payments';

export type IntegrationStatus = 'active' | 'inactive' | 'deprecated';

export type ConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'pending'
  | 'expired';

export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional';

export type SyncStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ============================================
// DATABASE ROW TYPES
// ============================================

/**
 * Integration row from database
 */
export interface IntegrationRow {
  id: string;
  provider: IntegrationProvider;
  type: IntegrationType;
  name: string;
  description: string | null;
  icon_url: string | null;
  documentation_url: string | null;
  status: IntegrationStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Integration connection row from database
 */
export interface IntegrationConnectionRow {
  id: string;
  integration_id: string;
  organization_id: string | null;
  external_account_id: string | null;
  external_account_name: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  environment: string;
  metadata: Record<string, unknown>;
  status: ConnectionStatus;
  error_message: string | null;
  last_sync_at: string | null;
  connected_by: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Integration sync log row from database
 */
export interface IntegrationSyncLogRow {
  id: string;
  connection_id: string;
  entity_type: string;
  entity_id: string | null;
  direction: SyncDirection;
  status: SyncStatus;
  request_data: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

// ============================================
// INSERT TYPES
// ============================================

/**
 * Data for creating a new connection
 */
export interface IntegrationConnectionInsert {
  integration_id: string;
  organization_id?: string | null;
  external_account_id?: string;
  external_account_name?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
  status?: ConnectionStatus;
  connected_by?: string;
}

/**
 * Data for updating a connection
 */
export interface IntegrationConnectionUpdate {
  external_account_id?: string;
  external_account_name?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
  status?: ConnectionStatus;
  error_message?: string | null;
  last_sync_at?: string;
}

/**
 * Data for creating a sync log entry
 */
export interface IntegrationSyncLogInsert {
  connection_id: string;
  entity_type: string;
  entity_id?: string;
  direction: SyncDirection;
  status?: SyncStatus;
  request_data?: Record<string, unknown>;
  response_data?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  started_at?: string;
}

/**
 * Data for updating a sync log entry
 */
export interface IntegrationSyncLogUpdate {
  status?: SyncStatus;
  response_data?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  retry_count?: number;
  next_retry_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

// ============================================
// API TYPES
// ============================================

/**
 * Connection status response for API
 */
export interface ConnectionStatusResponse {
  connected: boolean;
  provider: IntegrationProvider;
  accountId?: string;
  accountName?: string;
  environment?: string;
  connectedAt?: string;
  tokenExpiresAt?: string;
  status?: ConnectionStatus;
  errorMessage?: string;
  lastSyncAt?: string;
}

/**
 * Available integration info for UI
 */
export interface AvailableIntegration {
  id: string;
  provider: IntegrationProvider;
  type: IntegrationType;
  name: string;
  description?: string;
  iconUrl?: string;
  documentationUrl?: string;
  status: IntegrationStatus;
  connected: boolean;
  connectionStatus?: ConnectionStatus;
}

// ============================================
// OAUTH TYPES
// ============================================

/**
 * OAuth initiation result
 */
export interface OAuthInitiation {
  state: string;
  authorizationUrl: string;
}

/**
 * OAuth callback parameters
 */
export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
  [key: string]: string | undefined; // Provider-specific params
}

/**
 * OAuth token response (generic)
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  [key: string]: unknown; // Provider-specific fields
}

// ============================================
// SYNC TYPES
// ============================================

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean;
  entityType: string;
  entityId?: string;
  direction: SyncDirection;
  recordsProcessed?: number;
  recordsCreated?: number;
  recordsUpdated?: number;
  recordsFailed?: number;
  errors?: SyncError[];
  duration?: number;
}

/**
 * Sync error details
 */
export interface SyncError {
  code: string;
  message: string;
  entityId?: string;
  field?: string;
  details?: unknown;
}

/**
 * Sync options
 */
export interface SyncOptions {
  fullSync?: boolean; // Full sync vs incremental
  sinceDate?: Date; // For incremental syncs
  entityTypes?: string[]; // Specific entity types to sync
  batchSize?: number;
  dryRun?: boolean;
}
