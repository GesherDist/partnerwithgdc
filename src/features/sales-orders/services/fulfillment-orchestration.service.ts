/**
 * Fulfillment Orchestration Service
 *
 * Orchestrates allocation management - create, update, cancel, fulfill.
 * Coordinates between validation service, repositories, and inventory updates.
 */

import type { FulfillmentAllocation, FulfillmentSource } from '../types';
import {
  createAllocation,
  createBatchAllocations,
  updateAllocation,
  deleteAllocation,
  getAllocationById,
} from '../repositories/fulfillment-allocations.repository';
import {
  allocateInventory,
  deallocateInventory,
} from '@/features/platinum-dealers/repositories/platinum-dealers.repository';
import {
  validateAllocationRequest,
  validateMultiSourceAllocation,
  checkPurchaseOrderCapacity,
  type MultiSourceAllocationRequest,
} from './allocation-validation.service';
import { db } from '@/shared/lib/supabase/database';
import { productCycleCostRepository } from '@/features/products/repositories/product-cycle-cost.repository';
import {
  logInventoryMovement,
  logDealerInventoryMovement,
} from '@/features/inventory/services/inventory-movement.service';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface CreateAllocationParams {
  salesOrderItemId: string;
  fulfillmentSource: FulfillmentSource;
  quantity: number;
  productId: string;

  // Conditional fields
  locationId?: string;
  assignedContactId?: string;
  platinumDealerId?: string;
  dealerLocationId?: string;
  containerQty?: number;
  containerId?: string;
  purchaseOrderId?: string;
  notes?: string;
  createdBy?: string;
}

export interface CreateMultiSourceAllocationParams {
  salesOrderItemId: string;
  customerQty: number;
  productId: string;
  allocations: Omit<CreateAllocationParams, 'salesOrderItemId' | 'productId'>[];
  createdBy?: string;
}

export interface UpdateAllocationQuantityParams {
  allocationId: string;
  newQuantity: number;
  productId: string;
}

export interface AllocationResult {
  success: boolean;
  data?: FulfillmentAllocation;
  error?: string;
  /** Pick ticket numbers this item was taken off after a warehouse change */
  removedFromPickTickets?: string[];
}

export interface BatchAllocationResult {
  success: boolean;
  data?: FulfillmentAllocation[];
  error?: string;
  partialSuccess?: {
    succeeded: number;
    failed: number;
    allocations: FulfillmentAllocation[];
  };
}

// ============================================
// LINE COST (sales_order_items.unit_cost)
// ============================================

/**
 * The sales order line's cost is set once, by its first fulfillment
 * allocation, and is not changed by later allocations:
 * - Manufacturer (direct): the linked PO's order cycle cost (else the base cost)
 * - GDC inventory / Platinum dealer: the sales order's order cycle cost (else
 *   the base cost); these sources need an order series on the sales order
 */
type LineCostPlan =
  | { ok: false; error: string }
  | { ok: true; unitCost: number | null };

async function planLineCost(
  salesOrderItemId: string,
  productId: string,
  allocations: Array<{ fulfillmentSource: FulfillmentSource; purchaseOrderId?: string }>
): Promise<LineCostPlan> {
  const { data: item, error } = await db
    .from('sales_order_items')
    .select('unit_cost, sales_orders(order_series)')
    .eq('id', salesOrderItemId)
    .single();

  if (error || !item) {
    return { ok: false, error: 'Sales order item not found' };
  }

  const order = (Array.isArray(item.sales_orders) ? item.sales_orders[0] : item.sales_orders) as
    | { order_series: string | null }
    | null;
  const orderSeries = order?.order_series || null;

  if (!orderSeries && allocations.some((a) => a.fulfillmentSource !== 'direct')) {
    return {
      ok: false,
      error: 'Select an Order Series on the sales order before allocating from GDC Inventory or a Platinum Dealer',
    };
  }

  // Already set by an earlier allocation
  if (item.unit_cost !== null && item.unit_cost !== undefined) {
    return { ok: true, unitCost: null };
  }

  const first = allocations[0];
  if (!first) {
    return { ok: true, unitCost: null };
  }

  // PO line prices are not used: imported customer loads carry the customer's sale price
  if (first.fulfillmentSource === 'direct' && first.purchaseOrderId) {
    const { data: po } = await db
      .from('purchase_orders')
      .select('order_series')
      .eq('id', first.purchaseOrderId)
      .single();
    const costs = await productCycleCostRepository.unitCostsFor([productId], po?.order_series || null);
    return { ok: true, unitCost: costs.get(productId) ?? null };
  }

  const costs = await productCycleCostRepository.unitCostsFor([productId], orderSeries);
  return { ok: true, unitCost: costs.get(productId) ?? null };
}

/**
 * Save the planned cost on the line unless another allocation set it first.
 * No cost (0, e.g. a product without a base cost) is not saved, so a later
 * allocation can still set it.
 */
async function saveLineCost(salesOrderItemId: string, unitCost: number | null): Promise<void> {
  if (unitCost === null || unitCost <= 0) {
    return;
  }

  const { error } = await db
    .from('sales_order_items')
    .update({ unit_cost: unitCost, updated_at: new Date().toISOString() })
    .eq('id', salesOrderItemId)
    .is('unit_cost', null);

  if (error) {
    // The allocation stands; margin falls back to the order cycle cost
    console.error('Failed to save sales order line cost:', error);
  }
}

/**
 * Same rules when an existing allocation's source is changed: GDC Inventory
 * and Platinum Dealer need an order series on the sales order, and a line
 * without a saved cost gets it from the changed allocation. A saved cost is
 * not changed. Returns a function that saves the cost once the update succeeds.
 */
export async function checkAllocationSourceChange(
  allocationId: string,
  productId: string,
  change: { fulfillmentSource?: FulfillmentSource; purchaseOrderId?: string }
): Promise<{ ok: false; error: string } | { ok: true; saveCost: () => Promise<void> }> {
  const { data: allocation, error } = await db
    .from('fulfillment_allocations')
    .select('sales_order_item_id, fulfillment_source, purchase_order_id')
    .eq('id', allocationId)
    .single();

  if (error || !allocation) {
    return { ok: false, error: 'Allocation not found' };
  }

  const fulfillmentSource = change.fulfillmentSource ?? (allocation.fulfillment_source as FulfillmentSource);
  const purchaseOrderId = change.purchaseOrderId ?? allocation.purchase_order_id ?? undefined;
  if (fulfillmentSource === allocation.fulfillment_source) {
    // Same source: nothing to check, and a saved cost is never changed
    return { ok: true, saveCost: async () => {} };
  }
  const plan = await planLineCost(allocation.sales_order_item_id, productId, [{ fulfillmentSource, purchaseOrderId }]);
  if (!plan.ok) {
    return { ok: false, error: plan.error };
  }

  return { ok: true, saveCost: () => saveLineCost(allocation.sales_order_item_id, plan.unitCost) };
}

// ============================================
// ALLOCATION CREATION
// ============================================

