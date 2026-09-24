/**
 * Shipments Module Types
 *
 * All TypeScript interfaces for the Shipments feature.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type ShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'pending',
  'in_transit',
  'delivered',
  'failed',
];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  failed: 'Failed',
};

export const SHIPMENT_STATUS_COLORS: Record<ShipmentStatus, string> = {
  pending: 'bg-stone-100 text-stone-700 border border-stone-200',
  in_transit: 'bg-sky-100 text-sky-800 border border-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  failed: 'bg-red-100 text-red-800 border border-red-200',
};

// Valid status transitions
export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  pending: ['in_transit', 'failed'],
  in_transit: ['delivered', 'failed'],
  delivered: [],
  failed: [],
};

// ============================================
// SHIPMENT SOURCE (Operations Dashboard)
// ============================================

export type ShipmentSource = 'supplier' | 'warehouse';

export const SHIPMENT_SOURCES: ShipmentSource[] = ['supplier', 'warehouse'];

export const SHIPMENT_SOURCE_LABELS: Record<ShipmentSource, string> = {
  supplier: 'Supplier (Dropship)',
  warehouse: 'Warehouse (Pick Ticket)',
};

// ============================================
// LOAD STATUS (Operations Dashboard - Jenny)
// ============================================

export type LoadStatus = 'available' | 'sold' | 'open' | 'hold' | 'in_transit' | 'invoiced';

export const LOAD_STATUSES: LoadStatus[] = [
  'available',
  'sold',
  'open',
  'hold',
  'in_transit',
  'invoiced',
];

export const LOAD_STATUS_LABELS: Record<LoadStatus, string> = {
  available: 'Available',
  sold: 'Sold',
  open: 'Open',
  hold: 'Hold',
  in_transit: 'In Transit',
  invoiced: 'Invoiced',
};

export const LOAD_STATUS_COLORS: Record<LoadStatus, string> = {
  available: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  sold: 'bg-blue-100 text-blue-800 border border-blue-200',
  open: 'bg-amber-100 text-amber-800 border border-amber-200',
  hold: 'bg-stone-100 text-stone-700 border border-stone-200',
  in_transit: 'bg-sky-100 text-sky-800 border border-sky-200',
  invoiced: 'bg-purple-100 text-purple-800 border border-purple-200',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Shipment entity from database
 */
export interface Shipment {
  id: string;
  shipmentNumber: string;
  shipmentDate: Date;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  salesOrderId: string | null;
  purchaseOrderId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  serviceType: string | null;
  fromLocationId: string | null;

  // Ship To Address (denormalized)
  shipToName: string | null;
  shipToAddressStreet: string | null;
  shipToAddressCity: string | null;
  shipToAddressState: string | null;
  shipToAddressPostalCode: string | null;
  shipToAddressCountry: string | null;

  // Shipment Details
  totalWeight: number | null;
  weightUnit: string;
  totalPackages: number;

  // Status
  status: ShipmentStatus;

  // Notes
  notes: string | null;
  deliveryInstructions: string | null;

  // ============================================
  // Shipping Details (from Supplier Portal)
  // ============================================

  // Container & Vessel Info
  containerNumber: string | null;
  billOfLading: string | null;
  vesselName: string | null;

  // Ports
  portOfLoading: string | null;
  portOfDischarge: string | null;

  // Shipping Dates
  etd: Date | null;           // Estimated Time of Departure
  etaPort: Date | null;       // ETA to US Port
  etaCustomer: Date | null;   // ETA to Customer

  // Supplier tracking
  supplierUpdatedAt: Date | null;
  supplierUpdatedBy: string | null;

  // ============================================
  // Operations Dashboard Fields (Jenny)
  // ============================================

  // Supplier Reference (Galileo's SO#)
  supplierReferenceNumber: string | null;

  // Port & ETA Dates
  etaToPort: Date | null;
  confirmedEta: Date | null;
  customerExpectedDelivery: Date | null;

  // Quantity Tracking
  qtyDelivered: number;
  outstandingQty: number;
  totalQty: number;

  // Supplier Invoice
  supplierInvoiceNumber: string | null;
  supplierInvoiceAmount: number | null;

  // Payment Milestones
  payment50PercentDate: Date | null;
  remaining50DueDate: Date | null;

  // Operations Notes
  actionRequired: string | null;
  executiveNotes: string | null;

  // Last Free Day (LFD)
  lfdDate: Date | null;

  // Flags & Status
  isDelayed: boolean;
  loadStatus: LoadStatus;

  // Source: supplier (Supplier Schedule) or warehouse (GDC1 Inventory)
  source: ShipmentSource | null;

