/**
 * Quotes Repository
 *
 * Data access layer for Quotes module.
 * Handles all database operations for quotes using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Quote,
  QuoteItem,
  QuoteWithItems,
  QuoteListItem,
  QuoteListParams,
  CreateQuoteDTO,
  UpdateQuoteDTO,
  CreateQuoteItemDTO,
  QuoteStatus,
  PaginatedResult,
  CustomerSummary,
  UserSummary,
  SalesOrderSummary,
} from '../types';
import { calculateQuoteTotals, calculateLineTotal } from '../lib/schemas';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  valid_until: string | null;
  customer_id: string;
  sales_rep_id: string | null;
  currency_code: string;
  status: QuoteStatus;
  billing_address_street: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_postal_code: string | null;
  billing_address_country: string | null;
  shipping_address_street: string | null;
  shipping_address_city: string | null;
  shipping_address_state: string | null;
  shipping_address_postal_code: string | null;
  shipping_address_country: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  customer_notes: string | null;
  internal_notes: string | null;
  terms_and_conditions: string | null;
  po_document_url: string | null;
  customer_po_number: string | null;
  converted_to_sales_order_id: string | null;
  converted_at: string | null;
  converted_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbQuoteItem {
  id: string;
  quote_id: string;
  product_id: string;
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

interface DbCustomer {
  id: string;
  customer_code: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface DbUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface DbSalesOrder {
  id: string;
  order_number: string;
  status: string;
}

// ============================================
// REPOSITORY
// ============================================

class QuoteRepositoryImpl {
  // ==========================================
  // LIST & SEARCH
  // ==========================================

  /**
   * Find all quotes with pagination and filtering
   */
  async findMany(params: QuoteListParams = {}): Promise<PaginatedResult<QuoteListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      customerId,
      salesRepId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query with customer join for name
    let query = db
      .from('quotes')
      .select(
        `
        id,
        quote_number,
        customer_id,
        quote_date,
        valid_until,
        status,
        grand_total,
        currency_code,
        created_at,
        customers!inner (
          name
        )
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      query = query.ilike('quote_number', `%${search}%`);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply customer filter
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    // Apply sales rep filter
    if (salesRepId) {
      query = query.eq('sales_rep_id', salesRepId);
    }

    // Apply date range filters
    if (dateFrom) {
      query = query.gte('quote_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('quote_date', dateTo);
    }

    // Map camelCase sort fields to snake_case
    const sortFieldMap: Record<string, string> = {
      quoteNumber: 'quote_number',
      quoteDate: 'quote_date',
      validUntil: 'valid_until',
      grandTotal: 'grand_total',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || sortBy || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch quotes: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    // Get item counts for each quote
    const quoteIds = (data || []).map((row) => row.id);
    const itemCounts = await this.getItemCounts(quoteIds);

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
   * Find a single quote by ID with all items
   */
  async findById(id: string): Promise<QuoteWithItems | null> {
    const { data: quote, error } = await db
      .from('quotes')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch quote: ${error.message}`);
    }

    if (!quote) {return null;}

    // Fetch items
    const items = await this.findItemsByQuoteId(id);

    // Fetch related data
    const [customer, salesRep, salesOrder] = await Promise.all([
      this.getCustomerSummary(quote.customer_id),
      quote.sales_rep_id ? this.getUserSummary(quote.sales_rep_id) : null,
      quote.converted_to_sales_order_id
        ? this.getSalesOrderSummary(quote.converted_to_sales_order_id)
        : null,
    ]);

    return {
      ...this.mapToQuote(quote as DbQuote),
      items,
      customer: customer || undefined,
      salesRep: salesRep || undefined,
      salesOrder: salesOrder || undefined,
    };
  }

  /**
   * Find a single quote by quote number
   */
  async findByQuoteNumber(quoteNumber: string): Promise<QuoteWithItems | null> {
    const { data, error } = await db
      .from('quotes')
      .select('id')
      .eq('quote_number', quoteNumber)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch quote: ${error.message}`);
    }

    if (!data) {return null;}

    return this.findById(data.id);
  }

  // ==========================================
  // QUOTE ITEMS
  // ==========================================

  /**
   * Find all items for a quote (with product item_type for inventory filtering)
   */
  async findItemsByQuoteId(quoteId: string): Promise<QuoteItem[]> {
    const { data, error } = await db
      .from('quote_items')
      .select(`
        *,
        products:product_id (
          item_type,
          sku,
          name,
          description
        )
      `)
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch quote items: ${error.message}`);
    }

    return (data || []).map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productData = row.products as any;

      // If SKU or description is missing, use product data
      const sku = row.sku || productData?.sku || '';
      const description = row.description || productData?.description || productData?.name || '';

      return this.mapToQuoteItem(row as DbQuoteItem, productData?.item_type, sku, description);
    });
  }

  /**
   * Get item counts for multiple quotes
   */
  private async getItemCounts(quoteIds: string[]): Promise<Record<string, number>> {
    if (quoteIds.length === 0) {return {};}

    const { data, error } = await db
      .from('quote_items')
      .select('quote_id')
      .in('quote_id', quoteIds);

    if (error) {
      throw new Error(`Failed to fetch item counts: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.quote_id] = (counts[row.quote_id] || 0) + 1;
    }

    return counts;
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get counts by status
   */
  async getCountsByStatus(): Promise<Record<QuoteStatus, number>> {
    const { data, error } = await db
      .from('quotes')
      .select('status')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get quote counts: ${error.message}`);
    }

    const counts: Record<QuoteStatus, number> = {
      draft: 0,
      pending_approval: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      converted: 0,
    };

    (data || []).forEach((r) => {
      const quoteStatus = r.status as QuoteStatus;
      counts[quoteStatus] = (counts[quoteStatus] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get the next quote number
   */
  async getNextQuoteNumber(): Promise<string> {
    const { data, error } = await db.rpc('generate_quote_number');

    if (error) {
      throw new Error(`Failed to generate quote number: ${error.message}`);
    }

    return data as string;
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  /**
   * Check if a quote number already exists
   */
  async quoteNumberExists(quoteNumber: string): Promise<boolean> {
    const { count, error } = await db
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('quote_number', quoteNumber);

    if (error) {
      throw new Error(`Failed to check quote number: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Create a new quote with items
   */
  async create(data: CreateQuoteDTO, userId?: string): Promise<QuoteWithItems> {
    // Use provided quote number or auto-generate
    let quoteNumber: string;

    // Safely get trimmed quote number (handles undefined, null, empty string)
    const providedQuoteNumber = typeof data.quoteNumber === 'string' ? data.quoteNumber.trim() : '';

    if (providedQuoteNumber.length > 0) {
      // Check for duplicates
      const exists = await this.quoteNumberExists(providedQuoteNumber);
      if (exists) {
        throw new Error(`Quote number "${providedQuoteNumber}" already exists. Please use a different number.`);
      }
      quoteNumber = providedQuoteNumber;
    } else {
      // Auto-generate
      quoteNumber = await this.getNextQuoteNumber();
    }

    // Calculate totals from items
    const totals = calculateQuoteTotals(data.items);

    // Insert quote
    const { data: quote, error: quoteError } = await db
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        quote_date: data.quoteDate.toISOString().split('T')[0],
        valid_until: data.validUntil?.toISOString().split('T')[0] || null,
        customer_id: data.customerId,
        sales_rep_id: data.salesRepId || null,
        currency_code: data.currencyCode || 'USD',
        status: data.status || 'draft',
        billing_address_street: data.billingAddress.street,
        billing_address_city: data.billingAddress.city,
        billing_address_state: data.billingAddress.state,
        billing_address_postal_code: data.billingAddress.postalCode,
        billing_address_country: data.billingAddress.country,
        shipping_address_street: data.shippingAddress.street,
        shipping_address_city: data.shippingAddress.city,
        shipping_address_state: data.shippingAddress.state,
        shipping_address_postal_code: data.shippingAddress.postalCode,
        shipping_address_country: data.shippingAddress.country,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        customer_notes: data.customerNotes || null,
        internal_notes: data.internalNotes || null,
        terms_and_conditions: data.termsAndConditions || null,
        po_document_url: data.poDocumentUrl || null,
        customer_po_number: data.customerPoNumber || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (quoteError) {
      throw new Error(`Failed to create quote: ${quoteError.message}`);
    }

    // Insert items
    const itemsToInsert = data.items.map((item, index) => ({
      quote_id: quote.id,
      product_id: item.productId,
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
      .from('quote_items')
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback quote creation
      await db.from('quotes').delete().eq('id', quote.id);
      throw new Error(`Failed to create quote items: ${itemsError.message}`);
    }

    return this.findById(quote.id) as Promise<QuoteWithItems>;
  }

  /**
   * Update an existing quote
   */
  async update(
    id: string,
    data: UpdateQuoteDTO,
    userId?: string
  ): Promise<Quote> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.quoteDate !== undefined) {
      updateData.quote_date = data.quoteDate.toISOString().split('T')[0];
    }
    if (data.validUntil !== undefined) {
      updateData.valid_until = data.validUntil?.toISOString().split('T')[0] || null;
    }
    if (data.customerId !== undefined) {updateData.customer_id = data.customerId;}
    if (data.salesRepId !== undefined) {updateData.sales_rep_id = data.salesRepId;}
    if (data.currencyCode !== undefined) {updateData.currency_code = data.currencyCode;}
    if (data.billingAddress !== undefined) {
      updateData.billing_address_street = data.billingAddress.street;
      updateData.billing_address_city = data.billingAddress.city;
      updateData.billing_address_state = data.billingAddress.state;
      updateData.billing_address_postal_code = data.billingAddress.postalCode;
      updateData.billing_address_country = data.billingAddress.country;
    }
    if (data.shippingAddress !== undefined) {
      updateData.shipping_address_street = data.shippingAddress.street;
      updateData.shipping_address_city = data.shippingAddress.city;
      updateData.shipping_address_state = data.shippingAddress.state;
      updateData.shipping_address_postal_code = data.shippingAddress.postalCode;
      updateData.shipping_address_country = data.shippingAddress.country;
    }
    if (data.customerNotes !== undefined) {updateData.customer_notes = data.customerNotes;}
    if (data.internalNotes !== undefined) {updateData.internal_notes = data.internalNotes;}
    if (data.termsAndConditions !== undefined) {updateData.terms_and_conditions = data.termsAndConditions;}

    const { data: result, error } = await db
      .from('quotes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update quote: ${error.message}`);
    }

    return this.mapToQuote(result as DbQuote);
  }

  /**
   * Update quote status
   */
  async updateStatus(
    id: string,
    status: QuoteStatus,
    userId?: string
  ): Promise<Quote> {
    const updateData: Record<string, unknown> = {
      status,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await db
      .from('quotes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update quote status: ${error.message}`);
    }

    return this.mapToQuote(result as DbQuote);
  }

  /**
   * Convert quote to sales order
   */
  async markAsConverted(
    id: string,
    salesOrderId: string,
    userId?: string
  ): Promise<Quote> {
    const { data: result, error } = await db
      .from('quotes')
      .update({
        status: 'converted',
        converted_to_sales_order_id: salesOrderId,
        converted_at: new Date().toISOString(),
        converted_by: userId || null,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to mark quote as converted: ${error.message}`);
    }

    return this.mapToQuote(result as DbQuote);
  }

  /**
   * Soft delete a quote
   */
  async softDelete(id: string, userId?: string): Promise<Quote> {
    const { data, error } = await db
      .from('quotes')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete quote: ${error.message}`);
    }

    return this.mapToQuote(data as DbQuote);
  }

  /**
   * Recalculate quote totals
   */
  async recalculateTotals(id: string, userId?: string): Promise<Quote> {
    // Get current items
    const items = await this.findItemsByQuoteId(id);

    // Calculate totals
    const itemsForCalculation = items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
    }));

    const totals = calculateQuoteTotals(itemsForCalculation);

    // Update quote
    const { data, error } = await db
      .from('quotes')
      .update({
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        grand_total: totals.grandTotal,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to recalculate totals: ${error.message}`);
    }

    return this.mapToQuote(data as DbQuote);
  }

  // ==========================================
  // QUOTE ITEM OPERATIONS
  // ==========================================

  /**
   * Add an item to a quote
   */
  async addItem(
    quoteId: string,
    item: CreateQuoteItemDTO,
    userId?: string
  ): Promise<QuoteItem> {
    // Get current max sort order
    const { data: maxSortData } = await db
      .from('quote_items')
      .select('sort_order')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxSortData?.sort_order || 0) + 1;

    const { data, error } = await db
      .from('quote_items')
      .insert({
        quote_id: quoteId,
        product_id: item.productId,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit_code: item.unitCode,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent,
        tax_rate: item.taxRate,
        line_total: calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
        sort_order: sortOrder,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add quote item: ${error.message}`);
    }

    // Recalculate quote totals
    await this.recalculateTotals(quoteId, userId);

    return this.mapToQuoteItem(data as DbQuoteItem);
  }

  /**
   * Replace all items for a quote
   */
  async replaceItems(
    quoteId: string,
    items: CreateQuoteItemDTO[],
    userId?: string
  ): Promise<QuoteItem[]> {
    // Delete existing items
    const { error: deleteError } = await db
      .from('quote_items')
      .delete()
      .eq('quote_id', quoteId);

    if (deleteError) {
      throw new Error(`Failed to delete existing items: ${deleteError.message}`);
    }

    // Insert new items
    const itemsToInsert = items.map((item, index) => ({
      quote_id: quoteId,
      product_id: item.productId,
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

    const { data, error } = await db
      .from('quote_items')
      .insert(itemsToInsert)
      .select();

    if (error) {
      throw new Error(`Failed to insert quote items: ${error.message}`);
    }

    // Recalculate quote totals
    await this.recalculateTotals(quoteId, userId);

    return (data || []).map((row) => this.mapToQuoteItem(row as DbQuoteItem));
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

    const customer = data as DbCustomer;
    return {
      id: customer.id,
      customerCode: customer.customer_code,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    };
  }

  private async getUserSummary(userId: string): Promise<UserSummary | null> {
    const { data, error } = await db
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('id', userId)
      .single();

    if (error || !data) {return null;}

    const user = data as DbUser;
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
    };
  }

  private async getSalesOrderSummary(salesOrderId: string): Promise<SalesOrderSummary | null> {
    const { data, error } = await db
      .from('sales_orders')
      .select('id, order_number, status')
      .eq('id', salesOrderId)
      .single();

    if (error || !data) {return null;}

    const order = data as DbSalesOrder;
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
    };
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToQuote(data: DbQuote): Quote {
    return {
      id: data.id,
      quoteNumber: data.quote_number,
      quoteDate: new Date(data.quote_date),
      validUntil: data.valid_until ? new Date(data.valid_until) : null,
      customerId: data.customer_id,
      salesRepId: data.sales_rep_id,
      currencyCode: data.currency_code,
      status: data.status,
      billingAddressStreet: data.billing_address_street,
      billingAddressCity: data.billing_address_city,
      billingAddressState: data.billing_address_state,
      billingAddressPostalCode: data.billing_address_postal_code,
      billingAddressCountry: data.billing_address_country,
      shippingAddressStreet: data.shipping_address_street,
      shippingAddressCity: data.shipping_address_city,
      shippingAddressState: data.shipping_address_state,
      shippingAddressPostalCode: data.shipping_address_postal_code,
      shippingAddressCountry: data.shipping_address_country,
      subtotal: data.subtotal,
      discountTotal: data.discount_total,
      taxTotal: data.tax_total,
      grandTotal: data.grand_total,
      customerNotes: data.customer_notes,
      internalNotes: data.internal_notes,
      termsAndConditions: data.terms_and_conditions,
      poDocumentUrl: data.po_document_url,
      customerPoNumber: data.customer_po_number,
      convertedToSalesOrderId: data.converted_to_sales_order_id,
      convertedAt: data.converted_at ? new Date(data.converted_at) : null,
      convertedBy: data.converted_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToQuoteItem(
    data: DbQuoteItem,
    itemType?: string,
    skuOverride?: string,
    descriptionOverride?: string
  ): QuoteItem {
    return {
      id: data.id,
      quoteId: data.quote_id,
      productId: data.product_id,
      sku: skuOverride || data.sku,
      description: descriptionOverride || data.description,
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
      itemType: itemType as 'inventory' | 'non_inventory' | 'service' | undefined,
    };
  }

  private mapToListItem(
    data: {
      id: string;
      quote_number: string;
      customer_id: string;
      quote_date: string;
      valid_until: string | null;
      status: QuoteStatus;
      grand_total: number;
      currency_code: string;
      created_at: string;
      customers: { name: string } | { name: string }[];
    },
    itemCounts: Record<string, number>
  ): QuoteListItem {
    // Handle both object and array forms from Supabase
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    return {
      id: data.id,
      quoteNumber: data.quote_number,
      customerId: data.customer_id,
      customerName: customer?.name || 'Unknown',
      quoteDate: data.quote_date,
      validUntil: data.valid_until,
      status: data.status,
      grandTotal: data.grand_total,
      currencyCode: data.currency_code,
      itemCount: itemCounts[data.id] || 0,
      createdAt: new Date(data.created_at),
    };
  }
}

export const quoteRepository = new QuoteRepositoryImpl();
export type QuoteRepository = typeof quoteRepository;
