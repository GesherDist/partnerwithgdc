/**
 * Purchase Orders Module Types
 *
 * All TypeScript interfaces for the Purchase Orders feature.
 * Supplier info is at item level (per-item supplier assignment).
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type POStatus =
  | 'draft'
  | 'sent'
  | 'confirmed'
  | 'in_production'
  | 'ready_to_ship'
  | 'in_transit'
  | 'partial'
  | 'received'
  | 'cancelled';

export const PO_STATUSES: POStatus[] = [
  'draft',
  'sent',
  'confirmed',
  'in_production',
  'ready_to_ship',
  'in_transit',
  'partial',
  'received',
  'cancelled',
];

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  in_production: 'In Production',
  ready_to_ship: 'Ready to Ship',
  in_transit: 'In Transit',
  partial: 'Partial',
  received: 'Received',
  cancelled: 'Cancelled',
};

export const PO_STATUS_COLORS: Record<POStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  sent: 'bg-sky-100 text-sky-800 border border-sky-200',
  confirmed: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  in_production: 'bg-violet-100 text-violet-800 border border-violet-200',
  ready_to_ship: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  in_transit: 'bg-blue-100 text-blue-800 border border-blue-200',
  partial: 'bg-amber-100 text-amber-800 border border-amber-200',
  received: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border border-red-200',
};

// Valid status transitions
// Production statuses (in_production, ready_to_ship, in_transit) are set automatically by supplier
export const PO_STATUS_TRANSITIONS: Record<POStatus, POStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'ready_to_ship', 'in_transit', 'partial', 'received', 'cancelled'],
  in_production: ['ready_to_ship', 'in_transit', 'partial', 'received', 'cancelled'],
  ready_to_ship: ['in_transit', 'partial', 'received', 'cancelled'],
  in_transit: ['partial', 'received', 'cancelled'],
  partial: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

// Supplier summary for dropdown
export interface SupplierSummary {
  id: string;
  name: string;
  primaryContactName: string | null;
}

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Purchase Order entity from database
 * Note: Supplier info is now at item level (purchase_order_items.supplier_id)
 */
export interface PurchaseOrder {
  id: string;
  poNumber: string;
  poDate: Date;
  expectedDeliveryDate: Date | null;

  // Relationships
  salesOrderId: string | null;
  warehouseId: string | null;
  currencyCode: string;
  status: POStatus;
  // orderSeries can be:
  // - Set directly on PO for unallocated POs (no linked SO)
  // - Inherited from linked Sales Order when PO has a linked SO
  orderSeries: string | null;

  // Supplier Address (denormalized)
  vendorAddressStreet: string | null;
  vendorAddressCity: string | null;
  vendorAddressState: string | null;
  vendorAddressPostalCode: string | null;
  vendorAddressCountry: string | null;

  // Ship To Address (denormalized)
  shipToAddressStreet: string | null;
  shipToAddressCity: string | null;
  shipToAddressState: string | null;
  shipToAddressPostalCode: string | null;
  shipToAddressCountry: string | null;

  // Totals (in cents)
  subtotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;

  // Notes
  vendorNotes: string | null;
  internalNotes: string | null;

  // Cancellation
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Purchase Order Item entity from database
 */
export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  salesOrderItemId: string | null;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCode: string;
  unitPrice: number; // cents
  taxRate: number;
  lineTotal: number; // cents
  sortOrder: number;
  // Per-item supplier (optional override)
  supplierId: string | null;
  supplierName: string | null;
  itemType?: 'inventory' | 'non_inventory' | 'service';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Purchase Order with all related data
 */
export interface PurchaseOrderWithItems extends PurchaseOrder {
  items: PurchaseOrderItem[];
  salesOrder?: SalesOrderSummary;
  warehouse?: LocationSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  orderSeries?: string | null; // Inherited by PO
}

export interface LocationSummary {
  id: string;
  code: string;
  name: string;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface AddressDTO {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface CreatePOItemDTO {
  productId: string;
  salesOrderItemId?: string | null;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  unitCode: string;
  unitPrice: number; // cents
  taxRate: number;
  // Per-item supplier (optional)
  supplierId?: string | null;
  supplierName?: string | null;
  // Product type for display purposes
  itemType?: 'inventory' | 'non_inventory' | 'service';
}

export interface CreatePurchaseOrderDTO {
  poNumber?: string; // Optional - auto-generate if not provided
  poDate: Date;
  expectedDeliveryDate?: Date | null;
  salesOrderId?: string | null;
  warehouseId?: string | null;
  currencyCode?: string;
  status?: POStatus;
  // orderSeries can be set directly for unallocated POs (no linked SO)
  // For POs with linked SO, this is inherited from the SO
  orderSeries?: string | null;
  vendorAddress: AddressDTO;
  shipToAddress: AddressDTO;
  items: CreatePOItemDTO[]; // Supplier info is on items
  vendorNotes?: string | null;
  internalNotes?: string | null;
}

export interface UpdatePOItemDTO {
  id?: string; // If present, update existing item; if not, create new
  productId: string;
  salesOrderItemId?: string | null;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  unitCode: string;
  unitPrice: number; // cents
  taxRate: number;
  // Per-item supplier (optional)
  supplierId?: string | null;
  supplierName?: string | null;
}

export interface UpdatePurchaseOrderDTO {
  poDate?: Date;
  expectedDeliveryDate?: Date | null;
  warehouseId?: string | null;
  currencyCode?: string;
  // orderSeries can be updated for unallocated POs
  orderSeries?: string | null;
  vendorAddress?: AddressDTO;
  shipToAddress?: AddressDTO;
  vendorNotes?: string | null;
  internalNotes?: string | null;
  // Items array for updating (supplier info is on items)
  items?: UpdatePOItemDTO[];
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface POListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: POStatus;
  salesOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface POListItem {
  id: string;
  poNumber: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  status: POStatus;
  orderSeries: string | null;
  grandTotal: number; // cents
  currencyCode: string;
  itemCount: number;
  createdAt: Date;
  // Computed from items - shows unique suppliers
  suppliers: string[];
  // Linked Sales Order info
  salesOrderNumber: string | null;
  customerName: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface POTotals {
  subtotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface PurchaseOrdersTableProps {
  data: POListItem[];
  isLoading?: boolean;
  onRowClick?: (po: POListItem) => void;
  onView?: (po: POListItem) => void;
  onEdit?: (po: POListItem) => void;
  onDelete?: (po: POListItem) => void;
  toolbarContent?: React.ReactNode;
  // Server-side pagination
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

export interface CreatePurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
}

export interface EditPurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  poId: string;
  onSuccess?: () => void | Promise<void>;
}

export interface ViewPurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  poId: string | null;
  onEdit?: (po: POListItem | PurchaseOrderWithItems) => void;
}
