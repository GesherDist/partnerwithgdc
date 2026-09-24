/**
 * Deals Repository
 *
 * Database operations for the Deals module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Deal,
  DealNote,
  DealListItem,
  DealListParams,
  PaginatedDealResult,
  CreateDealDTO,
  UpdateDealDTO,
  CreateDealNoteDTO,
} from '../types';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DealRow {
  id: string;
  title: string;
  pipedrive_deal_id: number | null;
  pipedrive_person_id: number | null;
  pipedrive_org_id: number | null;
  value: number | null;
  currency: string;
  pipeline_id: number | null;
  pipeline_name: string | null;
  stage_id: number | null;
  stage_name: string | null;
  stage_order: number | null;
  status: string;
  probability: number | null;
  expected_close_date: string | null;
  won_time: string | null;
  lost_time: string | null;
  close_time: string | null;
  lost_reason: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  organization_name: string | null;
  organization_address_street: string | null;
  organization_address_city: string | null;
  organization_address_state: string | null;
  organization_address_postal_code: string | null;
  organization_address_country: string | null;
  customer_id: string | null;
  lead_id: string | null;
  owner_id: string | null;
  pipedrive_owner_id: number | null;
  pipedrive_owner_name: string | null;
  pipedrive_synced_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DealNoteRow {
  id: string;
  deal_id: string;
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

function mapRowToDeal(row: DealRow): Deal {
  return {
    id: row.id,
    title: row.title,
    pipedriveDealId: row.pipedrive_deal_id,
    pipedrivePersonId: row.pipedrive_person_id,
    pipedriveOrgId: row.pipedrive_org_id,
    value: row.value ? Number(row.value) : null,
    currency: row.currency || 'USD',
    pipelineId: row.pipeline_id,
    pipelineName: row.pipeline_name,
    stageId: row.stage_id,
    stageName: row.stage_name,
    stageOrder: row.stage_order,
    status: row.status as Deal['status'],
    probability: row.probability,
    expectedCloseDate: row.expected_close_date ? new Date(row.expected_close_date) : null,
    wonTime: row.won_time ? new Date(row.won_time) : null,
    lostTime: row.lost_time ? new Date(row.lost_time) : null,
    closeTime: row.close_time ? new Date(row.close_time) : null,
    lostReason: row.lost_reason,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    organizationName: row.organization_name,
    organizationAddressStreet: row.organization_address_street,
    organizationAddressCity: row.organization_address_city,
    organizationAddressState: row.organization_address_state,
    organizationAddressPostalCode: row.organization_address_postal_code,
    organizationAddressCountry: row.organization_address_country,
    customerId: row.customer_id,
    leadId: row.lead_id,
    ownerId: row.owner_id,
    pipedriveOwnerId: row.pipedrive_owner_id,
    pipedriveOwnerName: row.pipedrive_owner_name,
    pipedriveSyncedAt: row.pipedrive_synced_at ? new Date(row.pipedrive_synced_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

function mapRowToDealListItem(row: DealRow & { owner_name?: string | null }): DealListItem {
  return {
    id: row.id,
    title: row.title,
    value: row.value ? Number(row.value) : null,
    currency: row.currency || 'USD',
    pipelineName: row.pipeline_name,
    stageName: row.stage_name,
    stageOrder: row.stage_order,
    status: row.status as DealListItem['status'],
    probability: row.probability,
    expectedCloseDate: row.expected_close_date,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    organizationName: row.organization_name,
    ownerName: row.owner_name || row.pipedrive_owner_name || null,
    pipedriveDealId: row.pipedrive_deal_id,
    customerId: row.customer_id,
    leadId: row.lead_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToDealNote(row: DealNoteRow): DealNote {
  return {
    id: row.id,
    dealId: row.deal_id,
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

class DealsRepository {
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get a deal by ID
   */
  async getById(id: string): Promise<Deal | null> {
    const { data, error } = await db
      .from('deals')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToDeal(data as DealRow);
  }

  /**
   * Get a deal by Pipedrive Deal ID
   */
  async getByPipedriveDealId(pipedriveDealId: number): Promise<Deal | null> {
    const { data, error } = await db
      .from('deals')
      .select('*')
      .eq('pipedrive_deal_id', pipedriveDealId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToDeal(data as DealRow);
  }

  /**
   * Get paginated list of deals
   */
  async list(params: DealListParams = {}): Promise<PaginatedDealResult> {
    const {
      page = 1,
      limit = 25,
      search,
      status,
      pipelineId,
      stageId,
      ownerId,
      customerId,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('deals')
      .select('*, users!deals_owner_id_fkey(first_name, last_name)', { count: 'exact' })
      .is('deleted_at', null);

    // Filters
    if (status) {
      query = query.eq('status', status);
    }

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId);
    }

    if (stageId) {
      query = query.eq('stage_id', stageId);
    }

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%,organization_name.ilike.%${search}%`
      );
    }

    // Sorting
    const validSortFields = [
      'title',
      'value',
      'stage_name',
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
      console.error('Error fetching deals:', error);
      throw new Error('Failed to fetch deals');
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // Map results with owner name
    const deals: DealListItem[] = (data || []).map((row: DealRow & { users?: { first_name: string; last_name: string } }) => {
      const ownerName = row.users
        ? `${row.users.first_name} ${row.users.last_name}`.trim()
        : null;

      return mapRowToDealListItem({ ...row, owner_name: ownerName || undefined });
    });

    return {
      data: deals,
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
   * Get deal count by status
   */
  async getCountByStatus(): Promise<Record<string, number>> {
    const { data, error } = await db
      .from('deals')
      .select('status')
      .is('deleted_at', null);

    if (error) {
      console.error('Error counting deals:', error);
      return {};
    }

    const counts: Record<string, number> = {};
    (data || []).forEach((row: { status: string }) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get total deal value by status
   */
  async getTotalValueByStatus(): Promise<Array<{ status: string; totalValue: number; count: number }>> {
    const { data, error } = await db
      .from('deals')
      .select('status, value')
      .is('deleted_at', null);

    if (error) {
      console.error('Error getting deal values:', error);
      return [];
    }

    const statusMap: Record<string, { totalValue: number; count: number }> = {};

    (data || []).forEach((row: { status: string; value: number | null }) => {
      const status = row.status;
      if (!statusMap[status]) {
        statusMap[status] = { totalValue: 0, count: 0 };
      }
      statusMap[status].totalValue += Number(row.value) || 0;
      statusMap[status].count += 1;
    });

    return Object.entries(statusMap).map(([status, data]) => ({
      status,
      ...data,
    }));
  }

  /**
   * Get total deal value by pipeline
   */
  async getTotalValueByPipeline(): Promise<Array<{ pipeline: string; totalValue: number; count: number }>> {
    const { data, error } = await db
      .from('deals')
      .select('pipeline_name, value')
      .is('deleted_at', null)
      .eq('status', 'open');

    if (error) {
      console.error('Error getting deal values:', error);
      return [];
    }

    const pipelineMap: Record<string, { totalValue: number; count: number }> = {};

    (data || []).forEach((row: { pipeline_name: string | null; value: number | null }) => {
      const pipeline = row.pipeline_name || 'Unknown';
      if (!pipelineMap[pipeline]) {
        pipelineMap[pipeline] = { totalValue: 0, count: 0 };
      }
      pipelineMap[pipeline].totalValue += Number(row.value) || 0;
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
   * Create a new deal
   */
  async create(dto: CreateDealDTO, userId?: string): Promise<Deal> {
    const { data, error } = await db
      .from('deals')
      .insert({
        title: dto.title,
        pipedrive_deal_id: dto.pipedriveDealId || null,
        pipedrive_person_id: dto.pipedrivePersonId || null,
        pipedrive_org_id: dto.pipedriveOrgId || null,
        value: dto.value || null,
        currency: dto.currency || 'USD',
        pipeline_id: dto.pipelineId || null,
        pipeline_name: dto.pipelineName || null,
        stage_id: dto.stageId || null,
        stage_name: dto.stageName || null,
        stage_order: dto.stageOrder || null,
        status: dto.status || 'open',
        probability: dto.probability || null,
        expected_close_date: dto.expectedCloseDate?.toISOString() || null,
        won_time: dto.wonTime?.toISOString() || null,
        lost_time: dto.lostTime?.toISOString() || null,
        close_time: dto.closeTime?.toISOString() || null,
        lost_reason: dto.lostReason || null,
        contact_name: dto.contactName || null,
        contact_email: dto.contactEmail || null,
        contact_phone: dto.contactPhone || null,
        organization_name: dto.organizationName || null,
        organization_address_street: dto.organizationAddressStreet || null,
        organization_address_city: dto.organizationAddressCity || null,
        organization_address_state: dto.organizationAddressState || null,
        organization_address_postal_code: dto.organizationAddressPostalCode || null,
        organization_address_country: dto.organizationAddressCountry || null,
        customer_id: dto.customerId || null,
        lead_id: dto.leadId || null,
        owner_id: dto.ownerId || null,
        pipedrive_owner_id: dto.pipedriveOwnerId || null,
        pipedrive_owner_name: dto.pipedriveOwnerName || null,
        pipedrive_synced_at: dto.pipedriveDealId ? new Date().toISOString() : null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating deal:', error);
      throw new Error('Failed to create deal');
    }

    return mapRowToDeal(data as DealRow);
  }

  /**
   * Update a deal
   */
  async update(id: string, dto: UpdateDealDTO, userId?: string): Promise<Deal> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.value !== undefined) updateData.value = dto.value;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.pipelineId !== undefined) updateData.pipeline_id = dto.pipelineId;
    if (dto.pipelineName !== undefined) updateData.pipeline_name = dto.pipelineName;
    if (dto.stageId !== undefined) updateData.stage_id = dto.stageId;
    if (dto.stageName !== undefined) updateData.stage_name = dto.stageName;
    if (dto.stageOrder !== undefined) updateData.stage_order = dto.stageOrder;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.probability !== undefined) updateData.probability = dto.probability;
    if (dto.expectedCloseDate !== undefined) {
      updateData.expected_close_date = dto.expectedCloseDate?.toISOString() || null;
    }
    if (dto.wonTime !== undefined) {
      updateData.won_time = dto.wonTime?.toISOString() || null;
    }
    if (dto.lostTime !== undefined) {
      updateData.lost_time = dto.lostTime?.toISOString() || null;
    }
    if (dto.closeTime !== undefined) {
      updateData.close_time = dto.closeTime?.toISOString() || null;
    }
    if (dto.lostReason !== undefined) updateData.lost_reason = dto.lostReason;
    if (dto.contactName !== undefined) updateData.contact_name = dto.contactName;
    if (dto.contactEmail !== undefined) updateData.contact_email = dto.contactEmail;
    if (dto.contactPhone !== undefined) updateData.contact_phone = dto.contactPhone;
    if (dto.organizationName !== undefined) updateData.organization_name = dto.organizationName;
    if (dto.organizationAddressStreet !== undefined) updateData.organization_address_street = dto.organizationAddressStreet;
    if (dto.organizationAddressCity !== undefined) updateData.organization_address_city = dto.organizationAddressCity;
    if (dto.organizationAddressState !== undefined) updateData.organization_address_state = dto.organizationAddressState;
    if (dto.organizationAddressPostalCode !== undefined) updateData.organization_address_postal_code = dto.organizationAddressPostalCode;
    if (dto.organizationAddressCountry !== undefined) updateData.organization_address_country = dto.organizationAddressCountry;
    if (dto.customerId !== undefined) updateData.customer_id = dto.customerId;
    if (dto.leadId !== undefined) updateData.lead_id = dto.leadId;
    if (dto.ownerId !== undefined) updateData.owner_id = dto.ownerId;
    // Pipedrive IDs
    if (dto.pipedriveDealId !== undefined) updateData.pipedrive_deal_id = dto.pipedriveDealId;
    if (dto.pipedrivePersonId !== undefined) updateData.pipedrive_person_id = dto.pipedrivePersonId;
    if (dto.pipedriveOrgId !== undefined) updateData.pipedrive_org_id = dto.pipedriveOrgId;
    if (dto.pipedriveOwnerId !== undefined) updateData.pipedrive_owner_id = dto.pipedriveOwnerId;
    if (dto.pipedriveOwnerName !== undefined) updateData.pipedrive_owner_name = dto.pipedriveOwnerName;

    const { data, error } = await db
      .from('deals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating deal:', error);
      throw new Error('Failed to update deal');
    }

    return mapRowToDeal(data as DealRow);
  }

  /**
   * Soft delete a deal
   */
  async delete(id: string, userId?: string): Promise<void> {
    const { error } = await db
      .from('deals')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting deal:', error);
      throw new Error('Failed to delete deal');
    }
  }

  /**
   * Upsert deal from Pipedrive
   */
  async upsertFromPipedrive(dto: CreateDealDTO, userId?: string): Promise<{ deal: Deal; isNew: boolean }> {
    if (!dto.pipedriveDealId) {
      throw new Error('pipedriveDealId is required for upsert');
    }

    const existing = await this.getByPipedriveDealId(dto.pipedriveDealId);

    if (existing) {
      const updated = await this.updateFromPipedrive(existing.id, dto, userId);
      return { deal: updated, isNew: false };
    }

    const created = await this.create(dto, userId);
    return { deal: created, isNew: true };
  }

  /**
   * Update deal from Pipedrive sync
   */
  async updateFromPipedrive(id: string, dto: CreateDealDTO, userId?: string): Promise<Deal> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      pipedrive_synced_at: new Date().toISOString(),
    };

    // Update all fields from Pipedrive
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.pipedriveDealId !== undefined) updateData.pipedrive_deal_id = dto.pipedriveDealId;
    if (dto.pipedrivePersonId !== undefined) updateData.pipedrive_person_id = dto.pipedrivePersonId;
    if (dto.pipedriveOrgId !== undefined) updateData.pipedrive_org_id = dto.pipedriveOrgId;
    if (dto.value !== undefined) updateData.value = dto.value;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.pipelineId !== undefined) updateData.pipeline_id = dto.pipelineId;
    if (dto.pipelineName !== undefined) updateData.pipeline_name = dto.pipelineName;
    if (dto.stageId !== undefined) updateData.stage_id = dto.stageId;
    if (dto.stageName !== undefined) updateData.stage_name = dto.stageName;
    if (dto.stageOrder !== undefined) updateData.stage_order = dto.stageOrder;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.probability !== undefined) updateData.probability = dto.probability;
    if (dto.expectedCloseDate !== undefined) {
      updateData.expected_close_date = dto.expectedCloseDate?.toISOString() || null;
    }
    if (dto.wonTime !== undefined) {
      updateData.won_time = dto.wonTime?.toISOString() || null;
    }
    if (dto.lostTime !== undefined) {
      updateData.lost_time = dto.lostTime?.toISOString() || null;
    }
    if (dto.closeTime !== undefined) {
      updateData.close_time = dto.closeTime?.toISOString() || null;
    }
    if (dto.lostReason !== undefined) updateData.lost_reason = dto.lostReason;
    if (dto.contactName !== undefined) updateData.contact_name = dto.contactName;
    if (dto.contactEmail !== undefined) updateData.contact_email = dto.contactEmail;
    if (dto.contactPhone !== undefined) updateData.contact_phone = dto.contactPhone;
    if (dto.organizationName !== undefined) updateData.organization_name = dto.organizationName;
    if (dto.organizationAddressStreet !== undefined) updateData.organization_address_street = dto.organizationAddressStreet;
    if (dto.organizationAddressCity !== undefined) updateData.organization_address_city = dto.organizationAddressCity;
    if (dto.organizationAddressState !== undefined) updateData.organization_address_state = dto.organizationAddressState;
    if (dto.organizationAddressPostalCode !== undefined) updateData.organization_address_postal_code = dto.organizationAddressPostalCode;
    if (dto.organizationAddressCountry !== undefined) updateData.organization_address_country = dto.organizationAddressCountry;
    if (dto.pipedriveOwnerId !== undefined) updateData.pipedrive_owner_id = dto.pipedriveOwnerId;
    if (dto.pipedriveOwnerName !== undefined) updateData.pipedrive_owner_name = dto.pipedriveOwnerName;

    const { data, error } = await db
      .from('deals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating deal from Pipedrive:', error);
      throw new Error('Failed to update deal from Pipedrive');
    }

    return mapRowToDeal(data as DealRow);
  }

  /**
   * Get all Pipedrive Deal IDs from local deals
   */
  async getAllPipedriveDealIds(): Promise<number[]> {
    const { data, error } = await db
      .from('deals')
      .select('pipedrive_deal_id')
      .not('pipedrive_deal_id', 'is', null)
      .is('deleted_at', null);

    if (error) {
      console.error('Error fetching pipedrive deal IDs:', error);
      return [];
    }

    return (data || [])
      .map((row: { pipedrive_deal_id: number | null }) => row.pipedrive_deal_id)
      .filter((id): id is number => id !== null);
  }

  /**
   * Soft delete deals by Pipedrive Deal IDs
   */
  async softDeleteByPipedriveDealIds(dealIds: number[], userId?: string): Promise<number> {
    if (dealIds.length === 0) return 0;

    const { data, error } = await db
      .from('deals')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .in('pipedrive_deal_id', dealIds)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      console.error('Error soft deleting deals:', error);
      return 0;
    }

    return data?.length || 0;
  }

  // ============================================
  // NOTES OPERATIONS
  // ============================================

  /**
   * Get notes for a deal
   */
  async getNotes(dealId: string): Promise<DealNote[]> {
    const { data, error } = await db
      .from('deal_notes')
      .select('*, created_by_user:users!deal_notes_created_by_fkey(first_name, last_name)')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching deal notes:', error);
      return [];
    }

    return (data || []).map((row: DealNoteRow) => mapRowToDealNote(row));
  }

  /**
   * Create a note for a deal
   */
  async createNote(dto: CreateDealNoteDTO, userId?: string): Promise<DealNote> {
    const { data, error } = await db
      .from('deal_notes')
      .insert({
        deal_id: dto.dealId,
        content: dto.content,
        synced_to_pipedrive: false,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating deal note:', error);
      throw new Error('Failed to create deal note');
    }

    return mapRowToDealNote(data as DealNoteRow);
  }

  /**
   * Add a note to a deal
   */
  async addNote(
    dealId: string,
    content: string,
    userId?: string,
    pipedriveNoteId?: number
  ): Promise<DealNote> {
    const { data, error } = await db
      .from('deal_notes')
      .insert({
        deal_id: dealId,
        content,
        pipedrive_note_id: pipedriveNoteId || null,
        synced_to_pipedrive: !!pipedriveNoteId,
        synced_at: pipedriveNoteId ? new Date().toISOString() : null,
        created_by: userId || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error adding deal note:', error);
      throw new Error('Failed to add deal note');
    }

    return mapRowToDealNote(data as DealNoteRow);
  }

  /**
   * Mark note as synced to Pipedrive
   */
  async markNoteSynced(noteId: string, pipedriveNoteId: number): Promise<void> {
    const { error } = await db
      .from('deal_notes')
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
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    const { error } = await db
      .from('deal_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('Error deleting deal note:', error);
      throw new Error('Failed to delete deal note');
    }
  }

  /**
   * Get a note by Pipedrive Note ID
   */
  async getNoteByPipedriveId(pipedriveNoteId: number): Promise<DealNote | null> {
    const { data, error } = await db
      .from('deal_notes')
      .select('*, created_by_user:users!deal_notes_created_by_fkey(first_name, last_name)')
      .eq('pipedrive_note_id', pipedriveNoteId)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToDealNote(data as DealNoteRow);
  }

  /**
   * Update note content by Pipedrive Note ID
   */
  async updateNoteByPipedriveId(pipedriveNoteId: number, content: string): Promise<DealNote | null> {
    const { data, error } = await db
      .from('deal_notes')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('pipedrive_note_id', pipedriveNoteId)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating deal note by pipedrive ID:', error);
      return null;
    }

    return mapRowToDealNote(data as DealNoteRow);
  }

  /**
   * Delete notes by Pipedrive Note IDs
   */
  async deleteNotesByPipedriveIds(pipedriveNoteIds: number[]): Promise<number> {
    if (pipedriveNoteIds.length === 0) return 0;

    const { data, error } = await db
      .from('deal_notes')
      .delete()
      .in('pipedrive_note_id', pipedriveNoteIds)
      .select('id');

    if (error) {
      console.error('Error deleting deal notes by pipedrive IDs:', error);
      return 0;
    }

    return data?.length || 0;
  }
}

// Export singleton instance
export const dealsRepository = new DealsRepository();
