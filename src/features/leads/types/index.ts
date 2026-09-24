/**
 * Leads Module Types
 *
 * Type definitions for the Leads feature.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'deal' | 'converted' | 'lost';

export const LEAD_STATUSES: LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'deal',      // Converted to deal (not customer yet)
  'converted', // Converted to customer (deal won)
  'lost',
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  deal: 'Deal',        // Converted to deal, pending won/lost
  converted: 'Customer', // Converted to customer (deal won)
  lost: 'Lost',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border border-blue-200',
  contacted: 'bg-sky-100 text-sky-800 border border-sky-200',
  qualified: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  proposal: 'bg-purple-100 text-purple-800 border border-purple-200',
  negotiation: 'bg-amber-100 text-amber-800 border border-amber-200',
  deal: 'bg-cyan-100 text-cyan-800 border border-cyan-200',
  converted: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  lost: 'bg-red-100 text-red-800 border border-red-200',
};

export type LeadSource = 'pipedrive' | 'trade_show' | 'referral' | 'cold_call' | 'website' | 'email' | 'manual' | 'other';

export const LEAD_SOURCES: LeadSource[] = [
  'pipedrive',
  'trade_show',
  'referral',
  'cold_call',
  'website',
  'email',
  'manual',
  'other',
];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  pipedrive: 'Pipedrive',
  trade_show: 'Trade Show',
  referral: 'Referral',
  cold_call: 'Cold Call',
  website: 'Website',
  email: 'Email',
  manual: 'Manual Entry',
  other: 'Other',
};

export type DealStatus = 'open' | 'won' | 'lost';

export const DEAL_STATUSES: DealStatus[] = ['open', 'won', 'lost'];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Lead entity from database
 */
export interface Lead {
  id: string;

  // Basic Info
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;

  // Address
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;

  // Pipedrive IDs
  pipedrivePersonId: number | null;
  pipedriveDealId: number | null;
  pipedriveOrgId: number | null;
  pipedriveLeadId: string | null; // UUID from Leads Inbox
  pipedriveLabels: string[] | null; // Labels from Pipedrive (e.g., ["HOT", "Qualified"])

  // Deal Info
  dealTitle: string | null;
  dealValue: number | null;
  dealCurrency: string;
  dealStage: string | null;
  dealStageId: number | null;
  dealPipeline: string | null;
  dealPipelineId: number | null;
  dealProbability: number | null;
  dealStatus: DealStatus | null;
  expectedCloseDate: Date | null;
  dealWonTime: Date | null;
  dealLostTime: Date | null;
  dealLostReason: string | null;

  // Source & Status
  source: LeadSource;
  sourceDetail: string | null;
  status: LeadStatus;

  // Owner
  ownerId: string | null;
  pipedriveOwnerId: number | null;
  pipedriveOwnerName: string | null;

  // Notes
  notes: string | null;

