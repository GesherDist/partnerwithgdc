/**
 * Invoices Repository
 *
 * Data access layer for Invoices module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceWithItems,
  InvoiceListItem,
  InvoiceListParams,
  CreateInvoiceDTO,
  UpdateInvoiceDTO,
  RecordPaymentDTO,
  InvoiceStatus,
  PaginatedResult,
  CustomerSummary,
  SalesOrderSummary,
  ShipmentSummary,
} from '../types';
import { calculateInvoiceTotals, calculateLineTotal } from '../lib/schemas';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  customer_id: string;
  sales_order_id: string | null;
  shipment_id: string | null;
  currency_code: string;
  status: InvoiceStatus;
  payment_terms: string | null;
  billing_address_street: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_postal_code: string | null;
  billing_address_country: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  customer_notes: string | null;
  internal_notes: string | null;
  payment_notes: string | null;
  quickbooks_invoice_id: string | null;
  quickbooks_sync_status: string | null;
  quickbooks_last_sync: string | null;
  last_payment_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbInvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  sales_order_item_id: string | null;
  shipment_item_id: string | null;
  sku: string;
  description: string | null;
  quantity: number;
  unit_code: string;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface DbInvoicePayment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  quickbooks_payment_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// REPOSITORY
// ============================================

class InvoiceRepositoryImpl {
  /**
   * Find all invoices with pagination and filtering
   */
  async findMany(params: InvoiceListParams = {}): Promise<PaginatedResult<InvoiceListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      customerId,
      salesOrderId,
      dateFrom,
      dateTo,
      dueDateFrom,
      dueDateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    let query = db
      .from('invoices')
      .select(
        `
        id,
        invoice_number,
        customer_id,
        invoice_date,
        due_date,
        status,
        grand_total,
        amount_paid,
        balance_due,
        currency_code,
        created_at,
        customers!inner (
          name
        )
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    if (search) {
      query = query.ilike('invoice_number', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (salesOrderId) {
      query = query.eq('sales_order_id', salesOrderId);
    }

    if (dateFrom) {
      query = query.gte('invoice_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('invoice_date', dateTo);
    }

    if (dueDateFrom) {
      query = query.gte('due_date', dueDateFrom);
    }
    if (dueDateTo) {
      query = query.lte('due_date', dueDateTo);
    }

    const sortFieldMap: Record<string, string> = {
      invoiceNumber: 'invoice_number',
      invoiceDate: 'invoice_date',
      dueDate: 'due_date',
      grandTotal: 'grand_total',
      balanceDue: 'balance_due',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch invoices: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const invoiceIds = (data || []).map((row) => row.id);
    const itemCounts = await this.getItemCounts(invoiceIds);

    return {
      data: (data || []).map((row) => this.mapToListItem(row, itemCounts)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find a single invoice by ID with all items and payments
   */
  async findById(id: string): Promise<InvoiceWithItems | null> {
    const { data: invoice, error } = await db
      .from('invoices')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch invoice: ${error.message}`);
    }

    if (!invoice) {return null;}

    const [items, payments, customer, salesOrder, shipment] = await Promise.all([
      this.findItemsByInvoiceId(id),
      this.findPaymentsByInvoiceId(id),
      this.getCustomerSummary(invoice.customer_id),
      invoice.sales_order_id ? this.getSalesOrderSummary(invoice.sales_order_id) : null,
      invoice.shipment_id ? this.getShipmentSummary(invoice.shipment_id) : null,
    ]);

    return {
      ...this.mapToInvoice(invoice as DbInvoice),
      items,
      payments,
      customer: customer || undefined,
      salesOrder: salesOrder || undefined,
      shipment: shipment || undefined,
    };
  }

  /**
   * Find all items for an invoice
   */
  async findItemsByInvoiceId(invoiceId: string): Promise<InvoiceItem[]> {
    const { data, error } = await db
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch invoice items: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToInvoiceItem(row as DbInvoiceItem));
  }

  /**
   * Find all payments for an invoice
   */
  async findPaymentsByInvoiceId(invoiceId: string): Promise<InvoicePayment[]> {
    const { data, error } = await db
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch invoice payments: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToInvoicePayment(row as DbInvoicePayment));
  }

  /**
   * Get item counts for multiple invoices
   */
  private async getItemCounts(invoiceIds: string[]): Promise<Record<string, number>> {
    if (invoiceIds.length === 0) {return {};}

    const { data, error } = await db
      .from('invoice_items')
      .select('invoice_id')
      .in('invoice_id', invoiceIds);

    if (error) {
      throw new Error(`Failed to fetch item counts: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.invoice_id] = (counts[row.invoice_id] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get the next invoice number
   */
  async getNextInvoiceNumber(): Promise<string> {
    const { data, error } = await db.rpc('generate_invoice_number');

    if (error) {
      throw new Error(`Failed to generate invoice number: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Create a new invoice with items
   */
  async create(data: CreateInvoiceDTO, userId?: string): Promise<InvoiceWithItems> {
    const invoiceNumber = await this.getNextInvoiceNumber();
    const totals = calculateInvoiceTotals(data.items);

    const { data: invoice, error: invoiceError } = await db
      .from('invoices')
      .insert({
        invoice_number: invoiceNumber,
        invoice_date: data.invoiceDate.toISOString().split('T')[0],
        due_date: data.dueDate?.toISOString().split('T')[0] || null,
        customer_id: data.customerId,
        sales_order_id: data.salesOrderId || null,
        shipment_id: data.shipmentId || null,
        currency_code: data.currencyCode || 'USD',
        status: data.status || 'draft',
        payment_terms: data.paymentTerms || null,
        billing_address_street: data.billingAddress.street,
        billing_address_city: data.billingAddress.city,
        billing_address_state: data.billingAddress.state,
        billing_address_postal_code: data.billingAddress.postalCode,
        billing_address_country: data.billingAddress.country,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        amount_paid: 0,
        balance_due: totals.grandTotal,
        customer_notes: data.customerNotes || null,
        internal_notes: data.internalNotes || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    const itemsToInsert = data.items.map((item, index) => ({
      invoice_id: invoice.id,
      product_id: item.productId,
      sales_order_item_id: item.salesOrderItemId || null,
      shipment_item_id: item.shipmentItemId || null,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unit_code: item.unitCode,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent,
      tax_rate: item.taxRate,
      line_total: calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
      sort_order: index,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: itemsError } = await db
      .from('invoice_items')
      .insert(itemsToInsert);

    if (itemsError) {
      await db.from('invoices').delete().eq('id', invoice.id);
      throw new Error(`Failed to create invoice items: ${itemsError.message}`);
    }

    return this.findById(invoice.id) as Promise<InvoiceWithItems>;
  }

  /**
   * Update an existing invoice
   */
  async update(id: string, data: UpdateInvoiceDTO, userId?: string): Promise<Invoice> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.invoiceDate !== undefined) {
      updateData.invoice_date = data.invoiceDate.toISOString().split('T')[0];
    }
    if (data.dueDate !== undefined) {
      updateData.due_date = data.dueDate?.toISOString().split('T')[0] || null;
    }
    if (data.customerId !== undefined) {updateData.customer_id = data.customerId;}
    if (data.currencyCode !== undefined) {updateData.currency_code = data.currencyCode;}
    if (data.paymentTerms !== undefined) {updateData.payment_terms = data.paymentTerms;}
    if (data.billingAddress !== undefined) {
      updateData.billing_address_street = data.billingAddress.street;
      updateData.billing_address_city = data.billingAddress.city;
      updateData.billing_address_state = data.billingAddress.state;
      updateData.billing_address_postal_code = data.billingAddress.postalCode;
      updateData.billing_address_country = data.billingAddress.country;
    }
    if (data.customerNotes !== undefined) {updateData.customer_notes = data.customerNotes;}
    if (data.internalNotes !== undefined) {updateData.internal_notes = data.internalNotes;}
    if (data.paymentNotes !== undefined) {updateData.payment_notes = data.paymentNotes;}

    const { data: result, error } = await db
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice: ${error.message}`);
    }

    return this.mapToInvoice(result as DbInvoice);
  }

  /**
   * Update invoice status
   */
  async updateStatus(id: string, status: InvoiceStatus, userId?: string): Promise<Invoice> {
    const { data: result, error } = await db
      .from('invoices')
      .update({
        status,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update invoice status: ${error.message}`);
    }

    return this.mapToInvoice(result as DbInvoice);
  }

  /**
   * Record a payment
   */
  async recordPayment(invoiceId: string, payment: RecordPaymentDTO, userId?: string): Promise<InvoicePayment> {
    // Get current invoice
    const { data: invoice, error: invoiceError } = await db
      .from('invoices')
      .select('amount_paid, grand_total')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error('Invoice not found');
    }

    // Insert payment
    const { data: paymentRecord, error: paymentError } = await db
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        payment_date: payment.paymentDate.toISOString().split('T')[0],
        amount: payment.amount,
        payment_method: payment.paymentMethod || null,
        reference_number: payment.referenceNumber || null,
        notes: payment.notes || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (paymentError) {
      throw new Error(`Failed to record payment: ${paymentError.message}`);
    }

    // Update invoice totals
    const newAmountPaid = invoice.amount_paid + payment.amount;
    const newBalanceDue = invoice.grand_total - newAmountPaid;
    let newStatus: InvoiceStatus = 'partial';

    if (newBalanceDue <= 0) {
      newStatus = 'paid';
    }

    await db
      .from('invoices')
      .update({
        amount_paid: newAmountPaid,
        balance_due: Math.max(0, newBalanceDue),
        status: newStatus,
        last_payment_date: payment.paymentDate.toISOString().split('T')[0],
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    return this.mapToInvoicePayment(paymentRecord as DbInvoicePayment);
  }

  /**
   * Soft delete an invoice
   */
  async softDelete(id: string, userId?: string): Promise<Invoice> {
    const { data, error } = await db
      .from('invoices')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete invoice: ${error.message}`);
    }

    return this.mapToInvoice(data as DbInvoice);
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private async getCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
    const { data, error } = await db
      .from('customers')
      .select('id, customer_code, name, email, phone')
      .eq('id', customerId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      customerCode: data.customer_code,
      name: data.name,
      email: data.email,
      phone: data.phone,
    };
  }

  private async getSalesOrderSummary(soId: string): Promise<SalesOrderSummary | null> {
    const { data, error } = await db
      .from('sales_orders')
      .select('id, order_number, status, customer_po_number')
      .eq('id', soId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      orderNumber: data.order_number,
      status: data.status,
      customerPoNumber: data.customer_po_number,
    };
  }

  private async getShipmentSummary(shipmentId: string): Promise<ShipmentSummary | null> {
    const { data, error } = await db
      .from('shipments')
      .select('id, shipment_number, status')
      .eq('id', shipmentId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      shipmentNumber: data.shipment_number,
      status: data.status,
    };
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToInvoice(data: DbInvoice): Invoice {
    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      invoiceDate: new Date(data.invoice_date),
      dueDate: data.due_date ? new Date(data.due_date) : null,
      customerId: data.customer_id,
      salesOrderId: data.sales_order_id,
      shipmentId: data.shipment_id,
      currencyCode: data.currency_code,
      status: data.status,
      paymentTerms: data.payment_terms,
      billingAddressStreet: data.billing_address_street,
      billingAddressCity: data.billing_address_city,
      billingAddressState: data.billing_address_state,
      billingAddressPostalCode: data.billing_address_postal_code,
      billingAddressCountry: data.billing_address_country,
      subtotal: data.subtotal,
      discountTotal: data.discount_total,
      taxTotal: data.tax_total,
      grandTotal: data.grand_total,
      amountPaid: data.amount_paid,
      balanceDue: data.balance_due,
      customerNotes: data.customer_notes,
      internalNotes: data.internal_notes,
      paymentNotes: data.payment_notes,
      quickbooksInvoiceId: data.quickbooks_invoice_id,
      quickbooksSyncStatus: data.quickbooks_sync_status,
      quickbooksLastSync: data.quickbooks_last_sync ? new Date(data.quickbooks_last_sync) : null,
      lastPaymentDate: data.last_payment_date ? new Date(data.last_payment_date) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToInvoiceItem(data: DbInvoiceItem): InvoiceItem {
    return {
      id: data.id,
      invoiceId: data.invoice_id,
      productId: data.product_id,
      salesOrderItemId: data.sales_order_item_id,
      shipmentItemId: data.shipment_item_id,
      sku: data.sku,
      description: data.description,
      quantity: data.quantity,
      unitCode: data.unit_code,
      unitPrice: data.unit_price,
      discountPercent: Number(data.discount_percent),
      taxRate: Number(data.tax_rate),
      lineTotal: data.line_total,
      sortOrder: data.sort_order,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToInvoicePayment(data: DbInvoicePayment): InvoicePayment {
    return {
      id: data.id,
      invoiceId: data.invoice_id,
      paymentDate: new Date(data.payment_date),
      amount: data.amount,
      paymentMethod: data.payment_method,
      referenceNumber: data.reference_number,
      notes: data.notes,
      quickbooksPaymentId: data.quickbooks_payment_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToListItem(
    data: {
      id: string;
      invoice_number: string;
      customer_id: string;
      invoice_date: string;
      due_date: string | null;
      status: InvoiceStatus;
      grand_total: number;
      amount_paid: number;
      balance_due: number;
      currency_code: string;
      created_at: string;
      customers: { name: string } | { name: string }[];
    },
    itemCounts: Record<string, number>
  ): InvoiceListItem {
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      customerId: data.customer_id,
      customerName: customer?.name || 'Unknown',
      invoiceDate: data.invoice_date,
      dueDate: data.due_date,
      status: data.status,
      grandTotal: data.grand_total,
      amountPaid: data.amount_paid,
      balanceDue: data.balance_due,
      currencyCode: data.currency_code,
      itemCount: itemCounts[data.id] || 0,
      createdAt: new Date(data.created_at),
    };
  }
}

export const invoiceRepository = new InvoiceRepositoryImpl();
export type InvoiceRepository = typeof invoiceRepository;
