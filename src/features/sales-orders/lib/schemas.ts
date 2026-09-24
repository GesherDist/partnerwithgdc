/**
 * Sales Order Zod Schemas
 *
 * Validation schemas for Sales Order module.
 * Handles form validation, API validation, and data transformation.
 */

import { z } from 'zod';
import type { OrderStatus } from '../types';

// ============================================
// ENUMS
// ============================================

export const orderStatusSchema = z.enum([
  'draft',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]);

export const productSourceSchema = z.enum(['direct', 'warehouse']);

export const unitCodeSchema = z.enum(['EA', 'SET', 'PR', 'BOX']);

// ============================================
// ADDRESS SCHEMA
// ============================================

export const addressSchema = z.object({
  street: z.string().max(200).nullable(),
  city: z.string().max(100).nullable(),
  state: z.string().max(50).nullable(),
  postalCode: z.string().max(20).nullable(),
  country: z.string().max(50).nullable(),
});

export const addressFormSchema = z.object({
  street: z.string().max(200).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(50).optional().default(''),
  postalCode: z.string().max(20).optional().default(''),
  country: z.string().max(50).optional().default('US'),
});

// ============================================
// ORDER ITEM SCHEMAS
// ============================================

export const createOrderItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  sku: z.string().max(50).default(''), // SKU is auto-filled from product
  description: z.string().max(500).nullable(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitCode: z.string().min(1).max(10).default('EA'),
  unitPrice: z.number().int().min(0, 'Unit price must be non-negative'),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
  warehouseId: z.string().uuid().nullable().optional(),
  batchNumber: z.string().max(100).nullable().optional(),
  serialNumber: z.string().max(100).nullable().optional(),
});

export const updateOrderItemSchema = createOrderItemSchema.partial().extend({
  id: z.string().uuid().optional(),
});

// Form schema for order items (with string inputs that get parsed)
export const orderItemFormSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, 'Product is required'),
  sku: z.string(), // SKU is auto-filled when product is selected (empty string allowed)
  description: z.string().optional().default(''),
  quantity: z.union([z.string(), z.number()])
    .transform((val) => {
      const num = typeof val === 'string' ? parseInt(val, 10) : val;
      return isNaN(num) ? 0 : num;
    })
    .refine((val) => val > 0, { message: 'Quantity must be greater than 0' }),
  unitId: z.string().optional().default('EA'),
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
  taxRateId: z.string().optional().default(''),
  lineTotal: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  }).optional().default(0),
  warehouseId: z.string().optional(),
  batchNumber: z.string().optional(),
  serialNumber: z.string().optional(),
});

// ============================================
// SALES ORDER SCHEMAS
// ============================================

export const createSalesOrderSchema = z.object({
  orderNumber: z.string().max(50).nullable().optional(), // Optional: auto-generate if not provided
  orderDate: z.coerce.date(),
  requestedDeliveryDate: z.coerce.date().nullable(),
  customerId: z.string().uuid('Invalid customer ID'),
  salesRepId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  currencyCode: z.string().length(3).default('USD'),
  customerPoNumber: z.string().min(1, 'Customer PO number is required.').max(100),
  status: orderStatusSchema.default('draft'),
  productSource: productSourceSchema.optional(),
  orderSeries: z.string().max(20).nullable().optional(), // GDC 1, GDC 2, GDC 3
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  shippingMethod: z.string().max(100).nullable().optional(),
  items: z.array(createOrderItemSchema).min(1, 'At least one item is required'),
  customerNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
});

export const updateSalesOrderSchema = z.object({
  orderDate: z.coerce.date().optional(),
  requestedDeliveryDate: z.coerce.date().nullable().optional(),
  customerId: z.string().uuid('Invalid customer ID').optional(),
  salesRepId: z.string().uuid().nullable().optional(),
  warehouseId: z.string().uuid().nullable().optional(),
  currencyCode: z.string().length(3).optional(),
  customerPoNumber: z.string().min(1, 'Customer PO number is required.').max(100).optional(),
  productSource: productSourceSchema.optional(),
  orderSeries: z.string().max(20).nullable().optional(), // GDC 1, GDC 2, GDC 3
  billingAddress: addressSchema.optional(),
  shippingAddress: addressSchema.optional(),
  shippingMethod: z.string().max(100).nullable().optional(),
  customerNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
});

