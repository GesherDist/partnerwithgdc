/**
 * Email Parsing Types
 *
 * Type definitions for email parsing and processing system.
 */

// ============================================
// EMAIL CLASSIFICATION
// ============================================

export type EmailType = 'customer_po' | 'supplier_po' | 'freight_update' | 'unknown';

// ============================================
// PARSED CUSTOMER PO
// ============================================

export interface ParsedCustomerPO {
  // Customer Information
  customerName: string | null;
  customerEmail: string | null;
  contactPerson: string | null;

  // PO Information
  poNumber: string | null;
  poDate: string | null;
  requiredDate: string | null;

  // Items
  items: ParsedLineItem[];

  // Shipping
  shipTo: {
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  };

  // Totals
  subtotal: number | null;
  tax: number | null;
  total: number | null;

  // Notes
  notes: string | null;
  specialInstructions: string | null;

  // AI Confidence
  confidence: number; // 0.0 to 1.0
  extractionMethod: 'ai' | 'regex' | 'manual';
}

export interface ParsedLineItem {
  lineNumber: number;
  sku: string | null;
  productName: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  confidence: number; // Item-level confidence
}

// ============================================
// MATCHING RESULTS
// ============================================

export interface CustomerMatchResult {
  customerId: string | null;
  customerName: string;
  matchType: 'exact' | 'fuzzy' | 'not_found';
  confidence: number;
  suggestions?: Array<{
    id: string;
    name: string;
    similarity: number;
  }>;
}

export interface ProductMatchResult {
  productId: string | null;
  sku: string;
  productName: string | null;
  matchType: 'exact_sku' | 'fuzzy_sku' | 'exact_name' | 'fuzzy_name' | 'not_found';
  confidence: number;
  suggestions?: Array<{
    id: string;
    sku: string;
    name: string;
    similarity: number;
  }>;
}

export interface MatchingResults {
  customer: CustomerMatchResult;
  products: ProductMatchResult[];
  overallConfidence: number;
  hasIssues: boolean;
  issues: string[];
}

// ============================================
// PROCESSING RESULT
// ============================================

export interface CustomerPOProcessingResult {
  success: boolean;
  emailId: string;
  parsedData: ParsedCustomerPO | null;
  matchingResults: MatchingResults | null;
  quoteId: string | null;
  error?: string;
  shouldReview: boolean; // True if requires manual review
}

// ============================================
// PARSED SUPPLIER PO (Confirmation/Update)
// ============================================

export interface ParsedSupplierPO {
  // Supplier Information
  supplierName: string | null;
  supplierEmail: string | null;
  contactPerson: string | null;

  // PO Information (our PO that supplier is confirming)
  poNumber: string | null; // GDC-PO-12345
  confirmationDate: string | null;

  // Status
  confirmationStatus: 'confirmed' | 'rejected' | 'partial' | 'unknown' | null;
  productionStatus: 'not_started' | 'in_production' | 'ready_to_ship' | 'shipped' | null;
  progressPercentage: number | null; // 0-100

  // Items (for verification)
  items: ParsedSupplierLineItem[];

  // Dates
  expectedCompletionDate: string | null;
  expectedShipDate: string | null;
  actualShipDate: string | null;

  // Shipping Information
  containerNumber: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  mblNumber: string | null;

  // Ports & Dates
  portOfLoading: string | null;
  portOfDischarge: string | null;
  etd: string | null; // Expected Time of Departure
  eta: string | null; // Expected Time of Arrival

  // Totals (for verification)
  totalQuantity: number | null;
  totalAmount: number | null;

  // Notes
  notes: string | null;
  issuesOrConcerns: string | null;

  // AI Confidence
  confidence: number; // 0.0 to 1.0
  extractionMethod: 'ai' | 'regex' | 'manual';
}

export interface ParsedSupplierLineItem {
  lineNumber: number;
  sku: string | null;
  productName: string | null;
  description: string | null;
  orderedQuantity: number;
  confirmedQuantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  confidence: number;
}

// ============================================
// SUPPLIER MATCHING RESULTS
// ============================================

