/**
 * QuickBooks Connection Repository
 *
 * Database operations for QuickBooks connections.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  QuickBooksConnectionRow,
  QuickBooksConnectionInsert,
  QuickBooksConnectionUpdate,
} from '../types';

const TABLE_NAME = 'quickbooks_connections';

/**
 * Get the current QuickBooks connection (if any)
 *
 * Since we only support one connection per application,
 * this returns the first (and only) row.
 */
export async function getConnection(): Promise<QuickBooksConnectionRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .limit(1)
    .single();

  if (error) {
    // PGRST116 = no rows found, which is not an error
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get QuickBooks connection:', error);
    throw error;
  }

  return data as QuickBooksConnectionRow;
}

/**
 * Get connection by realm ID
 */
export async function getConnectionByRealmId(
  realmId: string
): Promise<QuickBooksConnectionRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('realm_id', realmId)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get QuickBooks connection by realmId:', error);
    throw error;
  }

  return data as QuickBooksConnectionRow;
}

/**
 * Create or update a QuickBooks connection
 *
 * Uses upsert to handle both new connections and reconnections.
 */
export async function upsertConnection(
  connection: QuickBooksConnectionInsert
): Promise<QuickBooksConnectionRow> {
  const supabase = createAdminClient();

  // First, delete any existing connections (single connection model)
  await supabase.from(TABLE_NAME).delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // Insert the new connection
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(connection)
    .select()
    .single();

  if (error) {
    console.error('Failed to upsert QuickBooks connection:', error);
    throw error;
  }

  return data as QuickBooksConnectionRow;
}

/**
 * Update an existing connection
 */
export async function updateConnection(
  id: string,
  updates: QuickBooksConnectionUpdate
): Promise<QuickBooksConnectionRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update QuickBooks connection:', error);
    throw error;
  }

  return data as QuickBooksConnectionRow;
}

/**
 * Update connection status
 */
export async function updateConnectionStatus(
  id: string,
  status: 'connected' | 'disconnected' | 'error',
  errorMessage?: string
): Promise<QuickBooksConnectionRow> {
  return updateConnection(id, {
    status,
    error_message: errorMessage ?? null,
  });
}

/**
 * Update tokens (after refresh)
 */
export async function updateTokens(
  id: string,
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string,
  tokenExpiresAt: string
): Promise<QuickBooksConnectionRow> {
  return updateConnection(id, {
    access_token_encrypted: accessTokenEncrypted,
    refresh_token_encrypted: refreshTokenEncrypted,
    token_expires_at: tokenExpiresAt,
    status: 'connected',
    error_message: null,
  });
}

/**
 * Disconnect (soft delete - mark as disconnected and clear tokens)
 */
export async function disconnectConnection(id: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to disconnect QuickBooks:', error);
    throw error;
  }
}

/**
 * Check if a connection exists
 */
export async function hasConnection(): Promise<boolean> {
  const connection = await getConnection();
  return connection !== null && connection.status === 'connected';
}
