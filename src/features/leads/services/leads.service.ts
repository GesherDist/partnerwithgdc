/**
 * Leads Service
 *
 * Business logic layer for leads management.
 */

import { leadsRepository } from '../repositories/leads.repository';
import type {
  Lead,
  LeadListItem,
  LeadListParams,
  LeadListResult,
  CreateLeadDTO,
  UpdateLeadDTO,
  LeadStatus,
  LeadSource,
} from '../types';

// ============================================
// SERVICE CLASS
// ============================================

class LeadsService {
  /**
   * Get paginated list of leads
   */
  async list(params: LeadListParams = {}): Promise<LeadListResult> {
    return leadsRepository.list(params);
  }

  /**
   * Get a single lead by ID
   */
  async getById(id: string): Promise<Lead | null> {
    return leadsRepository.getById(id);
  }

  /**
   * Get lead by Pipedrive person ID
   */
  async getByPipedriveId(pipedrivePersonId: number): Promise<Lead | null> {
    return leadsRepository.getByPipedrivePersonId(pipedrivePersonId);
  }

  /**
   * Create a new lead
   */
  async create(data: CreateLeadDTO, userId: string): Promise<Lead> {
    return leadsRepository.create(data, userId);
  }

  /**
   * Update an existing lead
   */
  async update(id: string, data: UpdateLeadDTO, userId: string): Promise<Lead> {
    return leadsRepository.update(id, data, userId);
  }

  /**
   * Update lead status
   */
  async updateStatus(
    id: string,
    status: LeadStatus,
    userId: string
  ): Promise<Lead> {
    return leadsRepository.update(id, { status }, userId);
  }

  /**
   * Delete a lead
   */
  async delete(id: string): Promise<void> {
    return leadsRepository.delete(id);
  }

  /**
   * Mark lead as converted
   */
  async markAsConverted(
    id: string,
    customerId: string,
    userId: string
  ): Promise<Lead> {
    return leadsRepository.markAsConverted(id, customerId, userId);
  }

  /**
   * Get leads by status
   */
  async getByStatus(status: LeadStatus): Promise<LeadListItem[]> {
    const result = await leadsRepository.list({
      status,
      limit: 1000,
    });
    return result.data;
  }

  /**
   * Get leads by source
   */
  async getBySource(source: LeadSource): Promise<LeadListItem[]> {
    const result = await leadsRepository.list({
      source,
      limit: 1000,
    });
    return result.data;
  }

  /**
   * Search leads
   */
  async search(query: string): Promise<LeadListItem[]> {
    const result = await leadsRepository.list({
      search: query,
      limit: 50,
    });
    return result.data;
  }

  /**
   * Get qualified leads (ready for conversion)
   */
  async getQualifiedLeads(): Promise<LeadListItem[]> {
    const result = await leadsRepository.list({
      status: 'qualified',
      limit: 1000,
    });
    return result.data;
  }

  /**
   * Get leads with upcoming expected close dates
   */
  async getUpcomingDeals(daysAhead: number = 30): Promise<LeadListItem[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    const result = await leadsRepository.list({
      limit: 1000,
    });

    return result.data.filter((lead) => {
      if (!lead.expectedCloseDate) return false;
      const closeDate = new Date(lead.expectedCloseDate);
      return closeDate >= now && closeDate <= futureDate;
    });
  }

  /**
   * Calculate lead statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<LeadStatus, number>;
    totalDealValue: number;
    averageDealValue: number;
    conversionRate: number;
  }> {
    const result = await leadsRepository.list({ limit: 10000 });
    const leads = result.data;

    const byStatus: Record<LeadStatus, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal: 0,
      negotiation: 0,
      deal: 0,
      converted: 0,
      lost: 0,
    };

    let totalDealValue = 0;
    let dealsWithValue = 0;

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      if (lead.dealValue) {
        totalDealValue += lead.dealValue;
        dealsWithValue++;
      }
    }

    const totalClosed = byStatus.converted + byStatus.lost;
    const conversionRate = totalClosed > 0
      ? (byStatus.converted / totalClosed) * 100
      : 0;

    return {
      total: leads.length,
      byStatus,
      totalDealValue,
      averageDealValue: dealsWithValue > 0 ? totalDealValue / dealsWithValue : 0,
      conversionRate,
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const leadsService = new LeadsService();