/**
 * Create a single fulfillment allocation
 *
 * Steps:
 * 1. Validate request
 * 2. Check inventory availability
 * 3. Create allocation in DB
 * 4. Update inventory (allocate)
 */
export async function createSingleAllocation(
  params: CreateAllocationParams
): Promise<AllocationResult> {
  try {
    // Step 1: Validate request
    const validation = await validateAllocationRequest({
      salesOrderItemId: params.salesOrderItemId,
      fulfillmentSource: params.fulfillmentSource,
      quantity: params.quantity,
      productId: params.productId,
      locationId: params.locationId,
      platinumDealerId: params.platinumDealerId,
      dealerLocationId: params.dealerLocationId,
      containerQty: params.containerQty,
      purchaseOrderId: params.fulfillmentSource === 'direct' ? params.purchaseOrderId : undefined,
    });

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Validation failed',
      };
    }

    const costPlan = await planLineCost(params.salesOrderItemId, params.productId, [params]);
    if (!costPlan.ok) {
      return { success: false, error: costPlan.error };
    }

    // Step 2: Create allocation in database
    // Auto-set status to 'allocated' if PO is already linked (manufacturer direct)
    const autoAllocatedStatus =
      params.fulfillmentSource === 'direct' && params.purchaseOrderId
        ? 'allocated'
        : 'pending';

    const { data: allocation, error: createError } = await createAllocation({
      salesOrderItemId: params.salesOrderItemId,
      fulfillmentSource: params.fulfillmentSource,
      quantity: params.quantity,
      status: autoAllocatedStatus, // Auto-allocated if PO already linked
      locationId: params.locationId || null,
      assignedContactId: params.assignedContactId || null,
      assignedUserId: null, // Not needed - we use assignedContactId for warehouse contacts
      platinumDealerId: params.platinumDealerId || null,
      dealerLocationId: params.dealerLocationId || null,
      purchaseOrderId: params.purchaseOrderId || null,
      containerId: params.containerId || null,
      containerQty: params.containerQty || 0,
      containerRemaining: params.containerQty
        ? params.containerQty - params.quantity
        : 0,
      notes: params.notes || null,
      createdBy: params.createdBy || null,
    });

    if (createError || !allocation) {
      return {
        success: false,
        error: createError?.message || 'Failed to create allocation',
      };
    }

    // Step 2.5: If PO is linked, update PO's sales_order_id to link it to this SO
    if (params.purchaseOrderId && params.fulfillmentSource === 'direct') {
      try {
        // Get sales_order_id from sales_order_item_id
        const { data: soItem } = await db
          .from('sales_order_items')
          .select('sales_order_id')
          .eq('id', params.salesOrderItemId)
          .single();

        if (soItem?.sales_order_id) {
          // Update PO to link it to this SO. A PO sold to several orders keeps
          // its first order; the others are found through the allocations.
          await db
            .from('purchase_orders')
            .update({ sales_order_id: soItem.sales_order_id })
            .eq('id', params.purchaseOrderId)
            .is('sales_order_id', null);

          console.log(`✅ Linked PO ${params.purchaseOrderId} to SO ${soItem.sales_order_id}`);
        }
      } catch (error) {
        console.error('Failed to link PO to SO:', error);
        // Don't fail the whole operation, just log the error
      }
    }

    // Step 3: Update inventory (allocate)
    const inventoryResult = await allocateInventoryForAllocation({
      fulfillmentSource: params.fulfillmentSource,
      quantity: params.quantity,
      productId: params.productId,
      locationId: params.locationId,
      dealerLocationId: params.dealerLocationId,
    });

    if (!inventoryResult.success) {
      // Rollback: Delete allocation if inventory update fails
      await deleteAllocation(allocation.id);
      return {
        success: false,
        error: inventoryResult.error || 'Failed to allocate inventory',
      };
    }

    await saveLineCost(params.salesOrderItemId, costPlan.unitCost);

    return {
      success: true,
      data: allocation,
    };
  } catch (error) {
    console.error('Error creating single allocation:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error creating allocation',
    };
  }
}

/**
 * Create multiple allocations for a single sales order item
 *
 * Steps:
 * 1. Validate all allocations
 * 2. Create all allocations in DB (batch)
 * 3. Update all inventories (transaction-like)
 */
export async function createMultiSourceAllocation(
  params: CreateMultiSourceAllocationParams
): Promise<BatchAllocationResult> {
  try {
    // Step 1: Validate all allocations
    const validationRequest: MultiSourceAllocationRequest = {
      salesOrderItemId: params.salesOrderItemId,
      customerQty: params.customerQty,
      allocations: params.allocations.map((a) => ({
        salesOrderItemId: params.salesOrderItemId,
        productId: params.productId,
        ...a,
      })),
    };

    const validation = await validateMultiSourceAllocation(validationRequest);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Validation failed',
      };
    }

    const costPlan = await planLineCost(params.salesOrderItemId, params.productId, params.allocations);
    if (!costPlan.ok) {
      return { success: false, error: costPlan.error };
    }

    // Step 2: Create all allocations
    const allocationData = params.allocations.map((a) => ({
      salesOrderItemId: params.salesOrderItemId,
      fulfillmentSource: a.fulfillmentSource,
      quantity: a.quantity,
      locationId: a.locationId || null,
      assignedContactId: a.assignedContactId || null,
      assignedUserId: null, // Not needed - we use assignedContactId for warehouse contacts
      platinumDealerId: a.platinumDealerId || null,
      dealerLocationId: a.dealerLocationId || null,
      purchaseOrderId: a.purchaseOrderId || null,
      containerId: a.containerId || null,
      containerQty: a.containerQty || 0,
      containerRemaining: a.containerQty ? a.containerQty - a.quantity : 0,
      notes: a.notes || null,
      createdBy: params.createdBy || null,
    }));

    // Create all allocations
    const { data: allocations, error: createError } =
      await createBatchAllocations(allocationData);

    if (createError || !allocations) {
      return {
        success: false,
        error: createError?.message || 'Failed to create allocations',
      };
    }

    // Step 3: Update all inventories
    const inventoryResults = await Promise.all(
      params.allocations.map((a) =>
        allocateInventoryForAllocation({
          fulfillmentSource: a.fulfillmentSource,
          quantity: a.quantity,
          productId: params.productId,
          locationId: a.locationId,
          dealerLocationId: a.dealerLocationId,
        })
      )
    );

    // Check if any inventory update failed
    const failedInventory = inventoryResults.find((r) => !r.success);
    if (failedInventory) {
      // Rollback: Delete all allocations
      await Promise.all(allocations.map((a) => deleteAllocation(a.id)));
      return {
        success: false,
        error: failedInventory.error || 'Failed to allocate inventory',
      };
    }

    await saveLineCost(params.salesOrderItemId, costPlan.unitCost);

    return {
      success: true,
      data: allocations,
    };
  } catch (error) {
    console.error('Error creating multi-source allocation:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error creating allocations',
    };
  }
}