  // Conversion
  convertedDealId: string | null;     // ID of deal when converted to deal (before customer)
  convertedCustomerId: string | null; // ID of customer when deal is won
  convertedAt: Date | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Lead Note entity from database
 */
export interface LeadNote {
  id: string;
  leadId: string;
  content: string;
  pipedriveNoteId: number | null;
  syncedToPipedrive: boolean;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  createdByName?: string | null;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateLeadDTO {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
  pipedrivePersonId?: number | null;
  pipedriveDealId?: number | null;
  pipedriveOrgId?: number | null;
  pipedriveLeadId?: string | null; // UUID from Leads Inbox
  pipedriveLabels?: string[] | null; // Labels from Pipedrive
  dealTitle?: string | null;
  dealValue?: number | null;
  dealCurrency?: string;
  dealStage?: string | null;
  dealStageId?: number | null;
  dealPipeline?: string | null;
  dealPipelineId?: number | null;
  dealProbability?: number | null;
  dealStatus?: DealStatus | null;
  expectedCloseDate?: Date | null;
  source?: LeadSource;
  sourceDetail?: string | null;
  status?: LeadStatus;
  ownerId?: string | null;
  pipedriveOwnerId?: number | null;
  pipedriveOwnerName?: string | null;
  notes?: string | null;
}

export interface UpdateLeadDTO {
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
  dealTitle?: string | null;
  dealValue?: number | null;
  dealStage?: string | null;
  dealStageId?: number | null;
  dealPipeline?: string | null;
  dealPipelineId?: number | null;
  dealProbability?: number | null;
  dealStatus?: DealStatus | null;
  expectedCloseDate?: Date | null;
  dealWonTime?: Date | null;
  dealLostTime?: Date | null;
  dealLostReason?: string | null;
  source?: LeadSource;
  sourceDetail?: string | null;
  status?: LeadStatus;
  ownerId?: string | null;
  notes?: string | null;
  // Pipedrive IDs (for sync)
  pipedriveLeadId?: string | null;
  pipedrivePersonId?: number | null;
  pipedriveDealId?: number | null;
  pipedriveOrgId?: number | null;
  // Pipedrive Labels (array of label names)
  pipedriveLabels?: string[] | null;
}

export interface ConvertLeadDTO {
  leadId?: string; // Optional - usually passed as separate parameter
  customerId?: string; // If linking to existing customer
  createCustomer?: boolean; // If creating new customer
  customerData?: {
    name: string;
    email?: string;
    phone?: string;
    channel?: 'oem' | 'dealer';
    addressStreet?: string;
    addressCity?: string;
    addressState?: string;
    addressPostalCode?: string;
    addressCountry?: string;
  };
}

export interface CreateLeadNoteDTO {
  leadId: string;
  content: string;
  syncToPipedrive?: boolean;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface LeadListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus;
  source?: LeadSource;
  dealStatus?: DealStatus;
  pipelineId?: number;
  ownerId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeConverted?: boolean;
}

export interface LeadListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  dealTitle: string | null;
  dealValue: number | null;
  dealCurrency: string;
  dealStage: string | null;
  dealPipeline: string | null;
  dealStatus: DealStatus | null;
  expectedCloseDate: string | null;
  source: LeadSource;
  sourceDetail: string | null;
  status: LeadStatus;
  ownerName: string | null;
  pipedriveLeadId: string | null;
  pipedrivePersonId: number | null;
  pipedriveDealId: number | null;
  pipedriveLabels: string[] | null;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedLeadResult {
  data: LeadListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Alias for backward compatibility
export type LeadListResult = PaginatedLeadResult;

// ============================================
// SYNC TYPES
// ============================================

export interface PipedriveSyncResult {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: Array<{
    pipedriveId: number;
    error: string;
  }>;
}

export interface LeadFromPipedrive {
  pipedrivePersonId: number;
  pipedriveOrgId: number | null;
  pipedriveDealId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  dealTitle: string | null;
  dealValue: number | null;
  dealCurrency: string;
  dealStage: string | null;
  dealStageId: number | null;
  dealPipeline: string | null;
  dealPipelineId: number | null;
  dealProbability: number | null;
  dealStatus: DealStatus | null;
  expectedCloseDate: Date | null;
  pipedriveOwnerId: number | null;
  pipedriveOwnerName: string | null;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface LeadsTableProps {
  data: LeadListItem[];
  isLoading?: boolean;
  onRowClick?: (lead: LeadListItem) => void;
  onView?: (lead: LeadListItem) => void;
  onEdit?: (lead: LeadListItem) => void;
  onConvert?: (lead: LeadListItem) => void;
  onDelete?: (lead: LeadListItem) => void;
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

export interface LeadDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  onEdit?: (lead: Lead) => void;
  onConvert?: (lead: Lead) => void;
}

export interface CreateLeadDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditLeadDrawerProps {
  open: boolean;
  onClose: () => void;
  leadId: string;
  onSuccess?: () => void;
}

export interface ConvertLeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead: Lead | LeadListItem;
  onSuccess?: (customerId: string) => void;
}

export interface SyncFromPipedriveDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: PipedriveSyncResult) => void;
}
