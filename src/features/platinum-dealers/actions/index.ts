/**
 * Server Actions for Platinum Dealers
 *
 * API layer for dealer CRUD operations, locations, and inventory management.
 */

'use server';

import {
  createDealer,
  getAllDealers,
  getDealerById,
  updateDealer,
  deleteDealer,
  createDealerLocation,
  getLocationsByDealerId,
  getDealerLocationById,
  updateDealerLocation,
  deleteDealerLocation,
  getDealerInventory,
  getAllInventoryForDealer,
  updateInventory,
  deleteDealerInventory,
  checkDealerInventoryAvailable,
} from '@/features/platinum-dealers/repositories/platinum-dealers.repository';
import type {
  PlatinumDealer,
  PlatinumDealerLocation,
  PlatinumDealerInventory,
  PlatinumDealerInventoryWithDetails,
  DealerStatus,
  CreatePlatinumDealerDTO,
  UpdatePlatinumDealerDTO,
  CreatePlatinumDealerLocationDTO,
  UpdatePlatinumDealerLocationDTO,
  PlatinumDealerInventoryFilters,
} from '@/features/platinum-dealers/types';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// DEALERS CRUD
// ============================================

/**
 * Create a new platinum dealer
 *
 * @example
 * const result = await createDealerAction({
 *   dealerName: 'ABC Tire Distributors',
 *   code: 'ABC-001',
 *   contactName: 'John Doe',
 *   email: 'john@abctire.com',
 *   phone: '+1-555-0123',
 * });
 */
