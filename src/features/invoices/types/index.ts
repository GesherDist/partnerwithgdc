/**
 * Invoices Module Types
 *
 * All TypeScript interfaces for the Invoices feature.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export const INVOICE_STATUSES: InvoiceStatus[] = [
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'cancelled',
];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  sent: 'bg-sky-100 text-sky-800 border border-sky-200',
  partial: 'bg-amber-100 text-amber-800 border border-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  overdue: 'bg-red-100 text-red-800 border border-red-200',
  cancelled: 'bg-stone-100 text-stone-500 border border-stone-200',
};

// Valid status transitions
export const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent', 'cancelled'],
  sent: ['partial', 'paid', 'overdue', 'cancelled'],
  partial: ['paid', 'overdue', 'cancelled'],
  paid: [],
  overdue: ['partial', 'paid', 'cancelled'],
  cancelled: [],
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Invoice entity from database
 */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  customerId: string;
  salesOrderId: string | null;
  shipmentId: string | null;
  currencyCode: string;
  status: InvoiceStatus;
  paymentTerms: string | null;

  // Billing Address (denormalized)
  billingAddressStreet: string | null;
  billingAddressCity: string | null;
  billingAddressState: string | null;
  billingAddressPostalCode: string | null;
  billingAddressCountry: string | null;

  // Totals (in cents)
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;

  // Notes
  customerNotes: string | null;
  internalNotes: string | null;
  paymentNotes: string | null;

  // QuickBooks Integration
  quickbooksInvoiceId: string | null;
  quickbooksSyncStatus: string | null;
  quickbooksLastSync: Date | null;

  // Payment Tracking
  lastPaymentDate: Date | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Invoice Item entity from database
 */
export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  salesOrderItemId: string | null;
  shipmentItemId: string | null;
  sku: string;
  description: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
  lineTotal: number; // cents
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Invoice Payment entity from database
 */
export interface InvoicePayment {
  id: string;
  invoiceId: string;
  paymentDate: Date;
  amount: number; // cents
  paymentMethod: string | null;
  referenceNumber: string | null;
  notes: string | null;
  quickbooksPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Invoice with all related data
 */
export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
  payments: InvoicePayment[];
  customer?: CustomerSummary;
  salesOrder?: SalesOrderSummary;
  shipment?: ShipmentSummary;
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

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  customerPoNumber: string | null;
}

export interface ShipmentSummary {
  id: string;
  shipmentNumber: string;
  status: string;
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

export interface CreateInvoiceItemDTO {
  productId: string;
  salesOrderItemId?: string | null;
  shipmentItemId?: string | null;
  sku: string;
  description: string | null;
  quantity: number;
  unitCode: string;
  unitPrice: number; // cents
  discountPercent: number;
  taxRate: number;
}

export interface CreateInvoiceDTO {
  invoiceDate: Date;
  dueDate?: Date | null;
  customerId: string;
  salesOrderId?: string | null;
  shipmentId?: string | null;
  currencyCode?: string;
  status?: InvoiceStatus;
  paymentTerms?: string | null;
  billingAddress: AddressDTO;
  items: CreateInvoiceItemDTO[];
  customerNotes?: string | null;
  internalNotes?: string | null;
}

export interface UpdateInvoiceDTO {
  invoiceDate?: Date;
  dueDate?: Date | null;
  customerId?: string;
  currencyCode?: string;
  paymentTerms?: string | null;
  billingAddress?: AddressDTO;
  customerNotes?: string | null;
  internalNotes?: string | null;
  paymentNotes?: string | null;
}

export interface RecordPaymentDTO {
  paymentDate: Date;
  amount: number; // cents
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  salesOrderId?: string;
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  grandTotal: number; // cents
  amountPaid: number; // cents
  balanceDue: number; // cents
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

export interface InvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface InvoicesTableProps {
  data: InvoiceListItem[];
  isLoading?: boolean;
  onRowClick?: (invoice: InvoiceListItem) => void;
  onView?: (invoice: InvoiceListItem) => void;
  onEdit?: (invoice: InvoiceListItem) => void;
  onDelete?: (invoice: InvoiceListItem) => void;
  onRecordPayment?: (invoice: InvoiceListItem) => void;
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

export interface CreateInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  onSuccess?: () => void;
}

export interface ViewInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string | null;
  onEdit?: (invoice: InvoiceListItem | InvoiceWithItems) => void;
  onRecordPayment?: (invoice: InvoiceListItem | InvoiceWithItems) => void;
}

export interface RecordPaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  onSuccess?: () => void;
}
