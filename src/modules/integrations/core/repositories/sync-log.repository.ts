/**
 * Integration Sync Log Repository
 *
 * Database operations for sync logging.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  IntegrationSyncLogRow,
  IntegrationSyncLogInsert,
  IntegrationSyncLogUpdate,
  SyncStatus,
  SyncDirection,
} from '../types';

const TABLE_NAME = 'integration_sync_logs';

// ============================================
// READ OPERATIONS
// ============================================

/**
 * Get sync logs for a connection
 */
export async function getSyncLogs(
  connectionId: string,
  options?: {
    entityType?: string;
    status?: SyncStatus;
    direction?: SyncDirection;
    limit?: number;
    offset?: number;
  }
): Promise<IntegrationSyncLogRow[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('connection_id', connectionId);

  if (options?.entityType) {
    query = query.eq('entity_type', options.entityType);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.direction) {
    query = query.eq('direction', options.direction);
  }

  query = query.order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get sync logs:', error);
    throw error;
  }

  return data as IntegrationSyncLogRow[];
}

/**
 * Get sync log by ID
 */
export async function getSyncLogById(id: string): Promise<IntegrationSyncLogRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('id', id)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get sync log by ID:', error);
    throw error;
  }

  return data as IntegrationSyncLogRow;
}

/**
 * Get the most recent sync for a connection and entity type
 */
export async function getLastSync(
  connectionId: string,
  entityType: string,
  direction?: SyncDirection
): Promise<IntegrationSyncLogRow | null> {
  const supabase = createAdminClient();

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('connection_id', connectionId)
    .eq('entity_type', entityType)
    .eq('status', 'completed');

  if (direction) {
    query = query.eq('direction', direction);
  }

  const { data, error } = await query
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to get last sync:', error);
    throw error;
  }

  return data as IntegrationSyncLogRow;
}

/**
 * Get pending retries
 */
export async function getPendingRetries(): Promise<IntegrationSyncLogRow[]> {
  const supabase = createAdminClient();

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('status', 'failed')
    .lt('retry_count', supabase.rpc('get_max_retries_value')) // This would need a DB function
    .lte('next_retry_at', now)
    .order('next_retry_at');

  if (error) {
    console.error('Failed to get pending retries:', error);
    throw error;
  }

  return data as IntegrationSyncLogRow[];
}

/**
 * Get failed syncs (all retries exhausted)
 */
export async function getFailedSyncs(
  connectionId: string,
  limit?: number
): Promise<IntegrationSyncLogRow[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('connection_id', connectionId)
    .eq('status', 'failed')
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get failed syncs:', error);
    throw error;
  }

  return data as IntegrationSyncLogRow[];
}

// ============================================
// WRITE OPERATIONS
// ============================================

/**
 * Create a sync log entry
 */
export async function createSyncLog(
  log: IntegrationSyncLogInsert
): Promise<IntegrationSyncLogRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert({
      ...log,
      started_at: log.started_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create sync log:', error);
    throw error;
  }

  return data as IntegrationSyncLogRow;
}

/**
 * Update a sync log entry
 */
export async function updateSyncLog(
  id: string,
  updates: IntegrationSyncLogUpdate
): Promise<IntegrationSyncLogRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update sync log:', error);
    throw error;
  }

  return data as IntegrationSyncLogRow;
}

/**
 * Mark sync as completed
 */
export async function completeSyncLog(
  id: string,
  responseData?: Record<string, unknown>
): Promise<IntegrationSyncLogRow> {
  const startedLog = await getSyncLogById(id);
  const completedAt = new Date();
  const startedAt = startedLog?.started_at ? new Date(startedLog.started_at) : completedAt;
  const durationMs = completedAt.getTime() - startedAt.getTime();

  return updateSyncLog(id, {
    status: 'completed',
    response_data: responseData,
    completed_at: completedAt.toISOString(),
    duration_ms: durationMs,
  });
}

/**
 * Mark sync as failed
 */
export async function failSyncLog(
  id: string,
  errorMessage: string,
  errorCode?: string,
  shouldRetry: boolean = true
): Promise<IntegrationSyncLogRow> {
  const currentLog = await getSyncLogById(id);
  const retryCount = (currentLog?.retry_count || 0) + 1;
  const maxRetries = currentLog?.max_retries || 3;

  const updates: IntegrationSyncLogUpdate = {
    status: 'failed',
    error_message: errorMessage,
    error_code: errorCode,
    retry_count: retryCount,
    completed_at: new Date().toISOString(),
  };

  // Calculate next retry time with exponential backoff
  if (shouldRetry && retryCount < maxRetries) {
    const backoffMinutes = Math.pow(2, retryCount); // 2, 4, 8 minutes
    const nextRetry = new Date();
    nextRetry.setMinutes(nextRetry.getMinutes() + backoffMinutes);
    updates.next_retry_at = nextRetry.toISOString();
  }

  return updateSyncLog(id, updates);
}

/**
 * Mark sync as in progress
 */
export async function startSyncLog(id: string): Promise<IntegrationSyncLogRow> {
  return updateSyncLog(id, {
    status: 'in_progress',
  });
}

/**
 * Cancel a sync
 */
export async function cancelSyncLog(id: string): Promise<IntegrationSyncLogRow> {
  return updateSyncLog(id, {
    status: 'cancelled',
    completed_at: new Date().toISOString(),
  });
}

// ============================================
// CLEANUP
// ============================================

/**
 * Delete old sync logs
 */
export async function deleteOldSyncLogs(
  olderThanDays: number = 30
): Promise<number> {
  const supabase = createAdminClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select('id');

  if (error) {
    console.error('Failed to delete old sync logs:', error);
    throw error;
  }

  return data?.length || 0;
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get sync statistics for a connection
 */
export async function getSyncStats(
  connectionId: string,
  days: number = 7
): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  averageDurationMs: number;
}> {
  const supabase = createAdminClient();

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('status, duration_ms')
    .eq('connection_id', connectionId)
    .gte('created_at', sinceDate.toISOString());

  if (error) {
    console.error('Failed to get sync stats:', error);
    throw error;
  }

  const logs = data || [];
  const completed = logs.filter((l) => l.status === 'completed');
  const durations = completed
    .map((l) => l.duration_ms)
    .filter((d): d is number => d !== null);

  return {
    total: logs.length,
    completed: completed.length,
    failed: logs.filter((l) => l.status === 'failed').length,
    pending: logs.filter((l) => l.status === 'pending' || l.status === 'in_progress').length,
    averageDurationMs:
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
  };
}