// ============================================
// ALLOCATION UPDATE
// ============================================

/**
 * Update allocation quantity
 *
 * Steps:
 * 1. Get current allocation
 * 2. Validate new quantity
 * 3. Deallocate old quantity
 * 4. Allocate new quantity
 * 5. Update allocation in DB
 */
export async function updateAllocationQuantity(
  params: UpdateAllocationQuantityParams
): Promise<AllocationResult> {
  try {
    // Step 1: Get current allocation
    const { data: currentAllocation, error: fetchError } =
      await getAllocationById(params.allocationId);

    if (fetchError || !currentAllocation) {
      return {
        success: false,
        error: 'Allocation not found',
      };
    }
    // A cancelled allocation already released its stock (same rule as updateAllocationDetails)
    if (currentAllocation.status === 'cancelled') {
      return { success: false, error: 'This allocation was cancelled. Add a new allocation instead.' };
    }

    const oldQuantity = currentAllocation.quantity;

    // Step 2: Validate new quantity
    const validation = await validateAllocationRequest({
      salesOrderItemId: currentAllocation.salesOrderItemId,
      fulfillmentSource: currentAllocation.fulfillmentSource,
      quantity: params.newQuantity,
      productId: params.productId,
      locationId: currentAllocation.locationId || undefined,
      platinumDealerId: currentAllocation.platinumDealerId || undefined,
      dealerLocationId: currentAllocation.dealerLocationId || undefined,
      containerQty: currentAllocation.containerQty || undefined,
      // PO tires left: checked only when more tires are taken from the PO
      purchaseOrderId:
        currentAllocation.fulfillmentSource === 'direct' && params.newQuantity > oldQuantity
          ? currentAllocation.purchaseOrderId || undefined
          : undefined,
      excludeAllocationId: params.allocationId, // Exclude current allocation from over-allocation check
    });

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Validation failed',
      };
    }

    // Step 3: Deallocate old quantity
    const deallocateResult = await deallocateInventoryForAllocation({
      fulfillmentSource: currentAllocation.fulfillmentSource,
      quantity: oldQuantity,
      productId: params.productId,
      locationId: currentAllocation.locationId || undefined,
      dealerLocationId: currentAllocation.dealerLocationId || undefined,
    });

    if (!deallocateResult.success) {
      return {
        success: false,
        error: deallocateResult.error || 'Failed to deallocate old inventory',
      };
    }

    // Step 4: Allocate new quantity
    const allocateResult = await allocateInventoryForAllocation({
      fulfillmentSource: currentAllocation.fulfillmentSource,
      quantity: params.newQuantity,
      productId: params.productId,
      locationId: currentAllocation.locationId || undefined,
      dealerLocationId: currentAllocation.dealerLocationId || undefined,
    });

    if (!allocateResult.success) {
      // Rollback: Re-allocate old quantity
      await allocateInventoryForAllocation({
        fulfillmentSource: currentAllocation.fulfillmentSource,
        quantity: oldQuantity,
        productId: params.productId,
        locationId: currentAllocation.locationId || undefined,
        dealerLocationId: currentAllocation.dealerLocationId || undefined,
      });
      return {
        success: false,
        error: allocateResult.error || 'Failed to allocate new inventory',
      };
    }

    // Step 5: Update allocation in database
    const { data: updatedAllocation, error: updateError } =
      await updateAllocation({
        id: params.allocationId,
        quantity: params.newQuantity,
        containerRemaining: currentAllocation.containerQty
          ? currentAllocation.containerQty - params.newQuantity
          : 0,
      });

    if (updateError || !updatedAllocation) {
      // Rollback inventory changes
      await deallocateInventoryForAllocation({
        fulfillmentSource: currentAllocation.fulfillmentSource,
        quantity: params.newQuantity,
        productId: params.productId,
        locationId: currentAllocation.locationId || undefined,
        dealerLocationId: currentAllocation.dealerLocationId || undefined,
      });
      await allocateInventoryForAllocation({
        fulfillmentSource: currentAllocation.fulfillmentSource,
        quantity: oldQuantity,
        productId: params.productId,
        locationId: currentAllocation.locationId || undefined,
        dealerLocationId: currentAllocation.dealerLocationId || undefined,
      });

      return {
        success: false,
        error: updateError?.message || 'Failed to update allocation',
      };
    }

    return {
      success: true,
      data: updatedAllocation,
    };
  } catch (error) {
    console.error('Error updating allocation quantity:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error updating allocation',
    };
  }
}

export interface AllocationDetailsChanges {
  fulfillmentSource?: FulfillmentSource;
  quantity?: number;
  locationId?: string;
  assignedContactId?: string;
  assignedUserId?: string;
  platinumDealerId?: string;
  dealerLocationId?: string;
  purchaseOrderId?: string;
  containerId?: string;
  containerQty?: number;
  notes?: string;
}

/**
 * Save an edit of an allocation (Edit Allocation dialog): every changed field
 * in one update.
 *
 * - Source, quantity, GDC location or dealer location changes move the
 *   reserved inventory (release the old, reserve the new; rolled back on failure).
 * - A new source follows the create rules: only while pending, order series
 *   for GDC Inventory / Platinum Dealer, a PO for Manufacturer, the old
 *   source's fields are cleared, and a line without a saved cost gets it.
 * - Status is managed by the system and is not changed here.
 */
