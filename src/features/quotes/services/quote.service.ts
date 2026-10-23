/**
 * Quotes Service
 *
 * Business logic layer for Quotes module.
 * Handles validation, business rules, and orchestration.
 */

import { quoteRepository } from '../repositories/quote.repository';
import {
  createQuoteSchema,
  updateQuoteSchema,
  formToCreateDTO,
  type CreateQuoteInput,
  type UpdateQuoteInput,
  type QuoteFormInput,
} from '../lib/schemas';
import type {
  Quote,
  QuoteWithItems,
  QuoteListItem,
  QuoteListParams,
  QuoteStatus,
  CreateQuoteItemDTO,
} from '../types';
import { QUOTE_STATUS_TRANSITIONS as STATUS_TRANSITIONS, isQuoteEditable } from '../types';
import { auditService } from '@/shared/lib/audit';

/**
 * Update the "ERP Order Status" of the quote's Pipedrive deal, if it has one.
 * Background; never fails the status change (gdc/order-status.service).
 */
function syncPipedriveOrderStatus(quoteId: string): void {
  void import('@/features/pipedrive/gdc/order-status.service')
    .then(({ syncOrderStatusInBackground }) => syncOrderStatusInBackground({ quoteId }))
    .catch((error) => console.error('[Pipedrive] Order status sync could not start:', error));
}

/** True when products, quantities, prices, discounts or tax differ (order-sensitive) */
function quoteItemsChanged(current: QuoteWithItems['items'], next: CreateQuoteItemDTO[]): boolean {
  if (current.length !== next.length) {return true;}
  const sorted = [...current].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.some((item, index) => {
    const other = next[index];
    return !other
      || item.productId !== other.productId
      || Number(item.quantity) !== Number(other.quantity)
      || Math.round(Number(item.unitPrice)) !== Math.round(Number(other.unitPrice))
      || Number(item.discountPercent) !== Number(other.discountPercent)
      || Number(item.taxRate) !== Number(other.taxRate);
  });
}

// Helper to convert quote to audit data (exclude large/sensitive fields)
function quoteToAuditData(quote: Quote | QuoteWithItems): Record<string, unknown> {
  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    customerId: quote.customerId,
    status: quote.status,
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal,
    taxTotal: quote.taxTotal,
    grandTotal: quote.grandTotal,
    validUntil: quote.validUntil,
  };
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

/**
 * Validate status transition
 */
