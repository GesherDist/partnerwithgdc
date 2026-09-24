/**
 * Core Integration Repositories
 *
 * Export all repository functions.
 */

// Integration Repository
export {
  getIntegrations,
  getActiveIntegrations,
  getIntegrationByProvider,
  getIntegrationById,
  getIntegrationsByType,
} from './integration.repository';

// Connection Repository
export {
  getConnections,
  getConnectionById,
  getConnectionByIntegrationId,
  getConnectionByProvider,
  getConnectionByExternalAccountId,
  createConnection,
  upsertConnection,
  updateConnection,
  updateConnectionStatus,
  updateConnectionTokens,
  updateLastSyncAt,
  deleteConnection,
  hardDeleteConnection,
  isConnected,
  getConnectionsNeedingRefresh,
  getConnectionsWithErrors,
} from './connection.repository';

// Sync Log Repository
export {
  getSyncLogs,
  getSyncLogById,
  getLastSync,
  getPendingRetries,
  getFailedSyncs,
  createSyncLog,
  updateSyncLog,
  completeSyncLog,
  failSyncLog,
  startSyncLog,
  cancelSyncLog,
  deleteOldSyncLogs,
  getSyncStats,
} from './sync-log.repository';
