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
import { toPipedriveId } from '../lib/sync-log';

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

/**
 * True when `field` changed from something other than `value` to `value`.
 *
 * Webhooks v1 send the full previous record; webhooks v2 send only the fields
 * that changed. In both cases a field that changed is present in `previous`,
 * so an unrelated edit (no `field` in `previous`) is never a transition.
 */
export function changedTo(
  current: Record<string, unknown> | undefined,
  previous: Record<string, unknown> | undefined,
  field: string,
  isValue: (value: unknown) => boolean
): boolean {
  if (!current || !isValue(current[field])) {
    return false;
  }
  if (!previous || !Object.prototype.hasOwnProperty.call(previous, field)) {
    return false;
  }
  return !isValue(previous[field]);
}

interface ProcessResult {
  success: boolean;
  action: 'created' | 'updated' | 'skipped' | 'error';
  entityType: 'lead' | 'customer' | 'note' | 'quote' | 'deal' | 'activity';
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
        case 'activity':
          return await this.handleActivityEvent(action, payload);
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
    // Update the lead already linked to this deal (or its person) instead of
    // creating another one. Checking the deal ID first makes redelivered
    // added.deal events idempotent, including deals without a person.
    const existingLead = await this.findLeadByDeal(deal);

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
    // Only a real transition to Won runs the ERP flow; edits to an already won
    // deal (including our own ERP Quote # write) do not
    if (changedTo(deal as unknown as Record<string, unknown>, previous as unknown as Record<string, unknown>, 'status', (v) => v === 'won')) {
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
   * Deal won (GDC spec): create the ERP quote from the deal's products and send
   * it through the normal approval workflow (see deal-erp.service). The ERP
   * customer is resolved from the deal's organization; customers are not created
   * here. A linked lead only gets its deal status updated (its workflow status
   * is owned by Gesher).
   */
  private async handleDealWon(deal: PipedriveDealData): Promise<ProcessResult> {
    const existingLead = await this.findLeadByDeal(deal);
    if (existingLead) {
      await leadsRepository.update(existingLead.id, {
        dealTitle: deal.title,
        dealValue: deal.value || null,
        dealStatus: 'won',
      });
    }

    const { handleWonDeal } = await import('../gdc/deal-erp.service');
    const result = await handleWonDeal(deal.id);

    return {
      // Only a failed quote creation is an error; missing links are reported on the deal
      success: result.status !== 'quote_failed',
      action: result.status === 'quote_created' ? 'created' : 'skipped',
      entityType: 'quote',
      entityId: result.quoteId,
      message: result.message,
    };
  }

  // ============================================
  // ACTIVITY EVENTS
  // ============================================

  /**
   * A completed Call or Site visit:
   * - report check: Outcome, summary and next step must be in the note,
   *   otherwise one reminder task is added for the owner (call-report.service)
   * - stage progression: on a GDC deal still in "Lead / Prospect" it moves the
   *   deal to "Contacted". Forward-only; other stages are moved by reps.
   */
  private async handleActivityEvent(action: string, payload: WebhookPayload): Promise<ProcessResult> {
    const activity = payload.current as unknown as Record<string, unknown> | undefined;
    const previous = payload.previous as unknown as Record<string, unknown> | undefined;
    const isDone = (value: unknown) => value === true || value === 1;
    // Added already done, or updated from not-done to done (v1 and v2 `previous`)
    const newlyDone =
      action === 'added' ? isDone(activity?.done) : action === 'updated' && changedTo(activity, previous, 'done', isDone);
    const toNumberId = (value: unknown) => Number(value) || null;
    const dealId = toNumberId(activity?.deal_id);

    if (!newlyDone || !activity) {
      return { success: true, action: 'skipped', entityType: 'activity', message: 'Not a newly completed activity' };
    }

    const { getActivePipedriveConnectionId } = await import('../gdc/settings');
    const { getGdcConfig } = await import('../gdc/setup.service');
    const { GDC_CONTACT_ACTIVITY_TYPES } = await import('../gdc/config');
    const { advanceDealStage, parseDeal } = await import('../gdc/deal-erp.service');
    const { ensureCallReport } = await import('../gdc/call-report.service');
    const { pipedriveProvider } = await import('@/modules/integrations/providers/crm/pipedrive');

    const connectionId = await getActivePipedriveConnectionId();
    if (!connectionId) {
      return { success: true, action: 'skipped', entityType: 'activity', message: 'Pipedrive not connected' };
    }
    const config = await getGdcConfig(connectionId);
    const contactTypes = GDC_CONTACT_ACTIVITY_TYPES.map((key) => config.activityTypes[key]);
    if (!contactTypes.includes(String(activity.type ?? ''))) {
      return { success: true, action: 'skipped', entityType: 'activity', message: 'Not a call or site visit' };
    }

    const report = await ensureCallReport(connectionId, config, {
      id: toNumberId(activity.id) ?? 0,
      type: String(activity.type ?? ''),
      subject: String(activity.subject ?? ''),
      note: typeof activity.note === 'string' ? activity.note : null,
      ownerId: toNumberId(activity.owner_id ?? activity.user_id),
      dealId,
      leadId: typeof activity.lead_id === 'string' && activity.lead_id ? activity.lead_id : null,
      personId: toNumberId(activity.person_id),
      orgId: toNumberId(activity.org_id),
    });
    const reportMessage =
      report.status === 'task_created' ? `report incomplete (${report.missing.join(', ')}), reminder task added` : `report ${report.status}`;

    let moved = false;
    if (dealId) {
      const response = await pipedriveProvider.request<unknown>(connectionId, 'GET', `deals/${dealId}`);
      const deal = parseDeal(response.data);
      moved = deal ? await advanceDealStage(connectionId, config, deal, 'contacted') : false;
    }

    return {
      success: true,
      action: moved || report.status === 'task_created' ? 'updated' : 'skipped',
      entityType: dealId ? 'deal' : 'activity',
      message: `${moved ? `Deal ${dealId} moved to Contacted` : 'No stage change'}; ${reportMessage}`,
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
      lead = await leadsRepository.getByPipedriveDealId(noteData.deal_id);
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
      .limit(1)
      .maybeSingle();

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
    // First try by deal ID (tolerates several matching leads; .single() would
    // error and fall through to creating yet another lead)
    const byDealId = await leadsRepository.getByPipedriveDealId(deal.id);

    if (byDealId) {
      return byDealId;
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
      // entity_id is a Gesher UUID column; the Pipedrive ID belongs in pipedrive_id
      const { error } = await db.from('pipedrive_sync_log').insert({
        event_type: 'webhook',
        direction: 'inbound',
        entity_type: payload.meta.object,
        entity_id: null,
        pipedrive_id: toPipedriveId(payload.meta.id),
        payload: payload as unknown as Record<string, unknown>,
        status: 'success',
      });

      if (error) {
        console.error('[Pipedrive Webhook] Failed to log event:', error.message);
      }
    } catch (error) {
      console.error('[Pipedrive Webhook] Failed to log event:', error);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const pipedriveWebhookService = new PipedriveWebhookService();
