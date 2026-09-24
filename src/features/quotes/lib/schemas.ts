/**
 * Quote Zod Schemas
 *
 * Validation schemas for Quotes module.
 * Handles form validation, API validation, and data transformation.
 */

import { z } from 'zod';
import type { QuoteStatus } from '../types';

// ============================================
// ENUMS
// ============================================

export const quoteStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'expired',
  'converted',
]);

export const unitCodeSchema = z.enum(['EA', 'SET', 'PR', 'BOX']);

// ============================================
// ADDRESS SCHEMA
// ============================================

export const addressSchema = z.object({
  street: z.string().max(200, 'Street must be 200 characters or less').nullable(),
  city: z.string().max(100, 'City must be 100 characters or less').nullable(),
  state: z.string().max(50, 'State must be 50 characters or less').nullable(),
  postalCode: z.string().max(20, 'Postal code must be 20 characters or less').nullable(),
  country: z.string().max(50, 'Country must be 50 characters or less').nullable(),
});

export const addressFormSchema = z.object({
  street: z.string().max(200, 'Street must be 200 characters or less').default(''),
  city: z.string().max(100, 'City must be 100 characters or less').default(''),
  state: z.string().max(50, 'State must be 50 characters or less').default(''),
  postalCode: z.string().max(20, 'Postal code must be 20 characters or less').default(''),
  country: z.string().max(50, 'Country must be 50 characters or less').default('US'),
});

// ============================================
// QUOTE ITEM SCHEMAS
// ============================================

export const createQuoteItemSchema = z.object({
  productId: z.string({ required_error: 'Product is required.' }).uuid('Please select a valid product.'),
  sku: z.string().max(50, 'SKU must be 50 characters or less.').default(''), // SKU is auto-filled from product
  description: z.string().max(500, 'Description must be 500 characters or less.').nullable(),
  quantity: z.number({ required_error: 'Quantity is required.' }).int('Quantity must be a whole number.').positive('Quantity must be greater than 0.'),
  unitCode: z.string().min(1).max(10).default('EA'),
  unitPrice: z.number({ required_error: 'Unit price is required.' }).int().positive('Unit price must be greater than 0.'),
  discountPercent: z.number().min(0, 'Discount cannot be negative.').max(100, 'Discount cannot exceed 100%.').default(0),
  taxRate: z.number().min(0, 'Tax rate cannot be negative.').max(100, 'Tax rate cannot exceed 100%.').default(0),
});

export const updateQuoteItemSchema = createQuoteItemSchema.partial().extend({
  id: z.string().uuid().optional(),
});

// Form schema for quote items (with string inputs that get parsed)
export const quoteItemFormSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, 'Product is required.'),
  sku: z.string().default(''), // SKU is auto-filled when product is selected
  description: z.string().default(''),
  quantity: z.union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? 0 : num;
    })
    .refine((val) => val > 0, { message: 'Quantity must be greater than 0' }),
  unitId: z.string().default('EA'),
  unitPrice: z.union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? 0 : num;
    })
    .refine((val) => val > 0, { message: 'Unit price must be greater than 0' }),
  discountPercent: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  }),
  taxRateId: z.string().default(''),
  lineTotal: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  }).default(0),
});

// ============================================
// QUOTE SCHEMAS
// ============================================

export const createQuoteSchema = z.object({
  quoteNumber: z.string().max(50).optional(), // Optional: if not provided, auto-generated
  quoteDate: z.coerce.date({
    required_error: 'Quote date is required.',
    invalid_type_error: 'Please enter a valid date.',
  }),
  validUntil: z.coerce.date({ invalid_type_error: 'Please enter a valid date.' }).nullable().optional(),
  customerId: z.string({ required_error: 'Customer is required.' }).uuid('Please select a valid customer.'),
  salesRepId: z.string().uuid('Please select a valid sales representative.').nullable().optional(),
  currencyCode: z.string().length(3, 'Currency code must be 3 characters.').default('USD'),
  status: quoteStatusSchema.default('draft'),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  items: z.array(createQuoteItemSchema).min(1, 'At least one line item is required.'),
  customerNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
  poDocumentUrl: z.string().nullable().optional(),
  customerPoNumber: z.string().max(100).nullable().optional(),
});

