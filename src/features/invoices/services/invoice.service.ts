/**
 * Invoices Service
 *
 * Business logic layer for Invoices module.
 */

import { invoiceRepository } from '../repositories/invoice.repository';
import { auditService } from '@/shared/lib/audit';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
  type RecordPaymentInput,
} from '../lib/schemas';
import type {
  Invoice,
  InvoiceWithItems,
  InvoiceListItem,
  InvoiceListParams,
  InvoiceStatus,
  InvoicePayment,
  CreateInvoiceDTO,
  CreateInvoiceItemDTO,
} from '../types';
import { INVOICE_STATUS_TRANSITIONS } from '../types';
import { creditCheckService } from '@/features/customers/services/credit-check.service';
import { salesOrderService } from '@/features/sales-orders/services/sales-order.service';

// Helper to convert invoice to audit data (exclude large/sensitive fields)
function invoiceToAuditData(invoice: Invoice | InvoiceWithItems): Record<string, unknown> {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    salesOrderId: invoice.salesOrderId,
    status: invoice.status,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    subtotal: invoice.subtotal,
    discountTotal: invoice.discountTotal,
    taxTotal: invoice.taxTotal,
    grandTotal: invoice.grandTotal,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
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

function isValidStatusTransition(currentStatus: InvoiceStatus, newStatus: InvoiceStatus): boolean {
  const allowedTransitions = INVOICE_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const invoiceService = {
  /**
   * Create invoice from a Sales Order
   * Maps all SO data to invoice format
   */
  async createFromSalesOrder(
    salesOrderId: string,
    options: {
      dueDate?: Date;
      paymentTerms?: string;
    } = {},
    userId?: string
  ): Promise<ServiceResult<InvoiceWithItems>> {
    try {
      // Fetch the sales order with items
      const soResult = await salesOrderService.getById(salesOrderId);

      if (!soResult.success || !soResult.data) {
        return {
          success: false,
          error: soResult.error || 'Sales order not found',
        };
      }

      const salesOrder = soResult.data;

      // Check if invoice already exists for this SO
      const existingResult = await invoiceRepository.findMany({
        salesOrderId: salesOrderId,
        limit: 1,
      });

      if (existingResult.data.length > 0) {
        return {
          success: false,
          error: 'An invoice already exists for this sales order',
        };
      }

      // Validate SO status - only allow invoicing for shipped or delivered orders
      const allowedStatuses = ['shipped', 'delivered', 'confirmed', 'processing'];
      if (!allowedStatuses.includes(salesOrder.status)) {
        return {
          success: false,
          error: `Cannot create invoice for order in '${salesOrder.status}' status. Order must be confirmed, processing, shipped, or delivered.`,
        };
      }

      // Map SO items to invoice items
      const invoiceItems: CreateInvoiceItemDTO[] = salesOrder.items.map((item) => ({
        productId: item.productId,
        salesOrderItemId: item.id,
        shipmentItemId: null,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unitCode: item.unitCode,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        taxRate: item.taxRate,
      }));

      // Create invoice DTO
      const invoiceDTO: CreateInvoiceDTO = {
        invoiceDate: new Date(),
        dueDate: options.dueDate || null,
        customerId: salesOrder.customerId,
        salesOrderId: salesOrder.id,
        shipmentId: null,
        currencyCode: salesOrder.currencyCode,
        status: 'draft',
        paymentTerms: options.paymentTerms || null,
        billingAddress: {
          street: salesOrder.billingAddressStreet,
          city: salesOrder.billingAddressCity,
          state: salesOrder.billingAddressState,
          postalCode: salesOrder.billingAddressPostalCode,
          country: salesOrder.billingAddressCountry,
        },
        items: invoiceItems,
        customerNotes: salesOrder.customerNotes,
        internalNotes: `Created from Sales Order ${salesOrder.orderNumber}`,
      };

      // Create the invoice
      const invoice = await invoiceRepository.create(invoiceDTO, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'invoices',
        'Invoice',
        invoice.id,
        invoiceToAuditData(invoice),
        { userId },
        `Created invoice: ${invoice.invoiceNumber} from SO: ${salesOrder.orderNumber}`
      ).catch((err) => {
        console.error('Failed to log invoice create audit:', err);
      });

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.createFromSalesOrder error:', error);
      return {
        success: false,
        error: 'Failed to create invoice from sales order',
      };
    }
  },

  /**
   * Get paginated list of invoices
   */
  async list(params: InvoiceListParams = {}): Promise<PaginatedServiceResult<InvoiceListItem>> {
    try {
      const result = await invoiceRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('InvoiceService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch invoices',
      };
    }
  },

  /**
   * Get a single invoice by ID
   */
  async getById(id: string): Promise<ServiceResult<InvoiceWithItems>> {
    try {
      const invoice = await invoiceRepository.findById(id);

      if (!invoice) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch invoice',
      };
    }
  },

  /**
   * Create a new invoice
   */
  async create(
    input: CreateInvoiceInput,
    userId?: string
  ): Promise<ServiceResult<InvoiceWithItems>> {
    try {
      const validation = createInvoiceSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const invoice = await invoiceRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'invoices',
        'Invoice',
        invoice.id,
        invoiceToAuditData(invoice),
        { userId },
        `Created invoice: ${invoice.invoiceNumber}`
      ).catch((err) => {
        console.error('Failed to log invoice create audit:', err);
      });

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.create error:', error);
      return {
        success: false,
        error: 'Failed to create invoice',
      };
    }
  },

  /**
   * Update an existing invoice
   */
  async update(
    id: string,
    input: UpdateInvoiceInput,
    userId?: string
  ): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit invoice in ${existing.status} status`,
        };
      }

      const validation = updateInvoiceSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Capture old data for audit before update
      const oldAuditData = invoiceToAuditData(existing);

      const invoice = await invoiceRepository.update(id, validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'invoices',
        'Invoice',
        invoice.id,
        oldAuditData,
        invoiceToAuditData(invoice),
        { userId },
        `Updated invoice: ${invoice.invoiceNumber}`
      ).catch((err) => {
        console.error('Failed to log invoice update audit:', err);
      });

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.update error:', error);
      return {
        success: false,
        error: 'Failed to update invoice',
      };
    }
  },

  /**
   * Soft delete an invoice
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft invoices can be deleted',
        };
      }

      const invoice = await invoiceRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'invoices',
        'Invoice',
        invoice.id,
        invoiceToAuditData(existing),
        { userId },
        `Deleted invoice: ${invoice.invoiceNumber}`
      ).catch((err) => {
        console.error('Failed to log invoice delete audit:', err);
      });

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete invoice',
      };
    }
  },

  /**
   * Record a payment
   * Also updates the customer's open balance
   */
  async recordPayment(
    id: string,
    input: RecordPaymentInput,
    userId?: string
  ): Promise<ServiceResult<InvoicePayment>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (['draft', 'cancelled', 'paid'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot record payment for invoice in ${existing.status} status`,
        };
      }

      const validation = recordPaymentSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check if payment amount is valid
      if (validation.data.amount > existing.balanceDue) {
        return {
          success: false,
          error: `Payment amount exceeds balance due (${existing.balanceDue / 100})`,
        };
      }

      const payment = await invoiceRepository.recordPayment(id, validation.data, userId);

      // Subtract payment amount from customer's open balance
      await creditCheckService.subtractFromBalance(
        existing.customerId,
        validation.data.amount,
        userId
      );

      // Log audit event for payment (fire and forget)
      auditService.log({
        action: 'update', // payment_recorded
        module: 'invoices',
        entityType: 'Invoice',
        entityId: id,
        oldData: { amountPaid: existing.amountPaid, balanceDue: existing.balanceDue },
        newData: { paymentAmount: validation.data.amount, paymentMethod: validation.data.paymentMethod },
        userId,
        description: `Payment of ${validation.data.amount / 100} recorded for invoice ${existing.invoiceNumber}`,
      }).catch((err) => {
        console.error('Failed to log invoice payment audit:', err);
      });

      return {
        success: true,
        data: payment,
      };
    } catch (error) {
      console.error('InvoiceService.recordPayment error:', error);
      return {
        success: false,
        error: 'Failed to record payment',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Send invoice (draft -> sent)
   * Also updates the customer's open balance
   */
  async send(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    try {
      // Get the invoice first to update customer balance
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: `Cannot send invoice in ${existing.status} status`,
        };
      }

      // Transition the status
      const result = await this.transitionStatus(id, 'sent', userId);

      if (result.success && result.data) {
        // Add invoice amount to customer's open balance
        await creditCheckService.addToBalance(
          existing.customerId,
          existing.grandTotal,
          userId
        );
      }

      return result;
    } catch (error) {
      console.error('InvoiceService.send error:', error);
      return {
        success: false,
        error: 'Failed to send invoice',
      };
    }
  },

  /**
   * Mark as overdue (sent/partial -> overdue)
   */
  async markOverdue(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    return this.transitionStatus(id, 'overdue', userId);
  },

  /**
   * Cancel invoice
   * Reverses the customer's open balance if invoice was sent
   */
  async cancel(id: string, userId?: string): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      // If invoice was sent (not draft), we need to reverse the balance addition
      const wasAddedToBalance = existing.status !== 'draft';

      const result = await this.transitionStatus(id, 'cancelled', userId);

      if (result.success && result.data && wasAddedToBalance) {
        // Subtract the remaining balance from customer's open balance
        // (grandTotal - amountPaid = what was never paid and should be removed)
        const amountToReverse = existing.grandTotal - existing.amountPaid;
        if (amountToReverse > 0) {
          await creditCheckService.subtractFromBalance(
            existing.customerId,
            amountToReverse,
            userId
          );
        }
      }

      return result;
    } catch (error) {
      console.error('InvoiceService.cancel error:', error);
      return {
        success: false,
        error: 'Failed to cancel invoice',
      };
    }
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: InvoiceStatus,
    userId?: string
  ): Promise<ServiceResult<Invoice>> {
    try {
      const existing = await invoiceRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Invoice not found',
        };
      }

      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const invoice = await invoiceRepository.updateStatus(id, newStatus, userId);

      // Log audit event for status change (fire and forget)
      auditService.log({
        action: 'update', // status_change
        module: 'invoices',
        entityType: 'Invoice',
        entityId: invoice.id,
        oldData: { status: existing.status },
        newData: { status: newStatus },
        userId,
        description: `Invoice ${invoice.invoiceNumber} status changed: ${existing.status} → ${newStatus}`,
      }).catch((err) => {
        console.error('Failed to log invoice status change audit:', err);
      });

      return {
        success: true,
        data: invoice,
      };
    } catch (error) {
      console.error('InvoiceService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update invoice status',
      };
    }
  },
};

export type InvoiceService = typeof invoiceService;
