/**
 * Pipedrive-specific Types
 *
 * Type definitions specific to Pipedrive CRM integration.
 */

// ============================================
// OAUTH TYPES
// ============================================

/**
 * Pipedrive OAuth token response
 */
export interface PipedriveTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
  api_domain: string;
}

/**
 * Pipedrive OAuth error response
 */
export interface PipedriveErrorResponse {
  error: string;
  error_description?: string;
}

// ============================================
// API TYPES
// ============================================

/**
 * Pipedrive API response wrapper
 */
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
}

/**
 * Pipedrive person (contact)
 */
export interface PipedrivePerson {
  id?: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: Array<{ value: string; primary: boolean; label?: string }>;
  phone?: Array<{ value: string; primary: boolean; label?: string }>;
  org_id?: number | { value: number; name?: string };
  owner_id?: number | { id: number; name?: string };
  visible_to?: string;
  label?: number;
  add_time?: string;
  update_time?: string;
  active_flag?: boolean;
  notes?: string;
  custom_fields?: Record<string, unknown>;
}

/**
 * Pipedrive organization
 */
export interface PipedriveOrganization {
  id?: number;
  name: string;
  owner_id?: number | { id: number; name?: string };
  address?: string;
  address_street_number?: string;
  address_route?: string;
  address_locality?: string;
  address_admin_area_level_1?: string;
  address_postal_code?: string;
  address_country?: string;
  visible_to?: string;
  label?: number;
  add_time?: string;
  update_time?: string;
  active_flag?: boolean;
  people_count?: number;
  cc_email?: string;
  custom_fields?: Record<string, unknown>;
}

/**
 * Pipedrive Lead Label
 */
export interface PipedriveLeadLabel {
  id: string; // UUID
  name: string; // e.g., "HOT", "WARM", "COLD"
  color: string; // Color hex code
  add_time?: string;
  update_time?: string;
}

/**
 * Pipedrive Lead (from Leads Inbox - different from Person)
 */
export interface PipedriveLead {
  id: string; // UUID, not integer
  title: string;
  owner_id?: number;
  creator_id?: number;
  label_ids?: string[];
  person_id?: number;
  organization_id?: number;
  source_name?: string;
  is_archived?: boolean;
  was_seen?: boolean;
  value?: {
    amount: number;
    currency: string;
  };
  expected_close_date?: string;
  next_activity_id?: number;
  add_time?: string;
  update_time?: string;
  visible_to?: string;
  cc_email?: string;
  // Embedded person object (when using ?include=person)
  person?: {
    id: number;
    name: string;
    email?: Array<{ value: string; primary: boolean }>;
    phone?: Array<{ value: string; primary: boolean }>;
  };
  // Embedded organization object (when using ?include=organization)
  organization?: {
    id: number;
    name: string;
    address?: string;
  };
}

/**
 * Pipedrive deal
 */
export interface PipedriveDeal {
  id?: number;
  title: string;
  value?: number;
  currency?: string;
  person_id?: number | { value: number; name?: string };
  org_id?: number | { value: number; name?: string };
  pipeline_id?: number;
  stage_id?: number;
  user_id?: number | { id: number; name?: string };
  status?: 'open' | 'won' | 'lost' | 'deleted';
  probability?: number;
  expected_close_date?: string;
  won_time?: string;
  lost_time?: string;
  add_time?: string;
  update_time?: string;
  visible_to?: string;
  label?: number;
  lost_reason?: string;
  custom_fields?: Record<string, unknown>;
}

/**
 * Pipedrive activity
 */
export interface PipedriveActivity {
  id?: number;
  type: string;
  subject: string;
  note?: string;
  done?: boolean;
  due_date?: string;
  due_time?: string;
  duration?: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  user_id?: number;
  add_time?: string;
  update_time?: string;
  marked_as_done_time?: string;
  busy_flag?: boolean;
  location?: string;
  public_description?: string;
}

/**
 * Pipedrive note
 */
export interface PipedriveNote {
  id?: number;
  content: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  lead_id?: string;
  user_id?: number;
  add_time?: string;
  update_time?: string;
  pinned_to_deal_flag?: boolean;
  pinned_to_person_flag?: boolean;
  pinned_to_organization_flag?: boolean;
  pinned_to_lead_flag?: boolean;
}

/**
 * Pipedrive pipeline
 */
export interface PipedrivePipeline {
  id: number;
  name: string;
  url_title?: string;
  order_nr?: number;
  active?: boolean;
  deal_probability?: boolean;
  add_time?: string;
  update_time?: string;
}

/**
 * Pipedrive stage
 */
export interface PipedriveStage {
  id: number;
  name: string;
  pipeline_id: number;
  order_nr: number;
  active_flag?: boolean;
  deal_probability?: number;
  rotten_flag?: boolean;
  rotten_days?: number;
  add_time?: string;
  update_time?: string;
}

/**
 * Pipedrive user info
 */
export interface PipedriveUser {
  id: number;
  name: string;
  email: string;
  default_currency?: string;
  locale?: string;
  company_id?: number;
  company_name?: string;
  company_domain?: string;
  is_admin?: boolean;
  timezone_name?: string;
  timezone_offset?: string;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * Pipedrive provider configuration
 */
export interface PipedriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: string;
}

/**
 * Pipedrive connection metadata stored in JSONB
 */
export interface PipedriveConnectionMetadata {
  apiDomain: string;
  companyId?: number;
  companyName?: string;
  companyDomain?: string;
  userId?: number;
  userName?: string;
  lastContactSync?: string;
  lastDealSync?: string;
  lastActivitySync?: string;
  [key: string]: unknown;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Connection status response for UI
 */
export interface PipedriveStatusResponse {
  connected: boolean;
  companyName?: string;
  companyDomain?: string;
  userName?: string;
  connectedAt?: string;
  tokenExpiresAt?: string;
  status?: string;
  errorMessage?: string;
}