export const updateQuoteSchema = z.object({
  quoteDate: z.coerce.date({ invalid_type_error: 'Please enter a valid date.' }).optional(),
  validUntil: z.coerce.date({ invalid_type_error: 'Please enter a valid date.' }).nullable().optional(),
  customerId: z.string().uuid('Please select a valid customer.').optional(),
  salesRepId: z.string().uuid('Please select a valid sales representative.').nullable().optional(),
  currencyCode: z.string().length(3, 'Currency code must be 3 characters.').optional(),
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  customerNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
});

// ============================================
// FORM SCHEMAS (for client-side validation)
// ============================================

export const quoteFormSchema = z.object({
  quoteNumber: z.string().optional().default(''),
  quoteDate: z.string().min(1, 'Quote date is required.'),
  validUntil: z.string().min(1, 'Valid until date is required.'),
  customerId: z.string().min(1, 'Customer is required.'),
  salesRepId: z.string().default(''),
  currencyId: z.string().default('USD'),
  status: quoteStatusSchema.default('draft'),
  billingAddress: addressFormSchema,
  shippingAddress: addressFormSchema,
  items: z.array(quoteItemFormSchema).min(1, 'At least one line item is required.'),
  customerNotes: z.string().default(''),
  internalNotes: z.string().default(''),
  termsAndConditions: z.string().default(''),
  customerPoNumber: z.string().min(1, 'Customer PO number is required.'),
}).refine(
  (data) => {
    // Validate Valid Until is a future date
    if (!data.validUntil) return false;
    const validUntilDate = new Date(data.validUntil);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    return validUntilDate > today;
  },
  {
    message: 'Valid until must be a future date',
    path: ['validUntil'],
  }
).refine(
  (data) => {
    // Validate Valid Until is after Quote Date
    if (!data.quoteDate || !data.validUntil) return false;
    const quoteDate = new Date(data.quoteDate);
    const validUntilDate = new Date(data.validUntil);
    return validUntilDate > quoteDate;
  },
  {
    message: 'Valid until must be after quote date',
    path: ['validUntil'],
  }
);

// ============================================
// LIST PARAMS SCHEMA
// ============================================

export const quoteListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: quoteStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  salesRepId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================
// STATUS TRANSITION SCHEMA
// ============================================