function isValidStatusTransition(currentStatus: QuoteStatus, newStatus: QuoteStatus): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const quoteService = {
  /**
   * Get paginated list of quotes
   */
  async list(params: QuoteListParams = {}): Promise<PaginatedServiceResult<QuoteListItem>> {
    try {
      const result = await quoteRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('QuoteService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch quotes',
      };
    }
  },

  /**
   * Get a single quote by ID
   */
  async getById(id: string): Promise<ServiceResult<QuoteWithItems>> {
    try {
      const quote = await quoteRepository.findById(id);

      if (!quote) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch quote',
      };
    }
  },

  /**
   * Get a single quote by quote number
   */
  async getByQuoteNumber(quoteNumber: string): Promise<ServiceResult<QuoteWithItems>> {
    try {
      const quote = await quoteRepository.findByQuoteNumber(quoteNumber);

      if (!quote) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.getByQuoteNumber error:', error);
      return {
        success: false,
        error: 'Failed to fetch quote',
      };
    }
  },

  /**
   * Create a new quote from form data
   */
  async createFromForm(
    input: QuoteFormInput,
    userId?: string
  ): Promise<ServiceResult<QuoteWithItems>> {
    try {
      // Convert form data to DTO
      const dto = formToCreateDTO(input);

      // Validate with schema
      const validation = createQuoteSchema.safeParse(dto);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Create quote
      const quote = await quoteRepository.create(validation.data, userId);

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.createFromForm error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create quote';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Create a new quote from DTO
   */
  async create(
    input: CreateQuoteInput,
    userId?: string
  ): Promise<ServiceResult<QuoteWithItems>> {
    try {
      // Validate input
      const validation = createQuoteSchema.safeParse(input);
      if (!validation.success) {
        console.error('QuoteService.create validation errors:', validation.error.flatten());
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Create quote
      const quote = await quoteRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'quotes',
        'Quote',
        quote.id,
        quoteToAuditData(quote),
        { userId },
        `Created quote: ${quote.quoteNumber}`
      ).catch((err) => {
        console.error('Failed to log quote create audit:', err);
      });

      // Send notification (async, non-blocking)
      this.sendQuoteCreatedNotification(quote, userId).catch((err) => {
        console.error('Failed to send quote created notification:', err);
      });

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.create error:', error);
      // Return the actual error message for debugging
      const errorMessage = error instanceof Error ? error.message : 'Failed to create quote';
      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Send notification for quote created (helper method)
   */
  async sendQuoteCreatedNotification(
    quote: QuoteWithItems,
    userId?: string
  ): Promise<void> {
    const { notificationService } = await import('@/features/notifications/services/notification.service');
    await notificationService.notifyQuoteCreated({
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerName: quote.customer?.name || 'Unknown Customer',
      totalAmount: quote.grandTotal,
      createdBy: userId,
    });
  },

  /**
   * Update an existing quote
   */
  async update(
    id: string,
    input: UpdateQuoteInput,
    userId?: string
  ): Promise<ServiceResult<Quote>> {
    try {
      // Check if quote exists
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if quote can be edited (until converted)
      if (!isQuoteEditable(existing.status)) {
        return {
          success: false,
          error: 'Cannot edit a converted quote.',
        };
      }

      // Validate input
      const validation = updateQuoteSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Capture old data for audit before update
      const oldAuditData = quoteToAuditData(existing);

      // Update quote
      const quote = await quoteRepository.update(id, validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'quotes',
        'Quote',
        quote.id,
        oldAuditData,
        quoteToAuditData(quote),
        { userId },
        `Updated quote: ${quote.quoteNumber}`
      ).catch((err) => {
        console.error('Failed to log quote update audit:', err);
      });

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.update error:', error);
      return {
        success: false,
        error: 'Failed to update quote',
      };
    }
  },

  /**
   * Update quote items
   */
  async updateItems(
    id: string,
    items: CreateQuoteItemDTO[],
    userId?: string
  ): Promise<ServiceResult<QuoteWithItems>> {
    try {
      // Check if quote exists
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if quote can be edited (until converted)
      if (!isQuoteEditable(existing.status)) {
        return {
          success: false,
          error: 'Cannot edit items for a converted quote.',
        };
      }

      // Validate items
      if (items.length === 0) {
        return {
          success: false,
          error: 'At least one item is required',
        };
      }

      // Replace items
      await quoteRepository.replaceItems(id, items, userId);

      // Approved quote with changed items/prices needs approval again
      if (existing.status === 'approved' && quoteItemsChanged(existing.items, items)) {
        await this.reopenApproval(existing, userId);
      }

      // Return updated quote
      const quote = await quoteRepository.findById(id);

      return {
        success: true,
        data: quote!,
      };
    } catch (error) {
      console.error('QuoteService.updateItems error:', error);
      return {
        success: false,
        error: 'Failed to update quote items',
      };
    }
  },

  /**
   * Soft delete a quote
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    try {
      // Check if quote exists
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Only allow deletion of draft quotes
      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft quotes can be deleted',
        };
      }

      const quote = await quoteRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'quotes',
        'Quote',
        quote.id,
        quoteToAuditData(existing),
        { userId },
        `Deleted quote: ${quote.quoteNumber}`
      ).catch((err) => {
        console.error('Failed to log quote delete audit:', err);
      });

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete quote',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Send an edited approved quote back to approval (approved -> pending_approval)
   * Creates a new 'quote_approval' event with the updated total
   */
  async reopenApproval(existing: Quote, userId?: string): Promise<void> {
    const updated = await quoteRepository.findById(existing.id);
    const { approvalEventRepository } = await import('@/features/approval-events/repositories/approval-event.repository');
    await approvalEventRepository.create({
      eventType: 'quote_approval',
      subjectType: 'quote',
      subjectId: existing.id,
      reason: `Quote ${existing.quoteNumber} edited after approval`,
      metadata: {
        quoteNumber: existing.quoteNumber,
        customerId: existing.customerId,
        grandTotal: updated?.grandTotal ?? existing.grandTotal,
      },
    }, userId);

    await quoteRepository.updateStatus(existing.id, 'pending_approval', userId);
    // Pipedrive deal: ERP Order Status (background, linked quotes only)
    syncPipedriveOrderStatus(existing.id);

    auditService.log({
      action: 'update', // status_change
      module: 'quotes',
      entityType: 'Quote',
      entityId: existing.id,
      oldData: { status: existing.status, grandTotal: existing.grandTotal },
      newData: { status: 'pending_approval', grandTotal: updated?.grandTotal },
      userId,
      description: `Quote ${existing.quoteNumber} items changed after approval; sent back for approval`,
    }).catch((err) => {
      console.error('Failed to log quote reopen audit:', err);
    });
  },

  /**
   * Submit quote for approval (draft -> pending_approval)
   * Creates an approval_event with type 'quote_approval'
   */
  async submitForApproval(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    try {
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, 'pending_approval')) {
        return {
          success: false,
          error: `Cannot submit quote in ${existing.status} status for approval. Quote must be in draft status.`,
        };
      }

      // Create approval event
      const { approvalEventRepository } = await import('@/features/approval-events/repositories/approval-event.repository');
      await approvalEventRepository.create({
        eventType: 'quote_approval',
        subjectType: 'quote',
        subjectId: id,
        reason: `Quote ${existing.quoteNumber} submitted for approval`,
        metadata: {
          quoteNumber: existing.quoteNumber,
          customerId: existing.customerId,
          grandTotal: existing.grandTotal,
        },
      }, userId);

      // Update quote status
      const quote = await quoteRepository.updateStatus(id, 'pending_approval', userId);
      // Pipedrive deal: ERP Order Status (background, linked quotes only)
      syncPipedriveOrderStatus(id);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'update', // status_change
        module: 'quotes',
        entityType: 'Quote',
        entityId: quote.id,
        oldData: { status: existing.status },
        newData: { status: 'pending_approval' },
        userId,
        description: `Quote ${quote.quoteNumber} submitted for approval`,
      }).catch((err) => {
        console.error('Failed to log quote submit audit:', err);
      });

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.submitForApproval error:', error);
      return {
        success: false,
        error: 'Failed to submit quote for approval',
      };
    }
  },

  /**
   * Approve quote (pending_approval -> approved)
   * Updates the approval_event to 'approved'
   */
  async approveQuote(
    id: string,
    approvalNote: string | null,
    userId?: string
  ): Promise<ServiceResult<Quote>> {
    try {
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, 'approved')) {
        return {
          success: false,
          error: `Cannot approve quote in ${existing.status} status. Quote must be pending approval.`,
        };
      }

      // Find and update the pending approval event
      const { approvalEventRepository } = await import('@/features/approval-events/repositories/approval-event.repository');
      const approvalEvents = await approvalEventRepository.findBySubject('quote', id);
      const pendingEvent = approvalEvents.find(e => e.status === 'pending' && e.eventType === 'quote_approval');

      if (pendingEvent) {
        await approvalEventRepository.approve(pendingEvent.id, approvalNote, userId);
      }

      // Update quote status
      const quote = await quoteRepository.updateStatus(id, 'approved', userId);
      // Pipedrive deal: ERP Order Status (background, linked quotes only)
      syncPipedriveOrderStatus(id);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'approve',
        module: 'quotes',
        entityType: 'Quote',
        entityId: quote.id,
        oldData: { status: existing.status },
        newData: { status: 'approved', approvalNote },
        userId,
        description: `Quote ${quote.quoteNumber} approved`,
      }).catch((err) => {
        console.error('Failed to log quote approve audit:', err);
      });

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.approveQuote error:', error);
      return {
        success: false,
        error: 'Failed to approve quote',
      };
    }
  },

  /**
   * Reject quote approval (pending_approval -> rejected)
   * Updates the approval_event to 'rejected'
   */
  async rejectQuoteApproval(
    id: string,
    rejectionNote: string | null,
    userId?: string
  ): Promise<ServiceResult<Quote>> {
    try {
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, 'rejected')) {
        return {
          success: false,
          error: `Cannot reject quote in ${existing.status} status. Quote must be pending approval.`,
        };
      }

      // Find and update the pending approval event
      const { approvalEventRepository } = await import('@/features/approval-events/repositories/approval-event.repository');
      const approvalEvents = await approvalEventRepository.findBySubject('quote', id);
      const pendingEvent = approvalEvents.find(e => e.status === 'pending' && e.eventType === 'quote_approval');

      if (pendingEvent) {
        await approvalEventRepository.reject(pendingEvent.id, rejectionNote, userId);
      }

      // Update quote status
      const quote = await quoteRepository.updateStatus(id, 'rejected', userId);
      // Pipedrive deal: ERP Order Status (background, linked quotes only)
      syncPipedriveOrderStatus(id);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'reject',
        module: 'quotes',
        entityType: 'Quote',
        entityId: quote.id,
        oldData: { status: existing.status },
        newData: { status: 'rejected', rejectionNote },
        userId,
        description: `Quote ${quote.quoteNumber} rejected`,
      }).catch((err) => {
        console.error('Failed to log quote reject audit:', err);
      });

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.rejectQuoteApproval error:', error);
      return {
        success: false,
        error: 'Failed to reject quote',
      };
    }
  },

  /**
   * Mark quote as expired
   */
  async expire(id: string, userId?: string): Promise<ServiceResult<Quote>> {
    return this.transitionStatus(id, 'expired', userId);
  },

  /**
   * Convert quote to sales order (accepted -> converted)
   * This also creates the sales order with credit check
   *
   * @param id - Quote ID
   * @param userId - User performing the conversion
   * @param bypassValidation - If true, allows Super Admin to convert from any status
   */
  async convertToSalesOrder(
    id: string,
    userId?: string,
    bypassValidation = false
  ): Promise<ServiceResult<{ quote: Quote; salesOrderId: string; creditStatus: 'ok' | 'hold' }>> {
    try {
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Validate required fields for conversion
      if (!existing.customerPoNumber) {
        return {
          success: false,
          error: 'Quote must have a Customer PO number before conversion to Sales Order',
        };
      }

      // Check if transition is valid (skip for Super Admin)
      if (!bypassValidation && !isValidStatusTransition(existing.status, 'converted')) {
        return {
          success: false,
          error: `Cannot convert quote in ${existing.status} status. Quote must be approved first.`,
        };
      }

      // Import services dynamically to avoid circular dependencies
      const { salesOrderService } = await import('@/features/sales-orders/services');
      const { creditCheckService } = await import('@/features/customers/services/credit-check.service');
      const { db } = await import('@/shared/lib/supabase/database');

      // Check customer credit
      const creditCheck = await creditCheckService.checkCredit(existing.customerId, existing.grandTotal);
      const creditStatus: 'ok' | 'hold' = creditCheck.passed ? 'ok' : 'hold';

      // Extract number from quote number and create matching SO number
      // QT-2600052 → C-SO-2600052
      // QT-2026-00057 → C-SO-2026-00057
      const quoteNumberPart = existing.quoteNumber.replace(/^QT-?/i, '');
      const desiredSoNumber = `C-SO-${quoteNumberPart}`;

      // Check if SO number already exists - if yes, let system auto-generate
      const { data: existingSo } = await db
        .from('sales_orders')
        .select('id')
        .eq('order_number', desiredSoNumber)
        .maybeSingle();

      // Use quote-based number if available, otherwise auto-generate
      const salesOrderNumber = existingSo ? undefined : desiredSoNumber;

      // Create sales order from quote data
      const salesOrderResult = await salesOrderService.create(
        {
          orderNumber: salesOrderNumber,
          orderDate: new Date(),
          requestedDeliveryDate: null,
          customerId: existing.customerId,
          salesRepId: existing.salesRepId,
          currencyCode: existing.currencyCode,
          status: 'draft',
          billingAddress: {
            street: existing.billingAddressStreet,
            city: existing.billingAddressCity,
            state: existing.billingAddressState,
            postalCode: existing.billingAddressPostalCode,
            country: existing.billingAddressCountry,
          },
          shippingAddress: {
            street: existing.shippingAddressStreet,
            city: existing.shippingAddressCity,
            state: existing.shippingAddressState,
            postalCode: existing.shippingAddressPostalCode,
            country: existing.shippingAddressCountry,
          },
          items: existing.items.map((item) => ({
            productId: item.productId,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            customerQty: item.quantity, // NEW: Set customer_qty for fulfillment allocations
            unitCode: item.unitCode,
            unitPrice: item.unitPrice,
            discountPercent: item.discountPercent,
            taxRate: item.taxRate,
          })),
          customerNotes: existing.customerNotes,
          internalNotes: existing.internalNotes,
          customerPoNumber: existing.customerPoNumber!,  // Copy PO number from quote (validated during quote creation)
        },
        userId
      );

      if (!salesOrderResult.success || !salesOrderResult.data) {
        return {
          success: false,
          error: salesOrderResult.error || 'Failed to create sales order',
        };
      }

      // Mark quote as converted
      const quote = await quoteRepository.markAsConverted(
        id,
        salesOrderResult.data.id,
        userId
      );

      // Update the sales order with quote reference and credit status
      await db
        .from('sales_orders')
        .update({
          quote_id: id,
          credit_status: creditStatus,
        })
        .eq('id', salesOrderResult.data.id);

      // If credit hold, log to approval_events
      if (creditStatus === 'hold') {
        const { error: approvalError } = await db.from('approval_events').insert({
          event_type: 'credit_release',
          subject_type: 'sales_order',
          subject_id: salesOrderResult.data.id,
          status: 'pending',
          requested_by: userId || null,
          reason: `Credit check failed: ${creditCheck.message || 'Awaiting finance approval'}`,
          metadata: { quoteId: id },
        });
        if (approvalError) {
          // The order is already created on hold; a missing audit row must not undo that
          console.error('Failed to log credit hold approval event:', approvalError);
        }
      }

      // If the quote came from a won Pipedrive deal, write the SO number back (never throws)
      const { writeBackSalesOrderNumber } = await import('@/features/pipedrive/gdc/deal-erp.service');
      await writeBackSalesOrderNumber(id, salesOrderResult.data.id);

      return {
        success: true,
        data: {
          quote,
          salesOrderId: salesOrderResult.data.id,
          creditStatus,
        },
      };
    } catch (error) {
      console.error('QuoteService.convertToSalesOrder error:', error);
      return {
        success: false,
        error: 'Failed to convert quote to sales order',
      };
    }
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: QuoteStatus,
    userId?: string
  ): Promise<ServiceResult<Quote>> {
    try {
      const existing = await quoteRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Quote not found',
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const quote = await quoteRepository.updateStatus(id, newStatus, userId);
      // Pipedrive deal: ERP Order Status (background, linked quotes only)
      syncPipedriveOrderStatus(id);

      return {
        success: true,
        data: quote,
      };
    } catch (error) {
      console.error('QuoteService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update quote status',
      };
    }
  },

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get quote counts by status
   */
  async getStatusCounts(): Promise<ServiceResult<Record<QuoteStatus, number>>> {
    try {
      const counts = await quoteRepository.getCountsByStatus();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('QuoteService.getStatusCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
      };
    }
  },

  /**
   * Get next quote number
   */
  async getNextQuoteNumber(): Promise<ServiceResult<string>> {
    try {
      const quoteNumber = await quoteRepository.getNextQuoteNumber();
      return {
        success: true,
        data: quoteNumber,
      };
    } catch (error) {
      console.error('QuoteService.getNextQuoteNumber error:', error);
      return {
        success: false,
        error: 'Failed to generate quote number',
      };
    }
  },
};

export type QuoteService = typeof quoteService;
