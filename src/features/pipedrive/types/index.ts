/**
 * Pipedrive Integration Types
 *
 * Type definitions for Pipedrive API responses and internal use.
 */

// ============================================
// PIPEDRIVE API TYPES
// ============================================

/**
 * Pipedrive Person (Contact)
 */
export interface PipedrivePerson {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: PipedriveEmail[];
  phone: PipedrivePhone[];
  org_id: PipedriveOrganizationRef | null;
  owner_id: PipedriveUserRef | null;
  active_flag: boolean;
  add_time: string;
  update_time: string;
  visible_to: string;
  label: number | null;
  // Custom fields are dynamic
  [key: string]: unknown;
}

export interface PipedriveEmail {
  value: string;
  primary: boolean;
  label: string;
}

export interface PipedrivePhone {
  value: string;
  primary: boolean;
  label: string;
}

export interface PipedriveOrganizationRef {
  name: string;
  people_count: number;
  owner_id: number;
  address: string | null;
  active_flag: boolean;
  cc_email: string;
  value: number;
}

export interface PipedriveUserRef {
  id: number;
  name: string;
  email: string;
  has_pic: boolean;
  pic_hash: string | null;
  active_flag: boolean;
  value: number;
}

/**
 * Pipedrive Organization
 */
export interface PipedriveOrganization {
  id: number;
  name: string;
  owner_id: PipedriveUserRef | null;
  address: string | null;
  address_street_number: string | null;
  address_route: string | null;
  address_sublocality: string | null;
  address_locality: string | null;
  address_admin_area_level_1: string | null;
  address_admin_area_level_2: string | null;
  address_country: string | null;
  address_postal_code: string | null;
  active_flag: boolean;
  cc_email: string;
  add_time: string;
  update_time: string;
  visible_to: string;
  [key: string]: unknown;
}

/**
 * Pipedrive Deal
 */
export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won' | 'lost' | 'deleted';
  stage_id: number;
  pipeline_id: number;
  person_id: PipedrivePersonRef | null;
  org_id: PipedriveOrganizationRef | null;
  user_id: PipedriveUserRef | null;
  expected_close_date: string | null;
  probability: number | null;
  won_time: string | null;
  lost_time: string | null;
  lost_reason: string | null;
  add_time: string;
  update_time: string;
  stage_change_time: string | null;
  active: boolean;
  deleted: boolean;
  close_time: string | null;
  visible_to: string;
  [key: string]: unknown;
}

export interface PipedrivePersonRef {
  name: string;
  email: PipedriveEmail[];
  phone: PipedrivePhone[];
  value: number;
  active_flag: boolean;
}

/**
 * Pipedrive Pipeline
 */
export interface PipedrivePipeline {
  id: number;
  name: string;
  url_title: string;
  order_nr: number;
  active: boolean;
  deal_probability: boolean;
  add_time: string;
  update_time: string;
}

/**
 * Pipedrive Stage
 */
export interface PipedriveStage {
  id: number;
  name: string;
  pipeline_id: number;
  order_nr: number;
  active_flag: boolean;
  deal_probability: number;
  rotten_flag: boolean;
  rotten_days: number | null;
  add_time: string;
  update_time: string;
}

/**
 * Pipedrive Note
 */
export interface PipedriveNote {
  id: number;
  content: string;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  user_id: number;
  add_time: string;
  update_time: string;
  active_flag: boolean;
  pinned_to_deal_flag: boolean;
  pinned_to_person_flag: boolean;
  pinned_to_organization_flag: boolean;
}

/**
 * Pipedrive Activity
 */
export interface PipedriveActivity {
  id: number;
  type: string;
  subject: string;
  note: string | null;
  due_date: string;
  due_time: string | null;
  duration: string | null;
  done: boolean;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  user_id: number;
  add_time: string;
  update_time: string;
  marked_as_done_time: string | null;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PipedriveApiResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
  related_objects?: Record<string, unknown>;
}

export interface PipedriveListResponse<T> {
  success: boolean;
  data: T[] | null;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
}