export async function updateAllocationDetails(params: {
  allocationId: string;
  productId: string;
  changes: AllocationDetailsChanges;
}): Promise<AllocationResult> {
  try {
    const { data: current, error: fetchError } = await getAllocationById(params.allocationId);
    if (fetchError || !current) {
      return { success: false, error: 'Allocation not found' };
    }
    // A cancelled allocation already released its stock; editing it would
    // reserve stock again for an allocation that stays cancelled (Nov 12 2026:
    // MWI C-SO2600038 reserved 48 x 38" this way)
    if (current.status === 'cancelled') {
      return { success: false, error: 'This allocation was cancelled. Add a new allocation instead.' };
    }

    const c = params.changes;
    const source = c.fulfillmentSource ?? current.fulfillmentSource;
    const isGdc = source === 'gdc_inventory';
    const isDealer = source === 'platinum_dealer_inventory' || source === 'platinum_dealer_fulfillment';
    const isDirect = source === 'direct';
    const next = {
      fulfillmentSource: source,
      quantity: c.quantity ?? current.quantity,
      locationId: isGdc ? (c.locationId ?? current.locationId) : null,
      assignedContactId: isGdc ? (c.assignedContactId ?? current.assignedContactId) : null,
      assignedUserId: isGdc ? (c.assignedUserId ?? current.assignedUserId) : null,
      platinumDealerId: isDealer ? (c.platinumDealerId ?? current.platinumDealerId) : null,
      // '' = "None (Dealer decides)" in the dialog
      dealerLocationId: isDealer ? (c.dealerLocationId === '' ? null : (c.dealerLocationId ?? current.dealerLocationId)) : null,
      purchaseOrderId: isDirect ? (c.purchaseOrderId ?? current.purchaseOrderId) : null,
      containerId: isDirect ? (c.containerId ?? current.containerId) : null,
      containerQty: isDirect ? (c.containerQty ?? current.containerQty) : 0,
      notes: c.notes ?? current.notes,
    };

    const sourceChanged = source !== current.fulfillmentSource;
    let saveCost: () => Promise<void> = async () => {};
    if (sourceChanged) {
      if (current.status !== 'pending') {
        return { success: false, error: 'Fulfillment source can only be changed while the allocation is pending' };
      }
      if (isDirect && !next.purchaseOrderId) {
        return { success: false, error: 'Please select a Purchase Order' };
      }
      const check = await checkAllocationSourceChange(params.allocationId, params.productId, {
        fulfillmentSource: source,
        purchaseOrderId: next.purchaseOrderId ?? undefined,
      });
      if (!check.ok) {
        return { success: false, error: check.error };
      }
      saveCost = check.saveCost;
    }

    // More tires taken from a PO (other PO, new direct source or a higher qty):
    // the PO may not be sold beyond what it carries
    const takesMoreFromPo =
      isDirect &&
      !!next.purchaseOrderId &&
      (sourceChanged || next.purchaseOrderId !== current.purchaseOrderId || next.quantity > current.quantity);
    if (takesMoreFromPo) {
      const capacity = await checkPurchaseOrderCapacity({
        purchaseOrderId: next.purchaseOrderId!,
        productId: params.productId,
        quantity: next.quantity,
        excludeAllocationId: params.allocationId,
      });
      if (!capacity.valid) {
        return { success: false, error: capacity.error || 'Not enough tires left on the purchase order' };
      }
    }

    const inventoryChanged =
      sourceChanged ||
      next.quantity !== current.quantity ||
      (isGdc && next.locationId !== current.locationId) ||
      (source === 'platinum_dealer_inventory' && next.dealerLocationId !== current.dealerLocationId);

    // GDC warehouse changed on an allocation that already has a pick ticket at
    // the old warehouse: allowed only while that pick ticket has not started
    // picking; its lines for this item are removed after the save
    const warehouseMoved =
      isGdc && !sourceChanged && !!current.locationId && !!next.locationId && next.locationId !== current.locationId;
    let oldPickTickets: Array<{ id: string; number: string }> = [];
    if (warehouseMoved) {
      const check = await findPickTicketsForWarehouseMove(current.salesOrderItemId, current.locationId!);
      if (!check.ok) {
        return { success: false, error: check.error };
      }
      oldPickTickets = check.pickTickets;
    }

    const oldReservation = {
      fulfillmentSource: current.fulfillmentSource,
      quantity: current.quantity,
      productId: params.productId,
      locationId: current.locationId || undefined,
      dealerLocationId: current.dealerLocationId || undefined,
    };
    const newReservation = {
      fulfillmentSource: next.fulfillmentSource,
      quantity: next.quantity,
      productId: params.productId,
      locationId: next.locationId || undefined,
      dealerLocationId: next.dealerLocationId || undefined,
    };

    if (inventoryChanged) {
      const validation = await validateAllocationRequest({
        salesOrderItemId: current.salesOrderItemId,
        fulfillmentSource: next.fulfillmentSource,
        quantity: next.quantity,
        productId: params.productId,
        locationId: next.locationId || undefined,
        platinumDealerId: next.platinumDealerId || undefined,
        dealerLocationId: next.dealerLocationId || undefined,
        containerQty: next.containerQty || undefined,
        excludeAllocationId: params.allocationId,
      });
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Validation failed' };
      }

      const released = await deallocateInventoryForAllocation(oldReservation);
      if (!released.success) {
        return { success: false, error: released.error || 'Failed to deallocate old inventory' };
      }
      // Roll back only what was actually released (older data may hold less)
      if (released.released !== undefined) {
        oldReservation.quantity = released.released;
      }
      const reserved = await allocateInventoryForAllocation(newReservation);
      if (!reserved.success) {
        if (oldReservation.quantity > 0) {
          await allocateInventoryForAllocation(oldReservation);
        }
        return { success: false, error: reserved.error || 'Failed to allocate new inventory' };
      }
    }

    const { data: updated, error: updateError } = await updateAllocation({
      id: params.allocationId,
      ...next,
      containerRemaining: isDirect && next.containerQty ? next.containerQty - next.quantity : 0,
      // Same status a new allocation of this source gets
      ...(sourceChanged ? { status: isDirect && next.purchaseOrderId ? 'allocated' : 'pending' } : {}),
    });

    if (updateError || !updated) {
      if (inventoryChanged) {
        await deallocateInventoryForAllocation(newReservation);
        if (oldReservation.quantity > 0) {
          await allocateInventoryForAllocation(oldReservation);
        }
      }
      return { success: false, error: updateError?.message || 'Failed to update allocation' };
    }

    if (sourceChanged) {
      await saveCost();
    }

    // The old warehouse's pick ticket no longer picks this item
    let removedFromPickTickets: string[] | undefined;
    if (oldPickTickets.length > 0) {
      removedFromPickTickets = await removeItemFromPickTickets(oldPickTickets, current.salesOrderItemId);
    }

    // The old PO is no longer used by this allocation (PO changed or source changed)
    if (current.purchaseOrderId && current.purchaseOrderId !== next.purchaseOrderId) {
      await unlinkPurchaseOrderIfUnused(current.purchaseOrderId, current.salesOrderItemId);
    }

    // As on create: a Manufacturer allocation links its PO to the sales order
    if (isDirect && next.purchaseOrderId && next.purchaseOrderId !== current.purchaseOrderId) {
      const { data: soItem } = await db
        .from('sales_order_items')
        .select('sales_order_id')
        .eq('id', current.salesOrderItemId)
        .single();
      if (soItem?.sales_order_id) {
        const { error: linkError } = await db
          .from('purchase_orders')
          .update({ sales_order_id: soItem.sales_order_id })
          .eq('id', next.purchaseOrderId)
          .is('sales_order_id', null);
        if (linkError) {
          console.error('Failed to link PO to SO:', linkError);
        }
      }
    }

    return { success: true, data: updated, removedFromPickTickets };
  } catch (error) {
    console.error('Error updating allocation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error updating allocation',
    };
  }
}

/**
 * A Manufacturer (direct) allocation links its PO to the sales order
 * (purchase_orders.sales_order_id). When the last active allocation of that PO
 * for that order goes away, the PO moves to another order it is still sold
 * to; with no order left it is unsold again and shows up for allocation.
 */
