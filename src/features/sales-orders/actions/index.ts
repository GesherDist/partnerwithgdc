/**
 * Sales Orders Server Actions
 *
 * Server actions for the Sales Orders module.
 * Can be called directly from Server Components or via useFormState.
 *
 * Every action authenticates the caller and checks the matching
 * `orders.*` permission before touching the service layer.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { salesOrderService } from '../services/sales-order.service';
import {
  salesOrderFormSchema,
  updateSalesOrderSchema,
} from '../lib/schemas';
import type {
  SalesOrderListParams,
  SalesOrder,
  SalesOrderWithItems,
  SalesOrderListItem,
  OrderStatus,
  CreateSalesOrderItemDTO,
} from '../types';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Resolve the current application user and verify a permission.
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

/**
 * Same as `authorize`, but any one of the permissions is enough.
 */
async function authorizeAny(permissions: string[]): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      result: { success: false, error: `Permission denied: requires one of [${permissions.join(', ')}]` },
    };
  }

  return { ok: true, user };
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of sales orders
 */
export async function getSalesOrders(
  params: SalesOrderListParams = {}
): Promise<ActionResult<{
  data: SalesOrderListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.list(params);
  return result;
}

/**
 * Get a single sales order by ID
 */
export async function getSalesOrder(id: string): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorizeAny(['orders.view_detail', 'orders.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  return salesOrderService.getById(id);
}

/**
 * Get a single sales order by order number
 */
export async function getSalesOrderByNumber(
  orderNumber: string
): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorizeAny(['orders.view_detail', 'orders.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  return salesOrderService.getByOrderNumber(orderNumber);
}

// ============================================
// CREATE/UPDATE ACTIONS
// ============================================

/**
 * Create a new sales order from form data
 */
export async function createSalesOrder(formData: FormData): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorize('orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

  // Parse form data
  const rawData = {
    orderDate: formData.get('orderDate') as string,
    requestedDeliveryDate: formData.get('requestedDeliveryDate') as string,
    customerId: formData.get('customerId') as string,
    salesRepId: formData.get('salesRepId') as string,
    warehouseId: formData.get('warehouseId') as string,
    currencyId: formData.get('currencyId') as string || 'USD',
    customerPoNumber: formData.get('customerPoNumber') as string,
    status: (formData.get('status') as OrderStatus) || 'draft',
    billingAddress: {
      street: formData.get('billingStreet') as string,
      city: formData.get('billingCity') as string,
      state: formData.get('billingState') as string,
      postalCode: formData.get('billingPostalCode') as string,
      country: formData.get('billingCountry') as string || 'US',
    },
    shippingAddress: {
      street: formData.get('shippingStreet') as string,
      city: formData.get('shippingCity') as string,
      state: formData.get('shippingState') as string,
      postalCode: formData.get('shippingPostalCode') as string,
      country: formData.get('shippingCountry') as string || 'US',
    },
    shippingMethodId: formData.get('shippingMethodId') as string,
    items: JSON.parse(formData.get('items') as string || '[]'),
    customerNotes: formData.get('customerNotes') as string,
    internalNotes: formData.get('internalNotes') as string,
  };

  // Validate form data
  const formValidation = salesOrderFormSchema.safeParse(rawData);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.createFromForm(formValidation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Create sales order from JSON data
 */
export async function createSalesOrderFromData(
  data: unknown
): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorize('orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

  // Validate first
  const formValidation = salesOrderFormSchema.safeParse(data);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.createFromForm(formValidation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Update an existing sales order
 */
export async function updateSalesOrder(
  id: string,
  formData: FormData
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

  // Parse form data
  const rawData: Record<string, unknown> = {};

  const fields = [
    'orderDate', 'requestedDeliveryDate', 'customerId', 'salesRepId',
    'warehouseId', 'currencyCode', 'customerPoNumber', 'orderSeries',
    'shippingMethod', 'customerNotes', 'internalNotes'
  ];

  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null) {
      rawData[field] = value;
    }
  }

  // Handle addresses
  if (formData.get('billingStreet') !== null) {
    rawData.billingAddress = {
      street: formData.get('billingStreet') as string || null,
      city: formData.get('billingCity') as string || null,
      state: formData.get('billingState') as string || null,
      postalCode: formData.get('billingPostalCode') as string || null,
      country: formData.get('billingCountry') as string || null,
    };
  }

  if (formData.get('shippingStreet') !== null) {
    rawData.shippingAddress = {
      street: formData.get('shippingStreet') as string || null,
      city: formData.get('shippingCity') as string || null,
      state: formData.get('shippingState') as string || null,
      postalCode: formData.get('shippingPostalCode') as string || null,
      country: formData.get('shippingCountry') as string || null,
    };
  }

  // Convert dates
  if (rawData.orderDate) {
    rawData.orderDate = new Date(rawData.orderDate as string);
  }
  if (rawData.requestedDeliveryDate) {
    rawData.requestedDeliveryDate = new Date(rawData.requestedDeliveryDate as string);
  }

  // Validate
  const validation = updateSalesOrderSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Update sales order from JSON data
 */
export async function updateSalesOrderFromData(
  id: string,
  data: unknown
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const appUser = auth.user;

  // Validate
  const validation = updateSalesOrderSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await salesOrderService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Update order series only (allowed in any status)
 * Order Series is a categorization field for tracking on Operations Dashboard
 */
export async function updateSalesOrderSeries(
  id: string,
  orderSeries: string | null
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.updateOrderSeries(id, orderSeries, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/api/sales-orders');
    revalidatePath('/operations');
  }

  return result;
}

/**
 * Update product source only (allowed only for draft/pending status)
 */
export async function updateSalesOrderProductSource(
  id: string,
  productSource: 'direct' | 'warehouse'
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.update(
    id,
    { productSource },
    auth.user.id
  );

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Update order header and items from DTO (for Edit drawer)
 */
export async function updateSalesOrderFromDTO(
  orderId: string,
  dto: {
    orderDate: Date;
    requestedDeliveryDate: Date | null;
    customerId: string;
    salesRepId: string | null;
    warehouseId: string | null;
    currencyCode: string;
    customerPoNumber: string;
    orderSeries: string | null;
    status: OrderStatus;
    billingAddress: {
      street: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
    };
    shippingAddress: {
      street: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
      country: string | null;
    };
    shippingMethod: string | null;
    items: CreateSalesOrderItemDTO[];
    customerNotes: string | null;
    internalNotes: string | null;
  }
): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  // Extract items and header data
  const { items, ...headerData } = dto;

  // Update header fields
  const headerResult = await salesOrderService.update(orderId, headerData, auth.user.id);
  if (!headerResult.success) {
    return headerResult as ActionResult<SalesOrderWithItems>;
  }

  // Update items
  const itemsResult = await salesOrderService.updateItems(orderId, items, auth.user.id);

  if (itemsResult.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${orderId}`);
    revalidatePath('/api/sales-orders');
  }

  return itemsResult;
}

/**
 * Update order items
 */
export async function updateSalesOrderItems(
  orderId: string,
  items: CreateSalesOrderItemDTO[]
): Promise<ActionResult<SalesOrderWithItems>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.updateItems(orderId, items, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${orderId}`);
    revalidatePath('/api/sales-orders');
  }

  return result;
}

/**
 * Soft delete a sales order
 */
export async function deleteSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.delete');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.delete(id, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath('/api/sales-orders');
  }

  return result;
}

// ============================================
// STATUS ACTIONS
// ============================================

/**
 * Submit a draft order (draft -> pending)
 */
export async function submitSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.submit(id, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Confirm a pending order (pending -> confirmed)
 * Also creates a Purchase Order automatically for direct orders
 * Note: Inventory allocation happens when Pick Ticket is created (not here)
 */
export async function confirmSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.approve');
  if (!auth.ok) {
    return auth.result;
  }

  // Check if Order Series is selected before confirming
  const { data: soCheck } = await db
    .from('sales_orders')
    .select('order_series')
    .eq('id', id)
    .single();

  if (!soCheck?.order_series) {
    return {
      success: false,
      error: 'Order Series is required. Please select an Order Series (GDC 1, GDC 2, or GDC 3) before confirming this order.',
    };
  }

  // Check if all allocations are 'allocated' before confirming
  const { data: itemsWithAllocations } = await db
    .from('sales_order_items')
    .select(`
      id,
      customer_qty,
      allocations:fulfillment_allocations(id, status, quantity)
    `)
    .eq('sales_order_id', id);

  if (itemsWithAllocations && itemsWithAllocations.length > 0) {
    // Check each item has allocations
    for (const item of itemsWithAllocations) {
      const allocations = item.allocations as any[];

      if (!allocations || allocations.length === 0) {
        return {
          success: false,
          error: 'Cannot confirm order. Some items have no allocations. Please allocate fulfillment sources for all items.',
        };
      }

      // Check all allocations are 'allocated' status
      const nonAllocated = allocations.filter((a: any) => a.status !== 'allocated');
      if (nonAllocated.length > 0) {
        return {
          success: false,
          error: `Cannot confirm order. ${nonAllocated.length} allocation(s) are not yet assigned. Please assign all action buttons in the confirmation modal.`,
        };
      }

      // Check total allocated quantity matches customer quantity
      const totalAllocated = allocations.reduce((sum: number, a: any) => sum + a.quantity, 0);
      if (totalAllocated !== item.customer_qty) {
        return {
          success: false,
          error: `Cannot confirm order. Item allocated quantity (${totalAllocated}) doesn't match customer quantity (${item.customer_qty}).`,
        };
      }
    }
  }

  console.log('🔄 [confirmSalesOrder] Starting confirmation for SO:', id);

  const result = await salesOrderService.confirm(id, auth.user.id);

  console.log('📊 [confirmSalesOrder] Confirm result:', result.success ? 'SUCCESS' : 'FAILED');

  if (result.success) {
    // Check if any allocations have direct fulfillment source (manufacturer)
    // Only direct orders need a supplier PO. Warehouse orders ship from our
    // own stock, so raising a PO would put a phantom order in front of the
    // supplier — and their confirmation would create a second shipment for an
    // order the warehouse is already fulfilling.

    console.log('🔍 [confirmSalesOrder] Checking for direct allocations...');

    // First get sales order item IDs
    const { data: orderItems, error: itemsError } = await db
      .from('sales_order_items')
      .select('id')
      .eq('sales_order_id', id);

    console.log('📦 [confirmSalesOrder] Order items:', orderItems?.length || 0, 'Error:', itemsError?.message || 'none');

    if (orderItems && orderItems.length > 0) {
      const itemIds = orderItems.map(item => item.id);
      console.log('🔑 [confirmSalesOrder] Item IDs:', itemIds);

      // Then check for direct allocations
      const { data: directAllocations, error: allocError } = await db
        .from('fulfillment_allocations')
        .select('id')
        .in('sales_order_item_id', itemIds)
        .eq('fulfillment_source', 'direct');

      console.log('🏭 [confirmSalesOrder] Direct allocations:', directAllocations?.length || 0, 'Error:', allocError?.message || 'none');
      console.log('📋 [confirmSalesOrder] Allocation IDs:', directAllocations?.map(a => a.id) || []);

      const hasDirectAllocations = directAllocations && directAllocations.length > 0;

      if (hasDirectAllocations) {
        console.log('✅ [confirmSalesOrder] Direct allocations found! Creating PO...');
        try {
          await createPurchaseOrderFromSalesOrder(id, auth.user.id);
          console.log('✅ [confirmSalesOrder] Purchase Order created successfully for Sales Order:', id);
        } catch (error) {
          console.error('❌ [confirmSalesOrder] Failed to auto-create PO for Sales Order:', id, error);
          console.error('❌ [confirmSalesOrder] Error details:', error instanceof Error ? error.message : error);
          console.error('❌ [confirmSalesOrder] Error stack:', error instanceof Error ? error.stack : 'no stack');
          // Don't fail the confirmation if PO creation fails
          // The PO can be created manually later if needed
        }
      } else {
        console.log('ℹ️ [confirmSalesOrder] No direct allocations found - skipping PO creation');
      }
    } else {
      console.log('⚠️ [confirmSalesOrder] No order items found!');
    }

    console.log('🔄 [confirmSalesOrder] Revalidating paths...');
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/purchase-orders');
    revalidatePath('/inventory');
    console.log('✅ [confirmSalesOrder] Paths revalidated');
  }

  console.log('🏁 [confirmSalesOrder] Returning result:', result.success ? 'SUCCESS' : 'FAILED');
  return result;
}

/**
 * Regenerate Purchase Order from Sales Order
 * Used when PO was deleted and needs to be recreated
 */
export async function regeneratePurchaseOrder(salesOrderId: string): Promise<ActionResult<{ poNumber: string }>> {
  const auth = await authorize('purchase_orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  // Check SO exists and is valid for PO creation
  const { data: so, error: soError } = await db
    .from('sales_orders')
    .select('id, status, order_series')
    .eq('id', salesOrderId)
    .is('deleted_at', null)
    .single();

  if (soError || !so) {
    return { success: false, error: 'Sales Order not found' };
  }

  // Validate status - must be confirmed or processing
  if (!['confirmed', 'processing'].includes(so.status)) {
    return { success: false, error: 'Sales Order must be confirmed or processing to create a PO' };
  }

  // Validate order series
  if (!so.order_series) {
    return { success: false, error: 'Order Series is required. Please select an Order Series before creating a PO.' };
  }

  // Check if there are any 'direct' allocations (manufacturer fulfillment)
  // First get sales order item IDs
  const { data: orderItems } = await db
    .from('sales_order_items')
    .select('id')
    .eq('sales_order_id', salesOrderId);

  if (!orderItems || orderItems.length === 0) {
    return { success: false, error: 'No items found in this Sales Order' };
  }

  const itemIds = orderItems.map(item => item.id);

  // Then check for direct allocations
  const { data: directAllocations } = await db
    .from('fulfillment_allocations')
    .select('id')
    .in('sales_order_item_id', itemIds)
    .eq('fulfillment_source', 'direct');

  if (!directAllocations || directAllocations.length === 0) {
    return {
      success: false,
      error: 'No manufacturer (direct) allocations found. Purchase Orders are only created for direct manufacturer fulfillment.'
    };
  }

  // Check if PO already exists for this SO
  const { data: existingPO } = await db
    .from('purchase_orders')
    .select('id, po_number')
    .eq('sales_order_id', salesOrderId)
    .is('deleted_at', null)
    .single();

  if (existingPO) {
    return { success: false, error: `Purchase Order ${existingPO.po_number} already exists for this Sales Order` };
  }

  try {
    await createPurchaseOrderFromSalesOrder(salesOrderId, auth.user.id);

    // Get the created PO number
    const { data: newPO } = await db
      .from('purchase_orders')
      .select('po_number')
      .eq('sales_order_id', salesOrderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${salesOrderId}`);
    revalidatePath('/purchase-orders');

    return {
      success: true,
      data: { poNumber: newPO?.po_number || 'Unknown' }
    };
  } catch (error) {
    console.error('Failed to regenerate PO:', error);
    return { success: false, error: 'Failed to create Purchase Order' };
  }
}

/**
 * Helper: Create Purchase Order from Sales Order
 */
async function createPurchaseOrderFromSalesOrder(
  salesOrderId: string,
  userId: string
): Promise<void> {
  console.log('🔄 Creating PO from Sales Order:', salesOrderId);

  // Get the sales order with items
  const soResult = await salesOrderService.getById(salesOrderId);
  if (!soResult.success || !soResult.data) {
    throw new Error('Failed to get sales order');
  }

  const salesOrder = soResult.data;

  // Get all sales order item IDs
  const itemIds = salesOrder.items.map(item => item.id);

  if (itemIds.length === 0) {
    console.log('ℹ️ No items in sales order, skipping PO creation');
    return;
  }

  // Get ONLY 'direct' fulfillment allocations (manufacturer orders)
  const { data: directAllocations, error: allocError } = await db
    .from('fulfillment_allocations')
    .select('id, sales_order_item_id, quantity, container_qty, notes')
    .in('sales_order_item_id', itemIds)
    .eq('fulfillment_source', 'direct');

  if (allocError) {
    console.error('❌ Error fetching direct allocations:', allocError);
    throw new Error('Failed to fetch direct allocations');
  }

  if (!directAllocations || directAllocations.length === 0) {
    console.log('ℹ️ No direct allocations found, skipping PO creation');
    return;
  }

  console.log(`📦 Found ${directAllocations.length} direct allocation(s)`);

  // Get sales order items data
  const { data: soItems, error: soItemsError } = await db
    .from('sales_order_items')
    .select('id, product_id, sku, description, unit_price')
    .in('id', directAllocations.map(a => a.sales_order_item_id));

  if (soItemsError) {
    console.error('❌ Error fetching sales order items:', soItemsError);
    throw new Error('Failed to fetch sales order items');
  }

  // Create map of SO item ID -> SO item data
  const soItemsMap = new Map(soItems?.map(item => [item.id, item]) || []);

  // Get product IDs from SO items
  const productIds = soItems?.map(item => item.product_id).filter(Boolean) || [];

  // Get products with supplier info
  const { data: products, error: productsError } = await db
    .from('products')
    .select('id, supplier_id, name')
    .in('id', productIds);

  if (productsError) {
    console.error('❌ Error fetching products:', productsError);
  }

  // Create map of product ID -> supplier ID
  const productSupplierMap = new Map(products?.map(p => [p.id, p.supplier_id]) || []);

  // Get all unique supplier IDs
  const supplierIds = Array.from(new Set(
    products?.map(p => p.supplier_id).filter(Boolean) || []
  )) as string[];

  // Get supplier details
  const { data: suppliers, error: suppliersError } = await db
    .from('suppliers')
    .select('id, name, primary_contact_name')
    .in('id', supplierIds);

  if (suppliersError) {
    console.error('❌ Error fetching suppliers:', suppliersError);
  }

  // Create map of supplier ID -> supplier data
  const suppliersMap = new Map(suppliers?.map(s => [s.id, s]) || []);

  // Group allocations by supplier
  const allocationsBySupplier = new Map<string | null, typeof directAllocations>();

  for (const allocation of directAllocations) {
    const soItem = soItemsMap.get(allocation.sales_order_item_id);
    const supplierId = soItem?.product_id ? productSupplierMap.get(soItem.product_id) || null : null;

    if (!allocationsBySupplier.has(supplierId)) {
      allocationsBySupplier.set(supplierId, []);
    }
    allocationsBySupplier.get(supplierId)!.push(allocation);
  }

  console.log(`🏢 Creating PO(s) for ${allocationsBySupplier.size} supplier(s)`);

  // Create PO for each supplier
  for (const [supplierId, allocations] of allocationsBySupplier) {
    const supplier = supplierId ? suppliersMap.get(supplierId) : null;

    console.log(`📝 Creating PO for supplier: ${supplier?.name || 'Unknown'} (${allocations.length} item(s))`);

    // Generate PO number
    const { data: poNumber, error: poNumberError } = await db.rpc('generate_po_number');
    if (poNumberError || !poNumber) {
      console.error('❌ Failed to generate PO number:', poNumberError);
      continue;
    }

    // Create PO items from allocations (use allocation quantity, not full SO item quantity)
    const poItems = allocations.map((allocation, index) => {
      const soItem = soItemsMap.get(allocation.sales_order_item_id);

      return {
        productId: soItem?.product_id || null,
        sku: soItem?.sku || '',
        description: soItem?.description || '',
        quantityOrdered: allocation.container_qty || allocation.quantity, // Use container_qty if available
        unitCode: 'EA',
        unitPrice: soItem?.unit_price || 0,
        taxRate: 0,
        sortOrder: index,
        allocationId: allocation.id,
        notes: allocation.notes,
      };
    });

    // Calculate totals
    const subtotal = poItems.reduce((sum, item) => sum + (item.unitPrice * item.quantityOrdered), 0);

    // Combine notes from all allocations
    const combinedNotes = allocations
      .filter(a => a.notes)
      .map(a => a.notes)
      .join('\n---\n');

    // Create the PO
    const { data: newPO, error } = await db
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        sales_order_id: salesOrderId,
        po_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: salesOrder.requestedDeliveryDate
          ? new Date(salesOrder.requestedDeliveryDate).toISOString().split('T')[0]
          : null,
        status: 'draft',
        currency_code: salesOrder.currencyCode || 'USD',
        warehouse_id: salesOrder.warehouseId,
        subtotal: subtotal,
        tax_total: 0,
        shipping_cost: 0,
        grand_total: subtotal,
        vendor_address_street: '',
        vendor_address_city: '',
        vendor_address_state: '',
        vendor_address_postal_code: '',
        vendor_address_country: 'USA',
        ship_to_address_street: salesOrder.shippingAddressStreet || '',
        ship_to_address_city: salesOrder.shippingAddressCity || '',
        ship_to_address_state: salesOrder.shippingAddressState || '',
        ship_to_address_postal_code: salesOrder.shippingAddressPostalCode || '',
        ship_to_address_country: salesOrder.shippingAddressCountry || 'USA',
        internal_notes: `Auto-created from SO: ${salesOrder.orderNumber}${combinedNotes ? '\n\nAllocation Notes:\n' + combinedNotes : ''}`,
        created_by: userId,
        updated_by: userId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ Failed to create PO:', error);
      continue;
    }

    console.log(`✅ PO created: ${poNumber} (ID: ${newPO.id})`);

    // Create PO items
    if (newPO && poItems.length > 0) {
      const poItemsToInsert = poItems.map(item => ({
        purchase_order_id: newPO.id,
        product_id: item.productId || null,
        sku: item.sku,
        description: item.description,
        quantity_ordered: item.quantityOrdered,
        quantity_received: 0,
        unit_code: item.unitCode,
        unit_price: item.unitPrice,
        tax_rate: item.taxRate,
        line_total: item.unitPrice * item.quantityOrdered,
        sort_order: item.sortOrder,
        supplier_id: supplierId || null,
        supplier_name: supplier?.name || null,
      }));

      const { error: itemsError } = await db
        .from('purchase_order_items')
        .insert(poItemsToInsert);

      if (itemsError) {
        console.error('❌ Failed to create PO items:', itemsError);
      } else {
        console.log(`✅ Created ${poItemsToInsert.length} PO item(s)`);
      }
    }
  }

  console.log('✅ PO creation complete');
}

/**
 * Create Purchase Order from a single allocation
 * Used when clicking "Create PO" button in modal
 */
export async function createPurchaseOrderFromAllocation(
  salesOrderId: string,
  allocationId: string
): Promise<ActionResult<{ poNumber: string; poId: string }>> {
  const auth = await authorize('purchase_orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    console.log('🔄 [createPurchaseOrderFromAllocation] Creating PO from allocation:', allocationId);

    // Get the allocation with details
    const { data: allocation, error: allocError } = await db
      .from('fulfillment_allocations')
      .select('id, sales_order_item_id, quantity, container_qty, notes')
      .eq('id', allocationId)
      .eq('fulfillment_source', 'direct')
      .single();

    if (allocError || !allocation) {
      return { success: false, error: 'Allocation not found or not a direct allocation' };
    }

    // Get sales order item
    const { data: soItem, error: soItemError } = await db
      .from('sales_order_items')
      .select('id, product_id, sku, description, unit_price, sales_order_id')
      .eq('id', allocation.sales_order_item_id)
      .single();

    if (soItemError || !soItem) {
      return { success: false, error: 'Sales order item not found' };
    }

    // Get sales order
    const { data: salesOrder, error: soError } = await db
      .from('sales_orders')
      .select('order_number, customer_id, currency_code, warehouse_id, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_postal_code, shipping_address_country, requested_delivery_date')
      .eq('id', salesOrderId)
      .single();

    if (soError || !salesOrder) {
      return { success: false, error: 'Sales order not found' };
    }

    // Get product with supplier
    let supplierId: string | null = null;
    let supplierName: string | null = null;

    if (soItem.product_id) {
      const { data: product } = await db
        .from('products')
        .select('supplier_id, suppliers(name)')
        .eq('id', soItem.product_id)
        .single();

      if (product) {
        supplierId = product.supplier_id;
        const supplier = product.suppliers as any;
        supplierName = supplier?.name || null;
      }
    }

    // Generate PO number
    const { data: poNumber, error: poNumberError } = await db.rpc('generate_po_number');
    if (poNumberError || !poNumber) {
      return { success: false, error: 'Failed to generate PO number' };
    }

    console.log('📝 [createPurchaseOrderFromAllocation] Creating PO:', poNumber);

    // Calculate total
    const quantity = allocation.container_qty || allocation.quantity;
    const subtotal = soItem.unit_price * quantity;

    // Create PO
    const { data: newPO, error: poError } = await db
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        sales_order_id: salesOrderId,
        po_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: salesOrder.requested_delivery_date
          ? new Date(salesOrder.requested_delivery_date).toISOString().split('T')[0]
          : null,
        status: 'draft',
        currency_code: salesOrder.currency_code || 'USD',
        warehouse_id: salesOrder.warehouse_id,
        subtotal: subtotal,
        tax_total: 0,
        shipping_cost: 0,
        grand_total: subtotal,
        vendor_address_street: '',
        vendor_address_city: '',
        vendor_address_state: '',
        vendor_address_postal_code: '',
        vendor_address_country: 'USA',
        ship_to_address_street: salesOrder.shipping_address_street || '',
        ship_to_address_city: salesOrder.shipping_address_city || '',
        ship_to_address_state: salesOrder.shipping_address_state || '',
        ship_to_address_postal_code: salesOrder.shipping_address_postal_code || '',
        ship_to_address_country: salesOrder.shipping_address_country || 'USA',
        internal_notes: `Auto-created from SO: ${salesOrder.order_number} (Allocation: ${allocationId})${allocation.notes ? '\n\nNotes: ' + allocation.notes : ''}`,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select('id')
      .single();

    if (poError || !newPO) {
      console.error('❌ Failed to create PO:', poError);
      return { success: false, error: 'Failed to create Purchase Order' };
    }

    console.log('✅ [createPurchaseOrderFromAllocation] PO created:', poNumber);

    // Create PO item
    const { error: itemError } = await db
      .from('purchase_order_items')
      .insert({
        purchase_order_id: newPO.id,
        product_id: soItem.product_id || null,
        sku: soItem.sku,
        description: soItem.description,
        quantity_ordered: quantity,
        quantity_received: 0,
        unit_code: 'EA',
        unit_price: soItem.unit_price,
        tax_rate: 0,
        line_total: subtotal,
        sort_order: 0,
        supplier_id: supplierId,
        supplier_name: supplierName,
      });

    if (itemError) {
      console.error('❌ Failed to create PO item:', itemError);
      return { success: false, error: 'Failed to create PO item' };
    }

    console.log('✅ [createPurchaseOrderFromAllocation] PO item created');

    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${newPO.id}`);

    return {
      success: true,
      data: { poNumber, poId: newPO.id },
    };
  } catch (error) {
    console.error('❌ [createPurchaseOrderFromAllocation] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Purchase Order',
    };
  }
}

/**
 * Create a single Purchase Order from multiple allocations (for manufacturer/direct allocations)
 */
export async function createPurchaseOrderFromMultipleAllocations(
  salesOrderId: string,
  allocationIds: string[]
): Promise<ActionResult<{ poNumber: string; poId: string }>> {
  const auth = await authorize('purchase_orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    console.log('🔄 [createPurchaseOrderFromMultipleAllocations] Creating PO from allocations:', allocationIds);

    if (allocationIds.length === 0) {
      return { success: false, error: 'No allocations provided' };
    }

    // Get all allocations with details
    const { data: allocations, error: allocError } = await db
      .from('fulfillment_allocations')
      .select('id, sales_order_item_id, quantity, container_qty, notes')
      .in('id', allocationIds)
      .eq('fulfillment_source', 'direct');

    if (allocError || !allocations || allocations.length === 0) {
      return { success: false, error: 'Allocations not found or not direct allocations' };
    }

    // Get sales order items for all allocations
    const soItemIds = allocations.map(a => a.sales_order_item_id);
    const { data: soItems, error: soItemsError } = await db
      .from('sales_order_items')
      .select('id, product_id, sku, description, unit_price, sales_order_id')
      .in('id', soItemIds);

    if (soItemsError || !soItems || soItems.length === 0) {
      return { success: false, error: 'Sales order items not found' };
    }

    // Get sales order
    const { data: salesOrder, error: soError } = await db
      .from('sales_orders')
      .select('order_number, customer_id, currency_code, warehouse_id, shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_postal_code, shipping_address_country, requested_delivery_date')
      .eq('id', salesOrderId)
      .single();

    if (soError || !salesOrder) {
      return { success: false, error: 'Sales order not found' };
    }

    // Get product IDs to fetch suppliers
    const productIds = soItems.map(item => item.product_id).filter(Boolean) as string[];
    const { data: products } = await db
      .from('products')
      .select('id, supplier_id, suppliers(name)')
      .in('id', productIds);

    const productMap = new Map(products?.map(p => [p.id, p]) || []);

    // Generate PO number
    const { data: poNumber, error: poNumberError } = await db.rpc('generate_po_number');
    if (poNumberError || !poNumber) {
      return { success: false, error: 'Failed to generate PO number' };
    }

    console.log('📝 [createPurchaseOrderFromMultipleAllocations] Creating PO:', poNumber);

    // Calculate combined total
    let combinedSubtotal = 0;
    const poItemsData: any[] = [];

    allocations.forEach((allocation, index) => {
      const soItem = soItems.find(si => si.id === allocation.sales_order_item_id);
      if (!soItem) return;

      const quantity = allocation.container_qty || allocation.quantity;
      const lineTotal = soItem.unit_price * quantity;
      combinedSubtotal += lineTotal;

      const product = soItem.product_id ? productMap.get(soItem.product_id) : null;
      const supplierId = product?.supplier_id || null;
      const supplierName = (product?.suppliers as any)?.name || null;

      poItemsData.push({
        product_id: soItem.product_id || null,
        sku: soItem.sku,
        description: soItem.description,
        quantity_ordered: quantity,
        quantity_received: 0,
        unit_code: 'EA',
        unit_price: soItem.unit_price,
        tax_rate: 0,
        line_total: lineTotal,
        sort_order: index,
        supplier_id: supplierId,
        supplier_name: supplierName,
      });
    });

    // Combine notes from all allocations
    const allNotes = allocations
      .map(a => a.notes)
      .filter(Boolean)
      .join('\n');

    // Create PO
    const { data: newPO, error: poError } = await db
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        sales_order_id: salesOrderId,
        po_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: salesOrder.requested_delivery_date
          ? new Date(salesOrder.requested_delivery_date).toISOString().split('T')[0]
          : null,
        status: 'draft',
        currency_code: salesOrder.currency_code || 'USD',
        warehouse_id: salesOrder.warehouse_id,
        subtotal: combinedSubtotal,
        tax_total: 0,
        shipping_cost: 0,
        grand_total: combinedSubtotal,
        vendor_address_street: '',
        vendor_address_city: '',
        vendor_address_state: '',
        vendor_address_postal_code: '',
        vendor_address_country: 'USA',
        ship_to_address_street: salesOrder.shipping_address_street || '',
        ship_to_address_city: salesOrder.shipping_address_city || '',
        ship_to_address_state: salesOrder.shipping_address_state || '',
        ship_to_address_postal_code: salesOrder.shipping_address_postal_code || '',
        ship_to_address_country: salesOrder.shipping_address_country || 'USA',
        internal_notes: `Auto-created from SO: ${salesOrder.order_number} (${allocations.length} items)${allNotes ? '\n\nNotes: ' + allNotes : ''}`,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select('id')
      .single();

    if (poError || !newPO) {
      console.error('❌ Failed to create PO:', poError);
      return { success: false, error: 'Failed to create Purchase Order' };
    }

    console.log('✅ [createPurchaseOrderFromMultipleAllocations] PO created:', poNumber);

    // Create all PO items
    const poItemsWithPOId = poItemsData.map(item => ({
      ...item,
      purchase_order_id: newPO.id,
    }));

    const { error: itemsError } = await db
      .from('purchase_order_items')
      .insert(poItemsWithPOId);

    if (itemsError) {
      console.error('❌ Failed to create PO items:', itemsError);
      return { success: false, error: 'Failed to create PO items' };
    }

    console.log(`✅ [createPurchaseOrderFromMultipleAllocations] ${poItemsData.length} PO items created`);

    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${newPO.id}`);

    return {
      success: true,
      data: { poNumber, poId: newPO.id },
    };
  } catch (error) {
    console.error('❌ [createPurchaseOrderFromMultipleAllocations] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create Purchase Order',
    };
  }
}

/**
 * Start processing an order (confirmed -> processing)
 */
export async function processSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.process(id, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Ship an order (processing -> shipped)
 */
export async function shipSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.ship(id, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Deliver an order (shipped -> delivered)
 */
export async function deliverSalesOrder(id: string): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await salesOrderService.deliver(id, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
  }

  return result;
}

/**
 * Cancel an order
 * If warehouse fulfillment, deallocates inventory
 */
export async function cancelSalesOrder(
  id: string,
  reason?: string
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('orders.delete');
  if (!auth.ok) {
    return auth.result;
  }

  // Get the SO first to check if we need to deallocate
  const soResult = await salesOrderService.getById(id);
  if (!soResult.success || !soResult.data) {
    return { success: false, error: 'Sales order not found' };
  }

  const salesOrder = soResult.data;

  // Only deallocate if order was confirmed and has warehouse
  if (salesOrder.status === 'confirmed' && salesOrder.warehouseId) {
    await deallocateInventoryForSalesOrder(salesOrder, auth.user.id);
  }

  const result = await salesOrderService.cancel(id, reason, auth.user.id);

  if (result.success) {
    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${id}`);
    revalidatePath('/inventory');
  }

  return result;
}

/**
 * Helper: Deallocate inventory for cancelled Sales Order
 */
async function deallocateInventoryForSalesOrder(
  salesOrder: SalesOrderWithItems,
  userId: string
): Promise<void> {
  const { inventoryService } = await import('@/features/inventory/services/inventory.service');

  const reference = {
    type: 'sales_order',
    id: salesOrder.id,
    number: salesOrder.orderNumber,
  };

  for (const item of salesOrder.items) {
    if (!item.productId) {
      continue;
    }

    try {
      await inventoryService.deallocateByProductLocation(
        item.productId,
        salesOrder.warehouseId!,
        item.quantity,
        userId,
        reference
      );
    } catch (error) {
      // Log but don't fail - best effort deallocation
      console.error(`Failed to deallocate ${item.sku}:`, error);
    }
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get order counts by status
 */
export async function getSalesOrderStatusCounts(): Promise<ActionResult<Record<OrderStatus, number>>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  return salesOrderService.getStatusCounts();
}

/**
 * Get the next order number
 */
export async function getNextOrderNumber(): Promise<ActionResult<string>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  return salesOrderService.getNextOrderNumber();
}

/**
 * Get customer addresses for auto-fill
 * Uses the customer module's service for addresses
 */
export async function getCustomerAddresses(customerId: string): Promise<ActionResult<{
  billing: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  shipping: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
}>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  // Import customer service to fetch addresses
  const { customerService } = await import('@/features/customers/services');
  return customerService.getAddresses(customerId);
}

/**
 * Get product price for auto-fill (uses price matrix based on customer channel)
 *
 * @param productId - Product ID
 * @param customerId - Customer ID (optional - if provided, uses price matrix)
 * @param quantity - Quantity (optional - for quantity-based pricing tiers)
 */
export async function getProductPrice(
  productId: string,
  customerId?: string,
  quantity: number = 1
): Promise<ActionResult<{
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  priceSource: 'matrix' | 'base';
}>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Get product info
    const { data: product, error: productError } = await db
      .from('products')
      .select('sku, name, description, base_price')
      .eq('id', productId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (productError) {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    let unitPrice = product.base_price;
    let priceSource: 'matrix' | 'base' = 'base';

    // If customerId provided, try to get price from price matrix
    if (customerId) {
      // Get customer's channel
      const { data: customer, error: customerError } = await db
        .from('customers')
        .select('channel')
        .eq('id', customerId)
        .is('deleted_at', null)
        .single();

      if (!customerError && customer?.channel) {
        // Look up price in price matrix (RPC returns array)
        const { data: priceData, error: priceError } = await db.rpc('get_product_price', {
          p_product_id: productId,
          p_channel: customer.channel,
          p_quantity: quantity,
        });

        // priceData is an array - get first result
        const matrixPrice = Array.isArray(priceData) ? priceData[0] : priceData;

        if (!priceError && matrixPrice && matrixPrice.price > 0) {
          unitPrice = matrixPrice.price;
          priceSource = 'matrix';
        }
      }
    }

    return {
      success: true,
      data: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        unitPrice,
        priceSource,
      },
    };
  } catch (error) {
    console.error('getProductPrice error:', error);
    return {
      success: false,
      error: 'Failed to fetch product price',
    };
  }
}

/**
 * Get master data for sales order form
 * Uses customer module for customer data
 */
export async function getSalesOrderMasterData(): Promise<ActionResult<{
  customers: Array<{
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    description: string | null;
    unitPrice: number;
    itemType: 'inventory' | 'non_inventory' | 'service';
  }>;
  warehouses: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  salesReps: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Import customer service to fetch customers
    const { customerService } = await import('@/features/customers/services');

    // Fetch all master data in parallel
    const [customersResult, productsResult, warehousesResult, usersResult] = await Promise.all([
      customerService.getForDropdown(),
      db.from('products')
        .select('id, sku, name, description, base_price, item_type')
        .eq('status', 'active')
        .eq('is_sellable', true)
        .is('deleted_at', null)
        .order('name'),
      db.from('locations')
        .select('id, location_code, name')
        .eq('is_active', true)
        .eq('location_type', 'warehouse')  // Only show actual warehouses, not drop_ship
        .is('deleted_at', null)
        .order('name'),
      db.from('users')
        .select('id, first_name, last_name, email')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('first_name'),
    ]);

    if (!customersResult.success) {throw new Error(customersResult.error);}
    if (productsResult.error) {throw productsResult.error;}
    if (warehousesResult.error) {throw warehousesResult.error;}
    if (usersResult.error) {throw usersResult.error;}

    return {
      success: true,
      data: {
        customers: (customersResult.data || []).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          email: c.email,
          phone: c.phone,
        })),
        products: (productsResult.data || []).map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          description: p.description,
          unitPrice: p.base_price,
          itemType: (p.item_type as 'inventory' | 'non_inventory' | 'service') || 'inventory',
        })),
        warehouses: (warehousesResult.data || []).map((w) => ({
          id: w.id,
          code: w.location_code,
          name: w.name,
        })),
        salesReps: (usersResult.data || []).map((u) => ({
          id: u.id,
          name: `${u.first_name} ${u.last_name}`,
          email: u.email,
        })),
      },
    };
  } catch (error) {
    console.error('getSalesOrderMasterData error:', error);
    return {
      success: false,
      error: 'Failed to fetch master data',
    };
  }
}

