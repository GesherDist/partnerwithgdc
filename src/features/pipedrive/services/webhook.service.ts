/**
 * Pipedrive Webhook Service
 *
 * Handles processing of incoming Pipedrive webhook events.
 * Supports person, deal, and note events.
 */

import { db } from '@/shared/lib/supabase/database';
import { leadsRepository } from '@/features/leads/repositories/leads.repository';
import type { CreateLeadDTO, LeadStatus } from '@/features/leads/types';
import type { PipedriveWebhookEvent } from '../lib/webhook-verify';

// ============================================
// TYPES
// ============================================

interface PipedrivePersonData {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: Array<{ value: string; primary: boolean }>;
  phone?: Array<{ value: string; primary: boolean }>;
  org_id?: number | { value: number; name: string };
  org_name?: string;
  owner_id?: number;
  add_time?: string;
  update_time?: string;
}

interface PipedriveDealData {
  id: number;
  title: string;
  value?: number;
  currency?: string;
  status: 'open' | 'won' | 'lost' | 'deleted';
  stage_id?: number;
  pipeline_id?: number;
  person_id?: number;
  org_id?: number;
  probability?: number;
  expected_close_date?: string;
  add_time?: string;
  update_time?: string;
  won_time?: string;
  lost_time?: string;
  stage_change_time?: string;
}

interface PipedriveNoteData {
  id: number;
  content: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  add_time?: string;
  update_time?: string;
}

interface WebhookPayload {
  v: number;
  matches_filters?: { current: unknown[] };
  meta: {
    action: string;
    object: string;
    id: number;
    company_id: number;
    user_id: number;
    host: string;
    timestamp: number;
    timestamp_micro: number;
    permitted_user_ids: number[];
    trans_pending: boolean;
    is_bulk_update: boolean;
    matches_filters?: { current: unknown[] };
    webhook_id: string;
  };
  current?: PipedrivePersonData | PipedriveDealData | PipedriveNoteData;
  previous?: PipedrivePersonData | PipedriveDealData | PipedriveNoteData;
  event: string;
}

interface ProcessResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped' | 'error';
  entityType: 'lead' | 'customer' | 'note';
  entityId?: string;
  message?: string;
}

// ============================================
// WEBHOOK SERVICE
// ============================================