async function unlinkPurchaseOrderIfUnused(purchaseOrderId: string, salesOrderItemId: string): Promise<void> {
  const { data: soItem } = await db
    .from('sales_order_items')
    .select('sales_order_id')
    .eq('id', salesOrderItemId)
    .single();
  if (!soItem?.sales_order_id) {
    return;
  }

  const { data: remaining, error } = await db
    .from('fulfillment_allocations')
    .select('created_at, sales_order_items (sales_order_id)')
    .eq('purchase_order_id', purchaseOrderId)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });
  if (error) {
    return;
  }
  const remainingOrderIds = (remaining || [])
    .map((a) => {
      const item = (Array.isArray(a.sales_order_items) ? a.sales_order_items[0] : a.sales_order_items) as
        | { sales_order_id: string | null }
        | null;
      return item?.sales_order_id ?? null;
    })
    .filter((id): id is string => !!id);
  // This order still has tires on the PO
  if (remainingOrderIds.includes(soItem.sales_order_id)) {
    return;
  }
  // Older data: allocations left without an order, keep the link as before
  if ((remaining || []).length > 0 && remainingOrderIds.length === 0) {
    return;
  }

  const { error: unlinkError } = await db
    .from('purchase_orders')
    .update({ sales_order_id: remainingOrderIds[0] ?? null, updated_at: new Date().toISOString() })
    .eq('id', purchaseOrderId)
    .eq('sales_order_id', soItem.sales_order_id);
  if (unlinkError) {
    console.error('[unlinkPurchaseOrderIfUnused] Failed to unlink PO:', unlinkError);
  }
}

/** Pick ticket statuses where nothing has been picked yet */
const PICK_TICKET_NOT_STARTED = ['pending', 'assigned'];

/**
 * Open pick tickets at `warehouseId` that include this sales order item.
 * A warehouse change is refused once one of them has started picking (the
 * tires are already being pulled from that warehouse).
 */
async function findPickTicketsForWarehouseMove(
  salesOrderItemId: string,
  warehouseId: string
): Promise<{ ok: true; pickTickets: Array<{ id: string; number: string }> } | { ok: false; error: string }> {
  const { data, error } = await db
    .from('pick_ticket_items')
    .select('pick_ticket_id, pick_tickets!inner (id, pick_ticket_number, status, warehouse_id, deleted_at)')
    .eq('sales_order_item_id', salesOrderItemId)
    .eq('pick_tickets.warehouse_id', warehouseId)
    .is('pick_tickets.deleted_at', null)
    .neq('pick_tickets.status', 'cancelled');

  if (error) {
    return { ok: false, error: `Could not check pick tickets: ${error.message}` };
  }

  const tickets = new Map<string, { id: string; number: string; status: string }>();
  for (const row of (data ?? []) as Array<{ pick_tickets: unknown }>) {
    const pt = (Array.isArray(row.pick_tickets) ? row.pick_tickets[0] : row.pick_tickets) as
      | { id: string; pick_ticket_number: string; status: string }
      | null;
    if (pt) {
      tickets.set(pt.id, { id: pt.id, number: pt.pick_ticket_number, status: pt.status });
    }
  }

  const started = [...tickets.values()].filter((pt) => !PICK_TICKET_NOT_STARTED.includes(pt.status));
  if (started.length > 0) {
    const list = started.map((pt) => `${pt.number} (${pt.status})`).join(', ');
    return {
      ok: false,
      error: `The warehouse can't be changed: pick ticket ${list} at the current warehouse has already started.`,
    };
  }

  return { ok: true, pickTickets: [...tickets.values()].map(({ id, number }) => ({ id, number })) };
}

/**
 * Take a sales order item off pick tickets that have not started; a pick
 * ticket left with no items is cancelled. Returns the pick ticket numbers changed.
 */
async function removeItemFromPickTickets(
  pickTickets: Array<{ id: string; number: string }>,
  salesOrderItemId: string
): Promise<string[]> {
  const changed: string[] = [];
  for (const pt of pickTickets) {
    const { error: deleteError } = await db
      .from('pick_ticket_items')
      .delete()
      .eq('pick_ticket_id', pt.id)
      .eq('sales_order_item_id', salesOrderItemId);
    if (deleteError) {
      console.error(`[removeItemFromPickTickets] ${pt.number}:`, deleteError);
      continue;
    }
    changed.push(pt.number);

    const { count } = await db
      .from('pick_ticket_items')
      .select('id', { count: 'exact', head: true })
      .eq('pick_ticket_id', pt.id);
    if (count === 0) {
      const { error: cancelError } = await db
        .from('pick_tickets')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', pt.id)
        .in('status', PICK_TICKET_NOT_STARTED);
      if (cancelError) {
        console.error(`[removeItemFromPickTickets] cancel ${pt.number}:`, cancelError);
      }
    }
  }
  return changed;
}

// ============================================
// ORDER CANCELLATION
// ============================================

/**
 * Release every open allocation of a sales order that is being cancelled
 * (Nov 12 2026). Before, cancelling an order left its allocations
 * "allocated": warehouse and dealer stock stayed reserved and the PO stayed
 * sold to the cancelled order.
 *
 * Each open allocation (not cancelled, not fulfilled) releases its own
 * reservation (GDC warehouse or dealer location; Manufacturer and Dealer
 * Fulfillment reserve nothing), is marked cancelled (kept for history, like
 * the other cancelled allocations) and frees its PO when no other allocation
 * of the order uses it. A failure never blocks the cancel (cancelling always
 * worked before): it is returned in `warnings` so the user can check that
 * stock, and the allocation is still marked cancelled when its release
 * failed because nothing was reserved (older data).
 *
 * `itemIdsWithAllocations`: order lines that have any allocation row (any
 * status). Their stock is handled here, so the caller must not also release
 * it the old way (by the order's warehouse).
 */