// ============================================
// CREDIT HOLD ACTIONS
// ============================================

/**
 * Release credit hold on a sales order
 * Finance only - requires sales_orders.release_hold permission
 */
export async function releaseSalesOrderHold(
  orderId: string,
  note?: string
): Promise<ActionResult<SalesOrder>> {
  const auth = await authorize('sales_orders.release_hold');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Get current order
    const { data: order, error: orderError } = await db
      .from('sales_orders')
      .select('id, credit_status, order_number')
      .eq('id', orderId)
      .is('deleted_at', null)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Sales order not found' };
    }

    if (order.credit_status !== 'hold') {
      return { success: false, error: 'Order is not on credit hold' };
    }

    // Update credit_status to 'ok'
    const { data: updatedOrder, error: updateError } = await db
      .from('sales_orders')
      .update({
        credit_status: 'ok',
        updated_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update pending approval event to approved
    await db
      .from('approval_events')
      .update({
        status: 'approved',
        decided_by: auth.user.id,
        decided_at: new Date().toISOString(),
        note: note || 'Credit hold released by finance',
      })
      .eq('subject_type', 'sales_order')
      .eq('subject_id', orderId)
      .eq('type', 'credit_release')
      .eq('status', 'pending');

    revalidatePath('/sales-orders');
    revalidatePath(`/sales-orders/${orderId}`);

    return {
      success: true,
      data: updatedOrder as SalesOrder,
    };
  } catch (error) {
    console.error('releaseSalesOrderHold error:', error);
    return {
      success: false,
      error: 'Failed to release credit hold',
    };
  }
}

