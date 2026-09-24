/**
 * Credit Notes Repository
 *
 * Data access layer for Credit Notes module.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  CreditNote,
  CreditNoteItem,
  CreditNoteWithItems,
  CreditNoteListItem,
  CreditNoteListParams,
  CreateCreditNoteDTO,
  UpdateCreditNoteDTO,
  CreditNoteStatus,
  CreditNoteReason,
  PaginatedResult,
  CustomerSummary,
  InvoiceSummary,
  SalesOrderSummary,
} from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbCreditNote {
  id: string;
  credit_note_number: string;
  credit_note_date: string;
  customer_id: string;
  invoice_id: string | null;
  sales_order_id: string | null;
  reason: CreditNoteReason;
  reason_description: string | null;
  status: CreditNoteStatus;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  quickbooks_credit_memo_id: string | null;
  quickbooks_sync_status: string;
  quickbooks_last_sync: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbCreditNoteItem {
  id: string;
  credit_note_id: string;
  product_id: string | null;
  invoice_item_id: string | null;
  sku: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// REPOSITORY
// ============================================

class CreditNoteRepositoryImpl {
  /**
   * Find all credit notes with pagination and filtering
   */
  async findMany(params: CreditNoteListParams = {}): Promise<PaginatedResult<CreditNoteListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      customerId,
      invoiceId,
      reason,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    let query = db
      .from('credit_notes')
      .select(
        `
        id,
        credit_note_number,
        credit_note_date,
        customer_id,
        status,
        reason,
        grand_total,
        created_at,
        customers!inner (
          name
        )
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    if (search) {
      query = query.ilike('credit_note_number', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }

    if (reason) {
      query = query.eq('reason', reason);
    }

    if (dateFrom) {
      query = query.gte('credit_note_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('credit_note_date', dateTo);
    }

    const sortFieldMap: Record<string, string> = {
      creditNoteNumber: 'credit_note_number',
      creditNoteDate: 'credit_note_date',
      grandTotal: 'grand_total',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch credit notes: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const cnIds = (data || []).map((row) => row.id);
    const itemCounts = await this.getItemCounts(cnIds);

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
   * Find a single credit note by ID with all items
   */
  async findById(id: string): Promise<CreditNoteWithItems | null> {
    const { data: cn, error } = await db
      .from('credit_notes')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch credit note: ${error.message}`);
    }

    if (!cn) {return null;}

    const items = await this.findItemsByCreditNoteId(id);

    const [customer, invoice, salesOrder] = await Promise.all([
      this.getCustomerSummary(cn.customer_id),
      cn.invoice_id ? this.getInvoiceSummary(cn.invoice_id) : null,
      cn.sales_order_id ? this.getSalesOrderSummary(cn.sales_order_id) : null,
    ]);

    return {
      ...this.mapToCreditNote(cn as DbCreditNote),
      items,
      customer: customer || undefined,
      invoice: invoice || undefined,
      salesOrder: salesOrder || undefined,
    };
  }

  /**
   * Find all items for a credit note
   */
  async findItemsByCreditNoteId(creditNoteId: string): Promise<CreditNoteItem[]> {
    const { data, error } = await db
      .from('credit_note_items')
      .select('*')
      .eq('credit_note_id', creditNoteId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch credit note items: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToCreditNoteItem(row as DbCreditNoteItem));
  }

  /**
   * Get item counts for multiple credit notes
   */
  private async getItemCounts(cnIds: string[]): Promise<Record<string, number>> {
    if (cnIds.length === 0) {return {};}

    const { data, error } = await db
      .from('credit_note_items')
      .select('credit_note_id')
      .in('credit_note_id', cnIds);

    if (error) {
      throw new Error(`Failed to fetch item counts: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.credit_note_id] = (counts[row.credit_note_id] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get the next credit note number
   */
  async getNextCreditNoteNumber(): Promise<string> {
    const { data, error } = await db.rpc('generate_credit_note_number');

    if (error) {
      throw new Error(`Failed to generate credit note number: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Create a new credit note with items
   */
  async create(data: CreateCreditNoteDTO, userId?: string): Promise<CreditNoteWithItems> {
    const cnNumber = await this.getNextCreditNoteNumber();
    const totals = this.calculateTotals(data.items);

    const { data: cn, error: cnError } = await db
      .from('credit_notes')
      .insert({
        credit_note_number: cnNumber,
        credit_note_date: (data.creditNoteDate || new Date()).toISOString().split('T')[0],
        customer_id: data.customerId,
        invoice_id: data.invoiceId || null,
        sales_order_id: data.salesOrderId || null,
        reason: data.reason,
        reason_description: data.reasonDescription || null,
        status: 'draft',
        subtotal: totals.subtotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        customer_notes: data.customerNotes || null,
        internal_notes: data.internalNotes || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (cnError) {
      throw new Error(`Failed to create credit note: ${cnError.message}`);
    }

    const itemsToInsert = data.items.map((item, index) => ({
      credit_note_id: cn.id,
      product_id: item.productId || null,
      invoice_item_id: item.invoiceItemId || null,
      sku: item.sku || null,
      description: item.description || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      tax_rate: item.taxRate || 0,
      line_total: Math.round(item.quantity * item.unitPrice),
      sort_order: index,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: itemsError } = await db
      .from('credit_note_items')
      .insert(itemsToInsert);

    if (itemsError) {
      await db.from('credit_notes').delete().eq('id', cn.id);
      throw new Error(`Failed to create credit note items: ${itemsError.message}`);
    }

    return this.findById(cn.id) as Promise<CreditNoteWithItems>;
  }

  /**
   * Update an existing credit note
   */
  async update(id: string, data: UpdateCreditNoteDTO, userId?: string): Promise<CreditNote> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.creditNoteDate !== undefined) {
      updateData.credit_note_date = data.creditNoteDate.toISOString().split('T')[0];
    }
    if (data.reason !== undefined) {updateData.reason = data.reason;}
    if (data.reasonDescription !== undefined) {updateData.reason_description = data.reasonDescription;}
    if (data.customerNotes !== undefined) {updateData.customer_notes = data.customerNotes;}
    if (data.internalNotes !== undefined) {updateData.internal_notes = data.internalNotes;}

    const { data: result, error } = await db
      .from('credit_notes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update credit note: ${error.message}`);
    }

    return this.mapToCreditNote(result as DbCreditNote);
  }

  /**
   * Update credit note status
   */
  async updateStatus(id: string, status: CreditNoteStatus, userId?: string): Promise<CreditNote> {
    const { data: result, error } = await db
      .from('credit_notes')
      .update({
        status,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update credit note status: ${error.message}`);
    }

    return this.mapToCreditNote(result as DbCreditNote);
  }

  /**
   * Soft delete a credit note
   */
  async softDelete(id: string, userId?: string): Promise<CreditNote> {
    const { data, error } = await db
      .from('credit_notes')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete credit note: ${error.message}`);
    }

    return this.mapToCreditNote(data as DbCreditNote);
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private calculateTotals(items: { quantity: number; unitPrice: number; taxRate?: number }[]) {
    let subtotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      const lineTotal = Math.round(item.quantity * item.unitPrice);
      subtotal += lineTotal;
      taxTotal += Math.round(lineTotal * ((item.taxRate || 0) / 100));
    }

    return {
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal,
    };
  }

  private async getCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
    const { data, error } = await db
      .from('customers')
      .select('id, customer_code, name')
      .eq('id', customerId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      code: data.customer_code,
      name: data.name,
    };
  }

  private async getInvoiceSummary(invoiceId: string): Promise<InvoiceSummary | null> {
    const { data, error } = await db
      .from('invoices')
      .select('id, invoice_number')
      .eq('id', invoiceId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
    };
  }

  private async getSalesOrderSummary(soId: string): Promise<SalesOrderSummary | null> {
    const { data, error } = await db
      .from('sales_orders')
      .select('id, order_number')
      .eq('id', soId)
      .single();

    if (error || !data) {return null;}

    return {
      id: data.id,
      orderNumber: data.order_number,
    };
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToCreditNote(data: DbCreditNote): CreditNote {
    return {
      id: data.id,
      creditNoteNumber: data.credit_note_number,
      creditNoteDate: new Date(data.credit_note_date),
      customerId: data.customer_id,
      invoiceId: data.invoice_id,
      salesOrderId: data.sales_order_id,
      reason: data.reason,
      reasonDescription: data.reason_description,
      status: data.status,
      subtotal: data.subtotal,
      taxTotal: data.tax_total,
      grandTotal: data.grand_total,
      quickbooksCreditMemoId: data.quickbooks_credit_memo_id,
      quickbooksSyncStatus: data.quickbooks_sync_status,
      quickbooksLastSync: data.quickbooks_last_sync ? new Date(data.quickbooks_last_sync) : null,
      customerNotes: data.customer_notes,
      internalNotes: data.internal_notes,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToCreditNoteItem(data: DbCreditNoteItem): CreditNoteItem {
    return {
      id: data.id,
      creditNoteId: data.credit_note_id,
      productId: data.product_id,
      invoiceItemId: data.invoice_item_id,
      sku: data.sku,
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unit_price,
      taxRate: Number(data.tax_rate),
      lineTotal: data.line_total,
      sortOrder: data.sort_order,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToListItem(
    data: {
      id: string;
      credit_note_number: string;
      credit_note_date: string;
      customer_id: string;
      status: CreditNoteStatus;
      reason: CreditNoteReason;
      grand_total: number;
      created_at: string;
      customers: { name: string } | { name: string }[];
    },
    itemCounts: Record<string, number>
  ): CreditNoteListItem {
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    return {
      id: data.id,
      creditNoteNumber: data.credit_note_number,
      creditNoteDate: data.credit_note_date,
      customerId: data.customer_id,
      customerName: customer?.name || 'Unknown',
      status: data.status,
      reason: data.reason,
      grandTotal: data.grand_total,
      itemCount: itemCounts[data.id] || 0,
      createdAt: new Date(data.created_at),
    };
  }
}

export const creditNoteRepository = new CreditNoteRepositoryImpl();
export type CreditNoteRepository = typeof creditNoteRepository;