export async function releaseAllocationsForCancelledOrder(salesOrderId: string): Promise<{
  success: boolean;
  error?: string;
  released: number;
  warnings: string[];
  itemIdsWithAllocations: Set<string>;
}> {
  const warnings: string[] = [];
  const itemIdsWithAllocations = new Set<string>();
  const { data, error } = await db
    .from('fulfillment_allocations')
    .select(
      'id, status, quantity, fulfillment_source, location_id, dealer_location_id, purchase_order_id, sales_order_item_id, sales_order_items!inner (sales_order_id, product_id)'
    )
    .eq('sales_order_items.sales_order_id', salesOrderId);
  if (error) {
    return { success: false, error: `Could not load the order's allocations: ${error.message}`, released: 0, warnings, itemIdsWithAllocations };
  }

  type Row = {
    id: string;
    status: string;
    quantity: number;
    fulfillment_source: FulfillmentSource;
    location_id: string | null;
    dealer_location_id: string | null;
    purchase_order_id: string | null;
    sales_order_item_id: string;
    sales_order_items: { product_id: string | null } | Array<{ product_id: string | null }> | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  rows.forEach((row) => itemIdsWithAllocations.add(row.sales_order_item_id));

  let released = 0;
  for (const row of rows) {
    if (row.status === 'cancelled' || row.status === 'fulfilled') {
      continue;
    }
    const item = Array.isArray(row.sales_order_items) ? row.sales_order_items[0] : row.sales_order_items;
    const productId = item?.product_id;
    if (!productId) {
      continue;
    }

    const release = await deallocateInventoryForAllocation({
      fulfillmentSource: row.fulfillment_source,
      quantity: row.quantity,
      productId,
      locationId: row.location_id || undefined,
      dealerLocationId: row.dealer_location_id || undefined,
    });
    if (!release.success) {
      // Usually older data with nothing reserved there; the allocation is
      // still cancelled below, and the user is told to check that stock
      warnings.push(`${row.quantity} tires: stock not released (${release.error || 'unknown error'})`);
    }

    const { error: statusError } = await updateAllocation({ id: row.id, status: 'cancelled' });
    if (statusError) {
      // Put the reservation back so stock and allocation stay in step
      if (release.success) {
        await allocateInventoryForAllocation({
          fulfillmentSource: row.fulfillment_source,
          quantity: release.released ?? row.quantity,
          productId,
          locationId: row.location_id || undefined,
          dealerLocationId: row.dealer_location_id || undefined,
        });
      }
      warnings.push(`${row.quantity} tires: allocation could not be cancelled (${statusError.message})`);
      continue;
    }

    if (row.fulfillment_source === 'direct' && row.purchase_order_id) {
      await unlinkPurchaseOrderIfUnused(row.purchase_order_id, row.sales_order_item_id);
    }
    released++;
  }

  return { success: true, released, warnings, itemIdsWithAllocations };
}

// ============================================
// ALLOCATION CANCELLATION
// ============================================

/**
 * Cancel allocation
 *
 * Steps:
 * 1. Get allocation
 * 2. Deallocate inventory
 * 3. Delete allocation
 */
export async function cancelAllocation(params: {
  allocationId: string;
  productId: string;
}): Promise<AllocationResult> {
  try {
    // Step 1: Get allocation
    const { data: allocation, error: fetchError } = await getAllocationById(
      params.allocationId
    );

    if (fetchError || !allocation) {
      return {
        success: false,
        error: 'Allocation not found',
      };
    }

    // Step 2: Deallocate inventory
    const deallocateResult = await deallocateInventoryForAllocation({
      fulfillmentSource: allocation.fulfillmentSource,
      quantity: allocation.quantity,
      productId: params.productId,
      locationId: allocation.locationId || undefined,
      dealerLocationId: allocation.dealerLocationId || undefined,
    });

    if (!deallocateResult.success) {
      return {
        success: false,
        error: deallocateResult.error || 'Failed to deallocate inventory',
      };
    }

    // Step 3: Delete allocation
    const { success: deleteSuccess, error: deleteError } =
      await deleteAllocation(params.allocationId);

    if (!deleteSuccess) {
      // Rollback: Re-allocate inventory
      await allocateInventoryForAllocation({
        fulfillmentSource: allocation.fulfillmentSource,
        quantity: allocation.quantity,
        productId: params.productId,
        locationId: allocation.locationId || undefined,
        dealerLocationId: allocation.dealerLocationId || undefined,
      });

      return {
        success: false,
        error: deleteError?.message || 'Failed to delete allocation',
      };
    }

    // The PO is free again once no allocation uses it
    if (allocation.fulfillmentSource === 'direct' && allocation.purchaseOrderId) {
      await unlinkPurchaseOrderIfUnused(allocation.purchaseOrderId, allocation.salesOrderItemId);
    }

    return {
      success: true,
      data: allocation,
    };
  } catch (error) {
    console.error('Error canceling allocation:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error canceling allocation',
    };
  }
}

// ============================================
// FULFILLMENT WORKFLOW
// ============================================

/**
 * Mark allocation as fulfilled (shipped)
 *
 * Steps:
 * 1. Update allocation status to 'fulfilled'
 * 2. Ship inventory (reduce on_hand, reduce allocated)
 */
export async function markAllocationFulfilled(params: {
  allocationId: string;
  productId: string;
}): Promise<AllocationResult> {
  try {
    // Step 1: Get allocation
    const { data: allocation, error: fetchError } = await getAllocationById(
      params.allocationId
    );

    if (fetchError || !allocation) {
      return {
        success: false,
        error: 'Allocation not found',
      };
    }

    // Step 2: Ship inventory
    const shipResult = await shipInventoryForAllocation({
      fulfillmentSource: allocation.fulfillmentSource,
      quantity: allocation.quantity,
      productId: params.productId,
      locationId: allocation.locationId || undefined,
      dealerLocationId: allocation.dealerLocationId || undefined,
    });

    if (!shipResult.success) {
      return {
        success: false,
        error: shipResult.error || 'Failed to ship inventory',
      };
    }

    // Step 3: Update allocation status
    const { data: updatedAllocation, error: updateError } =
      await updateAllocation({
        id: params.allocationId,
        status: 'fulfilled',
      });

    if (updateError || !updatedAllocation) {
      return {
        success: false,
        error: updateError?.message || 'Failed to update allocation status',
      };
    }

    return {
      success: true,
      data: updatedAllocation,
    };
  } catch (error) {
    console.error('Error marking allocation fulfilled:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error fulfilling allocation',
    };
  }
}

// ============================================
// INVENTORY OPERATIONS
// ============================================

/**
 * Allocate inventory for an allocation
 */
async function allocateInventoryForAllocation(params: {
  fulfillmentSource: FulfillmentSource;
  quantity: number;
  productId: string;
  locationId?: string;
  dealerLocationId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (params.fulfillmentSource === 'gdc_inventory') {
      if (!params.locationId) {
        return { success: false, error: 'Location ID required for GDC inventory' };
      }

      const supabase = db;
      const { data: inventory, error: fetchError } = await supabase
        .from('inventory')
        .select('on_hand, allocated')
        .eq('location_id', params.locationId)
        .eq('product_id', params.productId)
        .single();

      if (fetchError || !inventory) {
        return { success: false, error: 'Inventory not found' };
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ allocated: inventory.allocated + params.quantity })
        .eq('location_id', params.locationId)
        .eq('product_id', params.productId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Log inventory movement
      await logInventoryMovement({
        productId: params.productId,
        locationId: params.locationId,
        movementType: 'allocate',
        quantity: -params.quantity, // Negative = outbound/reserved
        referenceType: 'fulfillment_allocation',
        notes: `Reserved ${params.quantity} units for allocation`,
      });

      return { success: true };
    } else if (params.fulfillmentSource === 'platinum_dealer_inventory') {
      if (!params.dealerLocationId) {
        return {
          success: false,
          error: 'Dealer location ID required for dealer inventory',
        };
      }

      const { success, error } = await allocateInventory({
        dealerLocationId: params.dealerLocationId,
        productId: params.productId,
        quantity: params.quantity,
      });

      if (!success) {
        return { success: false, error: error?.message };
      }

      // Log dealer inventory movement
      await logDealerInventoryMovement({
        productId: params.productId,
        dealerLocationId: params.dealerLocationId,
        movementType: 'allocate',
        quantity: -params.quantity, // Negative = reserved
        referenceType: 'fulfillment_allocation',
        notes: `Reserved ${params.quantity} units from dealer inventory`,
      });

      return { success: true };
    }

    // For 'direct' and 'platinum_dealer_fulfillment', no inventory allocation needed
    return { success: true };
  } catch (error) {
    console.error('Error allocating inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Deallocate inventory for an allocation. `released` is how many GDC units
 * were actually freed (can be less than `quantity` for older data).
 */
async function deallocateInventoryForAllocation(params: {
  fulfillmentSource: FulfillmentSource;
  quantity: number;
  productId: string;
  locationId?: string;
  dealerLocationId?: string;
}): Promise<{ success: boolean; error?: string; released?: number }> {
  try {
    if (params.fulfillmentSource === 'gdc_inventory') {
      if (!params.locationId) {
        return { success: false, error: 'Location ID required for GDC inventory' };
      }

      const supabase = db;
      const { data: inventory, error: fetchError } = await supabase
        .from('inventory')
        .select('on_hand, allocated')
        .eq('location_id', params.locationId)
        .eq('product_id', params.productId)
        .single();

      if (fetchError || !inventory) {
        return { success: false, error: 'Inventory not found' };
      }

      // Release only what is actually reserved: an allocation saved without its
      // reservation (older data) must not push `allocated` below zero
      const released = Math.min(params.quantity, Math.max(0, inventory.allocated));
      if (released < params.quantity) {
        console.warn(
          `[deallocateInventoryForAllocation] Only ${released} of ${params.quantity} units were reserved at location ${params.locationId}`
        );
      }
      if (released === 0) {
        return { success: true, released: 0 };
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ allocated: inventory.allocated - released })
        .eq('location_id', params.locationId)
        .eq('product_id', params.productId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Log inventory movement
      await logInventoryMovement({
        productId: params.productId,
        locationId: params.locationId,
        movementType: 'deallocate',
        quantity: +released, // Positive = incoming/released
        referenceType: 'fulfillment_allocation',
        notes: `Released ${released} units - allocation cancelled/updated`,
      });

      return { success: true, released };
    } else if (params.fulfillmentSource === 'platinum_dealer_inventory') {
      if (!params.dealerLocationId) {
        return {
          success: false,
          error: 'Dealer location ID required for dealer inventory',
        };
      }

      const { success, error } = await deallocateInventory({
        dealerLocationId: params.dealerLocationId,
        productId: params.productId,
        quantity: params.quantity,
      });

      if (!success) {
        return { success: false, error: error?.message };
      }

      // Log dealer inventory movement
      await logDealerInventoryMovement({
        productId: params.productId,
        dealerLocationId: params.dealerLocationId,
        movementType: 'deallocate',
        quantity: +params.quantity, // Positive = released
        referenceType: 'fulfillment_allocation',
        notes: `Released ${params.quantity} units from dealer - allocation cancelled/updated`,
      });

      return { success: true };
    }

    // For 'direct' and 'platinum_dealer_fulfillment', no inventory deallocation needed
    return { success: true };
  } catch (error) {
    console.error('Error deallocating inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ship inventory (reduce on_hand and allocated)
 */
async function shipInventoryForAllocation(params: {
  fulfillmentSource: FulfillmentSource;
  quantity: number;
  productId: string;
  locationId?: string;
  dealerLocationId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (params.fulfillmentSource === 'gdc_inventory') {
      if (!params.locationId) {
        return { success: false, error: 'Location ID required for GDC inventory' };
      }

      const supabase = db;
      const { data: inventory, error: fetchError } = await supabase
        .from('inventory')
        .select('on_hand, allocated')
        .eq('location_id', params.locationId)
        .eq('product_id', params.productId)
        .single();

      if (fetchError || !inventory) {
        return { success: false, error: 'Inventory not found' };
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          on_hand: inventory.on_hand - params.quantity,
          allocated: inventory.allocated - params.quantity,
        })
        .eq('location_id', params.locationId)
        .eq('product_id', params.productId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Log inventory movement
      await logInventoryMovement({
        productId: params.productId,
        locationId: params.locationId,
        movementType: 'ship',
        quantity: -params.quantity, // Negative = shipped out
        referenceType: 'fulfillment_allocation',
        notes: `Shipped ${params.quantity} units from warehouse`,
      });

      return { success: true };
    } else if (params.fulfillmentSource === 'platinum_dealer_inventory') {
      if (!params.dealerLocationId) {
        return {
          success: false,
          error: 'Dealer location ID required for dealer inventory',
        };
      }

      const supabase = db;
      const { data: inventory, error: fetchError } = await supabase
        .from('platinum_dealer_inventory')
        .select('on_hand, allocated')
        .eq('dealer_location_id', params.dealerLocationId)
        .eq('product_id', params.productId)
        .single();

      if (fetchError || !inventory) {
        return { success: false, error: 'Dealer inventory not found' };
      }

      const { error: updateError } = await supabase
        .from('platinum_dealer_inventory')
        .update({
          on_hand: inventory.on_hand - params.quantity,
          allocated: inventory.allocated - params.quantity,
        })
        .eq('dealer_location_id', params.dealerLocationId)
        .eq('product_id', params.productId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Log dealer inventory movement
      await logDealerInventoryMovement({
        productId: params.productId,
        dealerLocationId: params.dealerLocationId,
        movementType: 'ship',
        quantity: -params.quantity, // Negative = shipped out
        referenceType: 'fulfillment_allocation',
        notes: `Shipped ${params.quantity} units from dealer inventory`,
      });

      return { success: true };
    }

    // For 'direct' and 'platinum_dealer_fulfillment', no inventory shipping needed
    return { success: true };
  } catch (error) {
    console.error('Error shipping inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// QUERY ALLOCATIONS
// ============================================

/**
 * Get all allocations for a sales order item with summary
 */
export async function getAllocationsForItem(salesOrderItemId: string): Promise<{
  allocations: FulfillmentAllocation[];
  totalAllocated: number;
  customerQty: number;
  remainingToAllocate: number;
  fullyAllocated: boolean;
}> {
  try {
    const supabase = db;

    // Get sales order item to get customer_qty
    const { data: item, error: itemError } = await supabase
      .from('sales_order_items')
      .select('customer_qty')
      .eq('id', salesOrderItemId)
      .single();

    if (itemError || !item) {
      throw new Error('Sales order item not found');
    }

    // Get all allocations with relationships
    const { data: allocations, error: allocError } = await supabase
      .from('fulfillment_allocations')
      .select(`
        *,
        location:locations!fulfillment_allocations_location_id_fkey(
          id,
          location_code,
          name
        ),
        assignedContact:location_contacts!fulfillment_allocations_assigned_contact_id_fkey(
          id,
          name,
          email,
          phone
        ),
        platinumDealer:platinum_dealers!fulfillment_allocations_platinum_dealer_id_fkey(
          id,
          dealer_name,
          code,
          email,
          contact_name
        ),
        dealerLocation:platinum_dealer_locations!fulfillment_allocations_dealer_location_id_fkey(
          id,
          dealer_id,
          location_name,
          location_code,
          address_street,
          address_city,
          address_state,
          address_postal_code
        ),
        purchaseOrder:purchase_orders!fulfillment_allocations_purchase_order_id_fkey(
          id,
          po_number,
          status
        )
      `)
      .eq('sales_order_item_id', salesOrderItemId)
      .order('created_at', { ascending: false });

    if (allocError) {
      throw new Error(`Failed to fetch allocations: ${allocError.message}`);
    }

    const allocs = (allocations || []).map((a: any) => ({
      id: a.id,
      salesOrderItemId: a.sales_order_item_id,
      fulfillmentSource: a.fulfillment_source,
      quantity: a.quantity,
      status: a.status,
      locationId: a.location_id,
      assignedContactId: a.assigned_contact_id,
      assignedUserId: a.assigned_user_id || null,
      platinumDealerId: a.platinum_dealer_id,
      dealerLocationId: a.dealer_location_id,
      containerQty: a.container_qty,
      containerRemaining: a.container_remaining,
      containerId: a.container_id,
      purchaseOrderId: a.purchase_order_id,
      notes: a.notes,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      createdBy: a.created_by,
      // Nested objects matching FulfillmentAllocationWithDetails
      location: a.location ? {
        id: a.location.id,
        locationCode: a.location.location_code,
        name: a.location.name,
      } : undefined,
      assignedContact: a.assignedContact ? {
        id: a.assignedContact.id,
        name: a.assignedContact.name,
        email: a.assignedContact.email,
        phone: a.assignedContact.phone,
      } : undefined,
      platinumDealer: a.platinumDealer ? {
        id: a.platinumDealer.id,
        dealerName: a.platinumDealer.dealer_name,
        code: a.platinumDealer.code,
        email: a.platinumDealer.email,
        contactName: a.platinumDealer.contact_name,
      } : undefined,
      dealerLocation: a.dealerLocation ? {
        id: a.dealerLocation.id,
        dealerId: a.dealerLocation.dealer_id,
        locationName: a.dealerLocation.location_name,
        locationCode: a.dealerLocation.location_code,
        addressStreet: a.dealerLocation.address_street,
        addressCity: a.dealerLocation.address_city,
        addressState: a.dealerLocation.address_state,
        addressPostalCode: a.dealerLocation.address_postal_code,
      } : undefined,
      purchaseOrder: a.purchaseOrder ? {
        id: a.purchaseOrder.id,
        poNumber: a.purchaseOrder.po_number,
        status: a.purchaseOrder.status,
      } : undefined,
    }));

    const totalAllocated = allocs.reduce((sum, a) => sum + a.quantity, 0);
    const remainingToAllocate = item.customer_qty - totalAllocated;
    const fullyAllocated = remainingToAllocate === 0;

    return {
      allocations: allocs,
      totalAllocated,
      customerQty: item.customer_qty,
      remainingToAllocate,
      fullyAllocated,
    };
  } catch (error) {
    console.error('Error getting allocations for item:', error);
    throw error;
  }
}

// ============================================
// SMART SUGGESTIONS
// ============================================

export interface AllocationSuggestion {
  suggestions: Array<{
    fulfillmentSource: FulfillmentSource;
    quantity: number;
    available: number;
    locationId?: string;
    locationName?: string;
    dealerId?: string;
    dealerName?: string;
  }>;
  totalCoverage: number;
  fullyAllocated: boolean;
}

/**
 * Suggest optimal allocation based on inventory availability
 */
export async function suggestOptimalAllocation(params: {
  salesOrderItemId: string;
  productId: string;
  customerQty: number;
}): Promise<AllocationSuggestion> {
  try {
    const supabase = db;

    // Get existing allocations
    const { data: existingAllocs } = await supabase
      .from('fulfillment_allocations')
      .select('quantity')
      .eq('sales_order_item_id', params.salesOrderItemId);

    const alreadyAllocated = (existingAllocs || []).reduce(
      (sum, a) => sum + a.quantity,
      0
    );
    const remaining = params.customerQty - alreadyAllocated;

    if (remaining <= 0) {
      return {
        suggestions: [],
        totalCoverage: params.customerQty,
        fullyAllocated: true,
      };
    }

    const suggestions: AllocationSuggestion['suggestions'] = [];
    let covered = 0;

    // Priority 1: GDC Inventory (fastest fulfillment)
    const { data: gdcInventory } = await supabase
      .from('inventory')
      .select('location_id, on_hand, allocated, locations(name)')
      .eq('product_id', params.productId)
      .gt('on_hand', 'allocated');

    if (gdcInventory && gdcInventory.length > 0) {
      for (const inv of gdcInventory) {
        const available = (inv.on_hand || 0) - (inv.allocated || 0);
        if (available > 0 && covered < remaining) {
          const qtyToAllocate = Math.min(available, remaining - covered);
          suggestions.push({
            fulfillmentSource: 'gdc_inventory',
            quantity: qtyToAllocate,
            available,
            locationId: inv.location_id,
            locationName: (inv.locations as any)?.name || 'Unknown',
          });
          covered += qtyToAllocate;
        }
      }
    }

    // Priority 2: Platinum Dealer Inventory
    if (covered < remaining) {
      const { data: dealerInventory } = await supabase
        .from('platinum_dealer_inventory')
        .select(`
          dealer_location_id,
          on_hand,
          allocated,
          platinum_dealer_locations(location_name, dealer_id, platinum_dealers(dealer_name))
        `)
        .eq('product_id', params.productId)
        .gt('on_hand', 'allocated');

      if (dealerInventory && dealerInventory.length > 0) {
        for (const inv of dealerInventory) {
          const available = (inv.on_hand || 0) - (inv.allocated || 0);
          if (available > 0 && covered < remaining) {
            const qtyToAllocate = Math.min(available, remaining - covered);
            const dealerLoc = inv.platinum_dealer_locations as any;
            const dealer = dealerLoc?.platinum_dealers;

            suggestions.push({
              fulfillmentSource: 'platinum_dealer_inventory',
              quantity: qtyToAllocate,
              available,
              locationId: inv.dealer_location_id,
              locationName: dealerLoc?.location_name || 'Unknown',
              dealerId: dealerLoc?.dealer_id,
              dealerName: dealer?.dealer_name || 'Unknown Dealer',
            });
            covered += qtyToAllocate;
          }
        }
      }
    }

    // Priority 3: Direct from manufacturer (always available, but slower)
    if (covered < remaining) {
      suggestions.push({
        fulfillmentSource: 'direct',
        quantity: remaining - covered,
        available: 999999, // Unlimited
      });
      covered = remaining;
    }

    return {
      suggestions,
      totalCoverage: covered,
      fullyAllocated: covered >= remaining,
    };
  } catch (error) {
    console.error('Error suggesting allocations:', error);
    return {
      suggestions: [],
      totalCoverage: 0,
      fullyAllocated: false,
    };
  }
}