export const statusTransitionSchema = z.object({
  newStatus: quoteStatusSchema,
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type CreateQuoteItemInput = z.infer<typeof createQuoteItemSchema>;
export type UpdateQuoteItemInput = z.infer<typeof updateQuoteItemSchema>;
export type QuoteFormInput = z.infer<typeof quoteFormSchema>;
export type QuoteItemFormInput = z.infer<typeof quoteItemFormSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type AddressFormInput = z.infer<typeof addressFormSchema>;

// ============================================
// CONVERSION UTILITIES
// ============================================

/**
 * Convert form values to CreateQuoteDTO
 */
export function formToCreateDTO(form: QuoteFormInput) {
  return {
    quoteNumber: form.quoteNumber?.trim() || undefined, // Optional: if empty, will be auto-generated
    quoteDate: new Date(form.quoteDate),
    validUntil: form.validUntil ? new Date(form.validUntil) : null,
    customerId: form.customerId,
    salesRepId: form.salesRepId || null,
    currencyCode: form.currencyId || 'USD',
    status: form.status as QuoteStatus,
    billingAddress: {
      street: form.billingAddress.street || null,
      city: form.billingAddress.city || null,
      state: form.billingAddress.state || null,
      postalCode: form.billingAddress.postalCode || null,
      country: form.billingAddress.country || null,
    },
    shippingAddress: {
      street: form.shippingAddress.street || null,
      city: form.shippingAddress.city || null,
      state: form.shippingAddress.state || null,
      postalCode: form.shippingAddress.postalCode || null,
      country: form.shippingAddress.country || null,
    },
    items: form.items.map((item) => ({
      productId: item.productId,
      sku: item.sku,
      description: item.description || null,
      quantity: Number(item.quantity),
      unitCode: item.unitId || 'EA',
      unitPrice: Math.round(Number(item.unitPrice) * 100), // dollars to cents
      discountPercent: Number(item.discountPercent),
      taxRate: getTaxRateFromId(item.taxRateId),
    })),
    customerNotes: form.customerNotes || null,
    internalNotes: form.internalNotes || null,
    termsAndConditions: form.termsAndConditions || null,
    customerPoNumber: form.customerPoNumber || null,
  };
}

/**
 * Convert Quote to form values
 */
export function quoteToFormValues(quote: {
  quoteDate: Date;
  validUntil: Date | null;
  customerId: string;
  salesRepId: string | null;
  currencyCode: string;
  status: QuoteStatus;
  billingAddressStreet: string | null;
  billingAddressCity: string | null;
  billingAddressState: string | null;
  billingAddressPostalCode: string | null;
  billingAddressCountry: string | null;
  shippingAddressStreet: string | null;
  shippingAddressCity: string | null;
  shippingAddressState: string | null;
  shippingAddressPostalCode: string | null;
  shippingAddressCountry: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  termsAndConditions: string | null;
  customerPoNumber?: string | null;
  quoteNumber: string;
  items?: Array<{
    id: string;
    productId: string;
    sku: string;
    description: string | null;
    quantity: number;
    unitCode: string;
    unitPrice: number;
    discountPercent: number;
    taxRate: number;
  }>;
}): QuoteFormInput {
  // Helper to format date as YYYY-MM-DD string
  const formatDateStr = (date: Date): string => date.toISOString().slice(0, 10);

  return {
    quoteNumber: quote.quoteNumber,
    quoteDate: formatDateStr(quote.quoteDate),
    validUntil: quote.validUntil ? formatDateStr(quote.validUntil) : '',
    customerId: quote.customerId,
    salesRepId: quote.salesRepId || '',
    currencyId: quote.currencyCode,
    status: quote.status,
    billingAddress: {
      street: quote.billingAddressStreet || '',
      city: quote.billingAddressCity || '',
      state: quote.billingAddressState || '',
      postalCode: quote.billingAddressPostalCode || '',
      country: quote.billingAddressCountry || 'US',
    },
    shippingAddress: {
      street: quote.shippingAddressStreet || '',
      city: quote.shippingAddressCity || '',
      state: quote.shippingAddressState || '',
      postalCode: quote.shippingAddressPostalCode || '',
      country: quote.shippingAddressCountry || 'US',
    },
    items: (quote.items || []).map((item) => {
      const unitPrice = item.unitPrice / 100; // cents to dollars
      const lineTotal = calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent) / 100; // cents to dollars
      return {
        id: item.id,
        productId: item.productId,
        sku: item.sku,
        description: item.description || '',
        quantity: item.quantity,
        unitId: item.unitCode,
        unitPrice,
        discountPercent: item.discountPercent,
        taxRateId: getTaxRateId(item.taxRate),
        lineTotal,
      };
    }),
    customerNotes: quote.customerNotes || '',
    internalNotes: quote.internalNotes || '',
    termsAndConditions: quote.termsAndConditions || '',
    customerPoNumber: quote.customerPoNumber || '',
  };
}

// ============================================
// TAX RATE HELPERS
// ============================================

// Static tax rates (should match master data)
const TAX_RATES: Record<string, number> = {
  'tax-001': 8.25,
  'tax-002': 5.0,
  'tax-003': 0,
};

function getTaxRateFromId(taxRateId: string): number {
  return TAX_RATES[taxRateId] ?? 0;
}

function getTaxRateId(taxRate: number): string {
  for (const [id, rate] of Object.entries(TAX_RATES)) {
    if (rate === taxRate) {return id;}
  }
  return 'tax-003'; // Default to tax exempt
}

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Calculate line total for a quote item (in cents)
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number, // cents
  discountPercent: number
): number {
  const subtotal = quantity * unitPrice;
  const discount = Math.round(subtotal * (discountPercent / 100));
  return subtotal - discount;
}

/**
 * Calculate quote totals from items (all values in cents)
 */
export function calculateQuoteTotals(
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxRate: number;
  }>
): {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
} {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const lineSubtotal = item.quantity * item.unitPrice;
    const lineDiscount = Math.round(lineSubtotal * (item.discountPercent / 100));
    const lineAfterDiscount = lineSubtotal - lineDiscount;
    const lineTax = Math.round(lineAfterDiscount * (item.taxRate / 100));

    subtotal += lineAfterDiscount;
    discountTotal += lineDiscount;
    taxTotal += lineTax;
  }

  const grandTotal = subtotal + taxTotal;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
  };
}
