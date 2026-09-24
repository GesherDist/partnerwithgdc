/**
 * Sales Order Module Types
 *
 * All TypeScript interfaces for the Sales Order feature.
 * Structured to mirror future REST API response formats.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type OrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'draft',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  confirmed: 'bg-teal-100 text-teal-800 border border-teal-200',
  processing: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  shipped: 'bg-sky-100 text-sky-800 border border-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border border-red-200',
};

// Valid status transitions
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['pending', 'confirmed', 'cancelled'], // Allow direct confirmation from draft
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// ============================================
// FULFILLMENT SOURCE (Where product is sourced from)
// ============================================

export type FulfillmentSource =
  | 'direct'                          // Manufacturer/Supplier (Galileo)
  | 'gdc_inventory'                   // GDC Warehouse Inventory
  | 'platinum_dealer_inventory'       // Platinum Dealer Existing Stock
  | 'platinum_dealer_fulfillment';    // Platinum Dealer Procures & Ships

export const FULFILLMENT_SOURCES: FulfillmentSource[] = [
  'direct',
  'gdc_inventory',
  'platinum_dealer_inventory',
  'platinum_dealer_fulfillment',
];

export const FULFILLMENT_SOURCE_LABELS: Record<FulfillmentSource, string> = {
  direct: 'Manufacturer/Supplier',
  gdc_inventory: 'GDC Inventory',
  platinum_dealer_inventory: 'Dealer Inventory',
  platinum_dealer_fulfillment: 'Dealer Fulfillment',
};

export const FULFILLMENT_SOURCE_DESCRIPTIONS: Record<
  FulfillmentSource,
  string
> = {
  direct: 'Ships directly from manufacturer (Galileo) to customer',
  gdc_inventory: 'Ships from GDC warehouse inventory (Nebraska, Kansas, etc.)',
  platinum_dealer_inventory:
    'Fulfilled from platinum dealer existing stock',
  platinum_dealer_fulfillment:
    'Platinum dealer procures and ships on our behalf',
};

// Legacy type for backward compatibility (will be removed in future)
/** @deprecated Use FulfillmentSource instead */
export type ProductSource = 'direct' | 'gdc_inventory';

/** @deprecated Use FULFILLMENT_SOURCES instead */
export const PRODUCT_SOURCES: ProductSource[] = ['direct', 'gdc_inventory'];

/** @deprecated Use FULFILLMENT_SOURCE_LABELS instead */
export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = {
  direct: 'Direct',
  gdc_inventory: 'GDC Inventory',
};

/** @deprecated Use FULFILLMENT_SOURCE_DESCRIPTIONS instead */
export const PRODUCT_SOURCE_DESCRIPTIONS: Record<ProductSource, string> = {
  direct: 'Ships from manufacturer to customer',
  gdc_inventory: 'Ships from GDC warehouse',
};

// Statuses that allow editing
export const EDITABLE_ORDER_STATUSES: OrderStatus[] = ['draft', 'pending'];

/**
 * Check if an order can be edited based on its status
 */
export function canEditOrder(status: OrderStatus): boolean {
  return EDITABLE_ORDER_STATUSES.includes(status);
}

// ============================================
// ORDER CREDIT STATUS
// ============================================

export type OrderCreditStatus = 'ok' | 'hold';

export const ORDER_CREDIT_STATUSES: OrderCreditStatus[] = ['ok', 'hold'];

export const ORDER_CREDIT_STATUS_LABELS: Record<OrderCreditStatus, string> = {
  ok: 'OK',
  hold: 'On Hold',
};

export const ORDER_CREDIT_STATUS_COLORS: Record<OrderCreditStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  hold: 'bg-amber-100 text-amber-800 border border-amber-200',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Sales Order entity from database
 */
export interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: Date;
  requestedDeliveryDate: Date | null;
  customerId: string;
  salesRepId: string | null;
  warehouseId: string | null;
  currencyCode: string;
  customerPoNumber: string | null;
  status: OrderStatus;
  creditStatus: OrderCreditStatus;
  orderSeries: string | null; // GDC 1, GDC 2, GDC 3 - time-based order cycles

  // Billing Address
  billingAddressStreet: string | null;
  billingAddressCity: string | null;
  billingAddressState: string | null;
  billingAddressPostalCode: string | null;
  billingAddressCountry: string | null;

  // Shipping Address
  shippingAddressStreet: string | null;
  shippingAddressCity: string | null;
  shippingAddressState: string | null;
  shippingAddressPostalCode: string | null;
  shippingAddressCountry: string | null;
  shippingMethod: string | null;

  // Totals (in cents)
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;

  // Notes
  customerNotes: string | null;
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
 * Sales Order Item entity from database
 */
export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId: string;
  sku: string;
  description: string | null;
  quantity: number; // Legacy field (kept for backward compatibility)
  customerQty: number; // Customer's actual order quantity (NEVER changes)
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
  lineTotal: number; // cents
  warehouseId: string | null;
  batchNumber: string | null;
  serialNumber: string | null;
  sortOrder: number;
  itemType?: 'inventory' | 'non_inventory' | 'service';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

// ============================================
// FULFILLMENT ALLOCATION TYPES
// ============================================

export type AllocationStatus =
  | 'pending'
  | 'allocated'
  | 'partially_fulfilled'
  | 'fulfilled'
  | 'cancelled';

export const ALLOCATION_STATUSES: AllocationStatus[] = [
  'pending',
  'allocated',
  'partially_fulfilled',
  'fulfilled',
  'cancelled',
];

export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  pending: 'Pending',
  allocated: 'Allocated',
  partially_fulfilled: 'Partially Fulfilled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

export const ALLOCATION_STATUS_COLORS: Record<AllocationStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  allocated: 'bg-blue-100 text-blue-800 border border-blue-200',
  partially_fulfilled: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  fulfilled: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border border-red-200',
};

/**
 * Fulfillment Allocation entity from database
 *
 * Tracks how each sales order item is fulfilled across multiple sources.
 * One sales_order_item can have multiple allocations (multi-source fulfillment).
 *
 * Example: Customer orders 150 tires
 *   - Allocation 1: 72 from manufacturer (direct)
 *   - Allocation 2: 30 from GDC warehouse (gdc_inventory)
 *   - Allocation 3: 20 from dealer stock (platinum_dealer_inventory)
 *   - Allocation 4: 28 from dealer fulfillment (platinum_dealer_fulfillment)
 */
export interface FulfillmentAllocation {
  id: string;
  salesOrderItemId: string;

  // Fulfillment Source
  fulfillmentSource: FulfillmentSource;

  // Allocation Quantity
  quantity: number;

  // Status
  status: AllocationStatus;

  // Location (conditional - required for gdc_inventory)
  locationId: string | null;
  assignedContactId: string | null; // Location contact for email/phone notifications
  assignedUserId: string | null; // Warehouse worker (user) for pick ticket assignment

  // Platinum Dealer (conditional - required for dealer sources)
  platinumDealerId: string | null;
  dealerLocationId: string | null;

  // Container/Procurement (only for manufacturer/supplier - direct)
  purchaseOrderId: string | null;
  containerId: string | null;
  containerQty: number; // Full container quantity (e.g., 72 tires)
  containerRemaining: number; // Remaining after this allocation

