/**
 * Sales Orders Repository
 *
 * Data access layer for Sales Orders module.
 * Handles all database operations for sales orders using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  SalesOrder,
  SalesOrderItem,
  SalesOrderWithItems,
  SalesOrderListItem,
  SalesOrderListParams,
  CreateSalesOrderDTO,
  UpdateSalesOrderDTO,
  CreateSalesOrderItemDTO,
  OrderStatus,
  OrderCreditStatus,
  PaginatedResult,
  CustomerSummary,
  UserSummary,
  LocationSummary,
} from '../types';
import { calculateOrderTotals, calculateLineTotal } from '../lib/schemas';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbSalesOrder {
  id: string;
  order_number: string;
  order_date: string;
  requested_delivery_date: string | null;
  customer_id: string;
  sales_rep_id: string | null;
  warehouse_id: string | null;
  currency_code: string;
  customer_po_number: string | null;
  status: OrderStatus;
  credit_status?: OrderCreditStatus;
  order_series?: string | null;
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
  shipping_method: string | null;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  shipping_cost: number;
  grand_total: number;
  customer_notes: string | null;
  internal_notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbSalesOrderItem {
  id: string;
  sales_order_id: string;
  product_id: string;
  sku: string;
  description: string | null;
  quantity: number;
  customer_qty: number;
  unit_code: string;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
  line_total: number;
  warehouse_id: string | null;
  batch_number: string | null;
  serial_number: string | null;
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

interface DbLocation {
  id: string;
  location_code: string;
  name: string;
}

// ============================================
// REPOSITORY
// ============================================

class SalesOrderRepositoryImpl {
  // ==========================================
  // LIST & SEARCH
  // ==========================================

  /**
   * Find all sales orders with pagination and filtering
   */
  async findMany(params: SalesOrderListParams = {}): Promise<PaginatedResult<SalesOrderListItem>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      orderSeries,
      customerId,
      salesRepId,
      warehouseId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query with customer join for name
    let query = db
      .from('sales_orders')
      .select(
        `
        id,
        order_number,
        customer_id,
        customer_po_number,
        order_date,
        requested_delivery_date,
        status,
        credit_status,
        order_series,
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
      query = query.or(
        `order_number.ilike.%${search}%,customer_po_number.ilike.%${search}%`
      );
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply order series filter
    if (orderSeries) {
      query = query.eq('order_series', orderSeries);
    }

    // Apply customer filter
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    // Apply sales rep filter
    if (salesRepId) {
      query = query.eq('sales_rep_id', salesRepId);
    }

    // Apply warehouse filter
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId);
    }

    // Apply date range filters
    if (dateFrom) {
      query = query.gte('order_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('order_date', dateTo);
    }

    // Map camelCase sort fields to snake_case
    const sortFieldMap: Record<string, string> = {
      orderNumber: 'order_number',
      orderDate: 'order_date',
      requestedDeliveryDate: 'requested_delivery_date',
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
      throw new Error(`Failed to fetch sales orders: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    // Get item counts for each order
    const orderIds = (data || []).map((row) => row.id);
    const itemCounts = await this.getItemCounts(orderIds);

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
   * Find a single sales order by ID with all items
   */
  async findById(id: string): Promise<SalesOrderWithItems | null> {
    const { data: order, error } = await db
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch sales order: ${error.message}`);
    }

    if (!order) {return null;}

    // Fetch items
    const items = await this.findItemsByOrderId(id);

    // Fetch related data
    const [customer, salesRep, warehouse, pickTickets] = await Promise.all([
      this.getCustomerSummary(order.customer_id),
      order.sales_rep_id ? this.getUserSummary(order.sales_rep_id) : null,
      order.warehouse_id ? this.getLocationSummary(order.warehouse_id) : null,
      this.getPickTicketsSummary(id),
    ]);

    return {
      ...this.mapToSalesOrder(order as DbSalesOrder),
      items,
      customer: customer || undefined,
      salesRep: salesRep || undefined,
      warehouse: warehouse || undefined,
      pickTickets: pickTickets || undefined,
    };
  }

  /**
   * Get pick tickets summary for a sales order
   */
  private async getPickTicketsSummary(salesOrderId: string): Promise<{ id: string; ticketNumber: string; status: string }[] | null> {
    const { data, error } = await db
      .from('pick_tickets')
      .select('id, pick_ticket_number, status')
      .eq('sales_order_id', salesOrderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return null;
    }

    return data.map((row) => ({
      id: row.id,
      ticketNumber: row.pick_ticket_number,
      status: row.status,
    }));
  }

  /**
   * Find a single sales order by order number
   */
  async findByOrderNumber(orderNumber: string): Promise<SalesOrderWithItems | null> {
    const { data, error } = await db
      .from('sales_orders')
      .select('id')
      .eq('order_number', orderNumber)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch sales order: ${error.message}`);
    }

    if (!data) {return null;}

    return this.findById(data.id);
  }

  // ==========================================
  // ORDER ITEMS
  // ==========================================

  /**
   * Find all items for a sales order
   */
  async findItemsByOrderId(orderId: string): Promise<SalesOrderItem[]> {
    const { data, error } = await db
      .from('sales_order_items')
      .select(`*, products:product_id (item_type, sku, name, description)`)
      .eq('sales_order_id', orderId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch order items: ${error.message}`);
    }

    // Load allocations for each item
    const items = await Promise.all(
      (data || []).map(async (row) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rowData = row as any;
        const itemType = rowData.products?.item_type as 'inventory' | 'non_inventory' | 'service' | undefined;

        // If SKU or description is missing, use product data
        const productData = rowData.products;
        const sku = rowData.sku || productData?.sku || '';
        const description = rowData.description || productData?.description || productData?.name || '';

        const item = this.mapToSalesOrderItem(rowData as DbSalesOrderItem, itemType, sku, description);

        // Load allocations for this item
        const { getAllocationsByItemId } = await import('./fulfillment-allocations.repository');
        const allocationsResult = await getAllocationsByItemId(item.id);

        if (allocationsResult.data) {
          // Dynamically add allocations to item (type will be SalesOrderItemWithAllocations at runtime)
          (item as any).allocations = allocationsResult.data;
        }

        return item;
      })
    );

    return items;
  }

  /**
   * Get item counts for multiple orders
   */
  private async getItemCounts(orderIds: string[]): Promise<Record<string, number>> {
    if (orderIds.length === 0) {return {};}

    const { data, error } = await db
      .from('sales_order_items')
      .select('sales_order_id')
      .in('sales_order_id', orderIds);

    if (error) {
      throw new Error(`Failed to fetch item counts: ${error.message}`);
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      counts[row.sales_order_id] = (counts[row.sales_order_id] || 0) + 1;
    }

    return counts;
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get counts by status
   */
  async getCountsByStatus(): Promise<Record<OrderStatus, number>> {
    const { data, error } = await db
      .from('sales_orders')
      .select('status')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get order counts: ${error.message}`);
    }

    const counts: Record<OrderStatus, number> = {
      draft: 0,
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    (data || []).forEach((r) => {
      const orderStatus = r.status as OrderStatus;
      counts[orderStatus] = (counts[orderStatus] || 0) + 1;
    });

    return counts;
  }

  /**
   * Get the next order number
   */
  async getNextOrderNumber(): Promise<string> {
    const { data, error } = await db.rpc('generate_order_number');

    if (error) {
      throw new Error(`Failed to generate order number: ${error.message}`);
    }

    return data as string;
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new sales order with items
   */
  async create(data: CreateSalesOrderDTO, userId?: string): Promise<SalesOrderWithItems> {
    // Use provided order number or generate one
    const orderNumber = data.orderNumber || await this.getNextOrderNumber();

    // Calculate totals from items
    const totals = calculateOrderTotals(data.items);

    // Insert order
    const { data: order, error: orderError } = await db
      .from('sales_orders')
      .insert({
        order_number: orderNumber,
        order_date: data.orderDate.toISOString().split('T')[0],
        requested_delivery_date: data.requestedDeliveryDate?.toISOString().split('T')[0] || null,
        customer_id: data.customerId,
        sales_rep_id: data.salesRepId || null,
        warehouse_id: data.warehouseId || null,
        currency_code: data.currencyCode || 'USD',
        customer_po_number: data.customerPoNumber || null,
        status: data.status || 'draft',
        order_series: data.orderSeries || null,
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
        shipping_method: data.shippingMethod || null,
        subtotal: totals.subtotal,
        discount_total: totals.discountTotal,
        tax_total: totals.taxTotal,
        shipping_cost: totals.shippingCost,
        grand_total: totals.grandTotal,
        customer_notes: data.customerNotes || null,
        internal_notes: data.internalNotes || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Failed to create sales order: ${orderError.message}`);
    }

    // Insert items
    const itemsToInsert = data.items.map((item, index) => ({
      sales_order_id: order.id,
      product_id: item.productId,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      customer_qty: item.customerQty || item.quantity, // Default to quantity if not provided
      unit_code: item.unitCode,
      unit_price: item.unitPrice,
      discount_percent: item.discountPercent,
      tax_rate: item.taxRate,
      line_total: calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
      warehouse_id: item.warehouseId || null,
      batch_number: item.batchNumber || null,
      serial_number: item.serialNumber || null,
      sort_order: index,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: itemsError } = await db
      .from('sales_order_items')
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback order creation
      await db.from('sales_orders').delete().eq('id', order.id);
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    return this.findById(order.id) as Promise<SalesOrderWithItems>;
  }

  /**
   * Update an existing sales order
   */
  async update(
    id: string,
    data: UpdateSalesOrderDTO,
    userId?: string
  ): Promise<SalesOrder> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.orderDate !== undefined) {
      updateData.order_date = data.orderDate.toISOString().split('T')[0];
    }
    if (data.requestedDeliveryDate !== undefined) {
      updateData.requested_delivery_date = data.requestedDeliveryDate?.toISOString().split('T')[0] || null;
    }
    if (data.customerId !== undefined) {updateData.customer_id = data.customerId;}
    if (data.salesRepId !== undefined) {updateData.sales_rep_id = data.salesRepId;}
    if (data.warehouseId !== undefined) {updateData.warehouse_id = data.warehouseId;}
    if (data.currencyCode !== undefined) {updateData.currency_code = data.currencyCode;}
    if (data.customerPoNumber !== undefined) {updateData.customer_po_number = data.customerPoNumber;}
    if (data.orderSeries !== undefined) {updateData.order_series = data.orderSeries;}
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
    if (data.shippingMethod !== undefined) {updateData.shipping_method = data.shippingMethod;}
    if (data.customerNotes !== undefined) {updateData.customer_notes = data.customerNotes;}
    if (data.internalNotes !== undefined) {updateData.internal_notes = data.internalNotes;}

    const { data: result, error } = await db
      .from('sales_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update sales order: ${error.message}`);
    }

    // Sync order_series to linked POs if order_series was updated
    if (data.orderSeries !== undefined) {
      await this.syncOrderSeriesToLinkedPOs(id, data.orderSeries, userId);
    }

    return this.mapToSalesOrder(result as DbSalesOrder);
  }

  /**
   * Update order status
   */
  async updateStatus(
    id: string,
    status: OrderStatus,
    userId?: string,
    reason?: string
  ): Promise<SalesOrder> {
    const updateData: Record<string, unknown> = {
      status,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
      updateData.cancelled_by = userId || null;
      updateData.cancellation_reason = reason || null;
    }

    const { data: result, error } = await db
      .from('sales_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update order status: ${error.message}`);
    }

    return this.mapToSalesOrder(result as DbSalesOrder);
  }

  /**
   * Soft delete a sales order
   */
  async softDelete(id: string, userId?: string): Promise<SalesOrder> {
    const { data, error } = await db
      .from('sales_orders')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete sales order: ${error.message}`);
    }

    return this.mapToSalesOrder(data as DbSalesOrder);
  }

  /**
   * Recalculate order totals
   */
  async recalculateTotals(id: string, userId?: string): Promise<SalesOrder> {
    // Get current items
    const items = await this.findItemsByOrderId(id);

    // Calculate totals
    const itemsForCalculation = items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
    }));

    // Get current shipping cost
    const { data: currentOrder } = await db
      .from('sales_orders')
      .select('shipping_cost')
      .eq('id', id)
      .single();

    const totals = calculateOrderTotals(
      itemsForCalculation,
      currentOrder?.shipping_cost || 0
    );

    // Update order
    const { data, error } = await db
      .from('sales_orders')
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

    return this.mapToSalesOrder(data as DbSalesOrder);
  }

  // ==========================================
  // ORDER ITEM OPERATIONS
  // ==========================================

  /**
   * Add an item to an order
   */
  async addItem(
    orderId: string,
    item: CreateSalesOrderItemDTO,
    userId?: string
  ): Promise<SalesOrderItem> {
    // Get current max sort order
    const { data: maxSortData } = await db
      .from('sales_order_items')
      .select('sort_order')
      .eq('sales_order_id', orderId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxSortData?.sort_order || 0) + 1;

    const { data, error } = await db
      .from('sales_order_items')
      .insert({
        sales_order_id: orderId,
        product_id: item.productId,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit_code: item.unitCode,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent,
        tax_rate: item.taxRate,
        line_total: calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
        warehouse_id: item.warehouseId || null,
        batch_number: item.batchNumber || null,
        serial_number: item.serialNumber || null,
        sort_order: sortOrder,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add order item: ${error.message}`);
    }

    // Recalculate order totals
    await this.recalculateTotals(orderId, userId);

    return this.mapToSalesOrderItem(data as DbSalesOrderItem);
  }

  /**
   * Update an order item
   */
  async updateItem(
    itemId: string,
    data: Partial<CreateSalesOrderItemDTO>,
    userId?: string
  ): Promise<SalesOrderItem> {
    // Get current item to get order ID
    const { data: currentItem, error: fetchError } = await db
      .from('sales_order_items')
      .select('sales_order_id, quantity, unit_price, discount_percent')
      .eq('id', itemId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch order item: ${fetchError.message}`);
    }

    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    };

    if (data.productId !== undefined) {updateData.product_id = data.productId;}
    if (data.sku !== undefined) {updateData.sku = data.sku;}
    if (data.description !== undefined) {updateData.description = data.description;}
    if (data.quantity !== undefined) {updateData.quantity = data.quantity;}
    if (data.unitCode !== undefined) {updateData.unit_code = data.unitCode;}
    if (data.unitPrice !== undefined) {updateData.unit_price = data.unitPrice;}
    if (data.discountPercent !== undefined) {updateData.discount_percent = data.discountPercent;}
    if (data.taxRate !== undefined) {updateData.tax_rate = data.taxRate;}
    if (data.warehouseId !== undefined) {updateData.warehouse_id = data.warehouseId;}
    if (data.batchNumber !== undefined) {updateData.batch_number = data.batchNumber;}
    if (data.serialNumber !== undefined) {updateData.serial_number = data.serialNumber;}

    // Recalculate line total
    const quantity = data.quantity ?? currentItem.quantity;
    const unitPrice = data.unitPrice ?? currentItem.unit_price;
    const discountPercent = data.discountPercent ?? currentItem.discount_percent;
    updateData.line_total = calculateLineTotal(quantity, unitPrice, discountPercent);

    const { data: result, error } = await db
      .from('sales_order_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update order item: ${error.message}`);
    }

    // Recalculate order totals
    await this.recalculateTotals(currentItem.sales_order_id, userId);

    return this.mapToSalesOrderItem(result as DbSalesOrderItem);
  }

  /**
   * Remove an order item
   */
  async removeItem(itemId: string, userId?: string): Promise<void> {
    // Get order ID before delete
    const { data: item, error: fetchError } = await db
      .from('sales_order_items')
      .select('sales_order_id')
      .eq('id', itemId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch order item: ${fetchError.message}`);
    }

    const { error } = await db
      .from('sales_order_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      throw new Error(`Failed to remove order item: ${error.message}`);
    }

    // Recalculate order totals
    await this.recalculateTotals(item.sales_order_id, userId);
  }

  /**
   * Replace all items for an order
   */
  async replaceItems(
    orderId: string,
    items: CreateSalesOrderItemDTO[],
    userId?: string
  ): Promise<SalesOrderItem[]> {
    // SMART UPDATE STRATEGY (not delete-all)
    // This prevents foreign key violations when pick tickets exist

    console.log('[replaceItems] Starting smart update. Items received:', {
      count: items.length,
      itemsWithId: items.filter((i: any) => i.id).length,
      itemsWithoutId: items.filter((i: any) => !i.id).length,
    });

    // Step 1: Get existing items
    const { data: existingItems, error: fetchError } = await db
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', orderId)
      .order('sort_order');

    if (fetchError) {
      throw new Error(`Failed to fetch existing items: ${fetchError.message}`);
    }

    console.log('[replaceItems] Existing items in DB:', existingItems?.length || 0);

    const existingItemsMap = new Map(
      (existingItems || []).map((item) => [item.id, item])
    );

    // Step 2: Delete items that are no longer in the list
    const newItemIds = items
      .map((item: any) => item.id)
      .filter((id: string | undefined) => id);

    const itemsToDelete = (existingItems || []).filter(
      (item) => !newItemIds.includes(item.id)
    );

    if (itemsToDelete.length > 0) {
      console.log(`[replaceItems] Attempting to delete ${itemsToDelete.length} items`);

      for (const existingItem of itemsToDelete) {
        const { error: deleteError } = await db
          .from('sales_order_items')
          .delete()
          .eq('id', existingItem.id);

        if (deleteError) {
          // Check if it's a foreign key constraint error (pick ticket exists)
          if (deleteError.message.includes('pick_ticket_items')) {
            throw new Error(
              `Cannot delete item "${existingItem.sku}" - Pick ticket already created for this item. ` +
              `Please cancel the pick ticket first before removing this item.`
            );
          } else {
            throw new Error(`Failed to delete item: ${deleteError.message}`);
          }
        }

        console.log(`[replaceItems] ✅ Deleted item ${existingItem.id}`);
      }
    }

    // Step 3: Update existing items and insert new ones
    const updatedItems: any[] = [];

    for (let index = 0; index < items.length; index++) {
      const item: any = items[index];
      const itemData = {
        product_id: item.productId,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        customer_qty: item.customerQty || item.quantity,
        unit_code: item.unitCode,
        unit_price: item.unitPrice,
        discount_percent: item.discountPercent,
        tax_rate: item.taxRate,
        line_total: calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
        warehouse_id: item.warehouseId || null,
        batch_number: item.batchNumber || null,
        serial_number: item.serialNumber || null,
        sort_order: index,
        updated_by: userId || null,
      };

      // CRITICAL: Check if item exists in DB, not just if it has an ID
      // Form might assign temporary IDs (like "item-123...") to new items
      // Only treat as existing if: 1) has ID, 2) ID is a valid UUID, 3) exists in DB
      const isValidUUID = item.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);
      const existsInDB = isValidUUID && existingItemsMap.has(item.id);

      if (existsInDB) {
        // UPDATE existing item
        console.log(`[replaceItems] Updating existing item ${item.id}`);

        const { data: updated, error: updateError } = await db
          .from('sales_order_items')
          .update(itemData)
          .eq('id', item.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update item ${item.id}: ${updateError.message}`);
        }

        updatedItems.push(updated);
      } else {
        // INSERT new item
        console.log(`[replaceItems] Inserting new item (product: ${item.productId})`);

        const { data: inserted, error: insertError } = await db
          .from('sales_order_items')
          .insert({
            ...itemData,
            sales_order_id: orderId,
            created_by: userId || null,
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to insert new item: ${insertError.message}`);
        }

        updatedItems.push(inserted);
      }
    }

    console.log('[replaceItems] ✅ Smart update complete:', {
      totalItems: updatedItems.length,
      updated: items.filter((i: any) => i.id).length,
      inserted: items.filter((i: any) => !i.id).length,
    });

    // Recalculate order totals
    await this.recalculateTotals(orderId, userId);

    return updatedItems.map((row) => this.mapToSalesOrderItem(row as DbSalesOrderItem));
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

  private async getLocationSummary(locationId: string): Promise<LocationSummary | null> {
    const { data, error } = await db
      .from('locations')
      .select('id, location_code, name')
      .eq('id', locationId)
      .single();

    if (error || !data) {return null;}

    const location = data as DbLocation;
    return {
      id: location.id,
      locationCode: location.location_code,
      name: location.name,
    };
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToSalesOrder(data: DbSalesOrder): SalesOrder {
    return {
      id: data.id,
      orderNumber: data.order_number,
      orderDate: new Date(data.order_date),
      requestedDeliveryDate: data.requested_delivery_date
        ? new Date(data.requested_delivery_date)
        : null,
      customerId: data.customer_id,
      salesRepId: data.sales_rep_id,
      warehouseId: data.warehouse_id,
      currencyCode: data.currency_code,
      customerPoNumber: data.customer_po_number,
      status: data.status,
      creditStatus: data.credit_status || 'ok',
      orderSeries: data.order_series || null,
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
      shippingMethod: data.shipping_method,
      subtotal: data.subtotal,
      discountTotal: data.discount_total,
      taxTotal: data.tax_total,
      shippingCost: data.shipping_cost,
      grandTotal: data.grand_total,
      customerNotes: data.customer_notes,
      internalNotes: data.internal_notes,
      cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : null,
      cancelledBy: data.cancelled_by,
      cancellationReason: data.cancellation_reason,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToSalesOrderItem(
    data: DbSalesOrderItem,
    itemType?: 'inventory' | 'non_inventory' | 'service',
    skuOverride?: string,
    descriptionOverride?: string
  ): SalesOrderItem {
    return {
      id: data.id,
      salesOrderId: data.sales_order_id,
      productId: data.product_id,
      sku: skuOverride || data.sku,
      description: descriptionOverride || data.description,
      quantity: data.quantity,
      customerQty: data.customer_qty,
      unitCode: data.unit_code,
      unitPrice: data.unit_price,
      discountPercent: Number(data.discount_percent),
      taxRate: Number(data.tax_rate),
      lineTotal: data.line_total,
      warehouseId: data.warehouse_id,
      batchNumber: data.batch_number,
      serialNumber: data.serial_number,
      sortOrder: data.sort_order,
      itemType,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  }

  private mapToListItem(
    data: {
      id: string;
      order_number: string;
      customer_id: string;
      customer_po_number?: string | null;
      order_date: string;
      requested_delivery_date: string | null;
      status: OrderStatus;
      credit_status?: OrderCreditStatus;
      order_series?: string | null;
      grand_total: number;
      currency_code: string;
      created_at: string;
      customers: { name: string } | { name: string }[];
    },
    itemCounts: Record<string, number>
  ): SalesOrderListItem {
    // Handle both object and array forms from Supabase
    const customer = Array.isArray(data.customers) ? data.customers[0] : data.customers;
    return {
      id: data.id,
      orderNumber: data.order_number,
      customerId: data.customer_id,
      customerName: customer?.name || 'Unknown',
      customerPoNumber: data.customer_po_number || null,
      orderDate: data.order_date,
      requestedDeliveryDate: data.requested_delivery_date,
      status: data.status,
      creditStatus: data.credit_status || 'ok',
      orderSeries: data.order_series || null,
      grandTotal: data.grand_total,
      currencyCode: data.currency_code,
      itemCount: itemCounts[data.id] || 0,
      createdAt: new Date(data.created_at),
    };
  }

  /**
   * Sync order_series from SO to all linked Purchase Orders
   * Called when order_series is updated on a Sales Order
   */
  async syncOrderSeriesToLinkedPOs(
    salesOrderId: string,
    orderSeries: string | null,
    userId?: string
  ): Promise<void> {
    // Update all POs linked to this SO
    const { data: updatedPOs, error } = await db
      .from('purchase_orders')
      .update({
        order_series: orderSeries,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('sales_order_id', salesOrderId)
      .select('id');

    if (error) {
      console.error('Failed to sync order_series to linked POs:', error);
      throw new Error(`Failed to sync order_series to linked POs: ${error.message}`);
    }

    if (updatedPOs && updatedPOs.length > 0) {
      console.log(`[SO] Synced order_series '${orderSeries}' to ${updatedPOs.length} linked PO(s)`);
    }
  }

  /**
   * Update order_series on SO and sync to all linked POs
   */
  async updateOrderSeries(
    salesOrderId: string,
    orderSeries: string | null,
    userId?: string
  ): Promise<void> {
    // Update the SO's order_series
    const { error: soError } = await db
      .from('sales_orders')
      .update({
        order_series: orderSeries,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', salesOrderId);

    if (soError) {
      throw new Error(`Failed to update SO order_series: ${soError.message}`);
    }

    // Sync to all linked POs
    await this.syncOrderSeriesToLinkedPOs(salesOrderId, orderSeries, userId);
  }
}

export const salesOrderRepository = new SalesOrderRepositoryImpl();
export type SalesOrderRepository = typeof salesOrderRepository;
