/**
 * Credit Notes Service
 *
 * Business logic layer for Credit Notes module.
 */

import { creditNoteRepository } from '../repositories/credit-note.repository';
import type {
  CreditNote,
  CreditNoteWithItems,
  CreditNoteListItem,
  CreditNoteListParams,
  CreateCreditNoteDTO,
  UpdateCreditNoteDTO,
  CreditNoteStatus,
} from '../types';
import { CREDIT_NOTE_STATUS_TRANSITIONS } from '../types';
import { auditService } from '@/shared/lib/audit';

// ============================================
// AUDIT TRAIL
// ============================================

/**
 * Credit notes are financial documents (Build Brief 5.3: short or damaged
 * goods are settled with one), so every create, edit, delete and status
 * change leaves an audit row.
 *
 * Fire-and-forget on purpose: an audit failure must never fail or undo a
 * credit note that was already written.
 */
function creditNoteAuditData(cn: CreditNote | CreditNoteWithItems): Record<string, unknown> {
  return {
    id: cn.id,
    creditNoteNumber: cn.creditNoteNumber,
    customerId: cn.customerId,
    invoiceId: cn.invoiceId,
    salesOrderId: cn.salesOrderId,
    reason: cn.reason,
    reasonDescription: cn.reasonDescription,
    status: cn.status,
    subtotal: cn.subtotal,
    taxTotal: cn.taxTotal,
    grandTotal: cn.grandTotal,
    customerNotes: cn.customerNotes,
    internalNotes: cn.internalNotes,
  };
}

function logCreditNoteAudit(entry: Parameters<typeof auditService.log>[0]): void {
  auditService.log(entry).catch((error) => {
    console.error('Failed to write credit note audit log:', error);
  });
}

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
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
// UTILITY FUNCTIONS
// ============================================

function isValidStatusTransition(currentStatus: CreditNoteStatus, newStatus: CreditNoteStatus): boolean {
  const allowedTransitions = CREDIT_NOTE_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const creditNoteService = {
  /**
   * Get paginated list of credit notes
   */
  async list(params: CreditNoteListParams = {}): Promise<PaginatedServiceResult<CreditNoteListItem>> {
    try {
      const result = await creditNoteRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('CreditNoteService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch credit notes',
      };
    }
  },

  /**
   * Get a single credit note by ID
   */
  async getById(id: string): Promise<ServiceResult<CreditNoteWithItems>> {
    try {
      const cn = await creditNoteRepository.findById(id);

      if (!cn) {
        return {
          success: false,
          error: 'Credit note not found',
        };
      }

      return {
        success: true,
        data: cn,
      };
    } catch (error) {
      console.error('CreditNoteService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch credit note',
      };
    }
  },

  /**
   * Create a new credit note
   */
  async create(
    data: CreateCreditNoteDTO,
    userId?: string
  ): Promise<ServiceResult<CreditNoteWithItems>> {
    try {
      // Validate items
      if (!data.items || data.items.length === 0) {
        return {
          success: false,
          error: 'Credit note must have at least one item',
        };
      }

      const cn = await creditNoteRepository.create(data, userId);

      logCreditNoteAudit({
        action: 'create',
        module: 'credit_notes',
        entityType: 'CreditNote',
        entityId: cn.id,
        newData: creditNoteAuditData(cn),
        userId,
        description: `Created credit note ${cn.creditNoteNumber}`,
      });

      return {
        success: true,
        data: cn,
      };
    } catch (error) {
      console.error('CreditNoteService.create error:', error);
      return {
        success: false,
        error: 'Failed to create credit note',
      };
    }
  },

  /**
   * Update an existing credit note
   */
  async update(
    id: string,
    data: UpdateCreditNoteDTO,
    userId?: string
  ): Promise<ServiceResult<CreditNote>> {
    try {
      const existing = await creditNoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Credit note not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: `Cannot edit credit note in ${existing.status} status`,
        };
      }

      const cn = await creditNoteRepository.update(id, data, userId);

      logCreditNoteAudit({
        action: 'update',
        module: 'credit_notes',
        entityType: 'CreditNote',
        entityId: cn.id,
        oldData: creditNoteAuditData(existing),
        newData: creditNoteAuditData(cn),
        userId,
        description: `Updated credit note ${cn.creditNoteNumber}`,
      });

      return {
        success: true,
        data: cn,
      };
    } catch (error) {
      console.error('CreditNoteService.update error:', error);
      return {
        success: false,
        error: 'Failed to update credit note',
      };
    }
  },

  /**
   * Soft delete a credit note
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<CreditNote>> {
    try {
      const existing = await creditNoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Credit note not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft credit notes can be deleted',
        };
      }

      const cn = await creditNoteRepository.softDelete(id, userId);

      logCreditNoteAudit({
        action: 'delete',
        module: 'credit_notes',
        entityType: 'CreditNote',
        entityId: cn.id,
        oldData: creditNoteAuditData(existing),
        userId,
        description: `Deleted credit note ${cn.creditNoteNumber}`,
      });

      return {
        success: true,
        data: cn,
      };
    } catch (error) {
      console.error('CreditNoteService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete credit note',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Issue credit note (draft -> issued)
   */
  async issue(id: string, userId?: string): Promise<ServiceResult<CreditNote>> {
    return this.transitionStatus(id, 'issued', userId);
  },

  /**
   * Apply credit note (issued -> applied)
   */
  async apply(id: string, userId?: string): Promise<ServiceResult<CreditNote>> {
    return this.transitionStatus(id, 'applied', userId);
  },

  /**
   * Cancel credit note
   */
  async cancel(id: string, userId?: string): Promise<ServiceResult<CreditNote>> {
    return this.transitionStatus(id, 'cancelled', userId);
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: CreditNoteStatus,
    userId?: string
  ): Promise<ServiceResult<CreditNote>> {
    try {
      const existing = await creditNoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Credit note not found',
        };
      }

      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const cn = await creditNoteRepository.updateStatus(id, newStatus, userId);

      logCreditNoteAudit({
        action: 'update', // status_change
        module: 'credit_notes',
        entityType: 'CreditNote',
        entityId: cn.id,
        oldData: { status: existing.status },
        newData: { status: newStatus },
        userId,
        description: `Credit note ${cn.creditNoteNumber} status changed: ${existing.status} → ${newStatus}`,
      });

      return {
        success: true,
        data: cn,
      };
    } catch (error) {
      console.error('CreditNoteService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update credit note status',
      };
    }
  },
};

export type CreditNoteService = typeof creditNoteService;