export async function createDealerAction(
  params: CreatePlatinumDealerDTO
): Promise<ActionResult<PlatinumDealer>> {
  try {
    const { data, error } = await createDealer(params);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to create dealer',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in createDealerAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get all dealers with optional filters
 *
 * @example
 * const result = await getAllDealersAction({
 *   status: 'active',
 *   search: 'ABC',
 * });
 */
export async function getAllDealersAction(filters?: {
  status?: DealerStatus;
  search?: string;
}): Promise<ActionResult<PlatinumDealer[]>> {
  try {
    const { data, error } = await getAllDealers(filters);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to fetch dealers',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in getAllDealersAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get dealer by ID
 */
export async function getDealerByIdAction(
  dealerId: string
): Promise<ActionResult<PlatinumDealer>> {
  try {
    const { data, error } = await getDealerById(dealerId);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Dealer not found',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in getDealerByIdAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Update dealer information
 *
 * @example
 * const result = await updateDealerAction('dealer-123', {
 *   contactName: 'Jane Smith',
 *   phone: '+1-555-9999',
 * });
 */
export async function updateDealerAction(
  dealerId: string,
  params: UpdatePlatinumDealerDTO
): Promise<ActionResult<PlatinumDealer>> {
  try {
    const { data, error } = await updateDealer(dealerId, params);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to update dealer',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in updateDealerAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Delete (soft delete) a dealer
 */
export async function deleteDealerAction(
  dealerId: string
): Promise<ActionResult> {
  try {
    const { error } = await deleteDealer(dealerId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error in deleteDealerAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// DEALER LOCATIONS
// ============================================

/**
 * Create a new location for a dealer
 *
 * @example
 * const result = await createDealerLocationAction({
 *   dealerId: 'dealer-123',
 *   locationName: 'Kansas City Warehouse',
 *   city: 'Kansas City',
 *   state: 'MO',
 * });
 */
export async function createDealerLocationAction(
  params: CreatePlatinumDealerLocationDTO
): Promise<ActionResult<PlatinumDealerLocation>> {
  try {
    const { data, error } = await createDealerLocation(params);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to create location',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in createDealerLocationAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get all locations for a dealer
 */
export async function getLocationsByDealerIdAction(
  dealerId: string
): Promise<ActionResult<PlatinumDealerLocation[]>> {
  try {
    const { data, error } = await getLocationsByDealerId(dealerId);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to fetch locations',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in getLocationsByDealerIdAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get location by ID
 */
export async function getDealerLocationByIdAction(
  locationId: string
): Promise<ActionResult<PlatinumDealerLocation>> {
  try {
    const { data, error } = await getDealerLocationById(locationId);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Location not found',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in getDealerLocationByIdAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Update dealer location
 */
export async function updateDealerLocationAction(
  locationId: string,
  params: UpdatePlatinumDealerLocationDTO
): Promise<ActionResult<PlatinumDealerLocation>> {
  try {
    const { data, error } = await updateDealerLocation(locationId, params);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to update location',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in updateDealerLocationAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Delete dealer location
 */
export async function deleteDealerLocationAction(
  locationId: string
): Promise<ActionResult> {
  try {
    const { error } = await deleteDealerLocation(locationId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error in deleteDealerLocationAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// INVENTORY MANAGEMENT
// ============================================

/**
 * Get inventory for a specific product at a dealer location
 *
 * @example
 * const result = await getDealerInventoryAction({
 *   dealerLocationId: 'location-123',
 *   productId: 'product-456',
 * });
 *
 * console.log('Available:', result.data?.available);
 */
export async function getDealerInventoryAction(params: {
  dealerLocationId: string;
  productId: string;
}): Promise<ActionResult<PlatinumDealerInventory>> {
  try {
    const { data, error } = await getDealerInventory(params);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Inventory not found',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in getDealerInventoryAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get all inventory for a dealer (across all locations)
 */
export async function getAllInventoryForDealerAction(
  dealerId: string,
  filters?: PlatinumDealerInventoryFilters
): Promise<ActionResult<PlatinumDealerInventoryWithDetails[]>> {
  try {
    const { data, error } = await getAllInventoryForDealer(dealerId, filters);

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to fetch inventory',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in getAllInventoryForDealerAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Update dealer inventory (on_hand quantity)
 * Creates new record if doesn't exist, updates if exists
 *
 * @example
 * const result = await updateDealerInventoryAction({
 *   dealerId: 'dealer-123',
 *   dealerLocationId: 'location-123',
 *   productId: 'product-456',
 *   onHand: 100,
 * });
 */
export async function updateDealerInventoryAction(params: {
  dealerId: string;
  dealerLocationId: string;
  productId: string;
  onHand: number;
}): Promise<ActionResult<PlatinumDealerInventory>> {
  try {
    if (params.onHand < 0) {
      return {
        success: false,
        error: 'On-hand quantity cannot be negative',
      };
    }

    const { data, error } = await updateInventory({
      dealerId: params.dealerId,
      dealerLocationId: params.dealerLocationId,
      productId: params.productId,
      onHand: params.onHand,
    });

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to update inventory',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in updateDealerInventoryAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Delete dealer inventory
 *
 * @example
 * const result = await deleteDealerInventoryAction({
 *   dealerLocationId: 'location-123',
 *   productId: 'product-456',
 * });
 */
export async function deleteDealerInventoryAction(params: {
  dealerLocationId: string;
  productId: string;
}): Promise<ActionResult> {
  try {
    const { success, error } = await deleteDealerInventory(params);

    if (!success || error) {
      return {
        success: false,
        error: error?.message || 'Failed to delete inventory',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error in deleteDealerInventoryAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Check if dealer has sufficient inventory available
 *
 * @example
 * const result = await checkDealerInventoryAvailableAction({
 *   dealerLocationId: 'location-123',
 *   productId: 'product-456',
 *   quantity: 50,
 * });
 *
 * if (result.data?.available) {
 *   console.log('Sufficient inventory!');
 * }
 */
export async function checkDealerInventoryAvailableAction(params: {
  dealerLocationId: string;
  productId: string;
  quantity: number;
}): Promise<
  ActionResult<{
    available: boolean;
    onHand: number;
    allocated: number;
    availableQty: number;
  }>
> {
  try {
    const result = await checkDealerInventoryAvailable(params);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('Error in checkDealerInventoryAvailableAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// ALLOCATIONS
// ============================================

/**
 * Get all fulfillment allocations for a dealer
 * Server-side action to bypass RLS policy issues
 *
 * @example
 * const result = await getDealerAllocationsAction('dealer-123');
 * if (result.success) {
 *   console.log('Allocations:', result.data);
 * }
 */
export async function getDealerAllocationsAction(
  dealerId: string
): Promise<ActionResult<any[]>> {
  try {
    const { getAllocationsByDealer } = await import(
      '@/features/sales-orders/repositories/fulfillment-allocations.repository'
    );

    const { data, error } = await getAllocationsByDealer(dealerId);

    if (error) {
      return {
        success: false,
        error: error.message || 'Failed to fetch allocations',
      };
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error('Error in getDealerAllocationsAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Update allocation status
 *
 * @example
 * const result = await updateAllocationStatusAction({
 *   allocationId: 'allocation-123',
 *   status: 'fulfilled',
 * });
 */
export async function updateAllocationStatusAction(params: {
  allocationId: string;
  status: 'pending' | 'allocated' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
}): Promise<ActionResult<any>> {
  try {
    const { updateAllocation } = await import(
      '@/features/sales-orders/repositories/fulfillment-allocations.repository'
    );

    const { data, error } = await updateAllocation({
      id: params.allocationId,
      status: params.status,
    });

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Failed to update allocation status',
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error in updateAllocationStatusAction:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
