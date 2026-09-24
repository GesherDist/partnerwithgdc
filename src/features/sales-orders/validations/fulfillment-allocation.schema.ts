/**
 * Zod Validation Schemas for Fulfillment Allocations
 *
 * Validates allocation data with conditional requirements based on fulfillment source.
 */

import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const fulfillmentSourceSchema = z.enum([
  'direct',
  'gdc_inventory',
  'platinum_dealer_inventory',
  'platinum_dealer_fulfillment',
]);

export const allocationStatusSchema = z.enum([
  'pending',
  'allocated',
  'partially_fulfilled',
  'fulfilled',
  'cancelled',
]);

// ============================================
// CREATE FULFILLMENT ALLOCATION
// ============================================

/**
 * Base schema for creating a fulfillment allocation
 */
export const createFulfillmentAllocationBaseSchema = z.object({
  salesOrderItemId: z.string().uuid('Invalid sales order item ID'),
  fulfillmentSource: fulfillmentSourceSchema,
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0'),
  notes: z.string().optional(),
});

/**
 * Schema for GDC Inventory allocation
 * Requires: location_id, assigned_contact_id
 * Optional: assigned_user_id (warehouse worker for pick ticket assignment)
 */
export const createGdcInventoryAllocationSchema =
  createFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('gdc_inventory'),
    locationId: z
      .string()
      .uuid('Invalid location ID')
      .describe('Required for GDC inventory source'),
    assignedContactId: z
      .string()
      .uuid('Invalid contact ID')
      .describe('Required - warehouse contact to receive email notification'),
    assignedUserId: z
      .string()
      .uuid('Invalid user ID')
      .optional()
      .describe('Optional - warehouse worker for pick ticket assignment'),
  });

/**
 * Schema for Manufacturer/Supplier (Direct) allocation
 * Requires: container_qty
 */
export const createDirectAllocationSchema =
  createFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('direct'),
    containerQty: z
      .number()
      .int('Container quantity must be an integer')
      .positive('Container quantity must be greater than 0')
      .describe('Required for manufacturer/supplier source'),
    purchaseOrderId: z.string().uuid('Invalid purchase order ID').optional(),
    containerId: z.string().optional(),
  });

/**
 * Schema for Platinum Dealer Inventory allocation
 * Requires: platinum_dealer_id, dealer_location_id
 */
export const createDealerInventoryAllocationSchema =
  createFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('platinum_dealer_inventory'),
    platinumDealerId: z
      .string()
      .uuid('Invalid platinum dealer ID')
      .describe('Required for dealer sources'),
    dealerLocationId: z
      .string()
      .uuid('Invalid dealer location ID')
      .describe('Required for dealer inventory source'),
  });

/**
 * Schema for Platinum Dealer Fulfillment allocation
 * Requires: platinum_dealer_id
 * Optional: dealer_location_id
 */
export const createDealerFulfillmentAllocationSchema =
  createFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('platinum_dealer_fulfillment'),
    platinumDealerId: z
      .string()
      .uuid('Invalid platinum dealer ID')
      .describe('Required for dealer fulfillment source'),
    dealerLocationId: z
      .union([z.string().uuid('Invalid dealer location ID'), z.literal('')])
      .optional()
      .describe('Optional for dealer fulfillment source'),
  });

/**
 * Discriminated union schema for creating allocations
 * Validates based on fulfillment source
 */
export const createFulfillmentAllocationSchema = z.discriminatedUnion(
  'fulfillmentSource',
  [
    createDirectAllocationSchema,
    createGdcInventoryAllocationSchema,
    createDealerInventoryAllocationSchema,
    createDealerFulfillmentAllocationSchema,
  ]
);

export type CreateFulfillmentAllocationInput = z.infer<
  typeof createFulfillmentAllocationSchema
>;

// ============================================
// UPDATE FULFILLMENT ALLOCATION
// ============================================

/**
 * Base schema for updating allocation (common fields)
 */
export const updateFulfillmentAllocationBaseSchema = z.object({
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .positive('Quantity must be greater than 0')
    .optional(),
  status: allocationStatusSchema.optional(),
  notes: z.string().optional(),
});

/**
 * Update schema for GDC Inventory allocation
 */
