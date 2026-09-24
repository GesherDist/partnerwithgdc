/**
 * Pipedrive Sync Service
 *
 * Handles synchronization between Pipedrive CRM and Gesher system.
 * Uses the existing PipedriveProvider for API operations.
 */

import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import type { PipedriveLead } from '@/modules/integrations/providers/crm/pipedrive';
import { getConnectionByIntegrationId, getIntegrationByProvider } from '@/modules/integrations/core/repositories';
import { leadsRepository } from '@/features/leads/repositories/leads.repository';
import { dealsRepository } from '@/features/deals/repositories/deals.repository';
import { db } from '@/shared/lib/supabase/database';
import { pipedriveRateLimiter, retryWithBackoff, isRetryableError } from '../lib/rate-limiter';
import type {
  PipedriveSyncResult,
  CreateLeadDTO,
} from '@/features/leads/types';
import type {
  DealSyncResult,
  CreateDealDTO,
} from '@/features/deals/types';
import type { CrmContact, CrmDeal, CrmOrganization, CrmPipeline } from '@/modules/integrations/core';
import type { SyncLogEntry } from '../types';

// ============================================
// TYPES
// ============================================

interface SyncOptions {
  fullSync?: boolean; // If true, sync all records, not just recent
  sinceDate?: Date; // Sync records updated since this date
  skipExisting?: boolean; // If true, skip leads that already exist
  cleanupDeleted?: boolean; // If true, soft-delete leads that no longer exist in Pipedrive
}

// ============================================
// HELPERS
// ============================================

/**
 * Strip HTML tags and decode HTML entities from content
 * Pipedrive often sends HTML content with &nbsp; entities
 */