class PipedriveWebhookService {
  /**
   * Process incoming webhook event
   */
  async processEvent(payload: WebhookPayload): Promise<ProcessResult> {
    const event = payload.event as PipedriveWebhookEvent;
    const action = payload.meta.action;
    const objectType = payload.meta.object;

    console.log(`[Pipedrive Webhook] Processing: ${event} (${objectType})`);

    // Log the event
    await this.logEvent(payload);

    try {
      // Route to appropriate handler
      switch (objectType) {
        case 'person':
          return await this.handlePersonEvent(action, payload);
        case 'deal':
          return await this.handleDealEvent(action, payload);
        case 'note':
          return await this.handleNoteEvent(action, payload);
        default:
          return {
            success: true,
            action: 'skipped',
            entityType: 'lead',
            message: `Unsupported object type: ${objectType}`,
          };
      }
    } catch (error) {
      console.error('[Pipedrive Webhook] Error:', error);
      return {
        success: false,
        action: 'error',
        entityType: 'lead',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================
  // PERSON EVENTS
  // ============================================

  private async handlePersonEvent(
    action: string,
    payload: WebhookPayload
  ): Promise<ProcessResult> {
    const personData = payload.current as PipedrivePersonData | undefined;

    if (!personData) {
      return {
        success: true,
        action: 'skipped',
        entityType: 'lead',
        message: 'No person data in payload',
      };
    }

    switch (action) {
      case 'added':
        return await this.createLeadFromPerson(personData);
      case 'updated':
        return await this.updateLeadFromPerson(personData);
      case 'deleted':
        return await this.handlePersonDeleted(personData.id);
      default:
        return {
          success: true,
          action: 'skipped',
          entityType: 'lead',
          message: `Unsupported action: ${action}`,
        };
    }
  }

  private async createLeadFromPerson(
    person: PipedrivePersonData
  ): Promise<ProcessResult> {
    // Check if lead already exists
    const existingLead = await leadsRepository.getByPipedrivePersonId(person.id);
    if (existingLead) {
      return {
        success: true,
        action: 'skipped',
        entityType: 'lead',
        entityId: existingLead.id,
        message: 'Lead already exists',
      };
    }

    // Extract email and phone
    const email = person.email?.find((e) => e.primary)?.value || person.email?.[0]?.value;
    const phone = person.phone?.find((p) => p.primary)?.value || person.phone?.[0]?.value;

    // Get org name
    const orgName = typeof person.org_id === 'object'
      ? person.org_id.name
      : person.org_name;

    const orgId = typeof person.org_id === 'object'
      ? person.org_id.value
      : person.org_id;

    // Create lead
    const leadData: CreateLeadDTO = {
      name: person.name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
      email: email || null,
      phone: phone || null,
      company: orgName || null,
      pipedrivePersonId: person.id,
      pipedriveOrgId: orgId || null,
      source: 'pipedrive',
      status: 'new',
    };

    const lead = await leadsRepository.create(leadData);

    return {
      success: true,
      action: 'created',
      entityType: 'lead',
      entityId: lead.id,
      message: `Created lead: ${lead.name}`,
    };
  }

  private async updateLeadFromPerson(
    person: PipedrivePersonData
  ): Promise<ProcessResult> {
    const existingLead = await leadsRepository.getByPipedrivePersonId(person.id);

    if (!existingLead) {
      // Lead doesn't exist, create it
      return await this.createLeadFromPerson(person);
    }

    // Extract email and phone
    const email = person.email?.find((e) => e.primary)?.value || person.email?.[0]?.value;
    const phone = person.phone?.find((p) => p.primary)?.value || person.phone?.[0]?.value;

    const orgName = typeof person.org_id === 'object'
      ? person.org_id.name
      : person.org_name;

    // Update lead
    const lead = await leadsRepository.update(existingLead.id, {
      name: person.name || existingLead.name,
      email: email || existingLead.email,
      phone: phone || existingLead.phone,
      company: orgName || existingLead.company,
    });

    return {
      success: true,
      action: 'updated',
      entityType: 'lead',
      entityId: lead.id,
      message: `Updated lead: ${lead.name}`,
    };
  }

  private async handlePersonDeleted(personId: number): Promise<ProcessResult> {
    const existingLead = await leadsRepository.getByPipedrivePersonId(personId);

    if (!existingLead) {
      return {
        success: true,
        action: 'skipped',
        entityType: 'lead',
        message: 'Lead not found',
      };
    }

    // Mark as lost instead of deleting
    await leadsRepository.update(existingLead.id, { status: 'lost' });

    return {
      success: true,
      action: 'updated',
      entityType: 'lead',
      entityId: existingLead.id,
      message: `Marked lead as lost: ${existingLead.name}`,
    };
  }

  // ============================================
  // DEAL EVENTS
  // ============================================

  private async handleDealEvent(
    action: string,
    payload: WebhookPayload
  ): Promise<ProcessResult> {
    const dealData = payload.current as PipedriveDealData | undefined;
    const previousData = payload.previous as PipedriveDealData | undefined;

    if (!dealData) {
      return {
        success: true,
        action: 'skipped',
        entityType: 'lead',
        message: 'No deal data in payload',
      };
    }

    switch (action) {
      case 'added':
        return await this.handleDealAdded(dealData);
      case 'updated':
        return await this.handleDealUpdated(dealData, previousData);
      case 'deleted':
        return await this.handleDealDeleted(dealData);
      default:
        return {
          success: true,
          action: 'skipped',
          entityType: 'lead',
          message: `Unsupported action: ${action}`,
        };
    }
  }

  private async handleDealAdded(deal: PipedriveDealData): Promise<ProcessResult> {
    // If deal has a person, update/create the lead with deal info
    if (deal.person_id) {
      const existingLead = await leadsRepository.getByPipedrivePersonId(deal.person_id);

      if (existingLead) {
        // Update existing lead with deal info
        // Filter out 'deleted' status as it's not a valid DealStatus
        const dealStatus = deal.status === 'deleted' ? null : deal.status as 'open' | 'won' | 'lost' | null;
        const lead = await leadsRepository.update(existingLead.id, {
          pipedriveDealId: deal.id,
          dealTitle: deal.title,
          dealValue: deal.value || null,
          dealStatus,
          dealProbability: deal.probability || null,
          expectedCloseDate: deal.expected_close_date ? new Date(deal.expected_close_date) : null,
          status: this.mapDealStatusToLeadStatus(deal.status),
        });

        return {
          success: true,
          action: 'updated',
          entityType: 'lead',
          entityId: lead.id,
          message: `Updated lead with deal: ${deal.title}`,
        };
      }
    }

    // Create a new lead from the deal
    // Filter out 'deleted' status as it's not a valid DealStatus
    const dealStatusCreate = deal.status === 'deleted' ? null : deal.status as 'open' | 'won' | 'lost' | null;
    const leadData: CreateLeadDTO = {
      name: deal.title,
      pipedriveDealId: deal.id,
      pipedriveOrgId: deal.org_id || null,
      dealTitle: deal.title,
      dealValue: deal.value || null,
      dealStatus: dealStatusCreate,
      dealProbability: deal.probability || null,
      expectedCloseDate: deal.expected_close_date ? new Date(deal.expected_close_date) : null,
      source: 'pipedrive',
      status: this.mapDealStatusToLeadStatus(deal.status),
    };

    const lead = await leadsRepository.create(leadData);

    return {
      success: true,
      action: 'created',
      entityType: 'lead',
      entityId: lead.id,
      message: `Created lead from deal: ${deal.title}`,
    };
  }

  private async handleDealUpdated(
    deal: PipedriveDealData,
    previous?: PipedriveDealData
  ): Promise<ProcessResult> {
    // Check if deal was won
    if (deal.status === 'won' && previous?.status !== 'won') {
      return await this.handleDealWon(deal);
    }

    // Find lead by deal ID or person ID
    let existingLead = await this.findLeadByDeal(deal);

    if (!existingLead) {
      // Create new lead
      return await this.handleDealAdded(deal);
    }

    // Update lead with deal info
    // Filter out 'deleted' status as it's not a valid DealStatus
    const dealStatusUpdate = deal.status === 'deleted' ? null : deal.status as 'open' | 'won' | 'lost' | null;
    const lead = await leadsRepository.update(existingLead.id, {
      dealTitle: deal.title,
      dealValue: deal.value || null,
      dealStatus: dealStatusUpdate,
      dealProbability: deal.probability || null,
      expectedCloseDate: deal.expected_close_date ? new Date(deal.expected_close_date) : null,
      status: this.mapDealStatusToLeadStatus(deal.status),
    });

    return {
      success: true,
      action: 'updated',
      entityType: 'lead',
      entityId: lead.id,
      message: `Updated lead from deal: ${deal.title}`,
    };
  }

  private async handleDealDeleted(deal: PipedriveDealData): Promise<ProcessResult> {
    const existingLead = await this.findLeadByDeal(deal);

    if (!existingLead) {
      return {
        success: true,
        action: 'skipped',
        entityType: 'lead',
        message: 'Lead not found',
      };
    }

    // Mark as lost - deleted deals map to 'lost' status
    await leadsRepository.update(existingLead.id, {
      status: 'lost',
      dealStatus: 'lost', // 'deleted' is not a valid DealStatus, use 'lost' instead
    });

    return {
      success: true,
      action: 'updated',
      entityType: 'lead',
      entityId: existingLead.id,
      message: `Marked lead as lost: ${existingLead.name}`,
    };
  }

  /**
   * Handle deal won - Create customer automatically!
   */
  private async handleDealWon(deal: PipedriveDealData): Promise<ProcessResult> {
    console.log(`[Pipedrive Webhook] Deal WON: ${deal.title}`);

    // Find the lead
    const existingLead = await this.findLeadByDeal(deal);

    // Check if customer already exists with this pipedrive deal
    const { data: existingCustomer } = await db
      .from('customers')
      .select('id, name')
      .eq('pipedrive_deal_id', deal.id)
      .single();

    if (existingCustomer) {
      // Update lead as converted if exists
      if (existingLead) {
        await leadsRepository.markAsConverted(
          existingLead.id,
          existingCustomer.id
        );
      }

      return {
        success: true,
        action: 'skipped',
        entityType: 'customer',
        entityId: existingCustomer.id,
        message: `Customer already exists: ${existingCustomer.name}`,
      };
    }

    // Create new customer
    const customerName = existingLead?.company || existingLead?.name || deal.title;

    const { data: newCustomer, error: customerError } = await db
      .from('customers')
      .insert({
        name: customerName,
        email: existingLead?.email || null,
        phone: existingLead?.phone || null,
        status: 'active',
        channel: 'dealer',
        billing_street: existingLead?.addressStreet || null,
        billing_city: existingLead?.addressCity || null,
        billing_state: existingLead?.addressState || null,
        billing_postal_code: existingLead?.addressPostalCode || null,
        billing_country: existingLead?.addressCountry || null,
        pipedrive_person_id: existingLead?.pipedrivePersonId || deal.person_id || null,
        pipedrive_org_id: existingLead?.pipedriveOrgId || deal.org_id || null,
        pipedrive_deal_id: deal.id,
      })
      .select('id, name')
      .single();

    if (customerError) {
      console.error('[Pipedrive Webhook] Error creating customer:', customerError);
      return {
        success: false,
        action: 'error',
        entityType: 'customer',
        message: `Failed to create customer: ${customerError.message}`,
      };
    }

    // Mark lead as converted
    if (existingLead) {
      await leadsRepository.markAsConverted(existingLead.id, newCustomer.id);
    }

    console.log(`[Pipedrive Webhook] Customer created: ${newCustomer.name} (${newCustomer.id})`);

    return {
      success: true,
      action: 'created',
      entityType: 'customer',
      entityId: newCustomer.id,
      message: `Created customer from won deal: ${newCustomer.name}`,
    };
  }

  // ============================================
  // NOTE EVENTS
  // ============================================

  private async handleNoteEvent(
    action: string,
    payload: WebhookPayload
  ): Promise<ProcessResult> {
    const noteData = payload.current as PipedriveNoteData | undefined;

    if (!noteData) {
      return {
        success: true,
        action: 'skipped',
        entityType: 'note',
        message: 'No note data in payload',
      };
    }

    if (action !== 'added' && action !== 'updated') {
      return {
        success: true,
        action: 'skipped',
        entityType: 'note',
        message: `Unsupported action: ${action}`,
      };
    }

    // Find lead by person_id or deal_id
    let lead = null;

    if (noteData.person_id) {
      lead = await leadsRepository.getByPipedrivePersonId(noteData.person_id);
    }

    if (!lead && noteData.deal_id) {
      const { data } = await db
        .from('leads')
        .select('*')
        .eq('pipedrive_deal_id', noteData.deal_id)
        .single();

      if (data) {
        lead = await leadsRepository.getById(data.id);
      }
    }

    if (!lead) {
      return {
        success: true,
        action: 'skipped',
        entityType: 'note',
        message: 'No matching lead found for note',
      };
    }

    // Check if note already exists
    const { data: existingNote } = await db
      .from('lead_notes')
      .select('id')
      .eq('pipedrive_note_id', noteData.id)
      .single();

    if (existingNote) {
      // Update existing note
      await db
        .from('lead_notes')
        .update({ content: noteData.content })
        .eq('id', existingNote.id);

      return {
        success: true,
        action: 'updated',
        entityType: 'note',
        entityId: existingNote.id,
        message: 'Updated note from Pipedrive',
      };
    }

    // Create new note
    const note = await leadsRepository.addNote(
      lead.id,
      noteData.content,
      undefined, // No user ID for webhook-created notes
      noteData.id
    );

    return {
      success: true,
      action: 'created',
      entityType: 'note',
      entityId: note.id,
      message: 'Created note from Pipedrive',
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private async findLeadByDeal(deal: PipedriveDealData) {
    // First try by deal ID
    const { data: byDealId } = await db
      .from('leads')
      .select('*')
      .eq('pipedrive_deal_id', deal.id)
      .single();

    if (byDealId) {
      return await leadsRepository.getById(byDealId.id);
    }

    // Then try by person ID
    if (deal.person_id) {
      return await leadsRepository.getByPipedrivePersonId(deal.person_id);
    }

    return null;
  }

  private mapDealStatusToLeadStatus(dealStatus: string): LeadStatus {
    switch (dealStatus) {
      case 'open':
        return 'qualified';
      case 'won':
        return 'converted';
      case 'lost':
      case 'deleted':
        return 'lost';
      default:
        return 'new';
    }
  }

  private async logEvent(payload: WebhookPayload): Promise<void> {
    try {
      await db.from('pipedrive_sync_log').insert({
        event_type: 'webhook',
        direction: 'inbound',
        entity_type: payload.meta.object,
        entity_id: String(payload.meta.id),
        pipedrive_id: payload.meta.id,
        payload: payload as unknown as Record<string, unknown>,
        status: 'success',
      });
    } catch (error) {
      console.error('[Pipedrive Webhook] Failed to log event:', error);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const pipedriveWebhookService = new PipedriveWebhookService();