// ============================================
// FORM SCHEMAS (for client-side validation)
// ============================================

export const salesOrderFormSchema = z.object({
  orderNumber: z.string().optional(),
  orderDate: z.string().min(1, 'Order date is required'),
  requestedDeliveryDate: z.string().min(1, 'Requested delivery date is required'),
  customerId: z.string().min(1, 'Customer is required'),
  salesRepId: z.string().optional().default(''),
  warehouseId: z.string().optional().default(''),
  currencyId: z.string().optional().default('USD'),
  customerPoNumber: z.string().min(1, 'Customer PO number is required.'),
  orderSeries: z.string().min(1, 'Order series is required'),
  status: orderStatusSchema.default('draft'),
  billingAddress: addressFormSchema,
  shippingAddress: addressFormSchema,
  shippingMethodId: z.string().optional().default(''),
  items: z.array(orderItemFormSchema).min(1, 'At least one item is required'),
  customerNotes: z.string().optional().default(''),
  internalNotes: z.string().optional().default(''),
}).refine(
  (data) => {
    // Validate Requested Delivery Date is a future date
    if (!data.requestedDeliveryDate) return false;
    const deliveryDate = new Date(data.requestedDeliveryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    return deliveryDate > today;
  },
  {
    message: 'Requested delivery date must be a future date',
    path: ['requestedDeliveryDate'],
  }
).refine(
  (data) => {
    // Validate Requested Delivery Date is after Order Date
    if (!data.orderDate || !data.requestedDeliveryDate) return false;
    const orderDate = new Date(data.orderDate);
    const deliveryDate = new Date(data.requestedDeliveryDate);
    return deliveryDate > orderDate;
  },
  {
    message: 'Requested delivery date must be after order date',
    path: ['requestedDeliveryDate'],
  }
);

// ============================================
// LIST PARAMS SCHEMA
// ============================================

export const salesOrderListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: orderStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
  salesRepId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================
// STATUS TRANSITION SCHEMA
// ============================================

export const statusTransitionSchema = z.object({
  newStatus: orderStatusSchema,
  reason: z.string().max(1000).optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateSalesOrderInput = z.infer<typeof createSalesOrderSchema>;
export type UpdateSalesOrderInput = z.infer<typeof updateSalesOrderSchema>;
export type CreateOrderItemInput = z.infer<typeof createOrderItemSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
export type SalesOrderFormInput = z.infer<typeof salesOrderFormSchema>;
export type OrderItemFormInput = z.infer<typeof orderItemFormSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type AddressFormInput = z.infer<typeof addressFormSchema>;

// ============================================
// CONVERSION UTILITIES
// ============================================

/**
 * Convert form values to CreateSalesOrderDTO
 */
export function formToCreateDTO(form: SalesOrderFormInput) {
  return {
    orderNumber: form.orderNumber || null, // Manual entry or null for auto-generate
    orderDate: new Date(form.orderDate),
    requestedDeliveryDate: form.requestedDeliveryDate
      ? new Date(form.requestedDeliveryDate)
      : null,
    customerId: form.customerId,
    salesRepId: form.salesRepId || null,
    warehouseId: form.warehouseId || null,
    currencyCode: form.currencyId || 'USD',
    customerPoNumber: form.customerPoNumber,
    orderSeries: form.orderSeries || null,
    status: form.status as OrderStatus,
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
    shippingMethod: form.shippingMethodId || null,
    items: (() => {
      const allItems = form.items || [];
      const validItems = allItems.filter((item) => item.productId && item.productId.trim() !== '');

      console.log('[formToCreateDTO] Items filtering:', {
        totalItems: allItems.length,
        validItems: validItems.length,
        removedEmptyItems: allItems.length - validItems.length,
      });

      return validItems.map((item) => ({
        id: item.id, // Include ID for existing items (undefined for new items)
        productId: item.productId,
        sku: item.sku,
        description: item.description || null,
        quantity: Number(item.quantity),
        unitCode: item.unitId || 'EA',
        unitPrice: Math.round(Number(item.unitPrice) * 100), // dollars to cents
        discountPercent: Number(item.discountPercent),
        taxRate: getTaxRateFromId(item.taxRateId),
        warehouseId: item.warehouseId || null,
        batchNumber: item.batchNumber || null,
        serialNumber: item.serialNumber || null,
      }));
    })(),
    customerNotes: form.customerNotes || null,
    internalNotes: form.internalNotes || null,
  };
}

/**
 * Convert SalesOrder to form values
 */
export function orderToFormValues(order: {
  orderDate: Date;
  requestedDeliveryDate: Date | null;
  customerId: string;
  salesRepId: string | null;
  warehouseId: string | null;
  currencyCode: string;
  customerPoNumber: string | null;
  orderSeries: string | null;
  status: OrderStatus;
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
  shippingMethod: string | null;
  customerNotes: string | null;
  internalNotes: string | null;
  orderNumber: string;
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
    warehouseId: string | null;
    batchNumber: string | null;
    serialNumber: string | null;
  }>;
}): SalesOrderFormInput {
  // Helper to format date as YYYY-MM-DD string
  const formatDateStr = (date: Date): string => date.toISOString().slice(0, 10);

  return {
    orderNumber: order.orderNumber,
    orderDate: formatDateStr(order.orderDate),
    requestedDeliveryDate: order.requestedDeliveryDate
      ? formatDateStr(order.requestedDeliveryDate)
      : '',
    customerId: order.customerId,
    salesRepId: order.salesRepId || '',
    warehouseId: order.warehouseId || '',
    currencyId: order.currencyCode,
    customerPoNumber: order.customerPoNumber || '',
    orderSeries: order.orderSeries || '',
    status: order.status,
    billingAddress: {
      street: order.billingAddressStreet || '',
      city: order.billingAddressCity || '',
      state: order.billingAddressState || '',
      postalCode: order.billingAddressPostalCode || '',
      country: order.billingAddressCountry || 'US',
    },
    shippingAddress: {
      street: order.shippingAddressStreet || '',
      city: order.shippingAddressCity || '',
      state: order.shippingAddressState || '',
      postalCode: order.shippingAddressPostalCode || '',
      country: order.shippingAddressCountry || 'US',
    },
    shippingMethodId: order.shippingMethod || '',
    items: (order.items || []).map((item) => {
      const unitPrice = item.unitPrice / 100; // cents to dollars
      const subtotalAfterDiscount = calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent) / 100; // cents to dollars
      // Include tax in line total
      const taxAmount = subtotalAfterDiscount * (item.taxRate / 100);
      const lineTotal = subtotalAfterDiscount + taxAmount;
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
        warehouseId: item.warehouseId || undefined,
        batchNumber: item.batchNumber || undefined,
        serialNumber: item.serialNumber || undefined,
      };
    }),
    customerNotes: order.customerNotes || '',
    internalNotes: order.internalNotes || '',
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
  // Handle floating point comparison with tolerance
  for (const [id, rate] of Object.entries(TAX_RATES)) {
    if (Math.abs(rate - taxRate) < 0.01) {return id;}
  }
  return 'tax-003'; // Default to tax exempt
}

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Calculate line total for an order item (in cents)
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
 * Calculate order totals from items (all values in cents)
 */
export function calculateOrderTotals(
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxRate: number;
  }>,
  shippingCost: number = 0
): {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCost: number;
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

  const grandTotal = subtotal + taxTotal + shippingCost;

  return {
    subtotal,
    discountTotal,
    taxTotal,
    shippingCost,
    grandTotal,
  };
}
