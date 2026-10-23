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
import { db } from '@/shared/lib/supabase/database';

/** Galileo invoices the customer on commission-only orders, so Gesher must not. */
export const COMMISSION_ONLY_INVOICE_ERROR =
  'This is a commission-only order: Galileo invoices the customer. Gesher bills the commission to Galileo instead.';

// ============================================
// COMMISSION BILLING (commission-only sales orders -> commission invoice to Galileo)
// ============================================

/** Order statuses whose commission can be billed (not draft, not cancelled). */
const BILLABLE_COMMISSION_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

export interface BillableCommissionOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPoNumber: string | null;
  status: string;
  tireCount: number;
  commissionRate: number; // cents per tire
  commissionAmount: number; // cents
  customerId: string | null;
  customerCode: string | null;
  shipToAddress: string | null; // Sales order delivery address, one line
}

interface CommissionOrderRow {
  id: string;
  order_number: string;
  customer_po_number: string | null;
  status: string;
  is_commission_only: boolean | null;
  commission_rate: number | null;
  commission_amount: number | null;
  commission_invoice_id: string | null;
  customer_id: string | null;
  shipping_address_street: string | null;
  shipping_address_city: string | null;
  shipping_address_state: string | null;
  shipping_address_postal_code: string | null;
  shipping_address_country: string | null;
  customers: { name: string; customer_code: string | null } | { name: string; customer_code: string | null }[] | null;
}

const COMMISSION_ORDER_SELECT =
  'id, order_number, customer_po_number, status, is_commission_only, commission_rate, commission_amount, commission_invoice_id, ' +
  'customer_id, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_postal_code, shipping_address_country, ' +
  'customers (name, customer_code)';

function toBillableCommissionOrder(row: CommissionOrderRow): BillableCommissionOrder {
  const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  const rate = row.commission_rate || 0;
  const amount = row.commission_amount || 0;
  const cityLine = [row.shipping_address_city, row.shipping_address_state, row.shipping_address_postal_code]
    .filter(Boolean)
    .join(', ');
  const shipTo = [row.shipping_address_street, cityLine, row.shipping_address_country].filter(Boolean).join(', ');
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerName: customer?.name || 'Unknown',
    customerId: row.customer_id,
    customerCode: customer?.customer_code || null,
    shipToAddress: shipTo || null,
    customerPoNumber: row.customer_po_number,
    status: row.status,
    tireCount: rate > 0 ? Math.round(amount / rate) : 0,
    commissionRate: rate,
    commissionAmount: amount,
  };
}

/** Commission-only orders that have a commission amount and are not billed yet. */
export async function listBillableCommissionOrders(): Promise<BillableCommissionOrder[]> {
  const { data, error } = await db
    .from('sales_orders')
    .select(COMMISSION_ORDER_SELECT)
    .eq('is_commission_only', true)
    .is('commission_invoice_id', null)
    .is('deleted_at', null)
    .in('status', BILLABLE_COMMISSION_ORDER_STATUSES)
    .gt('commission_amount', 0)
    .order('order_date', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as unknown as CommissionOrderRow[]).map(toBillableCommissionOrder);
}

/** Commission-only orders billed on a given commission invoice. */
export async function listCommissionOrdersForInvoice(invoiceId: string): Promise<BillableCommissionOrder[]> {
  const { data, error } = await db
    .from('sales_orders')
    .select(COMMISSION_ORDER_SELECT)
    .eq('commission_invoice_id', invoiceId)
    .is('deleted_at', null)
    .order('order_number', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as unknown as CommissionOrderRow[]).map(toBillableCommissionOrder);
}

/** The "Sales Commission" service product (QuickBooks SKU GDC-COMMISSION). */
async function findCommissionProduct(): Promise<{ id: string; sku: string } | null> {
  const { data: bySku, error: skuError } = await db
    .from('products')
    .select('id, sku')
    .eq('sku', 'GDC-COMMISSION')
    .is('deleted_at', null)
    .limit(1);

  if (skuError) {
    throw skuError;
  }
  if (bySku && bySku[0]) {
    return bySku[0];
  }

  const { data: byName, error: nameError } = await db
    .from('products')
    .select('id, sku')
    .eq('item_type', 'service')
    .ilike('name', '%commission%')
    .is('deleted_at', null)
    .limit(1);

  if (nameError) {
    throw nameError;
  }
  return byName?.[0] ?? null;
}

