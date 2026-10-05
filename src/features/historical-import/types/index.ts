/**
 * HISTORICAL IMPORT - TYPE DEFINITIONS
 * =====================================
 * Type definitions for the historical data import wizard
 */

// ============================================================================
// IMPORT WIZARD STEPS
// ============================================================================

export type ImportWizardStep =
  | 'upload'
  | 'review-data'
  | 'preview-quote'
  | 'preview-so'
  | 'preview-fulfillment'
  | 'complete';

// ============================================================================
// RAW EXCEL DATA
// ============================================================================

export interface RawExcelRow {
  // Row metadata
  rowIndex: number;
  sheetName: string;
  orderSeries: string;

  // Order info
  loadNumber: string;
  customer: string;
  customerPO: string;

  // Quantities
  qty38: number;
  qty24: number;
  totalQty: number;

  // Prices (dollars)
  price38: number;
  price24: number;

  // Delivery
  deliveryAddress: string;

  // Dates (ISO format)
  etaPort: string | null;
  confirmedEta: string | null;
  customerDueDate: string | null;
  actualDelivery: string | null;

  // Status
  status: string;

  // Tracking
  containerNumbers: string | null;

  // Validation
  isValid: boolean;
  validationErrors: string[];
  validationWarnings: string[];

  // Customer validation
  customerExists: boolean;
  customerId: string | null;
  isInternalCustomer: boolean;
}

// ============================================================================
// VALIDATION RESULT
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  rowIndex: number;
  loadNumber: string;
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  rowIndex: number;
  loadNumber: string;
  field: string;
  message: string;
  severity: 'warning';
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  customersFound: number;
  customersMissing: number;
  internalCustomers: number;
}

// ============================================================================
// QUOTE PREVIEW
// ============================================================================

export interface QuotePreview {
  // Header
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerPO: string;
  deliveryAddress: string;
  quoteDate: string;
  validUntil: string | null;
  status: string;
  terms: string;
  notes: string;

  // Items
  items: QuoteItemPreview[];

  // Totals (cents)
  subtotal: number;
  taxTotal: number;
  grandTotal: number;

  // Source
  sourceRow: number;
  loadNumber: string;
}

export interface QuoteItemPreview {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number; // cents
  lineTotal: number; // cents
}

// ============================================================================
// SALES ORDER PREVIEW
// ============================================================================

export interface SalesOrderPreview {
  // Header
  orderNumber: string;
  customerId: string;
  customerName: string;
  quoteId: string | null;
  customerPO: string; // Fixed: uppercase PO to match generator
  orderSeries: string; // GDC 1, GDC 2, etc.
  status: string;

  // Dates
  orderDate: string; // SO order date (from quote date)

  // Delivery
  shippingAddress: string; // Fixed: shippingAddress to match generator
  shippingMethod: string;
  expectedDeliveryDate: string | null; // Customer expected delivery date

  // Items
  items: SalesOrderItemPreview[];

  // Totals (cents)
  subtotal: number;
  taxTotal: number;
  grandTotal: number;

  // Notes
  notes: string;

  // Source
  sourceRow: number;
  loadNumber: string;
}

export interface SalesOrderItemPreview {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number; // cents
  lineTotal: number; // cents
  taxRate: number; // percentage (0-100)
  customerQty: number; // customer's actual order quantity (same as quantity for historical import)
  fulfillmentSource: 'manufacturer' | 'gdc_inventory' | 'platinum_dealer_inventory' | 'platinum_dealer_fulfillment'; // Historical import = 'manufacturer'
}

// ============================================================================
// PURCHASE ORDER PREVIEW
// ============================================================================

export interface PurchaseOrderPreview {
  // Header
  poNumber: string;
  salesOrderId: string | null;
  salesOrderNumber: string;
  vendorId: string;
  vendorName: string;
  status: string;
  orderSeries?: string; // GDC 1, GDC 2, etc.

  // Items
  items: PurchaseOrderItemPreview[];

  // Dates
  orderDate: string;
  expectedDeliveryDate: string | null;

  // Totals (cents)
  subtotal: number;
  taxTotal: number;
  grandTotal: number;

  // Notes
  notes: string;

  // Source
  sourceRow: number;
  loadNumber: string;
}

export interface PurchaseOrderItemPreview {
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number; // cents
  lineTotal: number; // cents
  vendorId: string; // Supplier ID (Galileo) - item-level supplier assignment
  vendorName: string; // Supplier name (denormalized)
}

// ============================================================================
// PICK TICKET PREVIEW
// ============================================================================

export interface PickTicketPreview {
  // Header
  salesOrderId: string | null;
  salesOrderNumber: string;
  ticketNumber?: string;  // Pick ticket number (optional for preview)
  locationId: string;
  locationName: string;
  status: string;

  // Items
  items: PickTicketItemPreview[];

  // Notes
  notes: string;

  // Source
  sourceRow: number;
  loadNumber: string;
}

export interface PickTicketItemPreview {
  productId: string;
  productName: string;
  productSku: string;
  quantityToPick: number;
  quantityPicked?: number;
}

// ============================================================================
// SHIPMENT PREVIEW
// ============================================================================

export interface ShipmentPreview {
  // Header
  salesOrderId: string | null;
  salesOrderNumber: string;
  purchaseOrderId: string | null;
  purchaseOrderNumber: string | null;
  status: string;
  source: 'supplier' | 'warehouse';

  // Vendor/Supplier (if applicable)
  vendorId: string | null; // Changed from supplierId to match generator
  vendorName: string | null; // Changed from supplierName to match generator

  // Tracking
  trackingNumber: string | null;
  containerNumbers: string | null;

  // Delivery
  deliveryAddress: string;

  // Dates
  shippedDate: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;

  // Notes
  notes: string;

  // Source
  sourceRow: number;
  loadNumber: string;
}

// ============================================================================
// IMPORT RESULT
// ============================================================================

export interface ImportResult {
  success: boolean;
  errors: string[];
  stats: {
    quotesCreated: number;
    quotesUpdated: number;
    salesOrdersCreated: number;
    salesOrdersUpdated: number;
    purchaseOrdersCreated: number;
    pickTicketsCreated: number;
    shipmentsCreated: number;
  };
}

// Legacy error type (keeping for compatibility)
export interface ImportError {
  rowIndex: number;
  loadNumber: string;
  step: string;
  message: string;
}

// ============================================================================
// WIZARD STATE
// ============================================================================

export interface ImportWizardState {
  // Current step
  currentStep: ImportWizardStep;

  // File info
  fileName: string | null;
  fileSize: number | null;

  // Parsed data
  rawRows: RawExcelRow[];
  validation: ValidationResult | null;

  // Previews
  quotePreviews: QuotePreview[];
  soPreviews: SalesOrderPreview[];
  poPreviews: PurchaseOrderPreview[];
  pickTicketPreviews: PickTicketPreview[];
  shipmentPreviews: ShipmentPreview[];

  // Import result
  result: ImportResult | null;

  // UI state
  isProcessing: boolean;
  error: string | null;
}
