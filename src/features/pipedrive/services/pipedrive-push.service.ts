/**
 * Pipedrive Push Service
 *
 * Handles outbound sync from Gesher to Pipedrive.
 * - Push notes to Pipedrive
 * - Update deal values from quotes
 * - Sync order history/LTV
 */

import { db } from '@/shared/lib/supabase/database';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import { getConnectionByIntegrationId, getIntegrationByProvider } from '@/modules/integrations/core/repositories';
import { pipedriveRateLimiter, retryWithBackoff, isRetryableError } from '../lib/rate-limiter';

// ============================================
// TYPES
// ============================================

interface PushNoteResult {
  success: boolean;
  pipedriveNoteId?: number;
  error?: string;
}

interface PushDealUpdateResult {
  success: boolean;
  error?: string;
}

interface CustomerLTV {
  customerId: string;
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  lastOrderDate: string | null;
}

// ============================================
// PUSH SERVICE
// ============================================

class PipedrivePushService {
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

  // ============================================
  // NOTES SYNC
  // ============================================

  /**
   * Push a note to Pipedrive
   * Can be attached to a person, deal, organization, or lead (Leads Inbox)
   */
  async pushNote(
    content: string,
    options: {
      personId?: number;
      dealId?: number;
      orgId?: number;
      leadId?: string; // Pipedrive Leads Inbox lead UUID
    }
  ): Promise<PushNoteResult> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      const result = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            // CrmNote uses string IDs
            const note = await pipedriveProvider.createNote(connectionId, {
              content,
              contactId: options.personId?.toString(),
              dealId: options.dealId?.toString(),
              organizationId: options.orgId?.toString(),
              leadId: options.leadId, // For Leads Inbox leads
            });
            return note;
          },
          { shouldRetry: isRetryableError }
        )
      );

      // Log sync - externalId is the Pipedrive ID
      const pipedriveNoteId = result.externalId ? parseInt(result.externalId) : undefined;
      await this.logSync('push', 'note', pipedriveNoteId || null, 'success');

      return {
        success: true,
        pipedriveNoteId,
      };
    } catch (error) {
      console.error('[PipedrivePush] Error pushing note:', error);
      await this.logSync('push', 'note', null, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push note',
      };
    }
  }

  /**
   * Push a customer note to their linked Pipedrive person
   */
  async pushCustomerNote(customerId: string, noteContent: string): Promise<PushNoteResult> {
    // Get customer with Pipedrive IDs
    const { data: customer } = await db
      .from('customers')
      .select('id, name, pipedrive_person_id, pipedrive_deal_id, pipedrive_org_id')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    if (!customer.pipedrive_person_id && !customer.pipedrive_deal_id) {
      return { success: false, error: 'Customer not linked to Pipedrive' };
    }

    return this.pushNote(noteContent, {
      personId: customer.pipedrive_person_id || undefined,
      dealId: customer.pipedrive_deal_id || undefined,
      orgId: customer.pipedrive_org_id || undefined,
    });
  }

  /**
   * Push a lead note to their linked Pipedrive lead/person
   * For Leads Inbox leads, uses lead_id. For converted leads, uses person_id.
   */
  async pushLeadNote(leadId: string, noteContent: string): Promise<PushNoteResult> {
    // Get lead with Pipedrive IDs (including pipedrive_lead_id for Leads Inbox)
    const { data: lead } = await db
      .from('leads')
      .select('id, name, pipedrive_lead_id, pipedrive_person_id, pipedrive_deal_id, pipedrive_org_id')
      .eq('id', leadId)
      .single();

    if (!lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Check for any Pipedrive link - lead_id (Leads Inbox) OR person_id/deal_id (converted)
    if (!lead.pipedrive_lead_id && !lead.pipedrive_person_id && !lead.pipedrive_deal_id) {
      return { success: false, error: 'Lead not linked to Pipedrive' };
    }

    // Push note - prefer lead_id for Leads Inbox, fall back to person_id
    const result = await this.pushNote(noteContent, {
      leadId: lead.pipedrive_lead_id || undefined, // For Leads Inbox leads
      personId: lead.pipedrive_person_id || undefined,
      dealId: lead.pipedrive_deal_id || undefined,
      orgId: lead.pipedrive_org_id || undefined,
    });

    // Update lead note with Pipedrive note ID if successful
    if (result.success && result.pipedriveNoteId) {
      // The calling code should handle marking the note as synced
    }

    return result;
  }

  /**
   * Update a note in Pipedrive
   */
  async updateNoteInPipedrive(
    pipedriveNoteId: number,
    content: string
  ): Promise<{ success: boolean; error?: string }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            await pipedriveProvider.updateNote(connectionId, pipedriveNoteId.toString(), {
              content,
            });
          },
          { shouldRetry: isRetryableError }
        )
      );

      await this.logSync('push', 'note', pipedriveNoteId, 'success', 'Note updated');
      return { success: true };
    } catch (error) {
      console.error('[PipedrivePush] Error updating note:', error);
      await this.logSync('push', 'note', pipedriveNoteId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update note',
      };
    }
  }

  /**
   * Delete a note from Pipedrive
   */
  async deleteNoteFromPipedrive(
    pipedriveNoteId: number
  ): Promise<{ success: boolean; error?: string }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            await pipedriveProvider.deleteNote(connectionId, pipedriveNoteId.toString());
          },
          { shouldRetry: isRetryableError }
        )
      );

      await this.logSync('push', 'note', pipedriveNoteId, 'success', 'Note deleted');
      return { success: true };
    } catch (error) {
      console.error('[PipedrivePush] Error deleting note:', error);
      await this.logSync('push', 'note', pipedriveNoteId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete note',
      };
    }
  }

  // ============================================
  // LEAD CREATION (PUSH TO PIPEDRIVE)
  // ============================================

  /**
   * Create a new lead in Pipedrive Leads Inbox
   * Returns the Pipedrive lead ID and optionally person/org IDs
   */
  async pushNewLead(leadData: {
    title: string;
    personName?: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    // Address fields
    addressStreet?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressPostalCode?: string | null;
    addressCountry?: string | null;
    // Deal info
    value?: number | null;
    currency?: string;
    expectedCloseDate?: Date | null;
    notes?: string | null;
    // Labels
    labelIds?: string[];
  }): Promise<{
    success: boolean;
    pipedriveLeadId?: string;
    pipedrivePersonId?: number;
    pipedriveOrgId?: number;
    error?: string;
  }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      const result = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            return pipedriveProvider.createLead(connectionId, {
              title: leadData.title,
              personName: leadData.personName,
              email: leadData.email || undefined,
              phone: leadData.phone || undefined,
              company: leadData.company || undefined,
              // Address
              addressStreet: leadData.addressStreet || undefined,
              addressCity: leadData.addressCity || undefined,
              addressState: leadData.addressState || undefined,
              addressPostalCode: leadData.addressPostalCode || undefined,
              addressCountry: leadData.addressCountry || undefined,
              // Deal info
              value: leadData.value || undefined,
              currency: leadData.currency || 'USD',
              expectedCloseDate: leadData.expectedCloseDate
                ? leadData.expectedCloseDate.toISOString().split('T')[0]
                : undefined,
              notes: leadData.notes || undefined,
              labelIds: leadData.labelIds,
            });
          },
          { shouldRetry: isRetryableError }
        )
      );

      // Log sync
      await this.logSync('push', 'lead', null, 'success');

      return {
        success: true,
        pipedriveLeadId: result.leadId,
        pipedrivePersonId: result.personId,
        pipedriveOrgId: result.orgId,
      };
    } catch (error) {
      console.error('[PipedrivePush] Error creating lead:', error);
      await this.logSync('push', 'lead', null, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create lead in Pipedrive',
      };
    }
  }

  // ============================================
  // LEAD UPDATE (PUSH TO PIPEDRIVE)
  // ============================================

  /**
   * Update an existing lead in Pipedrive
   * Updates the lead, person, and organization
   */
  async updateExistingLead(
    leadId: string,
    pipedriveLeadId: string,
    pipedrivePersonId: number | null,
    pipedriveOrgId: number | null,
    leadData: {
      name?: string;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      // Address fields
      addressStreet?: string | null;
      addressCity?: string | null;
      addressState?: string | null;
      addressPostalCode?: string | null;
      addressCountry?: string | null;
      // Deal info
      dealTitle?: string | null;
      dealValue?: number | null;
      currency?: string;
      expectedCloseDate?: Date | null;
      // Labels
      labelIds?: string[];
    }
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      const result = await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            return pipedriveProvider.updateLead(connectionId, pipedriveLeadId, {
              title: leadData.dealTitle || leadData.name || undefined,
              personId: pipedrivePersonId || undefined,
              orgId: pipedriveOrgId || undefined,
              // Contact info
              personName: leadData.name || undefined,
              email: leadData.email,
              phone: leadData.phone,
              // Company
              company: leadData.company,
              // Address
              addressStreet: leadData.addressStreet,
              addressCity: leadData.addressCity,
              addressState: leadData.addressState,
              addressPostalCode: leadData.addressPostalCode,
              addressCountry: leadData.addressCountry,
              // Deal info
              value: leadData.dealValue,
              currency: leadData.currency || 'USD',
              expectedCloseDate: leadData.expectedCloseDate
                ? leadData.expectedCloseDate.toISOString().split('T')[0]
                : undefined,
              labelIds: leadData.labelIds,
            });
          },
          { shouldRetry: isRetryableError }
        )
      );

      if (result.success) {
        // Log sync
        await this.logSync('push', 'lead_update', leadId, 'success');
        return { success: true };
      } else {
        await this.logSync('push', 'lead_update', leadId, 'failed', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('[PipedrivePush] Error updating lead:', error);
      await this.logSync('push', 'lead_update', leadId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update lead in Pipedrive',
      };
    }
  }

  // ============================================
  // LEAD CONVERSION (PUSH TO PIPEDRIVE)
  // ============================================

  /**
   * Convert a lead to customer/deal in Pipedrive
   * Called when lead is converted in Gesher
   *
   * If lead has pipedriveDealId → Update deal status to 'won'
   * If lead only has pipedriveLeadId → Create deal with status 'won'
   */
  async convertLeadInPipedrive(
    leadId: string,
    leadData: {
      name: string;
      company?: string | null;
      email?: string | null;
      phone?: string | null;
      dealTitle?: string | null;
      dealValue?: number | null;
      pipedriveLeadId?: string | null;
      pipedriveDealId?: number | null;
      pipedrivePersonId?: number | null;
      pipedriveOrgId?: number | null;
    }
  ): Promise<{
    success: boolean;
    pipedriveDealId?: number;
    error?: string;
  }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      let pipedriveDealId = leadData.pipedriveDealId;

      // Case 1: Lead already has a deal in Pipedrive - just update status to won
      if (pipedriveDealId) {
        await pipedriveRateLimiter.execute(() =>
          retryWithBackoff(
            async () => {
              await pipedriveProvider.updateDeal(connectionId, pipedriveDealId!.toString(), {
                status: 'won',
              });
            },
            { shouldRetry: isRetryableError }
          )
        );

        // Add conversion note
        const conversionNote = `🎉 Lead converted to customer in Gesher\nCustomer: ${leadData.company || leadData.name}`;
        await this.pushNote(conversionNote, { dealId: pipedriveDealId });

        await this.logSync('push', 'lead_convert', pipedriveDealId, 'success', 'Deal marked as won');

        return { success: true, pipedriveDealId };
      }

      // Case 2: Lead is from Leads Inbox (no deal yet) - create a won deal and delete lead
      if (leadData.pipedriveLeadId || leadData.pipedrivePersonId) {
        const dealResult = await pipedriveRateLimiter.execute(() =>
          retryWithBackoff(
            async () => {
              return pipedriveProvider.createDeal(connectionId, {
                title: leadData.dealTitle || `Deal with ${leadData.company || leadData.name}`,
                value: leadData.dealValue || 0,
                currency: 'USD',
                status: 'won',
                contactExternalId: leadData.pipedrivePersonId?.toString(),
                organizationExternalId: leadData.pipedriveOrgId?.toString(),
              });
            },
            { shouldRetry: isRetryableError }
          )
        );

        pipedriveDealId = dealResult.externalId ? parseInt(dealResult.externalId) : undefined;

        // Delete the lead from Leads Inbox after creating the deal
        if (leadData.pipedriveLeadId) {
          try {
            await pipedriveRateLimiter.execute(() =>
              retryWithBackoff(
                async () => {
                  await pipedriveProvider.deleteLead(connectionId, leadData.pipedriveLeadId!);
                },
                { shouldRetry: isRetryableError }
              )
            );
            console.log(`[PipedrivePush] Deleted lead ${leadData.pipedriveLeadId} from Leads Inbox`);
          } catch (deleteError) {
            // Log but don't fail - deal was created successfully
            console.warn('[PipedrivePush] Could not delete lead from Inbox:', deleteError);
          }
        }

        if (pipedriveDealId) {
          // Add conversion note
          const conversionNote = `🎉 Lead converted to customer in Gesher\nCustomer: ${leadData.company || leadData.name}`;
          await this.pushNote(conversionNote, { dealId: pipedriveDealId });
        }

        await this.logSync('push', 'lead_convert', leadId, 'success', `Created won deal ${pipedriveDealId}`);

        return { success: true, pipedriveDealId };
      }

      return { success: false, error: 'Lead not linked to Pipedrive' };
    } catch (error) {
      console.error('[PipedrivePush] Error converting lead:', error);
      await this.logSync('push', 'lead_convert', leadId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert lead in Pipedrive',
      };
    }
  }

  /**
   * Convert a lead to a deal (NOT customer) in Pipedrive
   * Creates deal with status 'open' and deletes the lead from Leads Inbox
   *
   * New workflow:
   * Lead → Convert to Deal (status: open) → Mark as Won → Customer created
   */
  async convertLeadToDealInPipedrive(
    leadId: string,
    leadData: {
      name: string;
      company?: string | null;
      email?: string | null;
      phone?: string | null;
      dealTitle?: string | null;
      dealValue?: number | null;
      pipedriveLeadId?: string | null;
      pipedriveDealId?: number | null;
      pipedrivePersonId?: number | null;
      pipedriveOrgId?: number | null;
    }
  ): Promise<{
    success: boolean;
    pipedriveDealId?: number;
    error?: string;
  }> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      let pipedriveDealId = leadData.pipedriveDealId;

      // Case 1: Lead already has a deal in Pipedrive - just ensure it's open
      if (pipedriveDealId) {
        await pipedriveRateLimiter.execute(() =>
          retryWithBackoff(
            async () => {
              await pipedriveProvider.updateDeal(connectionId, pipedriveDealId!.toString(), {
                status: 'open', // Keep deal OPEN, not won
              });
            },
            { shouldRetry: isRetryableError }
          )
        );

        // Add conversion note
        const conversionNote = `📋 Lead converted to Deal in Gesher\nDeal: ${leadData.dealTitle || leadData.company || leadData.name}`;
        await this.pushNote(conversionNote, { dealId: pipedriveDealId });

        await this.logSync('push', 'lead_to_deal', pipedriveDealId, 'success', 'Deal status confirmed as open');

        return { success: true, pipedriveDealId };
      }

      // Case 2: Lead is from Leads Inbox (no deal yet) - create an OPEN deal and delete lead
      if (leadData.pipedriveLeadId || leadData.pipedrivePersonId) {
        const dealResult = await pipedriveRateLimiter.execute(() =>
          retryWithBackoff(
            async () => {
              return pipedriveProvider.createDeal(connectionId, {
                title: leadData.dealTitle || `Deal with ${leadData.company || leadData.name}`,
                value: leadData.dealValue || 0,
                currency: 'USD',
                status: 'open', // Create as OPEN, not won
                contactExternalId: leadData.pipedrivePersonId?.toString(),
                organizationExternalId: leadData.pipedriveOrgId?.toString(),
              });
            },
            { shouldRetry: isRetryableError }
          )
        );

        pipedriveDealId = dealResult.externalId ? parseInt(dealResult.externalId) : undefined;

        // Delete the lead from Leads Inbox after creating the deal
        if (leadData.pipedriveLeadId) {
          try {
            await pipedriveRateLimiter.execute(() =>
              retryWithBackoff(
                async () => {
                  await pipedriveProvider.deleteLead(connectionId, leadData.pipedriveLeadId!);
                },
                { shouldRetry: isRetryableError }
              )
            );
            console.log(`[PipedrivePush] Deleted lead ${leadData.pipedriveLeadId} from Leads Inbox`);
          } catch (deleteError) {
            // Log but don't fail - deal was created successfully
            console.warn('[PipedrivePush] Could not delete lead from Inbox:', deleteError);
          }
        }

        if (pipedriveDealId) {
          // Add conversion note
          const conversionNote = `📋 Lead converted to Deal in Gesher\nDeal: ${leadData.dealTitle || leadData.company || leadData.name}`;
          await this.pushNote(conversionNote, { dealId: pipedriveDealId });
        }

        await this.logSync('push', 'lead_to_deal', leadId, 'success', `Created open deal ${pipedriveDealId}`);

        return { success: true, pipedriveDealId };
      }

      return { success: false, error: 'Lead not linked to Pipedrive' };
    } catch (error) {
      console.error('[PipedrivePush] Error converting lead to deal:', error);
      await this.logSync('push', 'lead_to_deal', leadId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert lead to deal in Pipedrive',
      };
    }
  }

  // ============================================
  // DEAL UPDATE SYNC
  // ============================================

  /**
   * Push complete deal update to Pipedrive
   * Updates deal, person, and organization
   */
  async pushDealUpdate(dealId: string): Promise<PushDealUpdateResult> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    // Get deal with all fields
    const { data: deal } = await db
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .single();

    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    if (!deal.pipedrive_deal_id) {
      // Deal not linked to Pipedrive, skip sync
      return { success: true };
    }

    try {
      // 1. Update the deal
      await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            await pipedriveProvider.updateDeal(connectionId, deal.pipedrive_deal_id.toString(), {
              title: deal.title,
              value: deal.value || undefined,
              currency: deal.currency || 'USD',
              expectedCloseDate: deal.expected_close_date
                ? new Date(deal.expected_close_date).toISOString().split('T')[0]
                : undefined,
            });
          },
          { shouldRetry: isRetryableError }
        )
      );

      // 2. Update person if exists (contact info)
      if (deal.pipedrive_person_id && (deal.contact_name || deal.contact_email || deal.contact_phone)) {
        try {
          await pipedriveRateLimiter.execute(() =>
            retryWithBackoff(
              async () => {
                // Parse name into firstName and lastName
                const fullName = deal.contact_name || '';
                const nameParts = fullName.trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || undefined;

                await pipedriveProvider.updateContact(connectionId, deal.pipedrive_person_id.toString(), {
                  firstName,
                  lastName,
                  email: deal.contact_email || undefined,
                  phone: deal.contact_phone || undefined,
                });
              },
              { shouldRetry: isRetryableError }
            )
          );
        } catch (personError) {
          console.warn('[PipedrivePush] Failed to update person (non-blocking):', personError);
        }
      }

      // 3. Update organization if exists (company name and address)
      if (deal.pipedrive_org_id && (deal.organization_name || deal.organization_address_street)) {
        try {
          await pipedriveRateLimiter.execute(() =>
            retryWithBackoff(
              async () => {
                await pipedriveProvider.updateOrganization(connectionId, deal.pipedrive_org_id.toString(), {
                  name: deal.organization_name || undefined,
                  address: {
                    street: deal.organization_address_street || undefined,
                    city: deal.organization_address_city || undefined,
                    state: deal.organization_address_state || undefined,
                    postalCode: deal.organization_address_postal_code || undefined,
                    country: deal.organization_address_country || undefined,
                  },
                });
              },
              { shouldRetry: isRetryableError }
            )
          );
        } catch (orgError) {
          console.warn('[PipedrivePush] Failed to update organization (non-blocking):', orgError);
        }
      }

      // Log success
      await this.logSync('push', 'deal_update', deal.pipedrive_deal_id, 'success', 'Deal updated in Pipedrive');

      return { success: true };
    } catch (error) {
      console.error('[PipedrivePush] Error pushing deal update:', error);
      await this.logSync('push', 'deal_update', deal.pipedrive_deal_id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update deal in Pipedrive',
      };
    }
  }

  // ============================================
  // DEAL STATUS SYNC
  // ============================================

  /**
   * Push deal status change to Pipedrive
   * Called when deal is marked as won/lost in Gesher
   */
  async pushDealStatus(
    dealId: string,
    status: 'won' | 'lost' | 'open',
    lostReason?: string
  ): Promise<PushDealUpdateResult> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    // Get deal with Pipedrive ID
    const { data: deal } = await db
      .from('deals')
      .select('id, title, pipedrive_deal_id')
      .eq('id', dealId)
      .single();

    if (!deal) {
      return { success: false, error: 'Deal not found' };
    }

    if (!deal.pipedrive_deal_id) {
      return { success: false, error: 'Deal not linked to Pipedrive' };
    }

    try {
      await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            await pipedriveProvider.updateDeal(connectionId, deal.pipedrive_deal_id.toString(), {
              status,
            });
          },
          { shouldRetry: isRetryableError }
        )
      );

      // Add activity note about status change
      const statusEmoji = status === 'won' ? '🎉' : status === 'lost' ? '❌' : '🔄';
      const statusNote = `${statusEmoji} Deal marked as ${status.toUpperCase()} in Gesher${lostReason ? `\nReason: ${lostReason}` : ''}`;
      await this.pushNote(statusNote, { dealId: deal.pipedrive_deal_id });

      // Log sync
      await this.logSync('push', 'deal_status', deal.pipedrive_deal_id, 'success', `Status changed to ${status}`);

      return { success: true };
    } catch (error) {
      console.error('[PipedrivePush] Error pushing deal status:', error);
      await this.logSync('push', 'deal_status', deal.pipedrive_deal_id, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update deal status in Pipedrive',
      };
    }
  }

  // ============================================
  // DEAL VALUE SYNC (FROM QUOTES)
  // ============================================

  /**
   * Update Pipedrive deal value from a quote
   */
  async updateDealValueFromQuote(
    quoteId: string,
    dealId: number,
    value: number,
    currency: string = 'USD'
  ): Promise<PushDealUpdateResult> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    try {
      await pipedriveRateLimiter.execute(() =>
        retryWithBackoff(
          async () => {
            // updateDeal takes externalId as string
            await pipedriveProvider.updateDeal(connectionId, dealId.toString(), {
              value,
            });
          },
          { shouldRetry: isRetryableError }
        )
      );

      // Add activity note about the quote
      const quoteNote = `Quote #${quoteId} created with value ${currency} ${value.toLocaleString()}`;
      await this.pushNote(quoteNote, { dealId });

      // Log sync
      await this.logSync('push', 'deal', dealId, 'success', `Updated deal value to ${value}`);

      return { success: true };
    } catch (error) {
      console.error('[PipedrivePush] Error updating deal value:', error);
      await this.logSync('push', 'deal', dealId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update deal',
      };
    }
  }

  /**
   * Sync quote to Pipedrive deal
   * Updates deal value and adds activity
   */
  async syncQuoteToDeal(quoteId: string): Promise<PushDealUpdateResult> {
    // Get quote with customer info
    const { data: quote } = await db
      .from('quotes')
      .select(`
        id,
        quote_number,
        total,
        currency,
        status,
        customer_id,
        customers (
          id,
          name,
          pipedrive_deal_id
        )
      `)
      .eq('id', quoteId)
      .single();

    if (!quote) {
      return { success: false, error: 'Quote not found' };
    }

    // Handle both array and single object cases from Supabase join
    const customersData = quote.customers as { id: string; name: string; pipedrive_deal_id: number | null } | { id: string; name: string; pipedrive_deal_id: number | null }[] | null;
    const customer = Array.isArray(customersData) ? customersData[0] : customersData;

    if (!customer?.pipedrive_deal_id) {
      return { success: false, error: 'Customer not linked to Pipedrive deal' };
    }

    return this.updateDealValueFromQuote(
      quote.quote_number || quote.id,
      customer.pipedrive_deal_id,
      Number(quote.total) || 0,
      quote.currency || 'USD'
    );
  }

  // ============================================
  // ORDER HISTORY / LTV SYNC
  // ============================================

  /**
   * Calculate customer LTV from orders
   */
  async calculateCustomerLTV(customerId: string): Promise<CustomerLTV | null> {
    const { data: orders } = await db
      .from('sales_orders')
      .select('id, total, created_at')
      .eq('customer_id', customerId)
      .in('status', ['delivered', 'invoiced', 'paid'])
      .order('created_at', { ascending: false });

    if (!orders || orders.length === 0) {
      return {
        customerId,
        totalRevenue: 0,
        orderCount: 0,
        averageOrderValue: 0,
        lastOrderDate: null,
      };
    }

    const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const orderCount = orders.length;
    const averageOrderValue = totalRevenue / orderCount;
    const lastOrderDate = orders[0]?.created_at || null;

    return {
      customerId,
      totalRevenue,
      orderCount,
      averageOrderValue,
      lastOrderDate,
    };
  }

  /**
   * Push customer LTV to Pipedrive
   * Updates custom fields on the person/organization
   */
  async pushCustomerLTV(customerId: string): Promise<PushDealUpdateResult> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    // Get customer with Pipedrive IDs
    const { data: customer } = await db
      .from('customers')
      .select('id, name, pipedrive_person_id, pipedrive_org_id')
      .eq('id', customerId)
      .single();

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    if (!customer.pipedrive_person_id && !customer.pipedrive_org_id) {
      return { success: false, error: 'Customer not linked to Pipedrive' };
    }

    // Calculate LTV
    const ltv = await this.calculateCustomerLTV(customerId);
    if (!ltv) {
      return { success: false, error: 'Failed to calculate LTV' };
    }

    try {
      // Create a note with LTV info (since custom fields require field ID configuration)
      const ltvNote = `
📊 Customer LTV Update
━━━━━━━━━━━━━━━━━━━━
Total Revenue: $${ltv.totalRevenue.toLocaleString()}
Order Count: ${ltv.orderCount}
Average Order: $${ltv.averageOrderValue.toLocaleString()}
Last Order: ${ltv.lastOrderDate ? new Date(ltv.lastOrderDate).toLocaleDateString() : 'N/A'}
━━━━━━━━━━━━━━━━━━━━
Updated: ${new Date().toLocaleString()}
      `.trim();

      await this.pushNote(ltvNote, {
        personId: customer.pipedrive_person_id || undefined,
        orgId: customer.pipedrive_org_id || undefined,
      });

      // Log sync
      await this.logSync('push', 'ltv', customer.id, 'success', `LTV: ${ltv.totalRevenue}`);

      return { success: true };
    } catch (error) {
      console.error('[PipedrivePush] Error pushing LTV:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push LTV',
      };
    }
  }

  /**
   * Push order completion activity to Pipedrive
   */
  async pushOrderActivity(orderId: string): Promise<PushDealUpdateResult> {
    const connectionId = await this.getConnectionId();
    if (!connectionId) {
      return { success: false, error: 'Pipedrive not connected' };
    }

    // Get order with customer info
    const { data: order } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        total,
        status,
        customer_id,
        customers (
          id,
          name,
          pipedrive_person_id,
          pipedrive_deal_id,
          pipedrive_org_id
        )
      `)
      .eq('id', orderId)
      .single();

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    // Handle both array and single object cases from Supabase join
    type CustomerType = {
      id: string;
      name: string;
      pipedrive_person_id: number | null;
      pipedrive_deal_id: number | null;
      pipedrive_org_id: number | null;
    };
    const customersData = order.customers as CustomerType | CustomerType[] | null;
    const customer = Array.isArray(customersData) ? customersData[0] : customersData;

    if (!customer?.pipedrive_person_id && !customer?.pipedrive_deal_id) {
      return { success: false, error: 'Customer not linked to Pipedrive' };
    }

    try {
      // Create activity note
      const activityNote = `
🛒 Order Completed
━━━━━━━━━━━━━━━━━━━━
Order #: ${order.order_number || order.id}
Amount: $${Number(order.total || 0).toLocaleString()}
Status: ${order.status}
Date: ${new Date().toLocaleDateString()}
      `.trim();

      await this.pushNote(activityNote, {
        personId: customer.pipedrive_person_id || undefined,
        dealId: customer.pipedrive_deal_id || undefined,
        orgId: customer.pipedrive_org_id || undefined,
      });

      // Log sync
      await this.logSync('push', 'order', order.id, 'success');

      return { success: true };
    } catch (error) {
      console.error('[PipedrivePush] Error pushing order activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to push order activity',
      };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private async logSync(
    eventType: string,
    entityType: string,
    entityId: string | number | null,
    status: 'success' | 'failed',
    message?: string
  ): Promise<void> {
    try {
      await db.from('pipedrive_sync_log').insert({
        event_type: eventType,
        direction: 'outbound',
        entity_type: entityType,
        entity_id: entityId ? String(entityId) : null,
        pipedrive_id: typeof entityId === 'number' ? entityId : null,
        status,
        error_message: status === 'failed' ? message : null,
      });
    } catch (error) {
      console.error('[PipedrivePush] Failed to log sync:', error);
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const pipedrivePushService = new PipedrivePushService();