/**
 * Build one invoice line per commission order, from the amounts stored on the orders.
 * Returns an error message when any order cannot be billed.
 */
async function buildCommissionLines(
  orderIds: string[]
): Promise<{ lines: CreateInvoiceItemDTO[] } | { error: string }> {
  const { data, error } = await db
    .from('sales_orders')
    .select(COMMISSION_ORDER_SELECT)
    .in('id', orderIds)
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  const rows = (data || []) as unknown as CommissionOrderRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const id of orderIds) {
    const row = byId.get(id);
    if (!row) {
      return { error: 'One of the selected sales orders was not found' };
    }
    if (row.is_commission_only !== true) {
      return { error: `${row.order_number} is not a commission-only order` };
    }
    if (!BILLABLE_COMMISSION_ORDER_STATUSES.includes(row.status)) {
      return { error: `${row.order_number} cannot be billed in '${row.status}' status` };
    }
    if (row.commission_invoice_id) {
      return { error: `Commission for ${row.order_number} is already billed` };
    }
    if (!row.commission_amount || row.commission_amount <= 0) {
      return { error: `${row.order_number} has no commission amount` };
    }
  }

  const product = await findCommissionProduct();
  if (!product) {
    return { error: 'No "Sales Commission" service product found (SKU GDC-COMMISSION). Please create it first.' };
  }

  const lines: CreateInvoiceItemDTO[] = orderIds.map((id) => {
    const order = toBillableCommissionOrder(byId.get(id) as CommissionOrderRow);
    const rate = (order.commissionRate / 100).toFixed(2);
    const description = [
      `Sales Commission - ${order.orderNumber}`,
      order.customerPoNumber ? `PO ${order.customerPoNumber}` : null,
      order.customerName,
      `${order.tireCount} tires x $${rate}`,
    ]
      .filter(Boolean)
      .join(' / ')
      .slice(0, 500);

    return {
      productId: product.id,
      sku: product.sku,
      description,
      quantity: 1,
      unitCode: 'EA',
      unitPrice: order.commissionAmount,
      discountPercent: 0,
      taxRate: 0,
    };
  });

  return { lines };
}

/** Make the orders billed on a cancelled/deleted commission invoice billable again. */
async function releaseCommissionOrders(invoiceId: string): Promise<void> {
  const { error } = await db
    .from('sales_orders')
    .update({ commission_invoice_id: null })
    .eq('commission_invoice_id', invoiceId);

  if (error) {
    console.error('Failed to release commission orders for invoice', invoiceId, error);
  }
}

// Helper to convert invoice to audit data (exclude large/sensitive fields)
/**
 * Update the "Invoice Status" of the Pipedrive deal the invoice's sales order
 * came from, if any. Background; never fails the invoice change
 * (gdc/order-status.service).
 */
