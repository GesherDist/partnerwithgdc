/**
 * Operations Dashboard Types
 *
 * Type definitions for Jenny's operations dashboard.
 * Based on the Master Sheet spreadsheet structure.
 */

// ============================================
// KPI STATS TYPES
// ============================================

export interface OperationsStats {
  availableInventoryQty: number;
  availableLoads: number;
  availableInventoryValue: number;
  committedCustomerQty: number;
  inTransitNext7Days: number;
  openLoads: number;
  outstandingQty: number;
  invoiceAmount: number;
}

// ============================================
// SKU BREAKDOWN TYPES
// ============================================

export interface SKUBreakdown {
  sku: string;
  skuName: string;
  supplierOutstandingQty: number;
  gdcInventory: Record<string, number>; // { 'GDC 0': 100, 'GDC 1': 200, ... }
  combinedQty: number;
  shareOfCombined: number; // percentage
}

// ============================================
// CUSTOMER COMMITMENTS TYPES
// ============================================

export interface CustomerCommitment {
  id: string;
  customer: string;
  loads: number;
  outstandingQty: number;
  invoiceAmount: number;
  inTransitNext7Days: number;
  productSource?: 'direct' | 'warehouse';  // For filtering Shipment Overview
}

// ============================================
// SHIPMENT STATUS TYPES
// Based on Jenny's Master Sheet dropdown options
// ============================================

export type ShipmentStatus =
  // Common statuses
  | 'AVAILABLE'
  | 'OPEN'
  | 'HOLD'
  | 'IN_TRANSIT'
  | 'SOLD'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'CLOSED'
  // Invoice/Payment statuses
  | 'INVOICED'
  | 'NOT_INVOICED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'DISPUTED'
  // Other statuses
  | 'PO_NEEDED'
  | 'DELIVERED';

export interface ShipmentStatusMix {
  status: ShipmentStatus;
  loads: number;
  qty: number;
}

// ============================================
// IMMEDIATE ATTENTION TYPES
// ============================================

export interface ImmediateAttentionItem {
  id: string;
  loadNumber: string;
  customer: string;
  po: string;
  qty: number;
  etaPort: string | null;
  customerEtaDue: string | null;
  status: ShipmentStatus;
  actionRequired: string;
  isOverdue: boolean;
  isThisWeek: boolean;
  productSource?: 'direct' | 'warehouse';  // For filtering Shipment Overview
  // LFD (Last Free Day) Alert fields
  lfdDate?: string | null;        // Last Free Day - deadline before demurrage charges
  isLFDApproaching?: boolean;     // LFD within 3 days
  isLFDCritical?: boolean;        // LFD is today or tomorrow
  deliveryAddress?: string | null; // Delivery destination address
  // Delay Alert fields
  isDelayed?: boolean;            // Shipment is delayed (manual flag OR auto-detected from dates)
  delayReason?: string | null;    // Reason for delay (from Seaair email or manual entry)
}

// ============================================
// SHIPMENT ITEM DETAIL (for dynamic SKU display)
// ============================================

export interface ShipmentItemDetail {
  sku: string;
  productName?: string;  // Product name for display (optional, fetched from database)
  qty: number;
  unitPrice?: number;    // Price per unit for this product (in dollars)
}

// SKU info for column headers
export interface SKUColumnInfo {
  sku: string;
  productName: string;
}

// ============================================
// DYNAMIC SKU COLUMNS
// ============================================

export interface DynamicSKUColumns {
  uniqueSkus: SKUColumnInfo[];  // All unique SKUs with product names for column headers
}

// ============================================
// SHIPMENT SCHEDULE TYPES (Supplier)
// ============================================

export interface ShipmentScheduleItem {
  id: string;
  no: number;
  loadNumber: string;
  items: ShipmentItemDetail[];  // Includes qty and unitPrice per SKU
  totalQty: number;
  customer: string;
  po: string;
  etaToUsPort: string | null;
  deliveryAddress: string;
  confirmedEta: string | null;
  customerExpectedDelivery: string | null;
  actualDeliveryDate: string | null;
  qtyDelivered: number;
  outstandingQtyForPO: number;
  invoiceNumber: string | null;
  invoiceAmount: number;
  // Prices are dynamic per product via items[].unitPrice
  payment50PercentDate: string | null;
  remaining50DueDate: string | null;
  status: ShipmentStatus;
  actionRequired: string;
  ankurNotes: string;
}

