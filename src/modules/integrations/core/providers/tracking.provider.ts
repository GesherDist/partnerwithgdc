/**
 * Tracking Provider Interface
 *
 * Interface for shipping and tracking integrations like ShipStation, EasyPost, etc.
 */

import type { IBaseProvider, ISyncableProvider } from './base.provider';

// ============================================
// TRACKING ENTITY TYPES
// ============================================

/**
 * Shipment data
 */
export interface Shipment {
  id?: string;
  externalId?: string;
  orderId?: string;
  orderExternalId?: string;
  trackingNumber?: string;
  carrier?: string;
  service?: string;
  status?: ShipmentStatus;
  shipDate?: string;
  deliveryDate?: string;
  estimatedDeliveryDate?: string;
  weight?: ShipmentWeight;
  dimensions?: ShipmentDimensions;
  fromAddress: ShipmentAddress;
  toAddress: ShipmentAddress;
  packages?: ShipmentPackage[];
  labelUrl?: string;
  cost?: number;
  currency?: string;
  insuredValue?: number;
  signatureRequired?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Shipment status
 */
export type ShipmentStatus =
  | 'pending'
  | 'label_created'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'returned'
  | 'failed'
  | 'cancelled';

/**
 * Shipment address
 */
export interface ShipmentAddress {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
  residential?: boolean;
}

/**
 * Shipment weight
 */
export interface ShipmentWeight {
  value: number;
  unit: 'oz' | 'lb' | 'g' | 'kg';
}

/**
 * Shipment dimensions
 */
export interface ShipmentDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'in' | 'cm';
}

/**
 * Shipment package
 */
export interface ShipmentPackage {
  id?: string;
  weight?: ShipmentWeight;
  dimensions?: ShipmentDimensions;
  trackingNumber?: string;
  labelUrl?: string;
}

/**
 * Tracking event
 */
export interface TrackingEvent {
  timestamp: string;
  status: string;
  statusDetail?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

/**
 * Tracking info
 */
export interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: ShipmentStatus;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  events: TrackingEvent[];
  signedBy?: string;
}

/**
 * Shipping rate
 */
export interface ShippingRate {
  carrier: string;
  service: string;
  rate: number;
  currency: string;
  estimatedDays?: number;
  deliveryDate?: string;
  deliveryDays?: number;
  deliveryDateGuaranteed?: boolean;
}

/**
 * Rate request
 */
export interface RateRequest {
  fromAddress: ShipmentAddress;
  toAddress: ShipmentAddress;
  weight: ShipmentWeight;
  dimensions?: ShipmentDimensions;
  packageType?: string;
  insuredValue?: number;
  signatureRequired?: boolean;
}

/**
 * Label options
 */
export interface LabelOptions {
  format?: 'pdf' | 'png' | 'zpl';
  size?: '4x6' | '4x8' | '8.5x11';
  resolution?: number;
}

// ============================================
// TRACKING PROVIDER INTERFACE
// ============================================

/**
 * Interface for tracking/shipping providers (ShipStation, EasyPost, etc.)
 */
export interface ITrackingProvider extends IBaseProvider, ISyncableProvider {
  // ============================================
  // RATES
  // ============================================

  /**
   * Get shipping rates for a shipment
   */
  getRates(connectionId: string, request: RateRequest): Promise<ShippingRate[]>;

  /**
   * Get rate for a specific carrier and service
   */
  getRate(
    connectionId: string,
    request: RateRequest,
    carrier: string,
    service: string
  ): Promise<ShippingRate | null>;

  // ============================================
  // SHIPMENTS
  // ============================================

  /**
   * Get all shipments
   */
  getShipments(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number; status?: ShipmentStatus }
  ): Promise<Shipment[]>;

  /**
   * Get a single shipment by external ID
   */
  getShipment(connectionId: string, externalId: string): Promise<Shipment | null>;

  /**
   * Get shipment by tracking number
   */
  getShipmentByTrackingNumber(
    connectionId: string,
    trackingNumber: string
  ): Promise<Shipment | null>;

  /**
   * Create a shipment
   */
  createShipment(connectionId: string, shipment: Shipment): Promise<Shipment>;

  /**
   * Update a shipment
   */
  updateShipment(
    connectionId: string,
    externalId: string,
    shipment: Partial<Shipment>
  ): Promise<Shipment>;

  /**
   * Cancel a shipment
   */
  cancelShipment(connectionId: string, externalId: string): Promise<void>;

  // ============================================
  // LABELS
  // ============================================

  /**
   * Purchase/create a shipping label
   */
  purchaseLabel(
    connectionId: string,
    shipment: Shipment,
    rate: ShippingRate,
    options?: LabelOptions
  ): Promise<Shipment>;

  /**
   * Get label for a shipment
   */
  getLabel(
    connectionId: string,
    shipmentExternalId: string,
    options?: LabelOptions
  ): Promise<string>; // Returns URL or base64

  /**
   * Void/refund a label
   */
  voidLabel(connectionId: string, shipmentExternalId: string): Promise<void>;

  // ============================================
  // TRACKING
  // ============================================

  /**
   * Get tracking info for a shipment
   */
  getTracking(connectionId: string, trackingNumber: string, carrier?: string): Promise<TrackingInfo>;

  /**
   * Subscribe to tracking updates (webhook)
   */
  subscribeToTracking?(
    connectionId: string,
    trackingNumber: string,
    carrier: string,
    webhookUrl: string
  ): Promise<void>;

  /**
   * Unsubscribe from tracking updates
   */
  unsubscribeFromTracking?(
    connectionId: string,
    trackingNumber: string,
    carrier: string
  ): Promise<void>;

  // ============================================
  // CARRIERS
  // ============================================

  /**
   * Get available carriers
   */
  getCarriers(connectionId: string): Promise<Carrier[]>;

  /**
   * Get carrier services
   */
  getCarrierServices(connectionId: string, carrier: string): Promise<CarrierService[]>;
}

/**
 * Carrier info
 */
export interface Carrier {
  id: string;
  code: string;
  name: string;
  connected?: boolean;
  accountNumber?: string;
}

/**
 * Carrier service
 */
export interface CarrierService {
  id: string;
  code: string;
  name: string;
  carrier: string;
  domestic?: boolean;
  international?: boolean;
}
