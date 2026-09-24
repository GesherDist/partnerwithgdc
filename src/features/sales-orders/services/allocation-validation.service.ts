/**
 * Allocation Validation Service
 *
 * Business logic layer for validating fulfillment allocations.
 * Handles complex validation rules, inventory checks, and availability queries.
 */

import type { FulfillmentSource } from '../types';
import {
  checkOverAllocation,
  getTotalAllocatedForItem,
} from '../repositories/fulfillment-allocations.repository';
import {
  checkDealerInventoryAvailable,
} from '@/features/platinum-dealers/repositories/platinum-dealers.repository';
import { db } from '@/shared/lib/supabase/database';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AllocationValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
  details?: Record<string, any>;
}

export interface AllocationRequest {
  salesOrderItemId: string;
  fulfillmentSource: FulfillmentSource;
  quantity: number;
  productId: string;

  // Conditional fields based on source
  locationId?: string;
  platinumDealerId?: string;
  dealerLocationId?: string;
  containerQty?: number;

  // For update operations
  excludeAllocationId?: string;
}

export interface MultiSourceAllocationRequest {
  salesOrderItemId: string;
  customerQty: number;
  allocations: AllocationRequest[];
}

export interface InventoryAvailability {
  available: boolean;
  source: FulfillmentSource;
  availableQty: number;
  requestedQty: number;
  details: Record<string, any>;
}

// ============================================
// MAIN VALIDATION FUNCTIONS
// ============================================

/**
 * Validate a single allocation request
 *
 * Performs comprehensive validation:
 * - Checks for over-allocation
 * - Validates required fields for source type
 * - Checks inventory availability
 * - Validates business rules
 */
export async function validateAllocationRequest(
  request: AllocationRequest
): Promise<AllocationValidationResult> {
  try {
    // Step 1: Validate required fields based on source
    const fieldValidation = validateRequiredFields(request);
    if (!fieldValidation.valid) {
      return fieldValidation;
    }

    // Step 2: Check for over-allocation
    const overAllocationCheck = await checkOverAllocation({
      salesOrderItemId: request.salesOrderItemId,
      newQuantity: request.quantity,
      excludeAllocationId: request.excludeAllocationId,
    });

    if (!overAllocationCheck.valid) {
      return {
        valid: false,
        error: overAllocationCheck.error,
        details: {
          totalAllocated: overAllocationCheck.totalAllocated,
          remainingToAllocate: overAllocationCheck.remainingToAllocate,
          customerQty: overAllocationCheck.customerQty,
        },
      };
    }

    // Step 3: Validate source-specific availability
    const availabilityCheck = await canAllocateFromSource(request);
    if (!availabilityCheck.valid) {
      return availabilityCheck;
    }

    // Step 4: Validate container qty for manufacturer source
    if (request.fulfillmentSource === 'direct') {
      const containerValidation = validateContainerQuantity(request);
      if (!containerValidation.valid) {
        return containerValidation;
      }
    }

    return {
      valid: true,
      details: {
        totalAllocated: overAllocationCheck.totalAllocated,
        remainingToAllocate: overAllocationCheck.remainingToAllocate,
      },
    };
  } catch (error) {
    console.error('Error validating allocation request:', error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error during validation',
    };
  }
}

/**
 * Validate multiple allocations for a single sales order item
 *
 * Ensures total allocated quantity matches customer quantity
 * and validates each individual allocation.
 */
export async function validateMultiSourceAllocation(
  request: MultiSourceAllocationRequest
): Promise<AllocationValidationResult> {
  try {
    const warnings: string[] = [];

    // Step 1: Check total quantity
    const totalQty = request.allocations.reduce(
      (sum, a) => sum + a.quantity,
      0
    );

    if (totalQty > request.customerQty) {
      return {
        valid: false,
        error: `Total allocation (${totalQty}) exceeds customer quantity (${request.customerQty})`,
        details: {
          totalAllocated: totalQty,
          customerQty: request.customerQty,
          excess: totalQty - request.customerQty,
        },
      };
    }

    if (totalQty < request.customerQty) {
      warnings.push(
        `Partial allocation: ${totalQty} of ${request.customerQty} units allocated. ${request.customerQty - totalQty} units remaining.`
      );
    }

    // Step 2: Check for duplicate sources (same source + location combination)
    const duplicateCheck = checkDuplicateSources(request.allocations);
    if (!duplicateCheck.valid) {
      return duplicateCheck;
    }

    // Step 3: Validate each allocation individually
    for (const allocation of request.allocations) {
      const validation = await validateAllocationRequest(allocation);
      if (!validation.valid) {
        return {
          valid: false,
          error: `Invalid allocation for ${allocation.fulfillmentSource}: ${validation.error}`,
        };
      }
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
      details: {
        totalAllocated: totalQty,
        customerQty: request.customerQty,
        remainingToAllocate: request.customerQty - totalQty,
      },
    };
  } catch (error) {
    console.error('Error validating multi-source allocation:', error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error during validation',
    };
  }
}

