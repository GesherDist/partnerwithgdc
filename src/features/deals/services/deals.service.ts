/**
 * Deals Service
 *
 * Business logic for the Deals module.
 */

import { dealsRepository } from '../repositories/deals.repository';
import { pipedrivePushService } from '@/features/pipedrive/services/pipedrive-push.service';
import { customerRepository } from '@/features/customers/repositories/customer.repository';
import { leadsRepository } from '@/features/leads/repositories/leads.repository';
import type {
  Deal,
  DealNote,
  DealListParams,
  PaginatedDealResult,
  CreateDealDTO,
  UpdateDealDTO,
  CreateDealNoteDTO,
  DealSyncResult,
} from '../types';

class DealsService {
  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Get a deal by ID
   */
  async getDeal(id: string): Promise<Deal | null> {
    return dealsRepository.getById(id);
  }

  /**
   * Get a deal by Pipedrive Deal ID
   */
  async getDealByPipedriveDealId(pipedriveDealId: number): Promise<Deal | null> {
    return dealsRepository.getByPipedriveDealId(pipedriveDealId);
  }

  /**
   * Get paginated list of deals
   */
  async getDeals(params: DealListParams = {}): Promise<PaginatedDealResult> {
    return dealsRepository.list(params);
  }

  /**
   * Get deal statistics
   */
  async getDealStats(): Promise<{
    countByStatus: Record<string, number>;
    valueByStatus: Array<{ status: string; totalValue: number; count: number }>;
    valueByPipeline: Array<{ pipeline: string; totalValue: number; count: number }>;
  }> {
    const [countByStatus, valueByStatus, valueByPipeline] = await Promise.all([
      dealsRepository.getCountByStatus(),
      dealsRepository.getTotalValueByStatus(),
      dealsRepository.getTotalValueByPipeline(),
    ]);

    return {
      countByStatus,
      valueByStatus,
      valueByPipeline,
    };
  }

  // ============================================
  // WRITE OPERATIONS
  // ============================================

  /**
   * Create a new deal
   */
  async createDeal(dto: CreateDealDTO, userId?: string): Promise<Deal> {
    return dealsRepository.create(dto, userId);
  }

  /**
   * Update a deal
   */
  async updateDeal(id: string, dto: UpdateDealDTO, userId?: string): Promise<Deal> {
    return dealsRepository.update(id, dto, userId);
  }

  /**
   * Delete a deal
   */
  async deleteDeal(id: string, userId?: string): Promise<void> {
    return dealsRepository.delete(id, userId);
  }

  /**
   * Mark deal as won
   * Updates local DB, creates customer from lead (if exists), and syncs to Pipedrive
   *
   * Workflow:
   * 1. Mark deal as won
   * 2. If deal has a linked lead, create customer from lead info
   * 3. Link deal to customer
   * 4. Mark lead as fully converted (to customer)
   * 5. Sync to Pipedrive
   */
  async markAsWon(id: string, userId?: string): Promise<Deal> {
    // Get the deal first to check if it has a lead
    const existingDeal = await dealsRepository.getById(id);
    if (!existingDeal) {
      throw new Error('Deal not found');
    }

    // Update deal status to won
    let deal = await dealsRepository.update(
      id,
      {
        status: 'won',
        wonTime: new Date(),
        closeTime: new Date(),
      },
      userId
    );

    // If deal has a linked lead and no customer yet, create customer from lead
    if (existingDeal.leadId && !existingDeal.customerId) {
      try {
        const lead = await leadsRepository.getById(existingDeal.leadId);
        if (lead) {
          // Generate customer code
          const customerCode = await customerRepository.getNextCustomerCode();

          // Create customer from lead info
          const customer = await customerRepository.create(
            {
              customerCode,
              name: lead.company || lead.name,
              email: lead.email || undefined,
              phone: lead.phone || undefined,
              channel: 'oem', // Default channel - can be customized
              address1: lead.addressStreet || undefined,
              city: lead.addressCity || undefined,
              state: lead.addressState || undefined,
              zip: lead.addressPostalCode || undefined,
              country: lead.addressCountry || 'US',
              status: 'active',
            },
            userId
          );

          console.log(`[DealsService] Created customer ${customer.id} from lead ${lead.id}`);

          // Link deal to customer
          deal = await dealsRepository.update(
            id,
            { customerId: customer.id },
            userId
          );

          // Mark lead as fully converted (to customer)
          await leadsRepository.markAsConverted(lead.id, customer.id, userId);
          console.log(`[DealsService] Lead ${lead.id} marked as converted to customer ${customer.id}`);

          // Sync customer creation to Pipedrive (async, non-blocking)
          pipedrivePushService.convertLeadInPipedrive(lead.id, {
            name: lead.name,
            company: lead.company,
            email: lead.email,
            phone: lead.phone,
            dealTitle: lead.dealTitle,
            dealValue: lead.dealValue,
            pipedriveLeadId: lead.pipedriveLeadId,
            pipedriveDealId: lead.pipedriveDealId || deal.pipedriveDealId,
            pipedrivePersonId: lead.pipedrivePersonId,
            pipedriveOrgId: lead.pipedriveOrgId,
          }).catch((error) => {
            console.error('[DealsService] Failed to sync lead conversion to Pipedrive:', error);
          });
        }
      } catch (customerError) {
        // Log but don't fail the deal won - customer creation is secondary
        console.error('[DealsService] Failed to create customer from lead:', customerError);
      }
    }

    // Push status change to Pipedrive (async, don't block)
    pipedrivePushService.pushDealStatus(id, 'won').catch((error) => {
      console.error('[DealsService] Failed to push deal won status to Pipedrive:', error);
    });

    return deal;
  }

