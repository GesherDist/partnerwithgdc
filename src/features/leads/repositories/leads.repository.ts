/**
 * Leads Repository
 *
 * Database operations for the Leads module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Lead,
  LeadNote,
  LeadListItem,
  LeadListParams,
  PaginatedLeadResult,
  CreateLeadDTO,
  UpdateLeadDTO,
  CreateLeadNoteDTO,
} from '../types';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  pipedrive_person_id: number | null;
  pipedrive_deal_id: number | null;
  pipedrive_org_id: number | null;
  pipedrive_lead_id: string | null; // UUID from Leads Inbox
  pipedrive_labels: string[] | null; // Labels from Pipedrive
  deal_title: string | null;
  deal_value: number | null;
  deal_currency: string;
  deal_stage: string | null;
  deal_stage_id: number | null;
  deal_pipeline: string | null;
  deal_pipeline_id: number | null;
  deal_probability: number | null;
  deal_status: string | null;
  expected_close_date: string | null;
  deal_won_time: string | null;
  deal_lost_time: string | null;
  deal_lost_reason: string | null;
  source: string;
  source_detail: string | null;
  status: string;
  owner_id: string | null;
  pipedrive_owner_id: number | null;
  pipedrive_owner_name: string | null;
  notes: string | null;
  converted_deal_id: string | null;
  converted_customer_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface LeadNoteRow {
  id: string;
  lead_id: string;
  content: string;
  pipedrive_note_id: number | null;
  synced_to_pipedrive: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  created_by_user?: { first_name: string; last_name: string } | null;
}

// ============================================
// MAPPER FUNCTIONS
// ============================================

function mapRowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    addressStreet: row.address_street,
    addressCity: row.address_city,
    addressState: row.address_state,
    addressPostalCode: row.address_postal_code,
    addressCountry: row.address_country,
    pipedrivePersonId: row.pipedrive_person_id,
    pipedriveDealId: row.pipedrive_deal_id,
    pipedriveOrgId: row.pipedrive_org_id,
    pipedriveLeadId: row.pipedrive_lead_id,
    pipedriveLabels: row.pipedrive_labels || null,
    dealTitle: row.deal_title,
    dealValue: row.deal_value ? Number(row.deal_value) : null,
    dealCurrency: row.deal_currency || 'USD',
    dealStage: row.deal_stage,
    dealStageId: row.deal_stage_id,
    dealPipeline: row.deal_pipeline,
    dealPipelineId: row.deal_pipeline_id,
    dealProbability: row.deal_probability,
    dealStatus: row.deal_status as Lead['dealStatus'],
    expectedCloseDate: row.expected_close_date ? new Date(row.expected_close_date) : null,
    dealWonTime: row.deal_won_time ? new Date(row.deal_won_time) : null,
    dealLostTime: row.deal_lost_time ? new Date(row.deal_lost_time) : null,
    dealLostReason: row.deal_lost_reason,
    source: row.source as Lead['source'],
    sourceDetail: row.source_detail,
    status: row.status as Lead['status'],
    ownerId: row.owner_id,
    pipedriveOwnerId: row.pipedrive_owner_id,
    pipedriveOwnerName: row.pipedrive_owner_name,
    notes: row.notes,
    convertedDealId: row.converted_deal_id,
    convertedCustomerId: row.converted_customer_id,
    convertedAt: row.converted_at ? new Date(row.converted_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

function mapRowToLeadListItem(row: LeadRow & { owner_name?: string | null }): LeadListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    dealTitle: row.deal_title,
    dealValue: row.deal_value ? Number(row.deal_value) : null,
    dealCurrency: row.deal_currency || 'USD',
    dealStage: row.deal_stage,
    dealPipeline: row.deal_pipeline,
    dealStatus: row.deal_status as LeadListItem['dealStatus'],
    expectedCloseDate: row.expected_close_date,
    source: row.source as LeadListItem['source'],
    sourceDetail: row.source_detail,
    status: row.status as LeadListItem['status'],
    ownerName: row.owner_name || row.pipedrive_owner_name || null,
    pipedriveLeadId: row.pipedrive_lead_id,
    pipedrivePersonId: row.pipedrive_person_id,
    pipedriveDealId: row.pipedrive_deal_id,
    pipedriveLabels: row.pipedrive_labels || null,
    convertedCustomerId: row.converted_customer_id,
    convertedAt: row.converted_at,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToLeadNote(row: LeadNoteRow): LeadNote {
  return {
    id: row.id,
    leadId: row.lead_id,
    content: row.content,
    pipedriveNoteId: row.pipedrive_note_id,
    syncedToPipedrive: row.synced_to_pipedrive,
    syncedAt: row.synced_at ? new Date(row.synced_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    createdByName: row.created_by_user
      ? `${row.created_by_user.first_name} ${row.created_by_user.last_name}`.trim()
      : null,
  };
}

// ============================================
// REPOSITORY CLASS
// ============================================

class LeadsRepository {
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get a lead by ID
   */
  async getById(id: string): Promise<Lead | null> {
    console.log('[LeadsRepository.getById] Fetching lead:', id);
    const { data, error } = await db
      .from('leads')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      console.log('[LeadsRepository.getById] Lead not found or error:', error);
      return null;
    }

    console.log('[LeadsRepository.getById] Raw data from DB - name:', data.name, 'company:', data.company, 'updated_at:', data.updated_at);
    return mapRowToLead(data as LeadRow);
  }

  /**
   * Get a lead by Pipedrive Person ID
   */
  async getByPipedrivePersonId(pipedrivePersonId: number): Promise<Lead | null> {
    const { data, error } = await db
      .from('leads')
      .select('*')
      .eq('pipedrive_person_id', pipedrivePersonId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToLead(data as LeadRow);
  }

  /**
   * Get a lead by Pipedrive Deal ID
   */
  async getByPipedriveDealId(pipedriveDealId: number): Promise<Lead | null> {
    const { data, error } = await db
      .from('leads')
      .select('*')
      .eq('pipedrive_deal_id', pipedriveDealId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToLead(data as LeadRow);
  }

  /**
   * Get a lead by Pipedrive Lead ID (UUID from Leads Inbox)
   */
  async getByPipedriveLeadId(pipedriveLeadId: string): Promise<Lead | null> {
    const { data, error } = await db
      .from('leads')
      .select('*')
      .eq('pipedrive_lead_id', pipedriveLeadId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToLead(data as LeadRow);
  }

  /**
   * Get paginated list of leads
   */
  async list(params: LeadListParams = {}): Promise<PaginatedLeadResult> {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      source,
      dealStatus,
      pipelineId,
      ownerId,
      sortBy = 'created_at',
      sortOrder = 'desc',
      includeConverted = false,
    } = params;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('leads')
      .select('*, users!leads_owner_id_fkey(first_name, last_name)', { count: 'exact' })
      .is('deleted_at', null);

    // Filters
    if (!includeConverted) {
      // Exclude leads that are converted to deal or customer
      query = query.not('status', 'in', '("deal","converted")');
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (source) {
      query = query.eq('source', source);
    }

    if (dealStatus) {
      query = query.eq('deal_status', dealStatus);
    }

    if (pipelineId) {
      query = query.eq('deal_pipeline_id', pipelineId);
    }

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,deal_title.ilike.%${search}%`
      );
    }

    // Sorting
    const validSortFields = [
      'name',
      'company',
      'deal_value',
      'deal_stage',
      'status',
      'created_at',
      'updated_at',
      'expected_close_date',
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching leads:', error);
      throw new Error('Failed to fetch leads');
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // Map results with owner name
    const leads: LeadListItem[] = (data || []).map((row: LeadRow & { users?: { first_name: string; last_name: string } }) => {
      const ownerName = row.users
        ? `${row.users.first_name} ${row.users.last_name}`.trim()
        : null;

      return mapRowToLeadListItem({ ...row, owner_name: ownerName || undefined });
    });

    return {
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get lead count by status
   */
  async getCountByStatus(): Promise<Record<string, number>> {
    const { data, error } = await db
      .from('leads')
      .select('status')
      .is('deleted_at', null)
      .is('converted_customer_id', null);

    if (error) {
      console.error('Error counting leads:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((row: { status: string }) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get total deal value by pipeline
   */
  async getTotalDealValueByPipeline(): Promise<Array<{ pipeline: string; totalValue: number; count: number }>> {
    const { data, error } = await db
      .from('leads')
      .select('deal_pipeline, deal_value')
      .is('deleted_at', null)
      .is('converted_customer_id', null)
      .eq('deal_status', 'open');

    if (error) {
      console.error('Error getting deal values:', error);
      return [];
    }

    const pipelineMap: Record<string, { totalValue: number; count: number }> = {};

    (data || []).forEach((row: { deal_pipeline: string | null; deal_value: number | null }) => {
      const pipeline = row.deal_pipeline || 'Unknown';
      if (!pipelineMap[pipeline]) {
        pipelineMap[pipeline] = { totalValue: 0, count: 0 };
      }
      pipelineMap[pipeline].totalValue += Number(row.deal_value) || 0;
      pipelineMap[pipeline].count += 1;
    });

    return Object.entries(pipelineMap).map(([pipeline, data]) => ({
      pipeline,
      ...data,
    }));
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create a new lead
   */
  async create(dto: CreateLeadDTO, userId?: string): Promise<Lead> {
    const { data, error } = await db
      .from('leads')
      .insert({
        name: dto.name,
        email: dto.email || null,
        phone: dto.phone || null,
        company: dto.company || null,
        address_street: dto.addressStreet || null,
        address_city: dto.addressCity || null,
        address_state: dto.addressState || null,
        address_postal_code: dto.addressPostalCode || null,
        address_country: dto.addressCountry || null,
        pipedrive_person_id: dto.pipedrivePersonId || null,
        pipedrive_deal_id: dto.pipedriveDealId || null,
        pipedrive_org_id: dto.pipedriveOrgId || null,
        pipedrive_lead_id: dto.pipedriveLeadId || null,
        pipedrive_labels: dto.pipedriveLabels || [],
        deal_title: dto.dealTitle || null,
        deal_value: dto.dealValue || null,
        deal_currency: dto.dealCurrency || 'USD',
        deal_stage: dto.dealStage || null,
        deal_stage_id: dto.dealStageId || null,
        deal_pipeline: dto.dealPipeline || null,
        deal_pipeline_id: dto.dealPipelineId || null,
        deal_probability: dto.dealProbability || null,
        deal_status: dto.dealStatus || null,
        expected_close_date: dto.expectedCloseDate?.toISOString() || null,
        source: dto.source || 'manual',
        source_detail: dto.sourceDetail || null,
        status: dto.status || 'new',
        owner_id: dto.ownerId || null,
        pipedrive_owner_id: dto.pipedriveOwnerId || null,
        pipedrive_owner_name: dto.pipedriveOwnerName || null,
        notes: dto.notes || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating lead:', error);
      throw new Error('Failed to create lead');
    }

    return mapRowToLead(data as LeadRow);
  }

  /**
   * Update a lead
   */
  async update(id: string, dto: UpdateLeadDTO, userId?: string): Promise<Lead> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(), // Explicitly set updated_at
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.company !== undefined) updateData.company = dto.company;
    if (dto.addressStreet !== undefined) updateData.address_street = dto.addressStreet;
    if (dto.addressCity !== undefined) updateData.address_city = dto.addressCity;
    if (dto.addressState !== undefined) updateData.address_state = dto.addressState;
    if (dto.addressPostalCode !== undefined) updateData.address_postal_code = dto.addressPostalCode;
    if (dto.addressCountry !== undefined) updateData.address_country = dto.addressCountry;
    if (dto.dealTitle !== undefined) updateData.deal_title = dto.dealTitle;
    if (dto.dealValue !== undefined) updateData.deal_value = dto.dealValue;
    if (dto.dealStage !== undefined) updateData.deal_stage = dto.dealStage;
    if (dto.dealStageId !== undefined) updateData.deal_stage_id = dto.dealStageId;
    if (dto.dealPipeline !== undefined) updateData.deal_pipeline = dto.dealPipeline;
    if (dto.dealPipelineId !== undefined) updateData.deal_pipeline_id = dto.dealPipelineId;
    if (dto.dealProbability !== undefined) updateData.deal_probability = dto.dealProbability;
    if (dto.dealStatus !== undefined) updateData.deal_status = dto.dealStatus;
    if (dto.expectedCloseDate !== undefined) {
      updateData.expected_close_date = dto.expectedCloseDate?.toISOString() || null;
    }
    if (dto.dealWonTime !== undefined) {
      updateData.deal_won_time = dto.dealWonTime?.toISOString() || null;
    }
    if (dto.dealLostTime !== undefined) {
      updateData.deal_lost_time = dto.dealLostTime?.toISOString() || null;
    }
    if (dto.dealLostReason !== undefined) updateData.deal_lost_reason = dto.dealLostReason;
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.sourceDetail !== undefined) updateData.source_detail = dto.sourceDetail;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.ownerId !== undefined) updateData.owner_id = dto.ownerId;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    // Pipedrive IDs
    if (dto.pipedriveLeadId !== undefined) updateData.pipedrive_lead_id = dto.pipedriveLeadId;
    if (dto.pipedrivePersonId !== undefined) updateData.pipedrive_person_id = dto.pipedrivePersonId;
    if (dto.pipedriveOrgId !== undefined) updateData.pipedrive_org_id = dto.pipedriveOrgId;
    // Pipedrive Labels (array of label names)
    if (dto.pipedriveLabels !== undefined) updateData.pipedrive_labels = dto.pipedriveLabels;

    console.log('[LeadsRepository.update] Updating lead:', id);
    console.log('[LeadsRepository.update] DTO received:', JSON.stringify(dto, null, 2));
    console.log('[LeadsRepository.update] Update data to send:', JSON.stringify(updateData, null, 2));

    const { data, error, count, status, statusText } = await db
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    console.log('[LeadsRepository.update] Supabase response - status:', status, 'statusText:', statusText, 'count:', count);
    console.log('[LeadsRepository.update] Supabase returned data:', data ? JSON.stringify(data, null, 2) : 'null');
    console.log('[LeadsRepository.update] Supabase error:', error ? JSON.stringify(error, null, 2) : 'none');

    if (error || !data) {
      console.error('[LeadsRepository.update] Error updating lead:', error);
      throw new Error('Failed to update lead');
    }

    // Verify the data matches what we sent
    if (dto.name !== undefined && data.name !== dto.name) {
      console.error('[LeadsRepository.update] DATA MISMATCH! Sent name:', dto.name, 'Got back:', data.name);
    }
    if (dto.company !== undefined && data.company !== dto.company) {
      console.error('[LeadsRepository.update] DATA MISMATCH! Sent company:', dto.company, 'Got back:', data.company);
    }

    console.log('[LeadsRepository.update] Lead updated successfully. ID:', data.id, 'Name:', data.name, 'Company:', data.company);

    return mapRowToLead(data as LeadRow);
  }

  /**
   * Mark lead as converted to customer
   */
  async markAsConverted(leadId: string, customerId: string, userId?: string): Promise<Lead> {
    const { data, error } = await db
      .from('leads')
      .update({
        status: 'converted',
        converted_customer_id: customerId,
        converted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error converting lead:', error);
      throw new Error('Failed to convert lead');
    }

    return mapRowToLead(data as LeadRow);
  }

  /**
   * Mark lead as converted to deal (customer created later when deal is won)
   */
  async markAsConvertedToDeal(leadId: string, dealId: string, userId?: string): Promise<Lead> {
    const { data, error } = await db
      .from('leads')
      .update({
        status: 'deal', // New status: converted to deal (not customer yet)
        converted_deal_id: dealId,
        converted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error converting lead to deal:', error);
      throw new Error('Failed to convert lead to deal');
    }

    return mapRowToLead(data as LeadRow);
  }

  /**
   * Soft delete a lead
   */
  async delete(id: string, userId?: string): Promise<void> {
    const { error } = await db
      .from('leads')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting lead:', error);
      throw new Error('Failed to delete lead');
    }
  }

  /**
   * Get all Pipedrive person IDs from local leads
   * Used to detect deletions during sync
   */
  async getAllPipedrivePersonIds(): Promise<number[]> {
    const { data, error } = await db
      .from('leads')
      .select('pipedrive_person_id')
      .not('pipedrive_person_id', 'is', null)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching pipedrive person IDs:', error);
      return [];
    }

    return (data || [])
      .map((row: { pipedrive_person_id: number | null }) => row.pipedrive_person_id)
      .filter((id): id is number => id !== null);
  }

  /**
   * Soft delete leads by Pipedrive person IDs
   * Used when leads are deleted from Pipedrive
   */
  async softDeleteByPipedrivePersonIds(personIds: number[], userId?: string): Promise<number> {
    if (personIds.length === 0) return 0;

    const { data, error } = await db
      .from('leads')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .in('pipedrive_person_id', personIds)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      console.error('Error soft deleting leads:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get all Pipedrive Lead IDs (UUIDs from Leads Inbox) from local leads
   * Used to detect deletions during Leads Inbox sync
   */
  async getAllPipedriveLeadIds(): Promise<Array<{ id: string; pipedriveLeadId: string }>> {
    const { data, error } = await db
      .from('leads')
      .select('id, pipedrive_lead_id')
      .not('pipedrive_lead_id', 'is', null)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching pipedrive lead IDs:', error);
      return [];
    }

    return (data || [])
      .filter((row: { id: string; pipedrive_lead_id: string | null }) => row.pipedrive_lead_id !== null)
      .map((row: { id: string; pipedrive_lead_id: string }) => ({
        id: row.id,
        pipedriveLeadId: row.pipedrive_lead_id,
      }));
  }

  /**
   * Soft delete leads by Pipedrive Lead IDs (UUIDs)
   * Used when leads are deleted from Pipedrive Leads Inbox
   */
  async softDeleteByPipedriveLeadIds(leadIds: string[], userId?: string): Promise<number> {
    if (leadIds.length === 0) return 0;

    const { data, error } = await db
      .from('leads')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .in('pipedrive_lead_id', leadIds)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      console.error('Error soft deleting leads by pipedrive_lead_id:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Upsert lead from Pipedrive Persons API
   * Creates or updates based on pipedrive_person_id
   */
  async upsertFromPipedrive(dto: CreateLeadDTO, userId?: string): Promise<{ lead: Lead; isNew: boolean }> {
    if (!dto.pipedrivePersonId) {
      throw new Error('pipedrivePersonId is required for upsert');
    }

    const existing = await this.getByPipedrivePersonId(dto.pipedrivePersonId);

    if (existing) {
      // Use updateFromPipedrive for full field update including Pipedrive-specific fields
      const updated = await this.updateFromPipedrive(existing.id, dto, userId);
      return { lead: updated, isNew: false };
    }

    const created = await this.create(dto, userId);
    return { lead: created, isNew: true };
  }

  /**
   * Upsert lead from Pipedrive Leads Inbox API
   * Creates or updates based on pipedrive_lead_id (UUID)
   */
  async upsertFromPipedriveLeadsInbox(dto: CreateLeadDTO, userId?: string): Promise<{ lead: Lead; isNew: boolean }> {
    if (!dto.pipedriveLeadId) {
      throw new Error('pipedriveLeadId is required for Leads Inbox upsert');
    }

    const existing = await this.getByPipedriveLeadId(dto.pipedriveLeadId);

    if (existing) {
      // Use updateFromPipedrive for full field update including Pipedrive-specific fields
      const updated = await this.updateFromPipedrive(existing.id, dto, userId);
      return { lead: updated, isNew: false };
    }

    const created = await this.create(dto, userId);
    return { lead: created, isNew: true };
  }

  /**
   * Update lead from Pipedrive sync
   * Updates all fields including Pipedrive-specific ones
   */
  async updateFromPipedrive(id: string, dto: CreateLeadDTO, userId?: string): Promise<Lead> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
    };

    // Basic fields
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.company !== undefined) updateData.company = dto.company;

    // Address fields
    if (dto.addressStreet !== undefined) updateData.address_street = dto.addressStreet;
    if (dto.addressCity !== undefined) updateData.address_city = dto.addressCity;
    if (dto.addressState !== undefined) updateData.address_state = dto.addressState;
    if (dto.addressPostalCode !== undefined) updateData.address_postal_code = dto.addressPostalCode;
    if (dto.addressCountry !== undefined) updateData.address_country = dto.addressCountry;

    // Pipedrive IDs - these are critical for sync
    if (dto.pipedrivePersonId !== undefined) updateData.pipedrive_person_id = dto.pipedrivePersonId;
    if (dto.pipedriveDealId !== undefined) updateData.pipedrive_deal_id = dto.pipedriveDealId;
    if (dto.pipedriveOrgId !== undefined) updateData.pipedrive_org_id = dto.pipedriveOrgId;
    if (dto.pipedriveLeadId !== undefined) updateData.pipedrive_lead_id = dto.pipedriveLeadId;
    if (dto.pipedriveLabels !== undefined) updateData.pipedrive_labels = dto.pipedriveLabels;
    if (dto.pipedriveOwnerId !== undefined) updateData.pipedrive_owner_id = dto.pipedriveOwnerId;
    if (dto.pipedriveOwnerName !== undefined) updateData.pipedrive_owner_name = dto.pipedriveOwnerName;

    // Deal fields
    if (dto.dealTitle !== undefined) updateData.deal_title = dto.dealTitle;
    if (dto.dealValue !== undefined) updateData.deal_value = dto.dealValue;
    if (dto.dealCurrency !== undefined) updateData.deal_currency = dto.dealCurrency;
    if (dto.dealStage !== undefined) updateData.deal_stage = dto.dealStage;
    if (dto.dealStageId !== undefined) updateData.deal_stage_id = dto.dealStageId;
    if (dto.dealPipeline !== undefined) updateData.deal_pipeline = dto.dealPipeline;
    if (dto.dealPipelineId !== undefined) updateData.deal_pipeline_id = dto.dealPipelineId;
    if (dto.dealProbability !== undefined) updateData.deal_probability = dto.dealProbability;
    if (dto.dealStatus !== undefined) updateData.deal_status = dto.dealStatus;
    if (dto.expectedCloseDate !== undefined) {
      updateData.expected_close_date = dto.expectedCloseDate?.toISOString() || null;
    }

    // Source & Status
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.sourceDetail !== undefined) updateData.source_detail = dto.sourceDetail;
    if (dto.status !== undefined) updateData.status = dto.status;

    // Notes
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const { data, error } = await db
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating lead from Pipedrive:', error);
      throw new Error('Failed to update lead from Pipedrive');
    }

    return mapRowToLead(data as LeadRow);
  }

  // ============================================
  // NOTES OPERATIONS
  // ============================================

  /**
   * Get notes for a lead
   */
  async getNotes(leadId: string): Promise<LeadNote[]> {
    const { data, error } = await db
      .from('lead_notes')
      .select('*, created_by_user:users!lead_notes_created_by_fkey(first_name, last_name)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lead notes:', error);
      return [];
    }

    return (data || []).map((row: LeadNoteRow) => mapRowToLeadNote(row));
  }

  /**
   * Create a note for a lead
   */
  async createNote(dto: CreateLeadNoteDTO, userId?: string): Promise<LeadNote> {
    const { data, error } = await db
      .from('lead_notes')
      .insert({
        lead_id: dto.leadId,
        content: dto.content,
        synced_to_pipedrive: false,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating lead note:', error);
      throw new Error('Failed to create lead note');
    }

    return mapRowToLeadNote(data as LeadNoteRow);
  }

  /**
   * Add a note to a lead (simple version for webhook/actions)
   */
  async addNote(
    leadId: string,
    content: string,
    userId?: string,
    pipedriveNoteId?: number
  ): Promise<LeadNote> {
    const { data, error } = await db
      .from('lead_notes')
      .insert({
        lead_id: leadId,
        content,
        pipedrive_note_id: pipedriveNoteId || null,
        synced_to_pipedrive: !!pipedriveNoteId,
        synced_at: pipedriveNoteId ? new Date().toISOString() : null,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error adding lead note:', error);
      throw new Error('Failed to add lead note');
    }

    return mapRowToLeadNote(data as LeadNoteRow);
  }

  /**
   * Mark note as synced to Pipedrive
   */
  async markNoteSynced(noteId: string, pipedriveNoteId: number): Promise<void> {
    const { error } = await db
      .from('lead_notes')
      .update({
        pipedrive_note_id: pipedriveNoteId,
        synced_to_pipedrive: true,
        synced_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (error) {
      console.error('Error marking note as synced:', error);
    }
  }

  /**
   * Get a note by ID
   */
  async getNoteById(noteId: string): Promise<LeadNote | null> {
    const { data, error } = await db
      .from('lead_notes')
      .select('*, created_by_user:users!lead_notes_created_by_fkey(first_name, last_name)')
      .eq('id', noteId)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToLeadNote(data as LeadNoteRow);
  }

  /**
   * Update a note
   */
  async updateNote(noteId: string, content: string): Promise<LeadNote> {
    const { data, error } = await db
      .from('lead_notes')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId)
      .select('*, created_by_user:users!lead_notes_created_by_fkey(first_name, last_name)')
      .single();

    if (error || !data) {
      console.error('Error updating lead note:', error);
      throw new Error('Failed to update lead note');
    }

    return mapRowToLeadNote(data as LeadNoteRow);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    const { error } = await db
      .from('lead_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('Error deleting lead note:', error);
      throw new Error('Failed to delete lead note');
    }
  }

  /**
   * Update a note by Pipedrive Note ID
   * Used when syncing edits from Pipedrive
   */
  async updateNoteByPipedriveId(pipedriveNoteId: number, content: string): Promise<LeadNote | null> {
    const { data, error } = await db
      .from('lead_notes')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('pipedrive_note_id', pipedriveNoteId)
      .select('*, created_by_user:users!lead_notes_created_by_fkey(first_name, last_name)')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error updating lead note by Pipedrive ID:', error);
      throw new Error('Failed to update lead note');
    }

    return data ? mapRowToLeadNote(data as LeadNoteRow) : null;
  }

  /**
   * Delete notes by Pipedrive Note IDs
   * Used when syncing deletes from Pipedrive
   */
  async deleteNotesByPipedriveIds(pipedriveNoteIds: number[]): Promise<number> {
    if (pipedriveNoteIds.length === 0) return 0;

    const { data, error } = await db
      .from('lead_notes')
      .delete()
      .in('pipedrive_note_id', pipedriveNoteIds)
      .select('id');

    if (error) {
      console.error('Error deleting lead notes by Pipedrive IDs:', error);
      throw new Error('Failed to delete lead notes');
    }

    return data?.length || 0;
  }

  /**
   * Get note by Pipedrive Note ID
   */
  async getNoteByPipedriveId(pipedriveNoteId: number): Promise<LeadNote | null> {
    const { data, error } = await db
      .from('lead_notes')
      .select('*, created_by_user:users!lead_notes_created_by_fkey(first_name, last_name)')
      .eq('pipedrive_note_id', pipedriveNoteId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching lead note by Pipedrive ID:', error);
      return null;
    }

    return data ? mapRowToLeadNote(data as LeadNoteRow) : null;
  }
}

// Export singleton instance
export const leadsRepository = new LeadsRepository();