// ============================================
// SOURCE-SPECIFIC VALIDATION
// ============================================

/**
 * Check if allocation can be fulfilled from specified source
 */
export async function canAllocateFromSource(
  request: AllocationRequest
): Promise<AllocationValidationResult> {
  try {
    switch (request.fulfillmentSource) {
      case 'gdc_inventory':
        return await checkGdcInventoryAvailability(request);

      case 'platinum_dealer_inventory':
        return await checkDealerInventoryAvailability(request);

      case 'direct':
        // Manufacturer can always fulfill (procurement on demand)
        return { valid: true };

      case 'platinum_dealer_fulfillment':
        // Dealer fulfillment (procurement on demand)
        return { valid: true };

      default:
        return {
          valid: false,
          error: `Unknown fulfillment source: ${request.fulfillmentSource}`,
        };
    }
  } catch (error) {
    console.error('Error checking source availability:', error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error checking availability',
    };
  }
}

/**
 * Check GDC warehouse inventory availability
 */
export async function checkGdcInventoryAvailability(
  request: AllocationRequest
): Promise<AllocationValidationResult> {
  try {
    if (!request.locationId) {
      return {
        valid: false,
        error: 'Location ID is required for GDC inventory source',
      };
    }

    const supabase = db;

    // Get GDC inventory
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('on_hand, allocated')
      .eq('location_id', request.locationId)
      .eq('product_id', request.productId)
      .single();

    if (error || !inventory) {
      return {
        valid: false,
        error: 'Product not found in GDC inventory',
        details: {
          locationId: request.locationId,
          productId: request.productId,
        },
      };
    }

    const available = inventory.on_hand - inventory.allocated;

    if (available < request.quantity) {
      return {
        valid: false,
        error: `Insufficient GDC inventory. Available: ${available}, Requested: ${request.quantity}`,
        details: {
          onHand: inventory.on_hand,
          allocated: inventory.allocated,
          available,
          requested: request.quantity,
          shortage: request.quantity - available,
        },
      };
    }

    return {
      valid: true,
      details: {
        onHand: inventory.on_hand,
        allocated: inventory.allocated,
        available,
        requested: request.quantity,
      },
    };
  } catch (error) {
    console.error('Error checking GDC inventory:', error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error checking GDC inventory',
    };
  }
}

/**
 * Check platinum dealer inventory availability
 */
export async function checkDealerInventoryAvailability(
  request: AllocationRequest
): Promise<AllocationValidationResult> {
  try {
    if (!request.dealerLocationId) {
      return {
        valid: false,
        error: 'Dealer location ID is required for dealer inventory source',
      };
    }

    const result = await checkDealerInventoryAvailable({
      dealerLocationId: request.dealerLocationId,
      productId: request.productId,
      quantity: request.quantity,
    });

    if (result.error) {
      return {
        valid: false,
        error: result.error.message,
      };
    }

    if (!result.available) {
      return {
        valid: false,
        error: `Insufficient dealer inventory. Available: ${result.availableQty}, Requested: ${request.quantity}`,
        details: {
          onHand: result.onHand,
          allocated: result.allocated,
          available: result.availableQty,
          requested: request.quantity,
          shortage: request.quantity - result.availableQty,
        },
      };
    }

    return {
      valid: true,
      details: {
        onHand: result.onHand,
        allocated: result.allocated,
        available: result.availableQty,
        requested: request.quantity,
      },
    };
  } catch (error) {
    console.error('Error checking dealer inventory:', error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error checking dealer inventory',
    };
  }
}

/**
 * Check manufacturer capacity (container-based)
 */