// ============================================
// GDC1 INVENTORY TYPES
// ============================================

export interface GDC1InventoryItem {
  id: string;
  no: number;
  loadNumber: string;
  // SKU quantities
  sku290Qty: number;  // 290/85R38 CW Qty
  sku380Qty: number;  // 380/85R24 CW Qty
  items: ShipmentItemDetail[];
  totalQty: number;
  customer: string | null;
  po: string | null;
  etaToUsPort: string | null;
  deliveryAddress: string;
  confirmedEta: string | null;  // Confirmed ETA (shipping system)
  customerExpectedDelivery: string | null;
  actualDelivery: string | null;
  qtyDelivered: number;
  outstandingPoQty: number;
  invoiceNumber: string | null;
  invoiceAmount: number;
  // Prices are now dynamic per product via items[].unitPrice
  payment50PercentDate: string | null;
  remaining50DueDate: string | null;
  status: ShipmentStatus;
  actionRequired: string;
  ankurNotes: string;
}

// ============================================
// RIM INSTALLATION TYPES
// ============================================

export interface RimInstallationItem {
  id: string;
  gdc1No: number;
  loadNumber: string;
  items: { sku: string; productName: string; qty: number }[];  // Dynamic SKU items
  totalQty: number;
  status: ShipmentStatus;
  actionRequired: string;
  executiveNote: string;
}

// ============================================
// FULL OPERATIONS DATA
// ============================================

export interface OperationsData {
  stats: OperationsStats;
  skuBreakdown: SKUBreakdown[];
  customerCommitments: CustomerCommitment[];
  shipmentStatusMix: ShipmentStatusMix[];
  immediateAttention: ImmediateAttentionItem[];
  supplierShipmentSchedule: ShipmentScheduleItem[];
  supplierScheduleSkus: SKUColumnInfo[];  // Dynamic SKU column headers with product names
  gdc1Inventory: GDC1InventoryItem[];
  gdc1InventorySkus: SKUColumnInfo[];  // Dynamic SKU column headers with product names
  // New: GDC inventories by order series (from Purchase Orders)
  gdcInventories: GDCInventoryData[];   // Array of GDC inventories for each order series
  rimInstallationRequired: RimInstallationItem[];
  rimInstallationSkus: SKUColumnInfo[];  // Dynamic SKU column headers for rim installation
  storyInBrief: string;
}

// ============================================
// GDC INVENTORY BY ORDER SERIES (from Purchase Orders)
// ============================================

export interface GDCInventoryItem {
  id: string;
  no: number;
  poNumber: string | null;    // Purchase Order Number
  soNumber: string | null;    // Linked SO Number (if any)
  customerPoNumber: string | null; // Customer PO Number (from sales_orders.customer_po_number)
  orderSeries: string;        // GDC 1, GDC 2, GDC 3
  items: ShipmentItemDetail[];
  totalQty: number;
  customer: string | null;    // Customer name (from linked SO) or "Gesher" for unallocated
  supplierName: string | null;
  etaToUsPort: string | null;
  confirmedEta?: string | null;
  actualDeliveryDate?: string | null;
  qtyDelivered?: number;
  outstandingQty?: number;
  invoiceAmount?: number;
  deliveryAddress: string;
  expectedDelivery: string | null;
  status: string;             // PO status: draft, sent, confirmed, etc.
  actionRequired: string;
  notes: string;
  isUnallocated?: boolean;    // True if PO has no linked Sales Order (speculative inventory)
}

export interface GDCInventoryData {
  orderSeries: string;        // e.g., "GDC 1"
  items: GDCInventoryItem[];
  uniqueSkus: SKUColumnInfo[];
}

// ============================================
// FILTER TYPES
// ============================================

export interface OperationsFilters {
  customerId?: string;
  productId?: string;
  status?: ShipmentStatus;
  salesOrderId?: string;
  customerPoNumber?: string;  // Customer PO Number from sales_orders.customer_po_number
  orderSeries?: string;       // Filter by GDC order series
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  customers: FilterOption[];
  products: FilterOption[];
  statuses: FilterOption[];
  salesOrders: FilterOption[];
  customerPoNumbers: FilterOption[];
}