export const updateGdcInventoryAllocationSchema =
  updateFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('gdc_inventory').optional(),
    locationId: z.string().uuid('Invalid location ID').optional(),
    assignedContactId: z.string().uuid('Invalid contact ID').optional(),
    assignedUserId: z.string().uuid('Invalid user ID').optional(),
  });

/**
 * Update schema for Direct (Manufacturer) allocation
 */
export const updateDirectAllocationSchema =
  updateFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('direct').optional(),
    containerQty: z
      .number()
      .int('Container quantity must be an integer')
      .positive('Container quantity must be greater than 0')
      .optional(),
    containerId: z.string().optional(),
    purchaseOrderId: z.string().uuid('Invalid purchase order ID').optional(),
  });

/**
 * Update schema for Dealer Inventory allocation
 */
export const updateDealerInventoryAllocationSchema =
  updateFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('platinum_dealer_inventory').optional(),
    platinumDealerId: z.string().uuid('Invalid platinum dealer ID').optional(),
    dealerLocationId: z.string().uuid('Invalid dealer location ID').optional(),
  });

/**
 * Update schema for Dealer Fulfillment allocation
 */
export const updateDealerFulfillmentAllocationSchema =
  updateFulfillmentAllocationBaseSchema.extend({
    fulfillmentSource: z.literal('platinum_dealer_fulfillment').optional(),
    platinumDealerId: z.string().uuid('Invalid platinum dealer ID').optional(),
    dealerLocationId: z
      .union([z.string().uuid('Invalid dealer location ID'), z.literal('')])
      .optional(),
  });

/**
 * Union schema for updating allocations
 * Allows changing fulfillment source when status is pending
 */
export const updateFulfillmentAllocationSchema = z.union([
  updateGdcInventoryAllocationSchema,
  updateDirectAllocationSchema,
  updateDealerInventoryAllocationSchema,
  updateDealerFulfillmentAllocationSchema,
]);

export type UpdateFulfillmentAllocationInput = z.infer<
  typeof updateFulfillmentAllocationSchema
>;

// ============================================
// ALLOCATION VALIDATION RULES
// ============================================

/**
 * Validate allocation against sales order item
 */
export const validateAllocationSchema = z.object({
  salesOrderItemId: z.string().uuid(),
  customerQty: z.number().positive(),
  existingAllocations: z.array(
    z.object({
      id: z.string().uuid(),
      quantity: z.number(),
    })
  ),
  newAllocationQty: z.number().positive(),
});

export type ValidateAllocationInput = z.infer<
  typeof validateAllocationSchema
>;

/**
 * Custom validation function for over-allocation check
 */
export function validateNotOverAllocated(input: ValidateAllocationInput): {
  valid: boolean;
  error?: string;
  totalAllocated: number;
  remainingToAllocate: number;
} {
  const totalExisting = input.existingAllocations.reduce(
    (sum, a) => sum + a.quantity,
    0
  );
  const totalAfterNew = totalExisting + input.newAllocationQty;

  if (totalAfterNew > input.customerQty) {
    return {
      valid: false,
      error: `Cannot allocate ${input.newAllocationQty} units. Total allocation (${totalAfterNew}) would exceed customer quantity (${input.customerQty}). ${input.customerQty - totalExisting} units remaining.`,
      totalAllocated: totalExisting,
      remainingToAllocate: input.customerQty - totalExisting,
    };
  }

  return {
    valid: true,
    totalAllocated: totalAfterNew,
    remainingToAllocate: input.customerQty - totalAfterNew,
  };
}

// ============================================
// BATCH ALLOCATION
// ============================================

/**
 * Schema for creating multiple allocations for one item
 */
export const createBatchAllocationSchema = z.object({
  salesOrderItemId: z.string().uuid('Invalid sales order item ID'),
  customerQty: z.number().int().positive('Customer quantity must be positive'),
  productId: z.string().uuid('Invalid product ID'),
  allocations: z
    .array(createFulfillmentAllocationSchema)
    .min(1, 'At least one allocation required')
    .refine(
      (allocations) => {
        const totalQty = allocations.reduce((sum, a) => sum + a.quantity, 0);
        return totalQty > 0;
      },
      {
        message: 'Total allocation quantity must be greater than 0',
      }
    ),
});

export type CreateBatchAllocationInput = z.infer<
  typeof createBatchAllocationSchema
>;
