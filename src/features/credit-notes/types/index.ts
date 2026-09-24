/**
 * Credit Notes Module Types
 *
 * All TypeScript interfaces for the Credit Notes feature.
 * Per client doc: "for short/damaged; adjust and push"
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type CreditNoteStatus =
  | 'draft'
  | 'issued'
  | 'applied'
  | 'cancelled';

export const CREDIT_NOTE_STATUSES: CreditNoteStatus[] = [
  'draft',
  'issued',
  'applied',
  'cancelled',
];

export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  applied: 'Applied',
  cancelled: 'Cancelled',
};

export const CREDIT_NOTE_STATUS_COLORS: Record<CreditNoteStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border border-stone-200',
  issued: 'bg-sky-100 text-sky-800 border border-sky-200',
  applied: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  cancelled: 'bg-red-100 text-red-800 border border-red-200',
};

export type CreditNoteReason =
  | 'short_shipment'
  | 'damaged_goods'
  | 'pricing_error'
  | 'return'
  | 'other';

export const CREDIT_NOTE_REASONS: CreditNoteReason[] = [
  'short_shipment',
  'damaged_goods',
  'pricing_error',
  'return',
  'other',
];

export const CREDIT_NOTE_REASON_LABELS: Record<CreditNoteReason, string> = {
  short_shipment: 'Short Shipment',
  damaged_goods: 'Damaged Goods',
  pricing_error: 'Pricing Error',
  return: 'Return',
  other: 'Other',
};

// Status transitions
export const CREDIT_NOTE_STATUS_TRANSITIONS: Record<CreditNoteStatus, CreditNoteStatus[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['applied', 'cancelled'],
  applied: [],
  cancelled: [],
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Credit Note entity from database
 */
export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  creditNoteDate: Date;

  // Relationships
  customerId: string;
  invoiceId: string | null;
  salesOrderId: string | null;

  // Details
  reason: CreditNoteReason;
  reasonDescription: string | null;
  status: CreditNoteStatus;

  // Amounts (in cents)
  subtotal: number;
  taxTotal: number;
  grandTotal: number;

  // QuickBooks Integration
  quickbooksCreditMemoId: string | null;
  quickbooksSyncStatus: string;
  quickbooksLastSync: Date | null;

  // Notes
  customerNotes: string | null;
  internalNotes: string | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Credit Note Item entity from database
 */
export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  productId: string | null;
  invoiceItemId: string | null;
  sku: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number; // cents
  taxRate: number;
  lineTotal: number; // cents
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Credit Note with all related data
 */
export interface CreditNoteWithItems extends CreditNote {
  items: CreditNoteItem[];
  customer?: CustomerSummary;
  invoice?: InvoiceSummary;
  salesOrder?: SalesOrderSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface CustomerSummary {
  id: string;
  code: string;
  name: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
}

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateCreditNoteItemDTO {
  productId?: string | null;
  invoiceItemId?: string | null;
  sku?: string | null;
  description?: string | null;
  quantity: number;
  unitPrice: number; // cents
  taxRate?: number;
}

export interface CreateCreditNoteDTO {
  creditNoteDate?: Date;
  customerId: string;
  invoiceId?: string | null;
  salesOrderId?: string | null;
  reason: CreditNoteReason;
  reasonDescription?: string | null;
  items: CreateCreditNoteItemDTO[];
  customerNotes?: string | null;
  internalNotes?: string | null;
}

export interface UpdateCreditNoteDTO {
  creditNoteDate?: Date;
  reason?: CreditNoteReason;
  reasonDescription?: string | null;
  customerNotes?: string | null;
  internalNotes?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface CreditNoteListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CreditNoteStatus;
  customerId?: string;
  invoiceId?: string;
  reason?: CreditNoteReason;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreditNoteListItem {
  id: string;
  creditNoteNumber: string;
  creditNoteDate: string;
  customerId: string;
  customerName: string;
  status: CreditNoteStatus;
  reason: CreditNoteReason;
  grandTotal: number; // cents
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

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface CreditNotesTableProps {
  data: CreditNoteListItem[];
  isLoading?: boolean;
  onRowClick?: (cn: CreditNoteListItem) => void;
  onView?: (cn: CreditNoteListItem) => void;
  onEdit?: (cn: CreditNoteListItem) => void;
  onDelete?: (cn: CreditNoteListItem) => void;
  toolbarContent?: React.ReactNode;
}

export interface ViewCreditNoteDrawerProps {
  open: boolean;
  onClose: () => void;
  creditNoteId: string | null;
  onEdit?: () => void;
}

export interface CreateCreditNoteDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditCreditNoteDrawerProps {
  open: boolean;
  onClose: () => void;
  creditNoteId: string | null;
  onSuccess?: () => void;
}