function syncPipedriveInvoiceStatus(invoiceId: string): void {
  void import('@/features/pipedrive/gdc/order-status.service')
    .then(({ syncInvoiceDealInBackground }) => syncInvoiceDealInBackground(invoiceId))
    .catch((error) => console.error('[Pipedrive] Invoice status sync could not start:', error));
}

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

      if (salesOrder.isCommissionOnly) {
        return { success: false, error: COMMISSION_ONLY_INVOICE_ERROR };
      }

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

      // Pipedrive deal: Invoice Status (background, orders from linked deals only)
      syncPipedriveInvoiceStatus(invoice.id);
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
      // Commission invoice billing selected commission-only orders:
      // their lines are built here from the stored amounts (never trusted from the client)
      const commissionOrderIds = Array.from(new Set(input.commissionSalesOrderIds || []));
      if (commissionOrderIds.length > 0) {
        if (input.invoiceType !== 'commission') {
          return { success: false, error: 'Commission orders can only be billed on a commission invoice' };
        }
        const built = await buildCommissionLines(commissionOrderIds);
        if ('error' in built) {
          return { success: false, error: built.error };
        }
        input = { ...input, items: [...built.lines, ...(input.items || [])], commissionSalesOrderIds: commissionOrderIds };
      }

      const validation = createInvoiceSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // A customer invoice linked to a sales order: same rules as createFromSalesOrder
      const linkedSalesOrderId = validation.data.salesOrderId;
      if (linkedSalesOrderId && validation.data.invoiceType !== 'commission') {
        const { data: linkedOrder, error: linkedOrderError } = await db
          .from('sales_orders')
          .select('id, is_commission_only')
          .eq('id', linkedSalesOrderId)
          .is('deleted_at', null)
          .maybeSingle();

        if (linkedOrderError) {
          throw linkedOrderError;
        }
        if (!linkedOrder) {
          return { success: false, error: 'Sales order not found' };
        }
        if (linkedOrder.is_commission_only === true) {
          return { success: false, error: COMMISSION_ONLY_INVOICE_ERROR };
        }

        const existing = await invoiceRepository.findMany({ salesOrderId: linkedSalesOrderId, limit: 1 });
        if (existing.data.length > 0) {
          return { success: false, error: 'An invoice already exists for this sales order' };
        }
      }

      const invoice = await invoiceRepository.create(validation.data, userId);

      // Mark the commission orders as billed on this invoice. The NULL check makes a
      // concurrent invoice for the same order fail instead of billing it twice.
      if (commissionOrderIds.length > 0) {
        const { data: linked, error: linkError } = await db
          .from('sales_orders')
          .update({ commission_invoice_id: invoice.id, updated_by: userId || null })
          .in('id', commissionOrderIds)
          .is('commission_invoice_id', null)
          .select('id');

        if (linkError || (linked || []).length !== commissionOrderIds.length) {
          console.error('Failed to link commission orders to invoice', invoice.id, linkError);
          await releaseCommissionOrders(invoice.id);
          await invoiceRepository.softDelete(invoice.id, userId);
          return {
            success: false,
            error: 'Some of the selected orders were billed by another invoice at the same time. Please try again.',
          };
        }
      }

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

      // Pipedrive deal: Invoice Status (background, orders from linked deals only)
      syncPipedriveInvoiceStatus(invoice.id);
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

      if (validation.data.status === 'cancelled') {
        await releaseCommissionOrders(id);
      }

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

      // Pipedrive deal: Invoice Status (background, orders from linked deals only)
      syncPipedriveInvoiceStatus(id);
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
      await releaseCommissionOrders(id);

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

      // Pipedrive deal: Invoice Status (background, orders from linked deals only)
      syncPipedriveInvoiceStatus(id);
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

      // Subtract payment amount from customer's open balance (only for customer invoices)
      if (existing.customerId) {
        await creditCheckService.subtractFromBalance(
          existing.customerId,
          validation.data.amount,
          userId
        );
      }

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

      // Pipedrive deal: Invoice Status (background, orders from linked deals only)
      syncPipedriveInvoiceStatus(id);
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
        // Add invoice amount to customer's open balance (only for customer invoices)
        if (existing.customerId) {
          await creditCheckService.addToBalance(
            existing.customerId,
            existing.grandTotal,
            userId
          );
        }
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
        // Subtract the remaining balance from customer's open balance (only for customer invoices)
        // (grandTotal - amountPaid = what was never paid and should be removed)
        if (existing.customerId) {
          const amountToReverse = existing.grandTotal - existing.amountPaid;
          if (amountToReverse > 0) {
            await creditCheckService.subtractFromBalance(
              existing.customerId,
              amountToReverse,
              userId
            );
          }
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
      // Pipedrive deal: Invoice Status (background, orders from linked deals only)
      syncPipedriveInvoiceStatus(id);

      if (newStatus === 'cancelled') {
        await releaseCommissionOrders(id);
      }

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