export async function checkManufacturerCapacity(
  request: AllocationRequest
): Promise<AllocationValidationResult> {
  try {
    if (!request.containerQty) {
      return {
        valid: false,
        error: 'Container quantity is required for manufacturer source',
      };
    }

    if (request.quantity > request.containerQty) {
      return {
        valid: false,
        error: `Allocation quantity (${request.quantity}) exceeds container capacity (${request.containerQty})`,
        details: {
          requested: request.quantity,
          containerQty: request.containerQty,
          excess: request.quantity - request.containerQty,
        },
      };
    }

    return {
      valid: true,
      details: {
        requested: request.quantity,
        containerQty: request.containerQty,
        remaining: request.containerQty - request.quantity,
      },
    };
  } catch (error) {
    console.error('Error checking manufacturer capacity:', error);
    return {
      valid: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error checking manufacturer capacity',
    };
  }
}

// ============================================
// FIELD VALIDATION
// ============================================

/**
 * Validate required fields based on fulfillment source
 */
function validateRequiredFields(
  request: AllocationRequest
): AllocationValidationResult {
  const errors: string[] = [];

  // Common validations
  if (!request.salesOrderItemId) {
    errors.push('Sales order item ID is required');
  }
  if (!request.fulfillmentSource) {
    errors.push('Fulfillment source is required');
  }
  if (!request.quantity || request.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }
  if (!request.productId) {
    errors.push('Product ID is required');
  }

  // Source-specific validations
  switch (request.fulfillmentSource) {
    case 'gdc_inventory':
      if (!request.locationId) {
        errors.push('Location ID is required for GDC inventory source');
      }
      break;

    case 'platinum_dealer_inventory':
    case 'platinum_dealer_fulfillment':
      if (!request.platinumDealerId) {
        errors.push('Platinum dealer ID is required for dealer sources');
      }
      if (
        request.fulfillmentSource === 'platinum_dealer_inventory' &&
        !request.dealerLocationId
      ) {
        errors.push('Dealer location ID is required for dealer inventory source');
      }
      break;

    case 'direct':
      if (!request.containerQty || request.containerQty <= 0) {
        errors.push(
          'Container quantity is required and must be greater than 0 for manufacturer source'
        );
      }
      break;
  }

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.join('; '),
    };
  }

  return { valid: true };
}

/**
 * Validate container quantity for manufacturer source
 */
function validateContainerQuantity(
  request: AllocationRequest
): AllocationValidationResult {
  if (!request.containerQty) {
    return {
      valid: false,
      error: 'Container quantity is required for manufacturer source',
    };
  }

  if (request.containerQty < request.quantity) {
    return {
      valid: false,
      error: `Container quantity (${request.containerQty}) must be greater than or equal to allocation quantity (${request.quantity})`,
    };
  }

  return { valid: true };
}

/**
 * Check for duplicate source+location combinations
 */
function checkDuplicateSources(
  allocations: AllocationRequest[]
): AllocationValidationResult {
  const sourceKeys = new Set<string>();

  for (const allocation of allocations) {
    let key = allocation.fulfillmentSource;

    // Add location-specific identifier
    if (allocation.fulfillmentSource === 'gdc_inventory') {
      key += `-${allocation.locationId}`;
    } else if (
      allocation.fulfillmentSource === 'platinum_dealer_inventory' ||
      allocation.fulfillmentSource === 'platinum_dealer_fulfillment'
    ) {
      key += `-${allocation.dealerLocationId || allocation.platinumDealerId}`;
    }

    if (sourceKeys.has(key)) {
      return {
        valid: false,
        error: `Duplicate allocation from same source: ${allocation.fulfillmentSource}`,
      };
    }

    sourceKeys.add(key);
  }

  return { valid: true };
}

// ============================================
// SMART SUGGESTIONS
// ============================================

/**
 * Suggest optimal allocation strategy for a sales order item
 *
 * Analyzes available inventory across all sources and suggests
 * the best combination to fulfill the order.
 */
