/**
 * Deals Module Types
 *
 * Type definitions for the Deals feature (Pipedrive Deals).
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type DealStatus = 'open' | 'won' | 'lost';

export const DEAL_STATUSES: DealStatus[] = ['open', 'won', 'lost'];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
};

export const DEAL_STATUS_COLORS: Record<DealStatus, string> = {
  open: 'bg-blue-100 text-blue-800 border border-blue-200',
  won: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  lost: 'bg-red-100 text-red-800 border border-red-200',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Deal entity from database
 */
export interface Deal {
  id: string;

  // Basic Info
  title: string;

  // Pipedrive IDs
  pipedriveDealId: number | null;
  pipedrivePersonId: number | null;
  pipedriveOrgId: number | null;

  // Value
  value: number | null;
  currency: string;

  // Pipeline & Stage
  pipelineId: number | null;
  pipelineName: string | null;
  stageId: number | null;
  stageName: string | null;
  stageOrder: number | null;

  // Status
  status: DealStatus;
  probability: number | null;

  // Dates
  expectedCloseDate: Date | null;
  wonTime: Date | null;
  lostTime: Date | null;
  closeTime: Date | null;

  // Lost reason
  lostReason: string | null;

  // Contact & Organization
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  organizationName: string | null;

  // Organization Address
  organizationAddressStreet: string | null;
  organizationAddressCity: string | null;
  organizationAddressState: string | null;
  organizationAddressPostalCode: string | null;
  organizationAddressCountry: string | null;

  // Linked entities
  customerId: string | null;
  leadId: string | null;

  // Owner
  ownerId: string | null;
  pipedriveOwnerId: number | null;
  pipedriveOwnerName: string | null;

  // Sync tracking
  pipedriveSyncedAt: Date | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Deal Note entity
 */
export interface DealNote {
  id: string;
  dealId: string;
  content: string;
  pipedriveNoteId: number | null;
  syncedToPipedrive: boolean;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  createdByName?: string | null;
}

/**
 * Deal Activity entity
 */
export interface DealActivity {
  id: string;
  dealId: string;
  activityType: string;
  subject: string;
  description: string | null;
  done: boolean;
  dueDate: Date | null;
  dueTime: string | null;
  completedAt: Date | null;
  pipedriveActivityId: number | null;
  syncedToPipedrive: boolean;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateDealDTO {
  title: string;
  pipedriveDealId?: number | null;
  pipedrivePersonId?: number | null;
  pipedriveOrgId?: number | null;
  value?: number | null;
  currency?: string;
  pipelineId?: number | null;
  pipelineName?: string | null;
  stageId?: number | null;
  stageName?: string | null;
  stageOrder?: number | null;
  status?: DealStatus;
  probability?: number | null;
  expectedCloseDate?: Date | null;
  wonTime?: Date | null;
  lostTime?: Date | null;
  closeTime?: Date | null;
  lostReason?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  organizationName?: string | null;
  organizationAddressStreet?: string | null;
  organizationAddressCity?: string | null;
  organizationAddressState?: string | null;
  organizationAddressPostalCode?: string | null;
  organizationAddressCountry?: string | null;
  customerId?: string | null;
  leadId?: string | null;
  ownerId?: string | null;
  pipedriveOwnerId?: number | null;
  pipedriveOwnerName?: string | null;
}

export interface UpdateDealDTO {
  title?: string;
  value?: number | null;
  currency?: string;
  pipelineId?: number | null;
  pipelineName?: string | null;
  stageId?: number | null;
  stageName?: string | null;
  stageOrder?: number | null;
  status?: DealStatus;
  probability?: number | null;
  expectedCloseDate?: Date | null;
  wonTime?: Date | null;
  lostTime?: Date | null;
  closeTime?: Date | null;
  lostReason?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  organizationName?: string | null;
  organizationAddressStreet?: string | null;
  organizationAddressCity?: string | null;
  organizationAddressState?: string | null;
  organizationAddressPostalCode?: string | null;
  organizationAddressCountry?: string | null;
  customerId?: string | null;
  leadId?: string | null;
  ownerId?: string | null;
  // Pipedrive IDs for sync
  pipedriveDealId?: number | null;
  pipedrivePersonId?: number | null;
  pipedriveOrgId?: number | null;
  pipedriveOwnerId?: number | null;
  pipedriveOwnerName?: string | null;
}

export interface CreateDealNoteDTO {
  dealId: string;
  content: string;
  syncToPipedrive?: boolean;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface DealListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DealStatus;
  pipelineId?: number;
  stageId?: number;
  ownerId?: string;
  customerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DealListItem {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  pipelineName: string | null;
  stageName: string | null;
  stageOrder: number | null;
  status: DealStatus;
  probability: number | null;
  expectedCloseDate: string | null;
  contactName: string | null;
  contactEmail: string | null;
  organizationName: string | null;
  ownerName: string | null;
  pipedriveDealId: number | null;
  customerId: string | null;
  leadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedDealResult {
  data: DealListItem[];
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
// SYNC TYPES
// ============================================

export interface DealSyncResult {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: Array<{
    pipedriveDealId: number;
    error: string;
  }>;
}

export interface DealFromPipedrive {
  pipedriveDealId: number;
  pipedrivePersonId: number | null;
  pipedriveOrgId: number | null;
  title: string;
  value: number | null;
  currency: string;
  pipelineId: number | null;
  pipelineName: string | null;
  stageId: number | null;
  stageName: string | null;
  stageOrder: number | null;
  status: DealStatus;
  probability: number | null;
  expectedCloseDate: Date | null;
  wonTime: Date | null;
  lostTime: Date | null;
  closeTime: Date | null;
  lostReason: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  organizationName: string | null;
  pipedriveOwnerId: number | null;
  pipedriveOwnerName: string | null;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface DealsTableProps {
  data: DealListItem[];
  isLoading?: boolean;
  onRowClick?: (deal: DealListItem) => void;
  onView?: (deal: DealListItem) => void;
  onEdit?: (deal: DealListItem) => void;
  onDelete?: (deal: DealListItem) => void;
  onRefresh?: () => void;
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

export interface DealDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  dealId: string | null;
  onEdit?: (deal: Deal) => void;
}

export interface SyncDealsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: DealSyncResult) => void;
}
