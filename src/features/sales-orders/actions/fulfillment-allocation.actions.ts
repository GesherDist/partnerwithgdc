/**
 * Server Actions for Fulfillment Allocations
 *
 * API layer for allocation CRUD operations.
 * Used by UI components to create, update, cancel, and query allocations.
 */

'use server';

import {
  createSingleAllocation,
  createMultiSourceAllocation,
  updateAllocationDetails,
  cancelAllocation,
  markAllocationFulfilled,
  suggestOptimalAllocation,
  getAllocationsForItem,
  type AllocationDetailsChanges,
  type AllocationResult,
  type BatchAllocationResult,
  type AllocationSuggestion,
} from '@/features/sales-orders/services/fulfillment-orchestration.service';
import {
  createFulfillmentAllocationSchema,
  createBatchAllocationSchema,
  updateFulfillmentAllocationSchema,
  type CreateFulfillmentAllocationInput,
  type CreateBatchAllocationInput,
  type UpdateFulfillmentAllocationInput,
} from '@/features/sales-orders/validations/fulfillment-allocation.schema';
import type { FulfillmentAllocation } from '@/features/sales-orders/types';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { ALLOCATION_PERMISSIONS } from '../lib/allocation-permissions';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  /** Extra note for the user after a successful save */
  message?: string;
}

// ============================================
// AUTHORIZATION HELPER
// ============================================

/**
 * Returns an error result when the caller is not signed in or lacks the
 * permission (see ALLOCATION_PERMISSIONS), otherwise null.
 */
async function denyUnless(permission: string): Promise<ActionResult<never> | null> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  if (!hasPermission(user, permission)) {
    return { success: false, error: `Permission denied: ${permission}` };
  }

  return null;
}

// ============================================
// CREATE ALLOCATIONS
// ============================================

/**
 * Create a single fulfillment allocation
 *
 * @example
 * // Allocate from GDC inventory
 * const result = await createAllocationAction({
 *   salesOrderItemId: 'item-123',
 *   fulfillmentSource: 'gdc_inventory',
 *   quantity: 30,
 *   locationId: 'location-456',
 * }, 'product-789');
 *
 * if (result.success) {
 *   console.log('Allocation created:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 */
