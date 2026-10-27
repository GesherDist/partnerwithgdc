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

// ============================================
// TYPES
// ============================================

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
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

    return {
      success: true,
      data: result.data,
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
  try {
    const { updateAllocation } = await import(
      '@/features/sales-orders/repositories/fulfillment-allocations.repository'
    );

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
