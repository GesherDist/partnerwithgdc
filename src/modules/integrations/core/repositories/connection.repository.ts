/**
 * Integration Connection Repository
 *
 * Database operations for integration connections.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  IntegrationConnectionRow,
  IntegrationConnectionInsert,
  IntegrationConnectionUpdate,
  IntegrationProvider,
  ConnectionStatus,
} from '../types';

const TABLE_NAME = 'integration_connections';

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get all connections for an organization
 */
export async function getConnections(
  organizationId?: string | null
): Promise<IntegrationConnectionRow[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .is('deleted_at', null);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get connections:', error);
    throw error;
  }

  return data as IntegrationConnectionRow[];
}

/**
 * Get connection by ID
 */
export async function getConnectionById(id: string): Promise<IntegrationConnectionRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get connection by ID:', error);
    throw error;
  }

  return data as IntegrationConnectionRow;
}

/**
 * Get connection by integration ID (for single-tenant)
 */
export async function getConnectionByIntegrationId(
  integrationId: string,
  organizationId?: string | null
): Promise<IntegrationConnectionRow | null> {
  const supabase = createAdminClient();

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('integration_id', integrationId)
    .is('deleted_at', null);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.limit(1).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get connection by integration ID:', error);
    throw error;
  }

  return data as IntegrationConnectionRow;
}

/**
 * Get connection by provider (convenience method)
 */
export async function getConnectionByProvider(
  provider: IntegrationProvider,
  organizationId?: string | null
): Promise<IntegrationConnectionRow | null> {
  const supabase = createAdminClient();

  let query = supabase
    .from(TABLE_NAME)
    .select(`
      *,
      integrations!inner(provider)
    `)
    .eq('integrations.provider', provider)
    .is('deleted_at', null);

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.limit(1).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get connection by provider:', error);
    throw error;
  }

  return data as IntegrationConnectionRow;
}

/**
 * Get connection by external account ID
 */
export async function getConnectionByExternalAccountId(
  integrationId: string,
  externalAccountId: string
): Promise<IntegrationConnectionRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('integration_id', integrationId)
    .eq('external_account_id', externalAccountId)
    .is('deleted_at', null)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get connection by external account ID:', error);
    throw error;
  }

  return data as IntegrationConnectionRow;
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Create a new connection
 */
export async function createConnection(
  connection: IntegrationConnectionInsert
): Promise<IntegrationConnectionRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      ...connection,
      connected_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create connection:', error);
    throw error;
  }

  return data as IntegrationConnectionRow;
}

/**
 * Upsert connection (create or replace)
 *
 * For single-connection-per-integration model, this deletes existing
 * connections for the same integration/organization before creating new.
 */
export async function upsertConnection(
  connection: IntegrationConnectionInsert
): Promise<IntegrationConnectionRow> {
  const supabase = createAdminClient();

  // Soft delete any existing connections for this integration/organization
  let deleteQuery = supabase
    .from(TABLE_NAME)
    .update({ deleted_at: new Date().toISOString() })
    .eq('integration_id', connection.integration_id)
    .is('deleted_at', null);

  if (connection.organization_id) {
    deleteQuery = deleteQuery.eq('organization_id', connection.organization_id);
  } else {
    deleteQuery = deleteQuery.is('organization_id', null);
  }

  await deleteQuery;

  // Create new connection
  return createConnection(connection);
}

/**
 * Update an existing connection
 */
export async function updateConnection(
  id: string,
  updates: IntegrationConnectionUpdate
): Promise<IntegrationConnectionRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    console.error('Failed to update connection:', error);
    throw error;
  }

  return data as IntegrationConnectionRow;
}

/**
 * Update connection status
 */
export async function updateConnectionStatus(
  id: string,
  status: ConnectionStatus,
  errorMessage?: string
): Promise<IntegrationConnectionRow> {
  return updateConnection(id, {
    status,
    error_message: errorMessage ?? null,
  });
}

/**
 * Update connection tokens
 */
export async function updateConnectionTokens(
  id: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: string
): Promise<IntegrationConnectionRow> {
  return updateConnection(id, {
    access_token: accessToken,
    refresh_token: refreshToken ?? undefined,
    token_expires_at: expiresAt,
    status: 'connected',
    error_message: null,
  });
}

/**
 * Update last sync timestamp
 */
export async function updateLastSyncAt(id: string): Promise<IntegrationConnectionRow> {
  return updateConnection(id, {
    last_sync_at: new Date().toISOString(),
  });
}

/**
 * Soft delete a connection
 */
export async function deleteConnection(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from(TABLE_NAME)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Failed to delete connection:', error);
    throw error;
  }
}

/**
 * Hard delete a connection (for disconnection with data removal)
 */
export async function hardDeleteConnection(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);

  if (error) {
    console.error('Failed to hard delete connection:', error);
    throw error;
  }
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Check if a connection exists and is connected
 */
export async function isConnected(
  integrationId: string,
  organizationId?: string | null
): Promise<boolean> {
  const connection = await getConnectionByIntegrationId(integrationId, organizationId);
  return connection !== null && connection.status === 'connected';
}

/**
 * Get connections that need token refresh
 */
export async function getConnectionsNeedingRefresh(
  bufferMinutes: number = 5
): Promise<IntegrationConnectionRow[]> {
  const supabase = createAdminClient();

  const threshold = new Date();
  threshold.setMinutes(threshold.getMinutes() + bufferMinutes);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('status', 'connected')
    .is('deleted_at', null)
    .not('token_expires_at', 'is', null)
    .lte('token_expires_at', threshold.toISOString());

  if (error) {
    console.error('Failed to get connections needing refresh:', error);
    throw error;
  }

  return data as IntegrationConnectionRow[];
}

/**
 * Get connections with errors
 */
export async function getConnectionsWithErrors(): Promise<IntegrationConnectionRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('status', 'error')
    .is('deleted_at', null);

  if (error) {
    console.error('Failed to get connections with errors:', error);
    throw error;
  }

  return data as IntegrationConnectionRow[];
}
