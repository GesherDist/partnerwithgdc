/**
 * CRM Provider Interface
 *
 * Interface for CRM integrations like Pipedrive, HubSpot, Salesforce, etc.
 */

import type { IBaseProvider, ISyncableProvider } from './base.provider';

// ============================================
// CRM ENTITY TYPES
// ============================================

/**
 * Contact data for CRM systems
 */
export interface CrmContact {
  id?: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  organizationId?: string;
  organizationExternalId?: string;
  address?: CrmAddress;
  notes?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Organization/Company data for CRM systems
 */
export interface CrmOrganization {
  id?: string;
  externalId?: string;
  name: string;
  address?: CrmAddress;
  phone?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  notes?: string;
  ownerId?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Deal/Opportunity data for CRM systems
 */
export interface CrmDeal {
  id?: string;
  externalId?: string;
  title: string;
  value?: number;
  currency?: string;
  status?: 'open' | 'won' | 'lost';
  stage?: string;
  stageId?: string;
  probability?: number;
  expectedCloseDate?: string;
  contactId?: string;
  contactExternalId?: string;
  organizationId?: string;
  organizationExternalId?: string;
  ownerId?: string;
  pipelineId?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Activity data for CRM systems
 */
export interface CrmActivity {
  id?: string;
  externalId?: string;
  type: 'call' | 'meeting' | 'email' | 'task' | 'note' | 'other';
  subject: string;
  description?: string;
  dueDate?: string;
  completedDate?: string;
  done?: boolean;
  contactId?: string;
  contactExternalId?: string;
  dealId?: string;
  dealExternalId?: string;
  organizationId?: string;
  organizationExternalId?: string;
  ownerId?: string;
  duration?: number; // in minutes
  metadata?: Record<string, unknown>;
}

/**
 * Pipeline data for CRM systems
 */
export interface CrmPipeline {
  id: string;
  externalId?: string;
  name: string;
  stages: CrmPipelineStage[];
  active?: boolean;
}

/**
 * Pipeline stage
 */
export interface CrmPipelineStage {
  id: string;
  externalId?: string;
  name: string;
  order: number;
  probability?: number;
}

/**
 * Note data for CRM systems
 */
export interface CrmNote {
  id?: string;
  externalId?: string;
  content: string;
  contactId?: string;
  dealId?: string;
  organizationId?: string;
  leadId?: string; // Pipedrive Leads Inbox lead UUID
  pinnedToTop?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Address for CRM entities
 */
export interface CrmAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

// ============================================
// SYNC RESULTS
// ============================================

export interface ContactSyncResult {
  created: CrmContact[];
  updated: CrmContact[];
  failed: Array<{ contact: CrmContact; error: string }>;
}

export interface OrganizationSyncResult {
  created: CrmOrganization[];
  updated: CrmOrganization[];
  failed: Array<{ organization: CrmOrganization; error: string }>;
}

export interface DealSyncResult {
  created: CrmDeal[];
  updated: CrmDeal[];
  failed: Array<{ deal: CrmDeal; error: string }>;
}

// ============================================
// CRM PROVIDER INTERFACE
// ============================================

/**
 * Interface for CRM providers (Pipedrive, HubSpot, Salesforce, etc.)
 */
export interface ICrmProvider extends IBaseProvider, ISyncableProvider {
  // ============================================
  // CONTACTS
  // ============================================

  /**
   * Get all contacts from CRM
   */
  getContacts(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<CrmContact[]>;

  /**
   * Get a single contact by external ID
   */
  getContact(connectionId: string, externalId: string): Promise<CrmContact | null>;

  /**
   * Create a contact in CRM
   */
  createContact(connectionId: string, contact: CrmContact): Promise<CrmContact>;

  /**
   * Update a contact in CRM
   */
  updateContact(
    connectionId: string,
    externalId: string,
    contact: Partial<CrmContact>
  ): Promise<CrmContact>;

  /**
   * Delete a contact from CRM
   */
  deleteContact(connectionId: string, externalId: string): Promise<void>;

  /**
   * Sync contacts
   */
  syncContacts(connectionId: string, contacts: CrmContact[]): Promise<ContactSyncResult>;

  // ============================================
  // ORGANIZATIONS
  // ============================================

  /**
   * Get all organizations from CRM
   */
  getOrganizations(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<CrmOrganization[]>;

  /**
   * Get a single organization by external ID
   */
  getOrganization(connectionId: string, externalId: string): Promise<CrmOrganization | null>;

  /**
   * Create an organization in CRM
   */
  createOrganization(
    connectionId: string,
    organization: CrmOrganization
  ): Promise<CrmOrganization>;

  /**
   * Update an organization in CRM
   */
  updateOrganization(
    connectionId: string,
    externalId: string,
    organization: Partial<CrmOrganization>
  ): Promise<CrmOrganization>;

  /**
   * Delete an organization from CRM
   */
  deleteOrganization(connectionId: string, externalId: string): Promise<void>;

  /**
   * Sync organizations
   */
  syncOrganizations(
    connectionId: string,
    organizations: CrmOrganization[]
  ): Promise<OrganizationSyncResult>;

  // ============================================
  // DEALS
  // ============================================

  /**
   * Get all deals from CRM
   */
  getDeals(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number; status?: string }
  ): Promise<CrmDeal[]>;

  /**
   * Get a single deal by external ID
   */
  getDeal(connectionId: string, externalId: string): Promise<CrmDeal | null>;

  /**
   * Create a deal in CRM
   */
  createDeal(connectionId: string, deal: CrmDeal): Promise<CrmDeal>;

  /**
   * Update a deal in CRM
   */
  updateDeal(connectionId: string, externalId: string, deal: Partial<CrmDeal>): Promise<CrmDeal>;

  /**
   * Delete a deal from CRM
   */
  deleteDeal(connectionId: string, externalId: string): Promise<void>;

  /**
   * Sync deals
   */
  syncDeals(connectionId: string, deals: CrmDeal[]): Promise<DealSyncResult>;

  // ============================================
  // ACTIVITIES
  // ============================================

  /**
   * Get activities from CRM
   */
  getActivities(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number; type?: string }
  ): Promise<CrmActivity[]>;

  /**
   * Create an activity in CRM
   */
  createActivity(connectionId: string, activity: CrmActivity): Promise<CrmActivity>;

  /**
   * Update an activity in CRM
   */
  updateActivity(
    connectionId: string,
    externalId: string,
    activity: Partial<CrmActivity>
  ): Promise<CrmActivity>;

  /**
   * Delete an activity from CRM
   */
  deleteActivity(connectionId: string, externalId: string): Promise<void>;

  // ============================================
  // NOTES
  // ============================================

  /**
   * Get notes from CRM
   */
  getNotes(
    connectionId: string,
    options?: { contactId?: string; dealId?: string; organizationId?: string; limit?: number }
  ): Promise<CrmNote[]>;

  /**
   * Create a note in CRM
   */
  createNote(connectionId: string, note: CrmNote): Promise<CrmNote>;

  /**
   * Update a note in CRM
   */
  updateNote(connectionId: string, externalId: string, note: Partial<CrmNote>): Promise<CrmNote>;

  /**
   * Delete a note from CRM
   */
  deleteNote(connectionId: string, externalId: string): Promise<void>;

  // ============================================
  // PIPELINES
  // ============================================

  /**
   * Get all pipelines from CRM
   */
  getPipelines(connectionId: string): Promise<CrmPipeline[]>;

  /**
   * Get a single pipeline by ID
   */
  getPipeline(connectionId: string, externalId: string): Promise<CrmPipeline | null>;
}