function stripHtmlAndDecode(html: string): string {
  if (!html) return '';

  // First, replace common HTML entities
  let text = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode any remaining HTML entities (numeric codes)
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// ============================================
// SYNC SERVICE
// ============================================

class PipedriveSyncService {
  private connectionId: string | null = null;

  /**
   * Get the current Pipedrive connection ID
   */
  private async getConnectionId(): Promise<string | null> {
    if (this.connectionId) {
      return this.connectionId;
    }

    const integration = await getIntegrationByProvider('pipedrive');
    if (!integration) {
      return null;
    }

    const connection = await getConnectionByIntegrationId(integration.id);
    if (!connection || connection.status !== 'connected') {
      return null;
    }

    this.connectionId = connection.id;
    return this.connectionId;
  }

  /**
   * Check if Pipedrive is connected
   */
  async isConnected(): Promise<boolean> {
    const connectionId = await this.getConnectionId();
    return connectionId !== null;
  }

  /**
   * Get Pipedrive connection status including company domain
   */
  async getConnectionStatus(): Promise<{ connected: boolean; companyDomain?: string }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { connected: false };
    }

    try {
      const status = await pipedriveProvider.getConnectionStatus(connectionId);
      return {
        connected: status.connected,
        companyDomain: status.environment, // environment contains companyDomain
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Get lead labels from Pipedrive
   */
  async getLeadLabels(): Promise<Array<{ id: string; name: string }>> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return [];
    }

    try {
      const labelMap = await pipedriveProvider.getLeadLabels(connectionId);
      const labels: Array<{ id: string; name: string }> = [];
      labelMap.forEach((name, id) => {
        labels.push({ id, name });
      });
      return labels;
    } catch (error) {
      console.error('[PipedriveSync] Error fetching lead labels:', error);
      return [];
    }
  }

  /**
   * Sync persons from Pipedrive to Leads
   */
  async syncPersonsToLeads(options: SyncOptions = {}): Promise<PipedriveSyncResult> {
    const result: PipedriveSyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
    };

    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      // Fetch all persons with rate limiting
      const persons = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getContacts(connectionId, {
            sinceDate: options.sinceDate,
            limit: 500,
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Fetch all deals for enrichment
      const deals = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getDeals(connectionId, {
            sinceDate: options.sinceDate,
            limit: 500,
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Fetch all organizations for enrichment
      const organizations = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getOrganizations(connectionId, {
            limit: 500,
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Create lookup maps
      const dealsByPersonId = new Map<string, CrmDeal[]>();
      deals.forEach((deal) => {
        if (deal.contactExternalId) {
          const existing = dealsByPersonId.get(deal.contactExternalId) || [];
          existing.push(deal);
          dealsByPersonId.set(deal.contactExternalId, existing);
        }
      });

      const orgsById = new Map<string, CrmOrganization>();
      organizations.forEach((org) => {
        if (org.externalId) {
          orgsById.set(org.externalId, org);
        }
      });

      // Collect all Pipedrive person IDs from the sync
      const pipedrivePersonIds = new Set<number>();

      // Process each person
      for (const person of persons) {
        if (!person.externalId) continue;

        const pipedrivePersonId = parseInt(person.externalId);
        pipedrivePersonIds.add(pipedrivePersonId);

        try {
          const personDeals = dealsByPersonId.get(person.externalId) || [];
          const organization = person.organizationExternalId
            ? orgsById.get(person.organizationExternalId) || null
            : null;

          // Get the most relevant deal (most recent open deal, or most recent won)
          const primaryDeal = this.getPrimaryDeal(personDeals);

          // Check if already exists
          const existing = await leadsRepository.getByPipedrivePersonId(pipedrivePersonId);

          if (existing && options.skipExisting) {
            result.skipped++;
            continue;
          }

          // Map to lead DTO
          const leadDto = this.mapPersonToLeadDTO(person, primaryDeal, organization);

          // Upsert lead
          const { isNew } = await leadsRepository.upsertFromPipedrive(leadDto);

          if (isNew) {
            result.created++;
          } else {
            result.updated++;
          }

          // Log sync
          await this.logSync({
            eventType: 'sync',
            direction: 'inbound',
            entityType: 'person',
            pipedriveId: pipedrivePersonId,
            status: 'success',
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            pipedriveId: parseInt(person.externalId || '0'),
            error: errorMessage,
          });

          await this.logSync({
            eventType: 'sync',
            direction: 'inbound',
            entityType: 'person',
            pipedriveId: parseInt(person.externalId || '0'),
            status: 'failed',
            errorMessage,
          });
        }
      }

      // Clean up deleted leads (leads in our DB but not in Pipedrive anymore)
      // Default to true for cleanup - always sync deletions
      if (options.cleanupDeleted !== false) {
        try {
          // Get all local leads with pipedrive_person_id
          const localPipedriveIds = await leadsRepository.getAllPipedrivePersonIds();

          // Find IDs that exist locally but not in Pipedrive (deleted from Pipedrive)
          const deletedIds = localPipedriveIds.filter(
            (id) => !pipedrivePersonIds.has(id)
          );

          if (deletedIds.length > 0) {
            const deletedCount = await leadsRepository.softDeleteByPipedrivePersonIds(deletedIds);
            result.deleted = deletedCount;

            // Log deletions
            for (const deletedId of deletedIds) {
              await this.logSync({
                eventType: 'sync',
                direction: 'inbound',
                entityType: 'person',
                pipedriveId: deletedId,
                status: 'success',
                payload: { action: 'deleted' },
              });
            }
          }
        } catch (error) {
          console.error('Error cleaning up deleted leads:', error);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Sync failed: ${errorMessage}`);
    }
  }

  /**
   * Preview leads from Pipedrive Leads Inbox without actually syncing
   * Returns items with their status for preview display
   */
  async previewLeadsInboxSync(): Promise<{
    items: Array<{
      id: string; // Pipedrive Lead UUID
      name: string;
      email?: string;
      company?: string;
      labels?: string[];
      status: 'new' | 'update' | 'skip';
      existingId?: string;
    }>;
    newCount: number;
    updateCount: number;
    skipCount: number;
  }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      // Fetch lead labels first (to convert label IDs to names)
      const labelMap = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getLeadLabels(connectionId)
      );

      // Fetch all leads from Leads Inbox
      const pipedriveLeads = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getLeads(connectionId, {
            limit: 500,
            archivedStatus: 'not_archived',
          }),
          { shouldRetry: isRetryableError }
        )
      );

      const items: Array<{
        id: string;
        name: string;
        email?: string;
        phone?: string;
        company?: string;
        labels?: string[];
        status: 'new' | 'update' | 'skip';
        existingId?: string;
      }> = [];

      let newCount = 0;
      let updateCount = 0;
      let skipCount = 0;

      // Check each lead against local database
      for (const lead of pipedriveLeads) {
        if (!lead.id) continue;

        const personName = lead.person?.name || lead.title;

        // Get email/phone from embedded person object first
        let primaryEmail = lead.person?.email?.find(e => e.primary)?.value || lead.person?.email?.[0]?.value;
        let primaryPhone = lead.person?.phone?.find(p => p.primary)?.value || lead.person?.phone?.[0]?.value;

        // If person_id exists but no email/phone, fetch full person details
        if (lead.person_id && (!primaryEmail || !primaryPhone)) {
          try {
            const person = await pipedriveRateLimiter.execute(() =>
              pipedriveProvider.getContact(connectionId, String(lead.person_id))
            );
            if (person) {
              if (!primaryEmail) primaryEmail = person.email || undefined;
              if (!primaryPhone) primaryPhone = person.phone || undefined;
            }
          } catch (e) {
            console.warn(`Failed to fetch person ${lead.person_id} for preview:`, e);
          }
        }

        // Convert label IDs to names
        const labels = (lead.label_ids || [])
          .map(id => labelMap.get(id))
          .filter((name): name is string => !!name);

        // Check if lead exists
        const existing = await leadsRepository.getByPipedriveLeadId(lead.id);

        if (existing) {
          items.push({
            id: lead.id,
            name: personName,
            email: primaryEmail,
            phone: primaryPhone,
            company: lead.organization?.name,
            labels,
            status: 'update',
            existingId: existing.id,
          });
          updateCount++;
        } else {
          items.push({
            id: lead.id,
            name: personName,
            email: primaryEmail,
            phone: primaryPhone,
            company: lead.organization?.name,
            labels,
            status: 'new',
          });
          newCount++;
        }
      }

      return { items, newCount, updateCount, skipCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Preview failed: ${errorMessage}`);
    }
  }

  /**
   * Sync leads from Pipedrive Leads Inbox to our Leads table
   * This is the correct method for syncing from Leads Inbox (not Persons)
   */
  async syncLeadsInboxToLeads(options: SyncOptions = {}): Promise<PipedriveSyncResult> {
    const result: PipedriveSyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
    };

    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      // Fetch lead labels first (to convert label IDs to names)
      const labelMap = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getLeadLabels(connectionId)
      );

      // Fetch all leads from Leads Inbox with rate limiting
      const pipedriveLeads = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getLeads(connectionId, {
            limit: 500,
            archivedStatus: 'not_archived',
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Collect all Pipedrive Lead IDs for deletion detection
      const pipedriveLeadIds = new Set<string>();

      // Process each lead
      for (const pipedriveLead of pipedriveLeads) {
        if (!pipedriveLead.id) continue;

        pipedriveLeadIds.add(pipedriveLead.id);

        try {
          // Convert label IDs to names
          const labels = (pipedriveLead.label_ids || [])
            .map(id => labelMap.get(id))
            .filter((name): name is string => !!name);

          // Fetch full person details if person_id exists (to get email, phone)
          let personDetails: { email?: string; phone?: string } = {};
          if (pipedriveLead.person_id) {
            try {
              const person = await pipedriveRateLimiter.execute(() =>
                pipedriveProvider.getContact(connectionId, String(pipedriveLead.person_id))
              );
              if (person) {
                personDetails = {
                  email: person.email || undefined,
                  phone: person.phone || undefined,
                };
              }
            } catch (e) {
              console.warn(`Failed to fetch person ${pipedriveLead.person_id}:`, e);
            }
          }

          // Fetch full organization details if organization_id exists (to get full address)
          let organizationDetails: CrmOrganization | null = null;
          if (pipedriveLead.organization_id) {
            try {
              organizationDetails = await pipedriveRateLimiter.execute(() =>
                pipedriveProvider.getOrganization(connectionId, String(pipedriveLead.organization_id))
              );
            } catch (e) {
              console.warn(`Failed to fetch organization ${pipedriveLead.organization_id}:`, e);
            }
          }

          // Map Pipedrive Lead to our Lead DTO (with labels, person details, and organization details)
          const leadDto = this.mapPipedriveLeadToLeadDTO(pipedriveLead, labels, personDetails, organizationDetails);

          // Check if lead already exists by pipedrive_lead_id
          const existing = await leadsRepository.getByPipedriveLeadId(pipedriveLead.id);

          if (existing && options.skipExisting) {
            result.skipped++;
            continue;
          }

          // Upsert using the Leads Inbox method
          const { lead, isNew } = await leadsRepository.upsertFromPipedriveLeadsInbox(leadDto);

          if (isNew) {
            result.created++;
          } else {
            result.updated++;
          }

          // Sync notes from Pipedrive for this lead (using lead_id for Leads Inbox)
          if (lead && pipedriveLead.id) {
            try {
              await this.syncNotesForLead(connectionId, lead.id, pipedriveLead.id);
            } catch (noteError) {
              console.warn(`Failed to sync notes for lead ${lead.id}:`, noteError);
              // Don't fail the entire sync if notes fail
            }
          }

          // Log sync
          await this.logSync({
            eventType: 'sync',
            direction: 'inbound',
            entityType: 'lead',
            pipedriveId: 0, // Leads have UUID, not integer ID
            status: 'success',
            payload: { pipedriveLeadId: pipedriveLead.id },
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            pipedriveId: 0,
            error: `${pipedriveLead.title}: ${errorMessage}`,
          });

          await this.logSync({
            eventType: 'sync',
            direction: 'inbound',
            entityType: 'lead',
            pipedriveId: 0,
            status: 'failed',
            errorMessage,
            payload: { pipedriveLeadId: pipedriveLead.id },
          });
        }
      }

      // Clean up deleted leads (leads in our DB but not in Pipedrive anymore)
      if (options.cleanupDeleted !== false) {
        try {
          // Get all local leads with pipedrive_lead_id
          const localLeadIds = await leadsRepository.getAllPipedriveLeadIds();

          // Find IDs that exist locally but not in Pipedrive
          const deletedIds = localLeadIds.filter(
            (localLead) => !pipedriveLeadIds.has(localLead.pipedriveLeadId)
          );

          if (deletedIds.length > 0) {
            // Soft delete by pipedrive_lead_id
            const pipedriveLeadIdsToDelete = deletedIds.map(d => d.pipedriveLeadId);
            const deletedCount = await leadsRepository.softDeleteByPipedriveLeadIds(pipedriveLeadIdsToDelete);
            result.deleted = deletedCount;

            // Log deletions
            for (const deletedLead of deletedIds) {
              await this.logSync({
                eventType: 'sync',
                direction: 'inbound',
                entityType: 'lead',
                entityId: deletedLead.id,
                pipedriveId: 0,
                status: 'success',
                payload: { action: 'deleted', pipedriveLeadId: deletedLead.pipedriveLeadId },
              });
            }
          }
        } catch (error) {
          console.error('Error cleaning up deleted leads:', error);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Sync failed: ${errorMessage}`);
    }
  }

  // ============================================
  // DEALS SYNC
  // ============================================

  /**
   * Preview deals sync from Pipedrive
   * Returns items with their sync status for preview display
   */
  async previewDealsSync(): Promise<{
    items: Array<{
      id: number;
      title: string;
      value?: number;
      currency?: string;
      status: 'new' | 'update' | 'skip';
      existingId?: string;
      pipelineName?: string;
      stageName?: string;
      contactName?: string;
      organizationName?: string;
    }>;
    newCount: number;
    updateCount: number;
    skipCount: number;
  }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      // Fetch all deals from Pipedrive
      const pipedriveDeals = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getDeals(connectionId, {
            limit: 500,
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Fetch pipelines for names
      const pipelines = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getPipelines(connectionId)
      );

      // Create lookup maps
      const pipelineMap = new Map<string, CrmPipeline>();
      const stageMap = new Map<string, { name: string; pipelineId: string }>();

      pipelines.forEach(p => {
        pipelineMap.set(p.id, p);
        p.stages?.forEach(s => {
          stageMap.set(s.id, { name: s.name, pipelineId: p.id });
        });
      });

      const items: Array<{
        id: number;
        title: string;
        value?: number;
        currency?: string;
        status: 'new' | 'update' | 'skip';
        existingId?: string;
        pipelineName?: string;
        stageName?: string;
        contactName?: string;
        organizationName?: string;
      }> = [];

      let newCount = 0;
      let updateCount = 0;
      const skipCount = 0;

      // Check each deal against local database
      for (const deal of pipedriveDeals) {
        if (!deal.externalId) continue;

        const pipedriveDealId = parseInt(deal.externalId);
        const pipeline = deal.pipelineId ? pipelineMap.get(deal.pipelineId) : null;
        const stage = deal.stageId ? stageMap.get(deal.stageId) : null;

        // Check if deal already exists
        const existing = await dealsRepository.getByPipedriveDealId(pipedriveDealId);

        if (existing) {
          items.push({
            id: pipedriveDealId,
            title: deal.title,
            value: deal.value ?? undefined,
            currency: deal.currency ?? undefined,
            status: 'update',
            existingId: existing.id,
            pipelineName: pipeline?.name,
            stageName: stage?.name,
          });
          updateCount++;
        } else {
          items.push({
            id: pipedriveDealId,
            title: deal.title,
            value: deal.value ?? undefined,
            currency: deal.currency ?? undefined,
            status: 'new',
            pipelineName: pipeline?.name,
            stageName: stage?.name,
          });
          newCount++;
        }
      }

      return { items, newCount, updateCount, skipCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Preview failed: ${errorMessage}`);
    }
  }

  /**
   * Sync deals from Pipedrive to local deals table
   */
  async syncDealsToLocal(options: SyncOptions = {}): Promise<DealSyncResult> {
    const result: DealSyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
    };

    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      // Fetch all deals from Pipedrive with rate limiting
      const pipedriveDeals = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getDeals(connectionId, {
            sinceDate: options.sinceDate,
            limit: 500,
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Fetch contacts (persons) for enrichment
      const contacts = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getContacts(connectionId, {
            limit: 500,
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Fetch organizations for enrichment
      const organizations = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          () => pipedriveProvider.getOrganizations(connectionId, {
            limit: 500,
          }),
          { shouldRetry: isRetryableError }
        )
      );

      // Fetch pipelines and stages for names
      const pipelines = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getPipelines(connectionId)
      );

      // Create lookup maps
      const contactsById = new Map<string, CrmContact>();
      contacts.forEach(c => {
        if (c.externalId) contactsById.set(c.externalId, c);
      });

      const orgsById = new Map<string, CrmOrganization>();
      organizations.forEach(o => {
        if (o.externalId) orgsById.set(o.externalId, o);
      });

      const pipelineMap = new Map<string, CrmPipeline>();
      const stageMap = new Map<string, { name: string; pipelineId: string; order: number; probability?: number }>();

      pipelines.forEach(p => {
        pipelineMap.set(p.id, p);
        p.stages?.forEach(s => {
          stageMap.set(s.id, {
            name: s.name,
            pipelineId: p.id,
            order: s.order || 0,
            probability: s.probability,
          });
        });
      });

      // Collect all Pipedrive Deal IDs from the sync
      const pipedriveDealIds = new Set<number>();

      // Process each deal
      for (const deal of pipedriveDeals) {
        if (!deal.externalId) continue;

        const pipedriveDealId = parseInt(deal.externalId);
        pipedriveDealIds.add(pipedriveDealId);

        try {
          // Get contact and organization info
          const contact = deal.contactExternalId
            ? contactsById.get(deal.contactExternalId) ?? null
            : null;
          const organization = deal.organizationExternalId
            ? orgsById.get(deal.organizationExternalId) ?? null
            : null;

          // Get pipeline and stage info
          const pipeline = deal.pipelineId ? pipelineMap.get(deal.pipelineId) ?? null : null;
          const stage = deal.stageId ? stageMap.get(deal.stageId) ?? null : null;

          // Check if already exists
          const existing = await dealsRepository.getByPipedriveDealId(pipedriveDealId);

          if (existing && options.skipExisting) {
            result.skipped++;
            continue;
          }

          // Map to deal DTO
          const dealDto = this.mapPipedriveDealToDTO(
            deal,
            contact,
            organization,
            pipeline,
            stage
          );

          // Upsert deal
          const { deal: savedDeal, isNew } = await dealsRepository.upsertFromPipedrive(dealDto);

          if (isNew) {
            result.created++;
          } else {
            result.updated++;
          }

          // Sync notes from Pipedrive for this deal
          if (savedDeal && pipedriveDealId) {
            try {
              await this.syncNotesForDeal(connectionId, savedDeal.id, pipedriveDealId);
            } catch (noteError) {
              console.warn(`Failed to sync notes for deal ${savedDeal.id}:`, noteError);
              // Don't fail the entire sync if notes fail
            }
          }

          // Log sync
          await this.logSync({
            eventType: 'sync',
            direction: 'inbound',
            entityType: 'deal',
            pipedriveId: pipedriveDealId,
            status: 'success',
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({
            pipedriveDealId: pipedriveDealId,
            error: errorMessage,
          });

          await this.logSync({
            eventType: 'sync',
            direction: 'inbound',
            entityType: 'deal',
            pipedriveId: pipedriveDealId,
            status: 'failed',
            errorMessage,
          });
        }
      }

      // Clean up deleted deals (deals in our DB but not in Pipedrive anymore)
      if (options.cleanupDeleted !== false) {
        try {
          // Get all local deals with pipedrive_deal_id
          const localPipedriveDealIds = await dealsRepository.getAllPipedriveDealIds();

          // Find IDs that exist locally but not in Pipedrive (deleted from Pipedrive)
          const deletedIds = localPipedriveDealIds.filter(
            id => !pipedriveDealIds.has(id)
          );

          if (deletedIds.length > 0) {
            const deletedCount = await dealsRepository.softDeleteByPipedriveDealIds(deletedIds);
            result.deleted = deletedCount;

            // Log deletions
            for (const deletedId of deletedIds) {
              await this.logSync({
                eventType: 'sync',
                direction: 'inbound',
                entityType: 'deal',
                pipedriveId: deletedId,
                status: 'success',
                payload: { action: 'deleted' },
              });
            }
          }
        } catch (error) {
          console.error('Error cleaning up deleted deals:', error);
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Deals sync failed: ${errorMessage}`);
    }
  }

  /**
   * Sync a single deal from Pipedrive (for webhook handling)
   */
  async syncSingleDeal(pipedriveDealId: number): Promise<{ deal: unknown; isNew: boolean } | null> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      // Fetch the deal
      const deal = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getDeal(connectionId, pipedriveDealId.toString())
      );

      if (!deal) {
        return null;
      }

      // Fetch contact if linked
      let contact: CrmContact | null = null;
      if (deal.contactExternalId) {
        contact = await pipedriveRateLimiter.execute(() =>
          pipedriveProvider.getContact(connectionId, deal.contactExternalId!)
        );
      }

      // Fetch organization if linked
      let organization: CrmOrganization | null = null;
      if (deal.organizationExternalId) {
        organization = await pipedriveRateLimiter.execute(() =>
          pipedriveProvider.getOrganization(connectionId, deal.organizationExternalId!)
        );
      }

      // Fetch pipelines for stage info
      const pipelines = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getPipelines(connectionId)
      );

      // Find pipeline and stage
      let pipeline: CrmPipeline | null = null;
      let stage: { name: string; pipelineId: string; order: number; probability?: number } | null = null;

      if (deal.pipelineId) {
        pipeline = pipelines.find(p => p.id === deal.pipelineId) || null;
        if (pipeline && deal.stageId) {
          const s = pipeline.stages?.find(s => s.id === deal.stageId);
          if (s) {
            stage = {
              name: s.name,
              pipelineId: pipeline.id,
              order: s.order || 0,
              probability: s.probability,
            };
          }
        }
      }

      // Map to deal DTO
      const dealDto = this.mapPipedriveDealToDTO(deal, contact, organization, pipeline, stage);

      // Upsert deal
      const { deal: savedDeal, isNew } = await dealsRepository.upsertFromPipedrive(dealDto);

      // Sync notes from Pipedrive for this deal
      if (savedDeal) {
        try {
          await this.syncNotesForDeal(connectionId, savedDeal.id, pipedriveDealId);
        } catch (noteError) {
          console.warn(`Failed to sync notes for deal ${savedDeal.id}:`, noteError);
          // Don't fail the entire sync if notes fail
        }
      }

      await this.logSync({
        eventType: 'webhook',
        direction: 'inbound',
        entityType: 'deal',
        entityId: savedDeal.id,
        pipedriveId: pipedriveDealId,
        status: 'success',
      });

      return { deal: savedDeal, isNew };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logSync({
        eventType: 'webhook',
        direction: 'inbound',
        entityType: 'deal',
        pipedriveId: pipedriveDealId,
        status: 'failed',
        errorMessage,
      });

      throw error;
    }
  }

  /**
   * Map Pipedrive deal to local Deal DTO
   */
  private mapPipedriveDealToDTO(
    deal: CrmDeal,
    contact: CrmContact | null,
    organization: CrmOrganization | null,
    pipeline: CrmPipeline | null,
    stage: { name: string; pipelineId: string; order: number; probability?: number } | null
  ): CreateDealDTO {
    const contactName = contact
      ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || null
      : null;

    return {
      title: deal.title,
      pipedriveDealId: deal.externalId ? parseInt(deal.externalId) : null,
      pipedrivePersonId: deal.contactExternalId ? parseInt(deal.contactExternalId) : null,
      pipedriveOrgId: deal.organizationExternalId ? parseInt(deal.organizationExternalId) : null,
      value: deal.value ?? null,
      currency: deal.currency || 'USD',
      pipelineId: deal.pipelineId ? parseInt(deal.pipelineId) : null,
      pipelineName: pipeline?.name || null,
      stageId: deal.stageId ? parseInt(deal.stageId) : null,
      stageName: stage?.name || null,
      stageOrder: stage?.order ?? null,
      status: deal.status as CreateDealDTO['status'] || 'open',
      probability: deal.probability ?? stage?.probability ?? null,
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null,
      wonTime: deal.metadata?.wonTime && typeof deal.metadata.wonTime === 'string' ? new Date(deal.metadata.wonTime) : null,
      lostTime: deal.metadata?.lostTime && typeof deal.metadata.lostTime === 'string' ? new Date(deal.metadata.lostTime) : null,
      lostReason: deal.metadata?.lostReason && typeof deal.metadata.lostReason === 'string' ? deal.metadata.lostReason : null,
      contactName,
      contactEmail: contact?.email || null,
      contactPhone: contact?.phone || null,
      organizationName: organization?.name || null,
      organizationAddressStreet: organization?.address?.street || null,
      organizationAddressCity: organization?.address?.city || null,
      organizationAddressState: organization?.address?.state || null,
      organizationAddressPostalCode: organization?.address?.postalCode || null,
      organizationAddressCountry: organization?.address?.country || null,
    };
  }

  /**
   * Sync notes from Pipedrive for a specific lead
   * Fetches notes by lead_id (for Leads Inbox) and saves to lead_notes table
   *
   * Bi-directional sync:
   * - Adds new notes from Pipedrive
   * - Updates existing notes if content changed in Pipedrive
   * - Deletes notes that were deleted in Pipedrive
   */
  private async syncNotesForLead(
    connectionId: string,
    leadId: string,
    pipedriveLeadId: string // Pipedrive Leads Inbox UUID
  ): Promise<{ added: number; updated: number; deleted: number }> {
    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    try {
      // Fetch notes from Pipedrive for this lead (using lead_id for Leads Inbox)
      const pipedriveNotes = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getNotes(connectionId, {
          leadId: pipedriveLeadId, // Use lead_id instead of person_id
          limit: 100,
        })
      );

      // Get existing notes for this lead
      const existingNotes = await leadsRepository.getNotes(leadId);

      // Create maps for easy lookup
      const existingNotesMap = new Map(
        existingNotes
          .filter(n => n.pipedriveNoteId)
          .map(n => [n.pipedriveNoteId!, n])
      );

      const pipedriveNoteIds = new Set<number>();

      // Process Pipedrive notes: add new or update existing
      for (const note of pipedriveNotes || []) {
        if (!note.externalId || !note.content) continue;

        const pipedriveNoteId = parseInt(note.externalId);
        pipedriveNoteIds.add(pipedriveNoteId);

        // Clean the note content - strip HTML and decode entities
        const cleanContent = stripHtmlAndDecode(note.content);

        const existingNote = existingNotesMap.get(pipedriveNoteId);

        if (existingNote) {
          // Note exists - check if content changed
          if (existingNote.content !== cleanContent) {
            await leadsRepository.updateNoteByPipedriveId(pipedriveNoteId, cleanContent);
            updatedCount++;
            console.log(`[PipedriveSyncNotes] Updated note ${pipedriveNoteId} for lead ${leadId}`);
          }
        } else {
          // New note - add it
          await leadsRepository.addNote(
            leadId,
            cleanContent,
            undefined, // No userId - system sync
            pipedriveNoteId
          );
          addedCount++;
        }
      }

      // Delete notes that no longer exist in Pipedrive
      const notesToDelete: number[] = [];
      for (const [pipedriveNoteId] of existingNotesMap) {
        if (!pipedriveNoteIds.has(pipedriveNoteId)) {
          notesToDelete.push(pipedriveNoteId);
        }
      }

      if (notesToDelete.length > 0) {
        deletedCount = await leadsRepository.deleteNotesByPipedriveIds(notesToDelete);
        console.log(`[PipedriveSyncNotes] Deleted ${deletedCount} notes for lead ${leadId}`);
      }

      if (addedCount > 0 || updatedCount > 0 || deletedCount > 0) {
        console.log(`[PipedriveSyncNotes] Lead ${leadId}: +${addedCount} added, ~${updatedCount} updated, -${deletedCount} deleted`);
      }

      return { added: addedCount, updated: updatedCount, deleted: deletedCount };
    } catch (error) {
      console.error(`[PipedriveSyncNotes] Error syncing notes for lead ${leadId}:`, error);
      throw error;
    }
  }

  /**
   * Sync notes from Pipedrive for a specific deal
   * Fetches notes by deal_id and saves to deal_notes table
   *
   * Bi-directional sync:
   * - Adds new notes from Pipedrive
   * - Updates existing notes if content changed in Pipedrive
   * - Deletes notes that were deleted in Pipedrive
   */
  private async syncNotesForDeal(
    connectionId: string,
    dealId: string,
    pipedriveDealId: number
  ): Promise<{ added: number; updated: number; deleted: number }> {
    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    try {
      // Fetch notes from Pipedrive for this deal
      const pipedriveNotes = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getNotes(connectionId, {
          dealId: pipedriveDealId.toString(),
          limit: 100,
        })
      );

      // Get existing notes for this deal
      const existingNotes = await dealsRepository.getNotes(dealId);

      // Create maps for easy lookup
      const existingNotesMap = new Map(
        existingNotes
          .filter(n => n.pipedriveNoteId)
          .map(n => [n.pipedriveNoteId!, n])
      );

      const pipedriveNoteIds = new Set<number>();

      // Process Pipedrive notes: add new or update existing
      for (const note of pipedriveNotes || []) {
        if (!note.externalId || !note.content) continue;

        const pipedriveNoteId = parseInt(note.externalId);
        pipedriveNoteIds.add(pipedriveNoteId);

        // Clean the note content - strip HTML and decode entities
        const cleanContent = stripHtmlAndDecode(note.content);

        const existingNote = existingNotesMap.get(pipedriveNoteId);

        if (existingNote) {
          // Note exists - check if content changed
          if (existingNote.content !== cleanContent) {
            await dealsRepository.updateNoteByPipedriveId(pipedriveNoteId, cleanContent);
            updatedCount++;
            console.log(`[PipedriveSyncNotes] Updated note ${pipedriveNoteId} for deal ${dealId}`);
          }
        } else {
          // New note - add it
          await dealsRepository.addNote(
            dealId,
            cleanContent,
            undefined, // No userId - system sync
            pipedriveNoteId
          );
          addedCount++;
        }
      }

      // Delete notes that no longer exist in Pipedrive
      const notesToDelete: number[] = [];
      for (const [pipedriveNoteId] of existingNotesMap) {
        if (!pipedriveNoteIds.has(pipedriveNoteId)) {
          notesToDelete.push(pipedriveNoteId);
        }
      }

      if (notesToDelete.length > 0) {
        deletedCount = await dealsRepository.deleteNotesByPipedriveIds(notesToDelete);
        console.log(`[PipedriveSyncNotes] Deleted ${deletedCount} notes for deal ${dealId}`);
      }

      if (addedCount > 0 || updatedCount > 0 || deletedCount > 0) {
        console.log(`[PipedriveSyncNotes] Deal ${dealId}: +${addedCount} added, ~${updatedCount} updated, -${deletedCount} deleted`);
      }

      return { added: addedCount, updated: updatedCount, deleted: deletedCount };
    } catch (error) {
      console.error(`[PipedriveSyncNotes] Error syncing notes for deal ${dealId}:`, error);
      throw error;
    }
  }

  /**
   * Map Pipedrive Lead (from Leads Inbox) to our Lead DTO
   */
  private mapPipedriveLeadToLeadDTO(
    lead: PipedriveLead,
    labels?: string[],
    personDetails?: { email?: string; phone?: string },
    organizationDetails?: CrmOrganization | null
  ): CreateLeadDTO {
    const personName = lead.person?.name || lead.title;
    // Use fetched person details first, then fall back to embedded data
    const primaryEmail = personDetails?.email || lead.person?.email?.find(e => e.primary)?.value || lead.person?.email?.[0]?.value;
    const primaryPhone = personDetails?.phone || lead.person?.phone?.find(p => p.primary)?.value || lead.person?.phone?.[0]?.value;

    return {
      name: personName,
      email: primaryEmail || null,
      phone: primaryPhone || null,
      company: organizationDetails?.name || lead.organization?.name || null,
      // Use full organization details if available for complete address
      addressStreet: organizationDetails?.address?.street || null,
      addressCity: organizationDetails?.address?.city || null,
      addressState: organizationDetails?.address?.state || null,
      addressPostalCode: organizationDetails?.address?.postalCode || null,
      addressCountry: organizationDetails?.address?.country || null,
      // Pipedrive Leads have UUID id - store it in pipedriveLeadId
      pipedriveLeadId: lead.id, // UUID from Leads Inbox
      pipedriveLabels: labels || null, // Labels like "HOT", "WARM", etc.
      pipedrivePersonId: lead.person_id || null,
      pipedriveOrgId: lead.organization_id || null,
      dealTitle: lead.title,
      dealValue: lead.value?.amount || null,
      dealCurrency: lead.value?.currency || 'USD',
      expectedCloseDate: lead.expected_close_date ? new Date(lead.expected_close_date) : null,
      source: 'pipedrive',
      sourceDetail: lead.source_name || 'Leads Inbox',
      status: 'new',
      pipedriveOwnerId: lead.owner_id || null,
    };
  }

  /**
   * Sync a single deal from Pipedrive (usually from webhook)
   */
  async syncDealToLead(pipedriveDealId: number): Promise<{ lead: unknown; isNew: boolean } | null> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      // Fetch the deal
      const deal = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.getDeal(connectionId, pipedriveDealId.toString())
      );

      if (!deal) {
        return null;
      }

      // Fetch the person if linked
      let person: CrmContact | null = null;
      if (deal.contactExternalId) {
        person = await pipedriveRateLimiter.execute(() =>
          pipedriveProvider.getContact(connectionId, deal.contactExternalId!)
        );
      }

      // Fetch the organization if linked
      let organization: CrmOrganization | null = null;
      if (deal.organizationExternalId) {
        organization = await pipedriveRateLimiter.execute(() =>
          pipedriveProvider.getOrganization(connectionId, deal.organizationExternalId!)
        );
      }

      // Map to lead DTO
      const leadDto = this.mapDealToLeadDTO(deal, person, organization);

      // Check if lead exists by deal ID
      let existing = await leadsRepository.getByPipedriveDealId(pipedriveDealId);

      // If not found by deal ID, check by person ID
      if (!existing && leadDto.pipedrivePersonId) {
        existing = await leadsRepository.getByPipedrivePersonId(leadDto.pipedrivePersonId);
      }

      if (existing) {
        // Update existing lead with deal info
        const updated = await leadsRepository.update(existing.id, {
          dealTitle: leadDto.dealTitle,
          dealValue: leadDto.dealValue,
          dealStage: leadDto.dealStage,
          dealStageId: leadDto.dealStageId,
          dealPipeline: leadDto.dealPipeline,
          dealPipelineId: leadDto.dealPipelineId,
          dealProbability: leadDto.dealProbability,
          dealStatus: leadDto.dealStatus,
          expectedCloseDate: leadDto.expectedCloseDate,
        });

        await this.logSync({
          eventType: 'webhook',
          direction: 'inbound',
          entityType: 'deal',
          entityId: existing.id,
          pipedriveId: pipedriveDealId,
          status: 'success',
        });

        return { lead: updated, isNew: false };
      }

      // Create new lead
      const created = await leadsRepository.create(leadDto);

      await this.logSync({
        eventType: 'webhook',
        direction: 'inbound',
        entityType: 'deal',
        entityId: created.id,
        pipedriveId: pipedriveDealId,
        status: 'success',
      });

      return { lead: created, isNew: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logSync({
        eventType: 'webhook',
        direction: 'inbound',
        entityType: 'deal',
        pipedriveId: pipedriveDealId,
        status: 'failed',
        errorMessage,
      });

      throw error;
    }
  }

  /**
   * Push a note to Pipedrive
   */
  async pushNoteToPipedrive(
    noteContent: string,
    options: { personId?: number; dealId?: number; orgId?: number }
  ): Promise<number | null> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      const note = await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.createNote(connectionId, {
          content: noteContent,
          contactId: options.personId?.toString(),
          dealId: options.dealId?.toString(),
          organizationId: options.orgId?.toString(),
        })
      );

      await this.logSync({
        eventType: 'push',
        direction: 'outbound',
        entityType: 'note',
        pipedriveId: parseInt(note.externalId || '0'),
        status: 'success',
      });

      return parseInt(note.externalId || '0');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logSync({
        eventType: 'push',
        direction: 'outbound',
        entityType: 'note',
        status: 'failed',
        errorMessage,
      });

      throw error;
    }
  }

  /**
   * Update deal value in Pipedrive (e.g., when quote is created)
   */
  async updateDealValue(pipedriveDealId: number, value: number): Promise<void> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    try {
      await pipedriveRateLimiter.execute(() =>
        pipedriveProvider.updateDeal(connectionId, pipedriveDealId.toString(), {
          value,
        })
      );

      await this.logSync({
        eventType: 'push',
        direction: 'outbound',
        entityType: 'deal',
        pipedriveId: pipedriveDealId,
        status: 'success',
        payload: { value },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.logSync({
        eventType: 'push',
        direction: 'outbound',
        entityType: 'deal',
        pipedriveId: pipedriveDealId,
        status: 'failed',
        errorMessage,
      });

      throw error;
    }
  }

  /**
   * Get pipelines from Pipedrive
   */
  async getPipelines(): Promise<Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      throw new Error('Pipedrive is not connected');
    }

    const pipelines = await pipedriveRateLimiter.execute(() =>
      pipedriveProvider.getPipelines(connectionId)
    );

    return pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      stages: p.stages?.map((s) => ({ id: s.id, name: s.name })) || [],
    }));
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get the primary deal from a list of deals
   * Priority: open deals > won deals > lost deals
   * Within same status: most recent
   */
  private getPrimaryDeal(deals: CrmDeal[]): CrmDeal | null {
    if (deals.length === 0) return null;

    const openDeals = deals.filter((d) => d.status === 'open');
    const wonDeals = deals.filter((d) => d.status === 'won');
    const lostDeals = deals.filter((d) => d.status === 'lost');

    // Return most recent from each category in priority order
    if (openDeals.length > 0) {
      return openDeals[0] ?? null;
    }
    if (wonDeals.length > 0) {
      return wonDeals[0] ?? null;
    }
    if (lostDeals.length > 0) {
      return lostDeals[0] ?? null;
    }

    return deals[0] ?? null;
  }

  /**
   * Map Pipedrive person to Lead DTO
   */
  private mapPersonToLeadDTO(
    person: CrmContact,
    deal: CrmDeal | null,
    organization: CrmOrganization | null
  ): CreateLeadDTO {
    return {
      name: `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email || 'Unknown',
      email: person.email,
      phone: person.phone,
      company: organization?.name || null,
      addressStreet: organization?.address?.street || null,
      addressCity: organization?.address?.city || null,
      addressState: organization?.address?.state || null,
      addressPostalCode: organization?.address?.postalCode || null,
      addressCountry: organization?.address?.country || null,
      pipedrivePersonId: person.externalId ? parseInt(person.externalId) : null,
      pipedriveDealId: deal?.externalId ? parseInt(deal.externalId) : null,
      pipedriveOrgId: organization?.externalId ? parseInt(organization.externalId) : null,
      dealTitle: deal?.title || null,
      dealValue: deal?.value || null,
      dealCurrency: deal?.currency || 'USD',
      dealStage: null, // Would need stage name lookup
      dealStageId: deal?.stageId ? parseInt(deal.stageId) : null,
      dealPipeline: null, // Would need pipeline name lookup
      dealPipelineId: deal?.pipelineId ? parseInt(deal.pipelineId) : null,
      dealProbability: deal?.probability || null,
      dealStatus: deal?.status as CreateLeadDTO['dealStatus'] || null,
      expectedCloseDate: deal?.expectedCloseDate ? new Date(deal.expectedCloseDate) : null,
      source: 'pipedrive',
      status: this.mapDealStatusToLeadStatus(deal?.status),
    };
  }

  /**
   * Map Pipedrive deal to Lead DTO
   */
  private mapDealToLeadDTO(
    deal: CrmDeal,
    person: CrmContact | null,
    organization: CrmOrganization | null
  ): CreateLeadDTO {
    return {
      name: person
        ? `${person.firstName || ''} ${person.lastName || ''}`.trim() || person.email || deal.title
        : deal.title,
      email: person?.email || null,
      phone: person?.phone || null,
      company: organization?.name || null,
      addressStreet: organization?.address?.street || null,
      addressCity: organization?.address?.city || null,
      addressState: organization?.address?.state || null,
      addressPostalCode: organization?.address?.postalCode || null,
      addressCountry: organization?.address?.country || null,
      pipedrivePersonId: person?.externalId ? parseInt(person.externalId) : null,
      pipedriveDealId: deal.externalId ? parseInt(deal.externalId) : null,
      pipedriveOrgId: organization?.externalId ? parseInt(organization.externalId) : null,
      dealTitle: deal.title,
      dealValue: deal.value,
      dealCurrency: deal.currency || 'USD',
      dealStage: null,
      dealStageId: deal.stageId ? parseInt(deal.stageId) : null,
      dealPipeline: null,
      dealPipelineId: deal.pipelineId ? parseInt(deal.pipelineId) : null,
      dealProbability: deal.probability || null,
      dealStatus: deal.status as CreateLeadDTO['dealStatus'] || null,
      expectedCloseDate: deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null,
      source: 'pipedrive',
      status: this.mapDealStatusToLeadStatus(deal.status),
    };
  }

  /**
   * Map Pipedrive deal status to lead status
   */
  private mapDealStatusToLeadStatus(dealStatus: string | undefined | null): CreateLeadDTO['status'] {
    switch (dealStatus) {
      case 'won':
        return 'converted';
      case 'lost':
        return 'lost';
      case 'open':
      default:
        return 'new';
    }
  }

  /**
   * Log sync operation
   */
  private async logSync(entry: SyncLogEntry): Promise<void> {
    try {
      await db.from('pipedrive_sync_log').insert({
        event_type: entry.eventType,
        direction: entry.direction,
        entity_type: entry.entityType,
        entity_id: entry.entityId || null,
        pipedrive_id: entry.pipedriveId || null,
        payload: entry.payload ? JSON.stringify(entry.payload) : null,
        status: entry.status,
        error_message: entry.errorMessage || null,
      });
    } catch (error) {
      console.error('Failed to log sync:', error);
    }
  }
}

// Export singleton instance
export const pipedriveSyncService = new PipedriveSyncService();
