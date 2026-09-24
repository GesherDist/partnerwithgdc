/**
 * Approval Events Module Types
 *
 * All TypeScript interfaces for the Approval Events feature.
 * Per client doc: "the audit spine. {type: credit_release | price_override | allocation, subject_id, decided_by, decided_at, note}"
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type ApprovalEventType =
  | 'credit_release'
  | 'price_override'
  | 'allocation'
  | 'quote_approval'
  | 'other';

export const APPROVAL_EVENT_TYPES: ApprovalEventType[] = [
  'credit_release',
  'price_override',
  'allocation',
  'quote_approval',
  'other',
];

export const APPROVAL_EVENT_TYPE_LABELS: Record<ApprovalEventType, string> = {
  credit_release: 'Credit Release',
  price_override: 'Price Override',
  allocation: 'Allocation',
  quote_approval: 'Quote Approval',
  other: 'Other',
};

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export const APPROVAL_STATUSES: ApprovalStatus[] = [
  'pending',
  'approved',
  'rejected',
];

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border border-red-200',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Approval Event entity from database
 */
export interface ApprovalEvent {
  id: string;

  // Event Type & Subject
  eventType: ApprovalEventType;
  subjectType: string; // 'quote', 'sales_order', 'invoice', etc.
  subjectId: string;

  // Approval Details
  status: ApprovalStatus;
  requestedBy: string | null;
  requestedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;

  // Context
  reason: string | null; // Why approval was requested
  decisionNote: string | null; // Approver's note

  // Additional Data (JSON for flexibility)
  metadata: Record<string, unknown>;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Approval Event with user details
 */
export interface ApprovalEventWithDetails extends ApprovalEvent {
  requestedByUser?: UserSummary;
  decidedByUser?: UserSummary;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateApprovalEventDTO {
  eventType: ApprovalEventType;
  subjectType: string;
  subjectId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DecideApprovalEventDTO {
  status: 'approved' | 'rejected';
  decisionNote?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface ApprovalEventListParams {
  page?: number;
  limit?: number;
  eventType?: ApprovalEventType;
  subjectType?: string;
  subjectId?: string;
  status?: ApprovalStatus;
  requestedBy?: string;
  decidedBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApprovalEventListItem {
  id: string;
  eventType: ApprovalEventType;
  subjectType: string;
  subjectId: string;
  status: ApprovalStatus;
  reason: string | null;
  requestedByName: string | null;
  requestedAt: Date;
  decidedByName: string | null;
  decidedAt: Date | null;
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

export interface ApprovalEventsTableProps {
  data: ApprovalEventListItem[];
  isLoading?: boolean;
  onRowClick?: (event: ApprovalEventListItem) => void;
  onView?: (event: ApprovalEventListItem) => void;
  onApprove?: (event: ApprovalEventListItem) => void;
  onReject?: (event: ApprovalEventListItem) => void;
  toolbarContent?: React.ReactNode;
}

export interface ViewApprovalEventDrawerProps {
  open: boolean;
  onClose: () => void;
  eventId: string | null;
  onApprove?: () => void;
  onReject?: () => void;
}

export interface ApproveRejectDialogProps {
  open: boolean;
  onClose: () => void;
  eventId: string | null;
  action: 'approve' | 'reject';
  onSuccess?: () => void;
}