/**
 * Get sales orders on credit hold
 */
export async function getSalesOrdersOnHold(): Promise<ActionResult<SalesOrderListItem[]>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const { data, error } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_id,
        customers!inner (name),
        order_date,
        requested_delivery_date,
        status,
        credit_status,
        product_source,
        grand_total,
        currency_code,
        order_series,
        created_at
      `)
      .eq('credit_status', 'hold')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const orders: SalesOrderListItem[] = (data || []).map((row) => ({
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      customerName: (row.customers as unknown as { name: string } | null)?.name || 'Unknown',
      orderDate: row.order_date,
      requestedDeliveryDate: row.requested_delivery_date,
      status: row.status as OrderStatus,
      creditStatus: row.credit_status as 'ok' | 'hold',
      // Matches the repository mapper, which defaults a null source to direct
      productSource: row.product_source || 'direct',
      grandTotal: row.grand_total,
      currencyCode: row.currency_code,
      orderSeries: row.order_series,
      itemCount: 0, // Not fetched for this list
      createdAt: new Date(row.created_at),
    }));

    return { success: true, data: orders };
  } catch (error) {
    console.error('getSalesOrdersOnHold error:', error);
    return { success: false, error: 'Failed to fetch orders on hold' };
  }
}

// ============================================
// PIPEDRIVE SYNC
// ============================================

/**
 * Sync order activity to Pipedrive
 * Called when order is delivered or manually triggered
 * Only syncs if customer is linked to Pipedrive
 */
export async function syncOrderToPipedrive(
  orderId: string
): Promise<ActionResult<{ synced: boolean; message: string }>> {
  const auth = await authorize('orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    // Get order with customer info
    const { data: order, error: orderError } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        total,
        status,
        customer_id,
        customers (
          id,
          name,
          pipedrive_person_id,
          pipedrive_deal_id
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Order not found' };
    }

    type CustomerType = {
      id: string;
      name: string;
      pipedrive_person_id: number | null;
      pipedrive_deal_id: number | null;
    };
    const customersData = order.customers as CustomerType | CustomerType[] | null;
    const customer = Array.isArray(customersData) ? customersData[0] : customersData;

    // Check if customer is linked to Pipedrive
    if (!customer?.pipedrive_person_id && !customer?.pipedrive_deal_id) {
      return {
        success: true,
        data: {
          synced: false,
          message: 'Customer not linked to Pipedrive',
        },
      };
    }

    // Import and use the push service
    const { pushOrderToPipedrive } = await import('@/features/pipedrive/actions');
    const syncResult = await pushOrderToPipedrive(orderId);

    if (syncResult.success) {
      return {
        success: true,
        data: {
          synced: true,
          message: 'Order activity synced to Pipedrive',
        },
      };
    } else {
      return {
        success: false,
        error: syncResult.error || 'Failed to sync to Pipedrive',
      };
    }
  } catch (error) {
    console.error('syncOrderToPipedrive error:', error);
    return {
      success: false,
      error: 'Failed to sync order to Pipedrive',
    };
  }
}
