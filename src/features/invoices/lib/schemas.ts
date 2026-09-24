/**
 * Invoices Validation Schemas
 *
 * Zod schemas for invoice validation.
 */

import { z } from 'zod';
import type { CreateInvoiceDTO, CreateInvoiceItemDTO, InvoiceTotals } from '../types';

// ============================================
// SHARED SCHEMAS
// ============================================

export const addressSchema = z.object({
  street: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
});

export const invoiceItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  salesOrderItemId: z.string().uuid().nullable().optional(),
  shipmentItemId: z.string().uuid().nullable().optional(),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().nullable(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitCode: z.string().default('EA'),
  unitPrice: z.number().int().min(0, 'Price must be non-negative'),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
});

// ============================================
// CREATE INVOICE SCHEMA
// ============================================

export const createInvoiceSchema = z.object({
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().nullable().optional(),
  customerId: z.string().uuid('Invalid customer ID'),
  salesOrderId: z.string().uuid().nullable().optional(),
  shipmentId: z.string().uuid().nullable().optional(),
  currencyCode: z.string().default('USD'),
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'] as const).default('draft'),
  paymentTerms: z.string().nullable().optional(),
  billingAddress: addressSchema,
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  customerNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ============================================
// UPDATE INVOICE SCHEMA
// ============================================

export const updateInvoiceSchema = z.object({
  invoiceDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  customerId: z.string().uuid().optional(),
  currencyCode: z.string().optional(),
  paymentTerms: z.string().nullable().optional(),
  billingAddress: addressSchema.optional(),
  customerNotes: z.string().nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  paymentNotes: z.string().nullable().optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

// ============================================
// RECORD PAYMENT SCHEMA
// ============================================

export const recordPaymentSchema = z.object({
  paymentDate: z.coerce.date(),
  amount: z.number().int().positive('Amount must be positive'),
  paymentMethod: z.string().nullable().optional(),
  referenceNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// ============================================
// CALCULATION HELPERS
// ============================================

/**
 * Calculate line total in cents (after discount)
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number
): number {
  const gross = quantity * unitPrice;
  const discount = Math.round(gross * (discountPercent / 100));
  return gross - discount;
}

/**
 * Calculate invoice totals from items
 */
export function calculateInvoiceTotals(
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxRate: number;
  }>
): InvoiceTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const gross = item.quantity * item.unitPrice;
    const discount = Math.round(gross * (item.discountPercent / 100));
    const lineTotal = gross - discount;

    subtotal += gross;
    discountTotal += discount;
    taxTotal += Math.round(lineTotal * (item.taxRate / 100));
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal: subtotal - discountTotal + taxTotal,
  };
}

// ============================================
// FORM SCHEMA (for client-side forms)
// ============================================

export const invoiceFormSchema = z.object({
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().optional(),
  customerId: z.string().min(1, 'Customer is required'),
  salesOrderId: z.string().optional(),
  shipmentId: z.string().optional(),
  currencyCode: z.string().default('USD'),
  paymentTerms: z.string().optional(),
  billingAddressStreet: z.string().optional(),
  billingAddressCity: z.string().optional(),
  billingAddressState: z.string().optional(),
  billingAddressPostalCode: z.string().optional(),
  billingAddressCountry: z.string().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

export type InvoiceFormInput = z.infer<typeof invoiceFormSchema>;

// ============================================
// FORM DATA CONVERSION
// ============================================

export function formToCreateDTO(
  form: InvoiceFormInput,
  items: CreateInvoiceItemDTO[]
): CreateInvoiceDTO {
  return {
    invoiceDate: new Date(form.invoiceDate),
    dueDate: form.dueDate ? new Date(form.dueDate) : null,
    customerId: form.customerId,
    salesOrderId: form.salesOrderId || null,
    shipmentId: form.shipmentId || null,
    currencyCode: form.currencyCode || 'USD',
    status: 'draft',
    paymentTerms: form.paymentTerms || null,
    billingAddress: {
      street: form.billingAddressStreet || null,
      city: form.billingAddressCity || null,
      state: form.billingAddressState || null,
      postalCode: form.billingAddressPostalCode || null,
      country: form.billingAddressCountry || null,
    },
    items,
    customerNotes: form.customerNotes || null,
    internalNotes: form.internalNotes || null,
  };
}
