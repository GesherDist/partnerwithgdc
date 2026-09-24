/**
 * Integration Framework Core
 *
 * Public exports for the enterprise integration system.
 */

// ============================================
// TYPES
// ============================================

export type {
  // Enums
  IntegrationProvider,
  IntegrationType,
  IntegrationStatus,
  ConnectionStatus,
  SyncDirection,
  SyncStatus,
  // Database Row Types
  IntegrationRow,
  IntegrationConnectionRow,
  IntegrationSyncLogRow,
  // Insert/Update Types
  IntegrationConnectionInsert,
  IntegrationConnectionUpdate,
  IntegrationSyncLogInsert,
  IntegrationSyncLogUpdate,
  // API Types
  ConnectionStatusResponse,
  AvailableIntegration,
  OAuthInitiation,
  OAuthCallbackParams,
  OAuthTokenResponse,
  // Sync Types
  SyncResult,
  SyncError,
  SyncOptions,
} from './types';

// ============================================
// PROVIDERS
// ============================================

export type {
  // Base Provider
  BaseProviderConfig,
  ProviderMetadata,
  IBaseProvider,
  ISyncableProvider,
  // Accounting Provider
  IAccountingProvider,
  AccountingCustomer,
  AccountingInvoice,
  AccountingLineItem,
  AccountingPayment,
  AccountingProduct,
  AccountingAddress,
  AccountingCompanyInfo,
  CustomerSyncResult,
  InvoiceSyncResult,
  PaymentSyncResult,
  // CRM Provider
  ICrmProvider,
  CrmContact,
  CrmOrganization,
  CrmDeal,
  CrmActivity,
  CrmPipeline,
  CrmPipelineStage,
  CrmNote,
  CrmAddress,
  ContactSyncResult,
  OrganizationSyncResult,
  DealSyncResult,
  // Tracking Provider
  ITrackingProvider,
  Shipment,
  ShipmentStatus,
  ShipmentAddress,
  ShipmentWeight,
  ShipmentDimensions,
  ShipmentPackage,
  TrackingEvent,
  TrackingInfo,
  ShippingRate,
  RateRequest,
  LabelOptions,
  Carrier,
  CarrierService,
} from './providers';

// ============================================
// ENCRYPTION
// ============================================

export {
  encrypt,
  decrypt,
  generateEncryptionKey,
  ENCRYPTION_ERRORS,
} from './lib/encryption';

// ============================================
// REPOSITORIES
// ============================================

export {
  // Integration Repository
  getIntegrations,
  getActiveIntegrations,
  getIntegrationByProvider,
  getIntegrationById,
  getIntegrationsByType,
  // Connection Repository
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
  // Sync Log Repository
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
} from './repositories';