export async function createAllocationAction(
  input: CreateFulfillmentAllocationInput,
  productId: string
): Promise<ActionResult<FulfillmentAllocation>> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.write);
  if (denied) {
    return denied;
  }
  try {
    // Validate input with Zod
    const validated = createFulfillmentAllocationSchema.safeParse(input);

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(', '),
      };
    }

    // Call orchestration service
    const result: AllocationResult = await createSingleAllocation({
      salesOrderItemId: validated.data.salesOrderItemId,
      fulfillmentSource: validated.data.fulfillmentSource,
      quantity: validated.data.quantity,
      productId, // Pass productId to service
      locationId:
        'locationId' in validated.data
          ? validated.data.locationId || undefined  // Convert empty string to undefined
          : undefined,
      assignedContactId:
        'assignedContactId' in validated.data
          ? validated.data.assignedContactId || undefined  // Convert empty string to undefined
          : undefined,
      platinumDealerId:
        'platinumDealerId' in validated.data
          ? validated.data.platinumDealerId || undefined  // Convert empty string to undefined
          : undefined,
      dealerLocationId:
        'dealerLocationId' in validated.data
          ? validated.data.dealerLocationId || undefined  // Convert empty string to undefined
          : undefined,
      containerQty:
        'containerQty' in validated.data
          ? validated.data.containerQty
          : undefined,
      purchaseOrderId:
        'purchaseOrderId' in validated.data
          ? validated.data.purchaseOrderId
          : undefined,
      containerId:
        'containerId' in validated.data ? validated.data.containerId : undefined,
      notes: validated.data.notes,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to create allocation',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('Error in createAllocationAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Create multiple allocations from different sources for one item
 *
 * @example
 * // Allocate 150 units from 4 sources
 * const result = await createMultiSourceAllocationAction({
 *   salesOrderItemId: 'item-123',
 *   allocations: [
 *     { fulfillmentSource: 'direct', quantity: 72, containerQty: 72 },
 *     { fulfillmentSource: 'gdc_inventory', quantity: 30, locationId: 'loc-1' },
 *     { fulfillmentSource: 'platinum_dealer_inventory', quantity: 20, platinumDealerId: 'dealer-1' },
 *     { fulfillmentSource: 'platinum_dealer_fulfillment', quantity: 28, platinumDealerId: 'dealer-2' },
 *   ],
 * });
 */
export async function createMultiSourceAllocationAction(
  input: CreateBatchAllocationInput
): Promise<ActionResult<FulfillmentAllocation[]>> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.write);
  if (denied) {
    return denied;
  }
  try {
    // Validate input with Zod
    const validated = createBatchAllocationSchema.safeParse(input);

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(', '),
      };
    }

    // Map allocations to service params
    const allocationsParams = validated.data.allocations.map((allocation) => ({
      salesOrderItemId: validated.data.salesOrderItemId,
      fulfillmentSource: allocation.fulfillmentSource,
      quantity: allocation.quantity,
      locationId:
        'locationId' in allocation ? allocation.locationId || undefined : undefined,  // Convert empty string to undefined
      assignedContactId:
        'assignedContactId' in allocation
          ? allocation.assignedContactId || undefined  // Convert empty string to undefined
          : undefined,
      platinumDealerId:
        'platinumDealerId' in allocation
          ? allocation.platinumDealerId || undefined  // Convert empty string to undefined
          : undefined,
      dealerLocationId:
        'dealerLocationId' in allocation
          ? allocation.dealerLocationId || undefined  // Convert empty string to undefined
          : undefined,
      containerQty:
        'containerQty' in allocation ? allocation.containerQty : undefined,
      purchaseOrderId:
        'purchaseOrderId' in allocation
          ? allocation.purchaseOrderId
          : undefined,
      containerId:
        'containerId' in allocation ? allocation.containerId : undefined,
      notes: allocation.notes,
    }));

    // Call orchestration service
    const result: BatchAllocationResult = await createMultiSourceAllocation({
      salesOrderItemId: validated.data.salesOrderItemId,
      customerQty: validated.data.customerQty,
      productId: validated.data.productId,
      allocations: allocationsParams,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to create allocations',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('Error in createMultiSourceAllocationAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// UPDATE ALLOCATION
// ============================================

/**
 * Update allocation quantity or other fields
 *
 * @example
 * const result = await updateAllocationAction('allocation-123', {
 *   quantity: 50,
 *   notes: 'Updated quantity',
 * }, 'product-456');
 */
export async function updateAllocationAction(
  allocationId: string,
  input: UpdateFulfillmentAllocationInput,
  productId: string
): Promise<ActionResult<FulfillmentAllocation>> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.write);
  if (denied) {
    return denied;
  }
  try {
    // Validate input with Zod
    const validated = updateFulfillmentAllocationSchema.safeParse(input);

    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors.map((e) => e.message).join(', '),
      };
    }

    // Every changed field in one update (quantity, source, location, dealer, PO, notes).
    // Status is managed by the system and is not changed from this dialog.
    const changes = validated.data as Partial<AllocationDetailsChanges>;
    const result = await updateAllocationDetails({
      allocationId,
      productId,
      changes: {
        fulfillmentSource: changes.fulfillmentSource,
        quantity: changes.quantity,
        locationId: changes.locationId,
        assignedContactId: changes.assignedContactId,
        assignedUserId: changes.assignedUserId,
        platinumDealerId: changes.platinumDealerId,
        dealerLocationId: changes.dealerLocationId,
        purchaseOrderId: changes.purchaseOrderId,
        containerId: changes.containerId,
        containerQty: changes.containerQty,
        notes: changes.notes,
      },
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to update allocation',
      };
    }

    // Warehouse changed after a pick ticket was made: the old pick ticket no
    // longer has this item, so make the pick ticket at the new warehouse
    const message = result.removedFromPickTickets?.length
      ? await createPickTicketAfterWarehouseMove(result.data, result.removedFromPickTickets)
      : undefined;

    return {
      success: true,
      data: result.data,
      message,
    };
  } catch (error) {
    console.error('Error in updateAllocationAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * After an allocation moved to another warehouse, create its pick ticket there
 * (same call the Confirm Allocations modal makes) and describe what changed.
 */
async function createPickTicketAfterWarehouseMove(
  allocation: FulfillmentAllocation,
  oldPickTickets: string[]
): Promise<string> {
  const removed = `Removed from pick ticket ${oldPickTickets.join(', ')}.`;
  const { db } = await import('@/shared/lib/supabase/database');
  const { data: item } = await db
    .from('sales_order_items')
    .select('sales_order_id')
    .eq('id', allocation.salesOrderItemId)
    .single();

  if (!item?.sales_order_id || !allocation.locationId) {
    return `${removed} Create the pick ticket for the new warehouse from Pick Tickets.`;
  }

  const { createPickTicketFromSalesOrder } = await import('@/features/pick-tickets/actions');
  const contactId = allocation.assignedContactId || undefined;
  const pt = await createPickTicketFromSalesOrder(
    item.sales_order_id,
    allocation.locationId,
    contactId ? [contactId] : undefined,
    allocation.notes || undefined,
    undefined, // assignedToId - warehouse contacts live in location_contacts
    true, // skipStatusCheck - the order is already confirmed
    true, // useAllocatedQuantities
    contactId,
    [allocation.id]
  );

  if (pt.success && pt.data) {
    return `${removed} New pick ticket ${pt.data.pickTicketNumber} created for the new warehouse.`;
  }
  return `${removed} The new pick ticket could not be created (${pt.error || 'unknown error'}); please create it from Pick Tickets.`;
}

// ============================================
// SELL A PURCHASE ORDER (PO → SALES ORDER)
// ============================================

export interface SellablePurchaseOrderLine {
  salesOrderId: string;
  salesOrderItemId: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string | null;
  customerPoNumber: string | null;
  productId: string;
  sku: string;
  orderQty: number;
  /** Customer quantity not allocated to any source yet */
  remaining: number;
}

export interface SellablePurchaseOrder {
  purchaseOrderId: string;
  poNumber: string;
  /** Tires ordered on the PO per product (the container quantity) */
  containerQtyByProduct: Record<string, number>;
  /** Tires on the PO per product not sold to any customer order yet */
  availableByProduct: Record<string, number>;
  lines: SellablePurchaseOrderLine[];
}

/**
 * Older POs could reach "confirmed" without the supplier shipment that PO
 * confirmation normally creates, and a PO without a shipment cannot be sold.
 * Creates that shipment the same way confirmation does (no-op if one exists).
 */
async function ensureSupplierShipment(purchaseOrderId: string): Promise<void> {
  const { db } = await import('@/shared/lib/supabase/database');
  const [{ data: po }, { count: shipments }] = await Promise.all([
    db.from('purchase_orders').select('status, deleted_at').eq('id', purchaseOrderId).maybeSingle(),
    db.from('shipments').select('id', { count: 'exact', head: true }).eq('purchase_order_id', purchaseOrderId),
  ]);
  if (!po || po.deleted_at || ['draft', 'sent', 'cancelled'].includes(po.status) || (shipments ?? 0) > 0) {
    return;
  }
  try {
    const user = await getCurrentUser();
    const { purchaseOrderService } = await import('@/features/purchase-orders/services/purchase-order.service');
    await purchaseOrderService.createSupplierShipment(purchaseOrderId, user?.id);
  } catch (error) {
    console.error('[ensureSupplierShipment] Could not create shipment:', error);
  }
}

/** The specific reason a PO is not offered for sale (same rules as getUnallocatedPurchaseOrders) */
async function whyPurchaseOrderNotSellable(purchaseOrderId: string): Promise<string> {
  const { db } = await import('@/shared/lib/supabase/database');
  const [{ data: po }, { count: shipments }, { data: allocations }, { count: received }] = await Promise.all([
    db
      .from('purchase_orders')
      .select('status, deleted_at, sales_order_id, sales_orders:sales_order_id (order_number), locations:warehouse_id (location_type)')
      .eq('id', purchaseOrderId)
      .maybeSingle(),
    db.from('shipments').select('id', { count: 'exact', head: true }).eq('purchase_order_id', purchaseOrderId),
    db
      .from('fulfillment_allocations')
      .select('id, sales_order_items (sales_orders (order_number))')
      .eq('purchase_order_id', purchaseOrderId)
      .neq('status', 'cancelled')
      .limit(1),
    db
      .from('purchase_order_items')
      .select('id', { count: 'exact', head: true })
      .eq('purchase_order_id', purchaseOrderId)
      .gt('quantity_received', 0),
  ]);

  if (!po || po.deleted_at) {
    return 'Purchase order not found.';
  }
  if (po.status === 'cancelled') {
    return 'This purchase order is cancelled.';
  }
  const linked = (po.sales_orders as { order_number?: string } | null)?.order_number;
  const { getPurchaseOrderSoldStates } = await import('@/features/purchase-orders/services/po-sold-state.service');
  const soldState = (await getPurchaseOrderSoldStates([purchaseOrderId])).get(purchaseOrderId);
  if (soldState?.fullySold) {
    return allocations && allocations.length > 0 && soldState.orderedQty > 0
      ? 'All tires on this purchase order are already sold to customer orders.'
      : `This purchase order is already sold${linked ? ` to ${linked}` : ''}.`;
  }
  if (po.sales_order_id && !(allocations && allocations.length > 0)) {
    return `This purchase order is already sold${linked ? ` to ${linked}` : ''}.`;
  }
  if ((received ?? 0) > 0) {
    return 'Tires from this purchase order are already received into stock; sell them from GDC Inventory on the sales order instead.';
  }
  if ((shipments ?? 0) === 0) {
    return 'This purchase order has no shipment yet. It gets one when the supplier confirms it (status Confirmed).';
  }
  if ((po.locations as { location_type?: string } | null)?.location_type !== 'warehouse') {
    return 'Set a warehouse on this purchase order (GDC Inventory, Kansas or Nebraska) first.';
  }
  return 'This purchase order cannot be sold right now.';
}

/**
 * Sales order lines a purchase order (container) can be sold to before it
 * arrives (Ankur, Nov 4 2026). The PO must be one the Add Allocation dialog
 * offers (shipment, not sold, nothing received); the lines are open orders for
 * the same tires that still have quantity to allocate.
 */
export async function getSellablePurchaseOrderLines(
  purchaseOrderId: string
): Promise<ActionResult<SellablePurchaseOrder>> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  try {
    await ensureSupplierShipment(purchaseOrderId);
    const { getUnallocatedPurchaseOrders } = await import('@/features/purchase-orders/actions');
    const available = await getUnallocatedPurchaseOrders();
    if (!available.success) {
      return { success: false, error: available.error || 'Could not check the purchase order' };
    }
    const po = (available.data || []).find((p: { id: string }) => p.id === purchaseOrderId) as
      | { id: string; po_number: string }
      | undefined;
    const { db } = await import('@/shared/lib/supabase/database');
    if (!po) {
      return { success: false, error: await whyPurchaseOrderNotSellable(purchaseOrderId) };
    }
    const { data: poItems, error: poItemsError } = await db
      .from('purchase_order_items')
      .select('product_id, quantity_ordered')
      .eq('purchase_order_id', purchaseOrderId);
    if (poItemsError) {
      return { success: false, error: poItemsError.message };
    }
    const containerQtyByProduct: Record<string, number> = {};
    for (const item of poItems || []) {
      if (item.product_id) {
        containerQtyByProduct[item.product_id] = (containerQtyByProduct[item.product_id] || 0) + Number(item.quantity_ordered || 0);
      }
    }
    // A PO can be sold to several orders: only its tires not sold yet are offered
    const { getPurchaseOrderSoldStates } = await import('@/features/purchase-orders/services/po-sold-state.service');
    const soldState = (await getPurchaseOrderSoldStates([purchaseOrderId])).get(purchaseOrderId);
    const availableByProduct: Record<string, number> = {};
    for (const productId of Object.keys(containerQtyByProduct)) {
      availableByProduct[productId] = soldState?.availableByProduct.get(productId) ?? containerQtyByProduct[productId] ?? 0;
    }

    const productIds = Object.keys(containerQtyByProduct).filter((productId) => (availableByProduct[productId] || 0) > 0);
    if (productIds.length === 0) {
      return { success: true, data: { purchaseOrderId, poNumber: po.po_number, containerQtyByProduct, availableByProduct, lines: [] } };
    }

    // Open orders (not shipped / delivered / cancelled) for the same tires
    const { data: soItems, error: soError } = await db
      .from('sales_order_items')
      .select('id, product_id, sku, quantity, customer_qty, sales_orders!inner (id, order_number, status, customer_po_number, deleted_at, customers (name))')
      .in('product_id', productIds)
      .in('sales_orders.status', ['draft', 'pending', 'confirmed', 'processing'])
      // Customer orders only (C-SO...). Internal shipment orders (SO26000xx)
      // already belong to their own container and must not be offered here.
      .like('sales_orders.order_number', 'C-SO%')
      .is('sales_orders.deleted_at', null);
    if (soError) {
      return { success: false, error: soError.message };
    }

    const itemIds = (soItems || []).map((i) => i.id);
    const allocatedByItem = new Map<string, number>();
    if (itemIds.length > 0) {
      const { data: allocations } = await db
        .from('fulfillment_allocations')
        .select('sales_order_item_id, quantity')
        .in('sales_order_item_id', itemIds)
        .neq('status', 'cancelled');
      for (const a of allocations || []) {
        allocatedByItem.set(a.sales_order_item_id, (allocatedByItem.get(a.sales_order_item_id) || 0) + Number(a.quantity || 0));
      }
    }

    const lines: SellablePurchaseOrderLine[] = [];
    for (const item of (soItems || []) as Array<Record<string, unknown>>) {
      const so = (Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders) as
        | { id: string; order_number: string; status: string; customer_po_number: string | null; customers: { name: string } | { name: string }[] | null }
        | null;
      if (!so) {
        continue;
      }
      const customer = Array.isArray(so.customers) ? so.customers[0] : so.customers;
      // Allocations must add up to the customer quantity (checked on confirm)
      const orderQty = Number(item.customer_qty ?? item.quantity ?? 0);
      const remaining = orderQty - (allocatedByItem.get(String(item.id)) || 0);
      if (remaining <= 0) {
        continue;
      }
      lines.push({
        salesOrderId: so.id,
        salesOrderItemId: String(item.id),
        orderNumber: so.order_number,
        orderStatus: so.status,
        customerName: customer?.name ?? null,
        customerPoNumber: so.customer_po_number,
        productId: String(item.product_id),
        sku: String(item.sku ?? ''),
        orderQty,
        remaining,
      });
    }
    lines.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber));

    return { success: true, data: { purchaseOrderId, poNumber: po.po_number, containerQtyByProduct, availableByProduct, lines } };
  } catch (error) {
    console.error('Error in getSellablePurchaseOrderLines:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ============================================
// CANCEL ALLOCATION
// ============================================

/**
 * Cancel/delete an allocation and deallocate inventory
 *
 * @example
 * const result = await cancelAllocationAction('allocation-123');
 */
export async function cancelAllocationAction(
  allocationId: string
): Promise<ActionResult> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.write);
  if (denied) {
    return denied;
  }
  try {
    // Get allocation first to get productId
    const { getAllocationById } = await import(
      '@/features/sales-orders/repositories/fulfillment-allocations.repository'
    );

    const { data: allocation, error: fetchError } =
      await getAllocationById(allocationId);

    if (fetchError || !allocation) {
      return {
        success: false,
        error: fetchError?.message || 'Allocation not found',
      };
    }

    // Get product ID from sales order item using direct database query
    const { db } = await import('@/shared/lib/supabase/database');

    const { data: item, error: itemError } = await db
      .from('sales_order_items')
      .select('product_id')
      .eq('id', allocation.salesOrderItemId)
      .single();

    if (itemError || !item) {
      return {
        success: false,
        error: itemError?.message || 'Sales order item not found',
      };
    }

    // Call orchestration service to cancel
    const result = await cancelAllocation({
      allocationId,
      productId: item.product_id,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to cancel allocation',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error in cancelAllocationAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// MARK FULFILLED
// ============================================

/**
 * Mark allocation as fulfilled (shipped)
 *
 * @example
 * const result = await markAllocationFulfilledAction('allocation-123');
 */
export async function markAllocationFulfilledAction(
  allocationId: string
): Promise<ActionResult<FulfillmentAllocation>> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.write);
  if (denied) {
    return denied;
  }
  try {
    // Get allocation first to get productId
    const { getAllocationById } = await import(
      '@/features/sales-orders/repositories/fulfillment-allocations.repository'
    );

    const { data: allocation, error: fetchError } =
      await getAllocationById(allocationId);

    if (fetchError || !allocation) {
      return {
        success: false,
        error: fetchError?.message || 'Allocation not found',
      };
    }

    // Get product ID from sales order item using direct database query
    const { db } = await import('@/shared/lib/supabase/database');

    const { data: item, error: itemError } = await db
      .from('sales_order_items')
      .select('product_id')
      .eq('id', allocation.salesOrderItemId)
      .single();

    if (itemError || !item) {
      return {
        success: false,
        error: itemError?.message || 'Sales order item not found',
      };
    }

    // Call orchestration service
    const result = await markAllocationFulfilled({
      allocationId,
      productId: item.product_id,
    });

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to mark allocation as fulfilled',
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('Error in markAllocationFulfilledAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// QUERY ALLOCATIONS
// ============================================

/**
 * Get all allocations for a sales order item
 *
 * @example
 * const result = await getAllocationsForItemAction('item-123');
 * console.log('Total allocated:', result.data?.totalAllocated);
 * console.log('Remaining:', result.data?.remainingToAllocate);
 */
export async function getAllocationsForItemAction(
  salesOrderItemId: string
): Promise<
  ActionResult<{
    allocations: FulfillmentAllocation[];
    totalAllocated: number;
    customerQty: number;
    remainingToAllocate: number;
    fullyAllocated: boolean;
  }>
> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  try {
    const result = await getAllocationsForItem(salesOrderItemId);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error in getAllocationsForItemAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// SMART SUGGESTIONS
// ============================================

/**
 * Get smart allocation suggestions based on inventory availability
 *
 * @example
 * const result = await suggestAllocationsAction({
 *   salesOrderItemId: 'item-123',
 *   productId: 'product-456',
 *   customerQty: 150,
 * });
 *
 * if (result.success && result.data) {
 *   console.log('Suggestions:', result.data.suggestions);
 *   console.log('Can fully allocate:', result.data.fullyAllocated);
 * }
 */
export async function suggestAllocationsAction(params: {
  salesOrderItemId: string;
  productId: string;
  customerQty: number;
}): Promise<ActionResult<AllocationSuggestion>> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  try {
    const result = await suggestOptimalAllocation(params);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error in suggestAllocationsAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate if all items in a sales order are fully allocated
 *
 * Checks each item to ensure:
 * - Total allocated quantity >= Customer quantity
 * - No remaining quantity (fully allocated)
 *
 * Returns list of items with remaining quantities if any exist.
 *
 * @param salesOrderId - ID of the sales order to validate
 * @returns Validation result with list of unallocated items
 */
export async function validateOrderFullyAllocatedAction(
  salesOrderId: string
): Promise<
  ActionResult<{
    fullyAllocated: boolean;
    unallocatedItems: Array<{
      itemId: string;
      sku: string;
      productName: string;
      customerQty: number;
      totalAllocated: number;
      remainingQty: number;
    }>;
  }>
> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  try {
    // Get order with items
    const { getSalesOrder } = await import('@/features/sales-orders/actions');
    const orderResult = await getSalesOrder(salesOrderId);

    if (!orderResult.success || !orderResult.data) {
      return {
        success: false,
        error: 'Failed to load sales order',
      };
    }

    const order = orderResult.data;
    const unallocatedItems: Array<{
      itemId: string;
      sku: string;
      productName: string;
      customerQty: number;
      totalAllocated: number;
      remainingQty: number;
    }> = [];

    // Check each item
    for (const item of order.items) {
      // Skip service and non-inventory items (they don't need allocation)
      if (item.itemType === 'service' || item.itemType === 'non_inventory') {
        continue;
      }

      const allocationResult = await getAllocationsForItem(item.id);

      if (!allocationResult.fullyAllocated) {
        unallocatedItems.push({
          itemId: item.id,
          sku: item.sku,
          productName: item.description || item.sku,
          customerQty: allocationResult.customerQty,
          totalAllocated: allocationResult.totalAllocated,
          remainingQty: allocationResult.remainingToAllocate,
        });
      }
    }

    return {
      success: true,
      data: {
        fullyAllocated: unallocatedItems.length === 0,
        unallocatedItems,
      },
    };
  } catch (error) {
    console.error('Error in validateOrderFullyAllocatedAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// ORDER SERIES VALIDATION
// ============================================

/**
 * Check if Order Series is required for this sales order
 *
 * Rules:
 * - If ALL allocations are "direct" (Manufacturer) → Order Series NOT required
 * - If ANY allocation is non-direct (gdc_inventory, platinum_dealer_inventory, platinum_dealer_fulfillment) → Order Series IS required
 *
 * Reason: GDC inventory cycles need tracking, but direct manufacturer shipments don't
 */
export async function checkOrderSeriesRequiredAction(
  salesOrderId: string
): Promise<
  ActionResult<{
    required: boolean;
    hasNonDirectAllocations: boolean;
    nonDirectSources: string[];
  }>
> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  try {
    // Get order with items
    const { getSalesOrder } = await import('@/features/sales-orders/actions');
    const orderResult = await getSalesOrder(salesOrderId);

    if (!orderResult.success || !orderResult.data) {
      return {
        success: false,
        error: 'Failed to load sales order',
      };
    }

    const order = orderResult.data;
    const nonDirectSources: string[] = [];

    // Check each item's allocations
    for (const item of order.items) {
      // Skip service and non-inventory items
      if (item.itemType === 'service' || item.itemType === 'non_inventory') {
        continue;
      }

      // Get allocations for this item
      const allocationResult = await getAllocationsForItem(item.id);

      if (allocationResult.allocations) {
        for (const allocation of allocationResult.allocations) {
          // Check if allocation is non-direct (not manufacturer)
          if (allocation.fulfillmentSource !== 'direct') {
            if (!nonDirectSources.includes(allocation.fulfillmentSource)) {
              nonDirectSources.push(allocation.fulfillmentSource);
            }
          }
        }
      }
    }

    const hasNonDirectAllocations = nonDirectSources.length > 0;

    return {
      success: true,
      data: {
        required: hasNonDirectAllocations,
        hasNonDirectAllocations,
        nonDirectSources,
      },
    };
  } catch (error) {
    console.error('Error in checkOrderSeriesRequiredAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// UPDATE ALLOCATION STATUS
// ============================================

/**
 * Update allocation status
 * Used when resources (PO, Pick Ticket) are created for an allocation
 */
export async function updateAllocationStatus(
  allocationId: string,
  status: 'pending' | 'allocated' | 'fulfilled' | 'cancelled'
): Promise<ActionResult<FulfillmentAllocation | null>> {
  const denied = await denyUnless(ALLOCATION_PERMISSIONS.write);
  if (denied) {
    return denied;
  }
  try {
    const { updateAllocation, getAllocationById } = await import(
      '@/features/sales-orders/repositories/fulfillment-allocations.repository'
    );

    // A cancelled allocation already released its stock; reviving it here
    // would mark it allocated without reserving any inventory
    const { data: current } = await getAllocationById(allocationId);
    if (current?.status === 'cancelled' && status !== 'cancelled') {
      return {
        success: false,
        error: 'This allocation was cancelled. Add a new allocation instead.',
      };
    }

    const result = await updateAllocation({
      id: allocationId,
      status,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    console.error('Error updating allocation status:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update allocation status',
    };
  }
}
