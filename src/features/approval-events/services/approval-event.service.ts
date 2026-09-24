/**
 * Approval Events Service
 *
 * Business logic layer for Approval Events module.
 */

import { approvalEventRepository } from '../repositories/approval-event.repository';
import type {
  ApprovalEvent,
  ApprovalEventWithDetails,
  ApprovalEventListItem,
  ApprovalEventListParams,
  CreateApprovalEventDTO,
  DecideApprovalEventDTO,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface PaginatedServiceResult<T> {
  success: boolean;
  data?: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
  error?: string;
}

// ============================================
// SERVICE
// ============================================

export const approvalEventService = {
  /**
   * Get paginated list of approval events
   */
  async list(params: ApprovalEventListParams = {}): Promise<PaginatedServiceResult<ApprovalEventListItem>> {
    try {
      const result = await approvalEventRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('ApprovalEventService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch approval events',
      };
    }
  },

  /**
   * Get pending approval events
   */
  async getPending(): Promise<ServiceResult<ApprovalEventListItem[]>> {
    try {
      const events = await approvalEventRepository.findPending();

      return {
        success: true,
        data: events,
      };
    } catch (error) {
      console.error('ApprovalEventService.getPending error:', error);
      return {
        success: false,
        error: 'Failed to fetch pending approvals',
      };
    }
  },

  /**
   * Get a single approval event by ID
   */
  async getById(id: string): Promise<ServiceResult<ApprovalEventWithDetails>> {
    try {
      const event = await approvalEventRepository.findById(id);

      if (!event) {
        return {
          success: false,
          error: 'Approval event not found',
        };
      }

      return {
        success: true,
        data: event,
      };
    } catch (error) {
      console.error('ApprovalEventService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch approval event',
      };
    }
  },

  /**
   * Get approval events for a specific subject
   */
  async getBySubject(
    subjectType: string,
    subjectId: string
  ): Promise<ServiceResult<ApprovalEvent[]>> {
    try {
      const events = await approvalEventRepository.findBySubject(subjectType, subjectId);

      return {
        success: true,
        data: events,
      };
    } catch (error) {
      console.error('ApprovalEventService.getBySubject error:', error);
      return {
        success: false,
        error: 'Failed to fetch approval events',
      };
    }
  },

  /**
   * Create a new approval event (request approval)
   */
  async requestApproval(
    data: CreateApprovalEventDTO,
    requestedBy?: string
  ): Promise<ServiceResult<ApprovalEvent>> {
    try {
      const event = await approvalEventRepository.create(data, requestedBy);

      return {
        success: true,
        data: event,
      };
    } catch (error) {
      console.error('ApprovalEventService.requestApproval error:', error);
      return {
        success: false,
        error: 'Failed to create approval request',
      };
    }
  },

  /**
   * Decide on an approval event (approve or reject)
   */
  async decide(
    id: string,
    decision: DecideApprovalEventDTO,
    decidedBy?: string
  ): Promise<ServiceResult<ApprovalEvent>> {
    try {
      const existing = await approvalEventRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Approval event not found',
        };
      }

      if (existing.status !== 'pending') {
        return {
          success: false,
          error: `Cannot decide on event that is already ${existing.status}`,
        };
      }

      let event: ApprovalEvent;
      if (decision.status === 'approved') {
        event = await approvalEventRepository.approve(id, decision.decisionNote || null, decidedBy);
      } else {
        event = await approvalEventRepository.reject(id, decision.decisionNote || null, decidedBy);
      }

      return {
        success: true,
        data: event,
      };
    } catch (error) {
      console.error('ApprovalEventService.decide error:', error);
      return {
        success: false,
        error: 'Failed to process decision',
      };
    }
  },

  /**
   * Approve an approval event
   */
  async approve(
    id: string,
    decisionNote?: string | null,
    decidedBy?: string
  ): Promise<ServiceResult<ApprovalEvent>> {
    return this.decide(id, { status: 'approved', decisionNote }, decidedBy);
  },

  /**
   * Reject an approval event
   */
  async reject(
    id: string,
    decisionNote?: string | null,
    decidedBy?: string
  ): Promise<ServiceResult<ApprovalEvent>> {
    return this.decide(id, { status: 'rejected', decisionNote }, decidedBy);
  },
};

export type ApprovalEventService = typeof approvalEventService;