export async function suggestOptimalAllocation(params: {
  salesOrderItemId: string;
  productId: string;
  customerQty: number;
}): Promise<{
  suggestions: AllocationRequest[];
  totalCoverage: number;
  fullyAllocated: boolean;
}> {
  try {
    const suggestions: AllocationRequest[] = [];
    let remaining = params.customerQty;

    // Already allocated quantity
    const { total: alreadyAllocated } = await getTotalAllocatedForItem(
      params.salesOrderItemId
    );
    remaining -= alreadyAllocated;

    if (remaining <= 0) {
      return {
        suggestions: [],
        totalCoverage: params.customerQty,
        fullyAllocated: true,
      };
    }

    // Priority 1: Check GDC inventory (fastest fulfillment)
    const gdcSuggestion = await checkGdcInventoryForSuggestion(
      params.productId,
      remaining
    );
    if (gdcSuggestion) {
      suggestions.push({
        ...gdcSuggestion,
        salesOrderItemId: params.salesOrderItemId,
        productId: params.productId,
      });
      remaining -= gdcSuggestion.quantity;
    }

    // Priority 2: Check dealer inventory (available stock)
    if (remaining > 0) {
      const dealerSuggestion = await checkDealerInventoryForSuggestion(
        params.productId,
        remaining
      );
      if (dealerSuggestion) {
        suggestions.push({
          ...dealerSuggestion,
          salesOrderItemId: params.salesOrderItemId,
          productId: params.productId,
        });
        remaining -= dealerSuggestion.quantity;
      }
    }

    // Priority 3: Manufacturer (always available, but slower)
    if (remaining > 0) {
      // Calculate optimal container quantity
      // Assume standard container sizes (this could be product-specific)
      const containerQty = Math.ceil(remaining / 72) * 72; // Round up to nearest 72

      suggestions.push({
        salesOrderItemId: params.salesOrderItemId,
        fulfillmentSource: 'direct',
        quantity: remaining,
        productId: params.productId,
        containerQty,
      });
      remaining = 0;
    }

    return {
      suggestions,
      totalCoverage: params.customerQty - remaining,
      fullyAllocated: remaining === 0,
    };
  } catch (error) {
    console.error('Error suggesting optimal allocation:', error);
    return {
      suggestions: [],
      totalCoverage: 0,
      fullyAllocated: false,
    };
  }
}

/**
 * Check GDC inventory and suggest allocation
 */
async function checkGdcInventoryForSuggestion(
  productId: string,
  requestedQty: number
): Promise<Omit<AllocationRequest, 'salesOrderItemId' | 'productId'> | null> {
  try {
    const supabase = db;

    const { data: inventories, error } = await supabase
      .from('inventory')
      .select('location_id, on_hand, allocated')
      .eq('product_id', productId)
      .order('on_hand', { ascending: false });

    if (error || !inventories || inventories.length === 0) {
      return null;
    }

    // Find location with sufficient inventory
    for (const inv of inventories) {
      const available = inv.on_hand - inv.allocated;
      if (available >= requestedQty) {
        return {
          fulfillmentSource: 'gdc_inventory',
          quantity: requestedQty,
          locationId: inv.location_id,
        };
      }
    }

    // If no single location has enough, use location with most stock
    const best = inventories[0];
    if (best) {
      const available = best.on_hand - best.allocated;
      if (available > 0) {
        return {
          fulfillmentSource: 'gdc_inventory',
          quantity: Math.min(available, requestedQty),
          locationId: best.location_id,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking GDC inventory for suggestion:', error);
    return null;
  }
}

/**
 * Check dealer inventory and suggest allocation
 */
async function checkDealerInventoryForSuggestion(
  productId: string,
  requestedQty: number
): Promise<Omit<AllocationRequest, 'salesOrderItemId' | 'productId'> | null> {
  try {
    const supabase = db;

    const { data: inventories, error } = await supabase
      .from('platinum_dealer_inventory')
      .select('dealer_id, dealer_location_id, on_hand, allocated, available')
      .eq('product_id', productId)
      .gt('available', 0)
      .order('available', { ascending: false });

    if (error || !inventories || inventories.length === 0) {
      return null;
    }

    // Find dealer location with sufficient inventory
    for (const inv of inventories) {
      if (inv.available >= requestedQty) {
        return {
          fulfillmentSource: 'platinum_dealer_inventory',
          quantity: requestedQty,
          platinumDealerId: inv.dealer_id,
          dealerLocationId: inv.dealer_location_id,
        };
      }
    }

    // If no single location has enough, use location with most stock
    const best = inventories[0];
    if (best && best.available > 0) {
      return {
        fulfillmentSource: 'platinum_dealer_inventory',
        quantity: Math.min(best.available, requestedQty),
        platinumDealerId: best.dealer_id,
        dealerLocationId: best.dealer_location_id,
      };
    }

    return null;
  } catch (error) {
    console.error('Error checking dealer inventory for suggestion:', error);
    return null;
  }
}
