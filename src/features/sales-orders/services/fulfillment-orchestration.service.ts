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
  type MultiSourceAllocationRequest,
} from './allocation-validation.service';
import { db } from '@/shared/lib/supabase/database';
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
    });

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Validation failed',
      };
    }

    // Step 2: Create allocation in database
    const { data: allocation, error: createError } = await createAllocation({
      salesOrderItemId: params.salesOrderItemId,
      fulfillmentSource: params.fulfillmentSource,
      quantity: params.quantity,
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
 * Deallocate inventory for an allocation
 */
async function deallocateInventoryForAllocation(params: {
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
        .update({ allocated: inventory.allocated - params.quantity })
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
        quantity: +params.quantity, // Positive = incoming/released
        referenceType: 'fulfillment_allocation',
        notes: `Released ${params.quantity} units - allocation cancelled/updated`,
      });

      return { success: true };
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