  /**
   * Mark deal as lost
   * Updates local DB and syncs to Pipedrive
   */
  async markAsLost(id: string, lostReason?: string, userId?: string): Promise<Deal> {
    const deal = await dealsRepository.update(
      id,
      {
        status: 'lost',
        lostTime: new Date(),
        closeTime: new Date(),
        lostReason: lostReason || null,
      },
      userId
    );

    // Push status change to Pipedrive (async, don't block)
    pipedrivePushService.pushDealStatus(id, 'lost', lostReason).catch((error) => {
      console.error('[DealsService] Failed to push deal lost status to Pipedrive:', error);
    });

    return deal;
  }

  /**
   * Reopen a deal
   * Updates local DB and syncs to Pipedrive
   */
  async reopenDeal(id: string, userId?: string): Promise<Deal> {
    const deal = await dealsRepository.update(
      id,
      {
        status: 'open',
        wonTime: null,
        lostTime: null,
        closeTime: null,
        lostReason: null,
      },
      userId
    );

    // Push status change to Pipedrive (async, don't block)
    pipedrivePushService.pushDealStatus(id, 'open').catch((error) => {
      console.error('[DealsService] Failed to push deal reopen status to Pipedrive:', error);
    });

    return deal;
  }

  /**
   * Link deal to customer
   */
  async linkToCustomer(dealId: string, customerId: string, userId?: string): Promise<Deal> {
    return dealsRepository.update(dealId, { customerId }, userId);
  }

  /**
   * Link deal to lead
   */
  async linkToLead(dealId: string, leadId: string, userId?: string): Promise<Deal> {
    return dealsRepository.update(dealId, { leadId }, userId);
  }

  // ============================================
  // NOTES OPERATIONS
  // ============================================

  /**
   * Get notes for a deal
   */
  async getNotes(dealId: string): Promise<DealNote[]> {
    return dealsRepository.getNotes(dealId);
  }

  /**
   * Add a note to a deal
   */
  async addNote(dto: CreateDealNoteDTO, userId?: string): Promise<DealNote> {
    return dealsRepository.createNote(dto, userId);
  }

  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<void> {
    return dealsRepository.deleteNote(noteId);
  }

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Upsert deal from Pipedrive
   */
  async upsertFromPipedrive(dto: CreateDealDTO, userId?: string): Promise<{ deal: Deal; isNew: boolean }> {
    return dealsRepository.upsertFromPipedrive(dto, userId);
  }

  /**
   * Sync deals from Pipedrive
   * This is called by the pipedrive-sync service
   */
  async syncFromPipedrive(
    deals: CreateDealDTO[],
    userId?: string
  ): Promise<DealSyncResult> {
    const result: DealSyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [],
    };

    // Get existing Pipedrive deal IDs
    const existingDealIds = await dealsRepository.getAllPipedriveDealIds();
    const incomingDealIds = deals
      .map((d) => d.pipedriveDealId)
      .filter((id): id is number => id !== null);

    // Process each deal
    for (const dealDto of deals) {
      try {
        if (!dealDto.pipedriveDealId) {
          result.skipped++;
          continue;
        }

        const { isNew } = await dealsRepository.upsertFromPipedrive(dealDto, userId);

        if (isNew) {
          result.created++;
        } else {
          result.updated++;
        }
      } catch (error) {
        result.errors.push({
          pipedriveDealId: dealDto.pipedriveDealId || 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Soft delete deals that are no longer in Pipedrive
    const deletedDealIds = existingDealIds.filter((id) => !incomingDealIds.includes(id));
    if (deletedDealIds.length > 0) {
      result.deleted = await dealsRepository.softDeleteByPipedriveDealIds(deletedDealIds, userId);
    }

    return result;
  }
}

// Export singleton instance
export const dealsService = new DealsService();
