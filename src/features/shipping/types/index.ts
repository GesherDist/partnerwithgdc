/**
 * Shipping Types
 *
 * Types for shipping tracking AI agent - email extraction and status management.
 * Also includes CMA CGM API integration types.
 */

// Re-export CMA CGM types
export * from './cma-cgm.types';

// ============================================
// ENUMS (matching database enums)
// ============================================

/**
 * Shipment tracking status from emails
 */
export type ShipmentTrackingStatus =
  | 'booked'
  | 'container_picked'
  | 'loaded_on_vessel'
  | 'departed_origin'
  | 'in_transit'
  | 'arrived_port'
  | 'customs_clearance'
  | 'on_rail'
  | 'at_ramp'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';

/**
 * Types of issues detected from shipping emails
 */
export type ShipmentIssueType =
  | 'container_damaged'
  | 'transload_required'
  | 'customs_hold'
  | 'delayed'
  | 'lfd_approaching'
  | 'demurrage_risk'
  | 'address_change'
  | 'additional_charges';

// ============================================
// AI EXTRACTION TYPES
// ============================================

/**
 * Data extracted from shipping email by AI
 */
export interface ShippingEmailExtraction {
  // Container & Reference Numbers
  containerNumber: string | null;
  mblNumber: string | null;
  soNumber: string | null;
  vesselName: string | null;
  voyageNumber: string | null;

  // Dates
  etaPort: string | null; // YYYY-MM-DD
  etaRamp: string | null;
  lfdDate: string | null;
  deliveryDate: string | null;

  // Status
  detectedStatus: ShipmentTrackingStatus;
  statusDescription: string;
  currentLocation: string | null;

  // Issues
  hasIssue: boolean;
  issueType: ShipmentIssueType | null;
  issueDescription: string | null;

  // Transload
  isTransload: boolean;
  newContainerNumber: string | null;

  // Confidence
  confidence: number; // 0.0 to 1.0

  // Summary
  keyPoints: string[];
}

// ============================================
// DATABASE MODEL TYPES
// ============================================

/**
 * Shipping email database record
 */
export interface ShippingEmail {
  id: string;
  inbound_email_id: string;
  shipment_id: string | null;
  container_number: string | null;
  mbl_number: string | null;
  so_number: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  detected_status: ShipmentTrackingStatus | null;
  status_description: string | null;
  current_location: string | null;
  eta_port: string | null;
  eta_ramp: string | null;
  lfd_date: string | null;
  delivery_date: string | null;
  has_issue: boolean;
  issue_type: ShipmentIssueType | null;
  issue_description: string | null;
  is_transload: boolean;
  new_container_number: string | null;
  is_processed: boolean;
  processed_at: string | null;
  is_matched: boolean;
  extraction_confidence: number | null;
  raw_extraction: ShippingEmailExtraction | null;
  key_points: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Shipping email with inbound email data
 */
export interface ShippingEmailWithInbound extends ShippingEmail {
  inbound_emails: {
    id: string;
    subject: string;
    from_email: string;
    from_name: string | null;
    received_at: string;
  };
}

/**
 * Shipment status history record
 */
export interface ShipmentStatusHistory {
  id: string;
  shipment_id: string;
  status: ShipmentTrackingStatus;
  status_date: string;
  location: string | null;
  inbound_email_id: string | null;
  shipping_email_id: string | null;
  notes: string | null;
  raw_extract: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

// ============================================
// SERVICE TYPES
// ============================================

/**
 * Result of processing a shipping email
 */
export interface ProcessShippingEmailResult {
  success: boolean;
  shippingEmailId?: string;
  shipmentId?: string;
  matched: boolean;
  extraction?: ShippingEmailExtraction;
  error?: string;
  /** Reason why shipment update was skipped (e.g., low confidence) */
  skippedReason?: string;
}

/**
 * Shipment reference for matching
 */
export interface ShipmentReference {
  id: string;
  shipment_number: string;
  sales_order_id?: string | null;
  order_number?: string;
  customer_name?: string | null;
  customer_po_number?: string | null;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Generic action result
 */
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Shipping emails list response
 */
export interface ShippingEmailListResponse {
  data: ShippingEmailWithInbound[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}
