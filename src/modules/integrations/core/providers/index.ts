/**
 * Provider Interfaces
 *
 * Export all provider interfaces.
 */

// Base Provider
export type {
  BaseProviderConfig,
  ProviderMetadata,
  IBaseProvider,
  ISyncableProvider,
} from './base.provider';

// Accounting Provider
export type {
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
} from './accounting.provider';

// CRM Provider
export type {
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
} from './crm.provider';

// Tracking Provider
export type {
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
} from './tracking.provider';
