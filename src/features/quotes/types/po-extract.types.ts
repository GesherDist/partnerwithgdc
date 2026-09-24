/**
 * PO Extraction Types
 *
 * Types for Purchase Order PDF extraction using Claude AI Vision.
 */

// ============================================
// EXTRACTED DATA TYPES
// ============================================

/**
 * Line item extracted from PO
 */
export interface ExtractedLineItem {
  sku: string | null;
  vendorItemNo: string | null; // Vendor's item number (e.g., "290/85R38")
  tireSize: string | null; // Extracted tire size for matching
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/**
 * Ship-to address extracted from PO
 */
export interface ExtractedShipTo {
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * Customer info extracted from PO (billing address)
 */
export interface ExtractedCustomer {
  name: string | null;
  address: string | null; // Street address only
  city: string | null;
  state: string | null;
  zip: string | null;
}

/**
 * Complete extracted PO data from Claude AI
 */
export interface ExtractedPOData {
  confidence: number; // 0-100
  poNumber: string | null;
  poDate: string | null;
  customer: ExtractedCustomer;
  shipTo: ExtractedShipTo;
  lineItems: ExtractedLineItem[];
}

// ============================================
// MATCHED DATA TYPES
// ============================================

/**
 * Product match result from database
 */
export interface ProductMatch {
  productId: string | null;
  sku: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number; // cents (selling price)
  baseCost?: number | null; // cents (cost price)
  extractedUnitPrice: number; // from PO (dollars)
  matched: boolean;
  matchConfidence: number; // 0-100
}

/**
 * Customer match result from database
 */
export interface CustomerMatch {
  customerId: string | null;
  name: string;
  matched: boolean;
  matchConfidence: number; // 0-100
}

/**
 * Processed PO data ready for quote creation
 */
export interface ProcessedPOData {
  extraction: ExtractedPOData;
  customer: CustomerMatch;
  products: ProductMatch[];
  unmatchedCount: number;
  matchedCount: number;
  pdfFile?: File; // Original PDF file for upload
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

/**
 * PO extraction API response
 */
export interface POExtractionResponse {
  success: boolean;
  data?: ProcessedPOData;
  error?: string;
}

/**
 * PO upload API response
 */
export interface POUploadResponse {
  success: boolean;
  data?: {
    path: string;
    url: string;
  };
  error?: string;
}

// ============================================
// COMPONENT STATE TYPES
// ============================================

/**
 * Upload dialog state
 */
export type UploadDialogState =
  | 'idle'           // Initial state, no file selected
  | 'file-selected'  // File selected, ready to process
  | 'extracting'     // Sending to Claude AI for extraction
  | 'reviewing'      // Showing extracted data for review
  | 'creating'       // Creating quote from extracted data
  | 'error';         // Error state

/**
 * Product match edit state (for user corrections)
 */
export interface ProductMatchEdit {
  index: number;
  productId: string | null;
  quantity: number;
  unitPrice: number;
}