export interface PipedriveError {
  success: false;
  error: string;
  error_info?: string;
  errorCode?: number;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export interface PipedriveWebhookPayload {
  v: number;
  matches_filters: {
    current: unknown[];
    previous: unknown[];
  };
  meta: {
    action: 'added' | 'updated' | 'deleted' | 'merged';
    change_source: string;
    company_id: number;
    host: string;
    id: number;
    is_bulk_update: boolean;
    matches_filters: unknown;
    object: 'deal' | 'person' | 'organization' | 'note' | 'activity';
    permitted_user_ids: number[];
    pipedrive_service_name: string;
    timestamp: number;
    timestamp_micro: number;
    trans_pending: boolean;
    user_id: number;
    v: number;
    webhook_id: string;
  };
  current: unknown;
  previous: unknown;
  event: string;
}

export interface PipedriveWebhookDealPayload extends PipedriveWebhookPayload {
  current: PipedriveDeal | null;
  previous: PipedriveDeal | null;
}

export interface PipedriveWebhookPersonPayload extends PipedriveWebhookPayload {
  current: PipedrivePerson | null;
  previous: PipedrivePerson | null;
}

export interface PipedriveWebhookNotePayload extends PipedriveWebhookPayload {
  current: PipedriveNote | null;
  previous: PipedriveNote | null;
}

// ============================================
// INTERNAL TYPES (for mapping)
// ============================================

export interface PipedrivePersonMapped {
  pipedrivePersonId: number;
  pipedriveOrgId: number | null;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  ownerId: number | null;
  ownerName: string | null;
  isActive: boolean;
  addedAt: Date;
  updatedAt: Date;
}

export interface PipedriveDealMapped {
  pipedriveDealId: number;
  pipedrivePersonId: number | null;
  pipedriveOrgId: number | null;
  title: string;
  value: number;
  currency: string;
  status: 'open' | 'won' | 'lost';
  stageId: number;
  stageName?: string;
  pipelineId: number;
  pipelineName?: string;
  probability: number | null;
  expectedCloseDate: Date | null;
  wonTime: Date | null;
  lostTime: Date | null;
  lostReason: string | null;
  ownerId: number | null;
  ownerName: string | null;
  addedAt: Date;
  updatedAt: Date;
}

// ============================================
// SYNC TYPES
// ============================================

export type SyncDirection = 'inbound' | 'outbound';
export type SyncEventType = 'sync' | 'webhook' | 'push';
export type SyncEntityType = 'person' | 'deal' | 'note' | 'organization' | 'lead';
export type SyncStatus = 'success' | 'failed' | 'skipped';

export interface SyncLogEntry {
  eventType: SyncEventType;
  direction: SyncDirection;
  entityType: SyncEntityType;
  entityId?: string;
  pipedriveId?: number;
  payload?: unknown;
  status: SyncStatus;
  errorMessage?: string;
}

// ============================================
// FILTER TYPES
// ============================================

export interface PipedriveFilterParams {
  start?: number;
  limit?: number;
  sort?: string;
  filter_id?: number;
}

export interface PipedrivePersonFilterParams extends PipedriveFilterParams {
  org_id?: number;
  owner_id?: number;
}

export interface PipedriveDealFilterParams extends PipedriveFilterParams {
  user_id?: number;
  stage_id?: number;
  pipeline_id?: number;
  status?: 'all_not_deleted' | 'open' | 'won' | 'lost' | 'deleted';
  person_id?: number;
  org_id?: number;
}

// ============================================
// CREATE/UPDATE DTOs
// ============================================

export interface CreatePipedrivePersonDTO {
  name: string;
  email?: string | PipedriveEmail[];
  phone?: string | PipedrivePhone[];
  org_id?: number;
  owner_id?: number;
  visible_to?: '1' | '3' | '5' | '7'; // owner, owner's group, entire company, owner's followers
  [key: string]: unknown; // Custom fields
}

export interface UpdatePipedrivePersonDTO {
  name?: string;
  email?: string | PipedriveEmail[];
  phone?: string | PipedrivePhone[];
  org_id?: number;
  owner_id?: number;
  visible_to?: '1' | '3' | '5' | '7';
  [key: string]: unknown;
}

export interface CreatePipedriveDealDTO {
  title: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  status?: 'open' | 'won' | 'lost';
  expected_close_date?: string;
  probability?: number;
  visible_to?: '1' | '3' | '5' | '7';
  [key: string]: unknown;
}

export interface UpdatePipedriveDealDTO {
  title?: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  status?: 'open' | 'won' | 'lost';
  expected_close_date?: string;
  probability?: number;
  won_time?: string;
  lost_time?: string;
  lost_reason?: string;
  visible_to?: '1' | '3' | '5' | '7';
  [key: string]: unknown;
}

export interface CreatePipedriveNoteDTO {
  content: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  pinned_to_deal_flag?: boolean;
  pinned_to_person_flag?: boolean;
  pinned_to_organization_flag?: boolean;
}

export interface CreatePipedriveActivityDTO {
  subject: string;
  type: string;
  due_date: string;
  due_time?: string;
  duration?: string;
  note?: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  done?: boolean;
}
