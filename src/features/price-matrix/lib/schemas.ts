/**
 * Price Matrix - Zod Validation Schemas
 */

import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const priceStatusSchema = z.enum(['active', 'inactive']);
export const customerChannelSchema = z.enum(['oem', 'dealer']);

// ============================================
// FORM SCHEMA
// ============================================

export const priceMatrixFormSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  channel: customerChannelSchema,
  minQuantity: z
    .string()
    .min(1, 'Minimum quantity is required')
    .refine((val) => !isNaN(parseInt(val)) && parseInt(val) >= 1, {
      message: 'Minimum quantity must be at least 1',
    }),
  maxQuantity: z
    .string()
    .refine(
      (val) => !val || (!isNaN(parseInt(val)) && parseInt(val) >= 1),
      { message: 'Maximum quantity must be a positive number' }
    ),
  cost: z
    .string()
    .min(1, 'Cost is required')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'Cost must be a valid positive number',
    }),
  price: z
    .string()
    .min(1, 'Price is required')
    .refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'Price must be a valid positive number',
    }),
  status: priceStatusSchema,
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string(),
}).refine(
  (data) => {
    const cost = parseFloat(data.cost);
    const price = parseFloat(data.price);
    return price >= cost;
  },
  {
    message: 'Price must be greater than or equal to cost',
    path: ['price'],
  }
).refine(
  (data) => {
    if (!data.maxQuantity) { return true; }
    const min = parseInt(data.minQuantity);
    const max = parseInt(data.maxQuantity);
    return max >= min;
  },
  {
    message: 'Maximum quantity must be greater than or equal to minimum',
    path: ['maxQuantity'],
  }
);

export type PriceMatrixFormInput = z.infer<typeof priceMatrixFormSchema>;

// ============================================
// CREATE DTO SCHEMA
// ============================================

export const createPriceMatrixSchema = z.object({
  productId: z.string().uuid(),
  channel: customerChannelSchema,
  minQuantity: z.number().int().min(1),
  maxQuantity: z.number().int().min(1).nullable().optional(),
  cost: z.number().int().min(0),
  price: z.number().int().min(0),
  status: priceStatusSchema.optional().default('active'),
  effectiveFrom: z.date().optional(),
  effectiveTo: z.date().nullable().optional(),
}).refine((data) => data.price >= data.cost, {
  message: 'Price must be greater than or equal to cost',
  path: ['price'],
}).refine(
  (data) => !data.maxQuantity || data.maxQuantity >= data.minQuantity,
  {
    message: 'Maximum quantity must be greater than or equal to minimum',
    path: ['maxQuantity'],
  }
);

export type CreatePriceMatrixInput = z.infer<typeof createPriceMatrixSchema>;

// ============================================
// UPDATE DTO SCHEMA
// ============================================

export const updatePriceMatrixSchema = z.object({
  channel: customerChannelSchema.optional(),
  minQuantity: z.number().int().min(1).optional(),
  maxQuantity: z.number().int().min(1).nullable().optional(),
  cost: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  status: priceStatusSchema.optional(),
  effectiveFrom: z.date().optional(),
  effectiveTo: z.date().nullable().optional(),
});

export type UpdatePriceMatrixInput = z.infer<typeof updatePriceMatrixSchema>;

// ============================================
// CONVERSION HELPERS
// ============================================

/**
 * Convert form values to DTO (dollars to cents)
 */
export function formToDTO(form: PriceMatrixFormInput): CreatePriceMatrixInput {
  return {
    productId: form.productId,
    channel: form.channel,
    minQuantity: parseInt(form.minQuantity),
    maxQuantity: form.maxQuantity ? parseInt(form.maxQuantity) : null,
    cost: Math.round(parseFloat(form.cost) * 100),
    price: Math.round(parseFloat(form.price) * 100),
    status: form.status,
    effectiveFrom: new Date(form.effectiveFrom),
    effectiveTo: form.effectiveTo ? new Date(form.effectiveTo) : null,
  };
}

/**
 * Convert entity to form values (cents to dollars)
 */
export function entityToFormValues(entity: {
  productId: string;
  channel: 'oem' | 'dealer';
  minQuantity: number;
  maxQuantity: number | null;
  cost: number;
  price: number;
  status: 'active' | 'inactive';
  effectiveFrom: Date;
  effectiveTo: Date | null;
}): PriceMatrixFormInput {
  return {
    productId: entity.productId,
    channel: entity.channel,
    minQuantity: entity.minQuantity.toString(),
    maxQuantity: entity.maxQuantity?.toString() || '',
    cost: (entity.cost / 100).toFixed(2),
    price: (entity.price / 100).toFixed(2),
    status: entity.status,
    effectiveFrom: entity.effectiveFrom.toISOString().split('T')[0] ?? '',
    effectiveTo: entity.effectiveTo?.toISOString().split('T')[0] ?? '',
  };
}

/**
 * Format cents as currency string
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format quantity range for display
 */
export function formatQuantityRange(min: number, max: number | null): string {
  if (max === null) {
    return `${min}+`;
  }
  if (min === max) {
    return min.toString();
  }
  return `${min}-${max}`;
}

/**
 * Calculate margin and margin percent
 */
export function calculateMargin(cost: number, price: number): {
  margin: number;
  marginPercent: number;
} {
  const margin = price - cost;
  const marginPercent = cost > 0 ? ((price - cost) / cost) * 100 : 0;
  return { margin, marginPercent };
}