  // Customer Ship Window
  customerShipWindowStart: Date | null;
  customerShipWindowEnd: Date | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Shipment Item entity from database
 */
export interface ShipmentItem {
  id: string;
  shipmentId: string;
  productId: string;
  salesOrderItemId: string | null;
  purchaseOrderItemId: string | null;
  sku: string;
  description: string | null;
  quantityShipped: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Shipment with all related data
 */
export interface ShipmentWithItems extends Shipment {
  items: ShipmentItem[];
  salesOrder?: SalesOrderSummary;
  purchaseOrder?: PurchaseOrderSummary;
  fromLocation?: LocationSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  customerPoNumber: string | null;
  customer: CustomerSummary | null;
}

export interface CustomerSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
}

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  status: string;
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

export interface CreateShipmentItemDTO {
  productId: string;
  salesOrderItemId?: string | null;
  purchaseOrderItemId?: string | null;
  sku: string;
  description: string | null;
  quantityShipped: number;
}

export interface CreateShipmentDTO {
  shipmentDate: Date;
  estimatedArrival?: Date | null;
  salesOrderId?: string | null;
  purchaseOrderId?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  serviceType?: string | null;
  fromLocationId?: string | null;
  shipToName?: string | null;
  shipToAddress: AddressDTO;
  totalWeight?: number | null;
  weightUnit?: string;
  totalPackages?: number;
  status?: ShipmentStatus;
  items: CreateShipmentItemDTO[];
  notes?: string | null;
  deliveryInstructions?: string | null;

  // Operations Dashboard Fields
  supplierReferenceNumber?: string | null;
  etaToPort?: Date | null;
  confirmedEta?: Date | null;
  customerExpectedDelivery?: Date | null;
  qtyDelivered?: number;
  outstandingQty?: number;
  totalQty?: number;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceAmount?: number | null;
  payment50PercentDate?: Date | null;
  remaining50DueDate?: Date | null;
  actionRequired?: string | null;
  executiveNotes?: string | null;
  isDelayed?: boolean;
  loadStatus?: LoadStatus;
  customerShipWindowStart?: Date | null;
  customerShipWindowEnd?: Date | null;

  // Source: supplier (Supplier Schedule) or warehouse (GDC1 Inventory)
  source?: ShipmentSource | null;
}

export interface UpdateShipmentDTO {
  shipmentDate?: Date;
  estimatedArrival?: Date | null;
  actualArrival?: Date | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  serviceType?: string | null;
  fromLocationId?: string | null;
  shipToName?: string | null;
  shipToAddress?: AddressDTO;
  totalWeight?: number | null;
  weightUnit?: string;
  totalPackages?: number;
  notes?: string | null;
  deliveryInstructions?: string | null;

  // Operations Dashboard Fields
  supplierReferenceNumber?: string | null;
  etaToPort?: Date | null;
  confirmedEta?: Date | null;
  customerExpectedDelivery?: Date | null;
  qtyDelivered?: number;
  outstandingQty?: number;
  totalQty?: number;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceAmount?: number | null;
  payment50PercentDate?: Date | null;
  remaining50DueDate?: Date | null;
  actionRequired?: string | null;
  executiveNotes?: string | null;
  lfdDate?: Date | null;
  isDelayed?: boolean;
  loadStatus?: LoadStatus;
  customerShipWindowStart?: Date | null;
  customerShipWindowEnd?: Date | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface ShipmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ShipmentStatus;
  salesOrderId?: string;
  purchaseOrderId?: string;
  carrier?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';

  // Operations Dashboard Filters
  loadStatus?: LoadStatus;
  customerId?: string;
  isDelayed?: boolean;
  etaFrom?: string;
  etaTo?: string;
  supplierReferenceNumber?: string;
}

export interface ShipmentListItem {
  id: string;
  shipmentNumber: string;
  shipmentDate: string;
  estimatedArrival: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  status: ShipmentStatus;
  itemCount: number;
  salesOrderNumber: string | null;
  purchaseOrderNumber: string | null;
  createdAt: Date;

  // Operations Dashboard Fields
  supplierReferenceNumber: string | null;
  etaToPort: string | null;
  confirmedEta: string | null;
  customerExpectedDelivery: string | null;
  actualArrival: string | null;
  qtyDelivered: number;
  outstandingQty: number;
  totalQty: number;
  loadStatus: LoadStatus;
  isDelayed: boolean;
  actionRequired: string | null;
  customerName: string | null;
  customerPo: string | null;
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

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface ShipmentsTableProps {
  data: ShipmentListItem[];
  isLoading?: boolean;
  onRowClick?: (shipment: ShipmentListItem) => void;
  onView?: (shipment: ShipmentListItem) => void;
  onEdit?: (shipment: ShipmentListItem) => void;
  onDelete?: (shipment: ShipmentListItem) => void;
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

export interface CreateShipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditShipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  onSuccess?: () => void;
}

export interface ViewShipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string | null;
  onEdit?: (shipment: ShipmentListItem | ShipmentWithItems) => void;
}