export interface SupplierMatchResult {
  supplierId: string | null;
  supplierName: string;
  matchType: 'exact' | 'fuzzy' | 'not_found';
  confidence: number;
  suggestions?: Array<{
    id: string;
    name: string;
    similarity: number;
  }>;
}

export interface POMatchResult {
  poId: string | null;
  poNumber: string;
  matchType: 'exact' | 'fuzzy' | 'not_found';
  confidence: number;
  existingStatus: string | null;
  suggestions?: Array<{
    id: string;
    poNumber: string;
    similarity: number;
  }>;
}

export interface SupplierPOMatchingResults {
  supplier: SupplierMatchResult;
  purchaseOrder: POMatchResult;
  products: ProductMatchResult[];
  overallConfidence: number;
  hasIssues: boolean;
  issues: string[];
}

// ============================================
// SUPPLIER PO PROCESSING RESULT
// ============================================

export interface SupplierPOProcessingResult {
  success: boolean;
  emailId: string;
  parsedData: ParsedSupplierPO | null;
  matchingResults: SupplierPOMatchingResults | null;
  purchaseOrderId: string | null;
  updated: boolean; // True if PO was updated
  error?: string;
  shouldReview: boolean; // True if requires manual review
}

// ============================================
// PARSED FREIGHT UPDATE (Generic Tracking)
// ============================================

export interface ParsedFreightUpdate {
  // Freight Forwarder Information
  forwarderName: string | null; // SEAIR, Flexport, DHL, etc.
  forwarderEmail: string | null;
  contactPerson: string | null;

  // Reference Numbers
  containerNumber: string | null;
  mblNumber: string | null; // Master Bill of Lading
  hblNumber: string | null; // House Bill of Lading
  bookingNumber: string | null;
  soNumber: string | null; // Sales Order reference
  poNumber: string | null; // Purchase Order reference

  // Vessel Information
  vesselName: string | null;
  voyageNumber: string | null;

  // Tracking Status
  currentStatus: string | null; // Free-text status from email
  trackingStatus:
    | 'booked'
    | 'picked_up'
    | 'at_origin_port'
    | 'loaded_on_vessel'
    | 'departed'
    | 'in_transit'
    | 'arrived_destination_port'
    | 'customs_clearance'
    | 'released'
    | 'on_rail'
    | 'at_ramp'
    | 'out_for_delivery'
    | 'delivered'
    | 'unknown'
    | null;
  currentLocation: string | null;
  statusDescription: string | null;

  // Dates
  etaOriginPort: string | null;
  etdOriginPort: string | null; // Expected Time of Departure
  etaDestinationPort: string | null;
  etdDestinationPort: string | null;
  etaFinalDestination: string | null;
  lfdDate: string | null; // Last Free Day
  actualArrivalDate: string | null;
  actualDeliveryDate: string | null;

  // Ports & Locations
  portOfLoading: string | null;
  portOfDischarge: string | null;
  finalDestination: string | null;

  // Issues & Alerts
  hasIssue: boolean;
  issueType: string | null;
  issueDescription: string | null;
  isDelayed: boolean;
  delayReason: string | null;

  // Additional Info
  cargoDescription: string | null;
  weight: string | null;
  volume: string | null;
  notes: string | null;

  // AI Confidence
  confidence: number; // 0.0 to 1.0
  extractionMethod: 'ai' | 'regex' | 'manual';
}

// ============================================
// FREIGHT UPDATE MATCHING RESULTS
// ============================================

export interface FreightUpdateMatchingResults {
  shipment: {
    shipmentId: string | null;
    containerNumber: string | null;
    soNumber: string | null;
    matchType: 'container' | 'mbl' | 'so' | 'po' | 'not_found';
    confidence: number;
  };
  overallConfidence: number;
  hasIssues: boolean;
  issues: string[];
}

// ============================================
// FREIGHT UPDATE PROCESSING RESULT
// ============================================

export interface FreightUpdateProcessingResult {
  success: boolean;
  emailId: string;
  parsedData: ParsedFreightUpdate | null;
  matchingResults: FreightUpdateMatchingResults | null;
  shipmentId: string | null;
  updated: boolean; // True if shipment was updated
  error?: string;
  shouldReview: boolean; // True if requires manual review
}