  // Metadata
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

/**
 * Fulfillment Allocation with related data
 */
export interface FulfillmentAllocationWithDetails
  extends FulfillmentAllocation {
  salesOrderItem?: {
    id: string;
    sku: string | null;
    description: string | null;
    salesOrder?: {
      id: string;
      orderNumber: string;
      customer?: {
        id: string;
        companyName: string;
      };
    };
  };
  location?: LocationSummary;
  assignedContact?: LocationContactSummary;
  platinumDealer?: PlatinumDealerSummary;
  dealerLocation?: PlatinumDealerLocationSummary;
  purchaseOrder?: PurchaseOrderSummary;
}

/**
 * Sales Order Item with allocations
 */
export interface SalesOrderItemWithAllocations extends SalesOrderItem {
  allocations: FulfillmentAllocationWithDetails[];
  totalAllocated: number; // Sum of all allocation quantities
  remainingToAllocate: number; // customerQty - totalAllocated
}

/**
 * Pick Ticket summary for sales order
 */
export interface PickTicketSummary {
  id: string;
  ticketNumber: string;
  status: string;
}

/**
 * Sales Order with all related data
 */
export interface SalesOrderWithItems extends SalesOrder {
  items: SalesOrderItem[];
  customer?: CustomerSummary;
  salesRep?: UserSummary;
  warehouse?: LocationSummary;
  pickTickets?: PickTicketSummary[];
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface CustomerSummary {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface LocationSummary {
  id: string;
  locationCode: string;
  name: string;
}

export interface LocationContactSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface PlatinumDealerSummary {
  id: string;
  dealerName: string;
  code: string | null;
  email: string | null;
  contactName: string | null;
}

export interface PlatinumDealerLocationSummary {
  id: string;
  dealerId: string;
  locationName: string;
  locationCode: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
}

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  status: string;
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

export interface CreateSalesOrderItemDTO {
  id?: string; // Optional: for updating existing items (undefined for new items)
  productId: string;
  sku: string;
  description: string | null;
  quantity: number;
  customerQty?: number; // Customer's actual order quantity (defaults to quantity if not provided)
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
  warehouseId?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
}

export interface UpdateSalesOrderItemDTO {
  quantity?: number;
  unitCode?: string;
  unitPrice?: number;
  discountPercent?: number;
  taxRate?: number;
  warehouseId?: string | null;
  batchNumber?: string | null;
  serialNumber?: string | null;
}

export interface CreateSalesOrderDTO {
  orderNumber?: string | null;
  orderDate: Date;
  requestedDeliveryDate?: Date | null;
  customerId: string;
  salesRepId?: string | null;
  warehouseId?: string | null;
  currencyCode?: string;
  customerPoNumber?: string | null;
  status?: OrderStatus;
  orderSeries?: string | null; // GDC 1, GDC 2, GDC 3
  billingAddress: AddressDTO;
  shippingAddress: AddressDTO;
  shippingMethod?: string | null;
  items: CreateSalesOrderItemDTO[];
  customerNotes?: string | null;
  internalNotes?: string | null;
}

export interface UpdateSalesOrderDTO {
  orderDate?: Date;
  requestedDeliveryDate?: Date | null;
  customerId?: string;
  salesRepId?: string | null;
  warehouseId?: string | null;
  currencyCode?: string;
  customerPoNumber?: string | null;
  orderSeries?: string | null; // GDC 1, GDC 2, GDC 3
  billingAddress?: AddressDTO;
  shippingAddress?: AddressDTO;
  shippingMethod?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface SalesOrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus;
  orderSeries?: string;
  customerId?: string;
  salesRepId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SalesOrderListItem {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPoNumber?: string | null; // Customer's PO number
  orderDate: string;
  requestedDeliveryDate: string | null;
  status: OrderStatus;
  creditStatus: OrderCreditStatus;
  orderSeries?: string | null; // GDC 1, GDC 2, GDC 3 (optional)
  grandTotal: number; // cents
  currencyCode: string;
  itemCount: number;
  createdAt: Date;
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

export interface OrderTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;
}

// ============================================
// MASTER DATA TYPES (for dropdowns)
// ============================================

export interface Customer {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  billingAddress: Address;
  shippingAddress: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unitPrice: number; // dollars for display
  unitId: string;
  itemType?: 'inventory' | 'non_inventory' | 'service';
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
}

export interface SalesRep {
  id: string;
  name: string;
  email: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  estimatedDays: number;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
}

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
}

// ============================================
// MASTER DATA AGGREGATION
// ============================================

export interface SalesOrderMasterData {
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
  salesReps: SalesRep[];
  currencies: Currency[];
  shippingMethods: ShippingMethod[];
  units: Unit[];
  taxRates: TaxRate[];
}

// ============================================
// ORDER ITEM TYPES (form state)
// ============================================

export interface OrderItem {
  id?: string;
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  unitId: string;
  unitPrice: number; // dollars for form
  discountPercent: number;
  taxRateId: string;
  lineTotal: number; // dollars for display

  // Future extension fields (optional)
  warehouseId?: string;
  batchNumber?: string;
  serialNumber?: string;
  priceListId?: string;
  availableQuantity?: number;
}

// Configuration for extensible columns
export interface OrderItemColumnConfig {
  showWarehouse?: boolean;
  showBatch?: boolean;
  showSerialNumber?: boolean;
  showInventoryAvailability?: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SalesOrderListResponse {
  data: SalesOrderListItem[];
  meta: PaginationMeta;
}

export interface SalesOrderDetailResponse {
  data: SalesOrderWithItems;
}

export interface MasterDataResponse {
  data: SalesOrderMasterData;
  meta: {
    cachedAt: string;
  };
}

// ============================================
// FORM TYPES
// ============================================

export interface SalesOrderFormData {
  orderNumber?: string;
  orderDate: string;
  requestedDeliveryDate?: string;
  customerId: string;
  salesRepId?: string;
  warehouseId?: string;
  currencyId?: string;
  customerPoNumber?: string;
  status?: OrderStatus;
  orderSeries?: string; // GDC 1, GDC 2, GDC 3

  billingAddress: Address;
  shippingAddress: Address;
  shippingMethodId?: string;

  items: OrderItem[];

  customerNotes?: string;
  internalNotes?: string;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface SalesOrderInfoSectionProps {
  customers: Customer[];
  salesReps: SalesRep[];
  warehouses: Warehouse[];
  currencies: Currency[];
}

export interface BillingShippingSectionProps {
  shippingMethods: ShippingMethod[];
  isLoadingAddresses?: boolean;
}

export interface OrderItemsTableProps {
  products: Product[];
  units: Unit[];
  taxRates: TaxRate[];
  items: OrderItem[];
  onItemsChange: (items: OrderItem[]) => void;
  onProductSelect?: (itemIndex: number, productId: string) => void;
  columnConfig?: OrderItemColumnConfig;
  mode?: 'create' | 'edit';
  itemErrors?: Array<Record<string, string>>;
  itemsError?: string;
}

export interface OrderSummaryCardsProps {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  grandTotal: number;
  currencySymbol?: string;
  /** Optional slot for credit warning or other content */
  creditSlot?: React.ReactNode;
}

export interface SalesOrderFormProps {
  masterData: SalesOrderMasterData;
  initialData?: Partial<SalesOrderFormData>;
  onSubmit?: (data: SalesOrderFormData) => void;
  onCancel?: () => void;
  onSaveDraft?: (data: SalesOrderFormData) => void;
  mode?: 'create' | 'edit';
  onValidationChange?: (isValid: boolean) => void;
  serverErrors?: Record<string, string[]>;
}

export interface CreateSalesOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  masterData: SalesOrderMasterData;
}

export interface SalesOrdersTableProps {
  data: SalesOrderListItem[];
  isLoading?: boolean;
  onRowClick?: (order: SalesOrderListItem) => void;
  onView?: (order: SalesOrderListItem) => void;
  onEdit?: (order: SalesOrderListItem) => void;
  onDelete?: (order: SalesOrderListItem) => void;
  onConfirm?: (order: SalesOrderListItem) => void;
  onCancel?: (order: SalesOrderListItem) => void;
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
