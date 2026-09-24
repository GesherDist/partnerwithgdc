/**
 * Customer Zod Schemas
 *
 * Validation schemas for Customer module.
 * Handles form validation, API validation, and data transformation.
 */

import { z } from 'zod';
import type { Customer, CustomerFormValues } from '../types';

// ============================================
// ENUMS (must match database enum values exactly)
// ============================================

export const customerStatusSchema = z.enum(['active', 'inactive']);
export const customerChannelSchema = z.enum(['oem', 'dealer']);
export const creditStatusSchema = z.enum(['approved', 'pending', 'hold', 'suspended', 'blocked', 'rejected']);

// ============================================
// BASE FIELD SCHEMAS
// ============================================

export const customerCodeSchema = z
  .string()
  .min(1, 'Customer code is required')
  .max(50, 'Customer code must be 50 characters or less')
  .regex(/^[A-Z0-9\-]+$/, 'Must be uppercase alphanumeric with hyphens only');

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(255, 'Email must be 255 characters or less')
  .optional()
  .or(z.literal(''))
  .transform((val) => (val === '' ? null : val));

export const phoneSchema = z
  .string()
  .max(20, 'Phone must be 20 characters or less')
  .optional()
  .or(z.literal(''))
  .transform((val) => (val === '' ? null : val));

export const urlSchema = z
  .string()
  .url('Invalid URL')
  .max(255, 'URL must be 255 characters or less')
  .optional()
  .or(z.literal(''))
  .transform((val) => (val === '' ? null : val));

// ============================================
// ADDRESS SCHEMAS
// ============================================

export const addressSchema = z.object({
  address1: z.string().max(200).nullable().optional(),
  address2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  country: z.string().max(50).nullable().optional(),
});

export const addressFormSchema = z.object({
  address1: z.string().max(200).optional().default(''),
  address2: z.string().max(200).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(50).optional().default(''),
  zip: z.string().max(20).optional().default(''),
  country: z.string().max(50).optional().default('US'),
});

// ============================================
// CREATE/UPDATE SCHEMAS (API validation)
// ============================================

export const createCustomerSchema = z.object({
  customerCode: customerCodeSchema,
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  legalName: z.string().max(255).nullable().optional(),
  channel: customerChannelSchema.default('dealer'),

  // Billing Address
  address1: z.string().max(200).nullable().optional(),
  address2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  country: z.string().max(50).nullable().optional().default('US'),

  // Shipping Address
  shippingAddress1: z.string().max(200).nullable().optional(),
  shippingAddress2: z.string().max(200).nullable().optional(),
  shippingCity: z.string().max(100).nullable().optional(),
  shippingState: z.string().max(50).nullable().optional(),
  shippingZip: z.string().max(20).nullable().optional(),
  shippingCountry: z.string().max(50).nullable().optional().default('US'),
  useSeparateShipping: z.boolean().default(false),

  // Contact
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional()
    .or(z.literal('').transform(() => null)),
  website: z.string().url().max(255).nullable().optional()
    .or(z.literal('').transform(() => null)),

  // Tax
  taxId: z.string().max(50).nullable().optional(),
  taxExempt: z.boolean().default(false),
  taxExemptNumber: z.string().max(50).nullable().optional(),
  taxExemptExpiryAt: z.string().nullable().optional(), // ISO date string

  // Credit
  creditStatus: creditStatusSchema.default('pending'),
  creditLimit: z.number().int().min(0).default(0),
  openBalance: z.number().int().min(0).default(0),
  creditTerms: z.string().max(50).nullable().optional(),

  // Settings
  preferredLocationId: z.string().uuid().nullable().optional()
    .or(z.literal('').transform(() => null)),
  defaultPaymentMethod: z.string().max(50).nullable().optional(),
  status: customerStatusSchema.default('active'),
  internalNotes: z.string().nullable().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ============================================
// FORM SCHEMAS (client-side validation)
// ============================================

export const customerFormSchema = z.object({
  // customerCode is auto-generated, so it's optional in the form
  customerCode: z
    .string()
    .max(50, 'Customer code must be 50 characters or less')
    .optional()
    .default(''),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less'),
  legalName: z.string().max(255).optional().default(''),
  channel: customerChannelSchema.default('dealer'),

  // Billing Address
  address1: z.string().max(200).optional().default(''),
  address2: z.string().max(200).optional().default(''),
  city: z.string().max(100).optional().default(''),
  state: z.string().max(50).optional().default(''),
  zip: z.string().max(20).optional().default(''),
  country: z.string().max(50).optional().default('US'),

  // Shipping Address
  shippingAddress1: z.string().max(200).optional().default(''),
  shippingAddress2: z.string().max(200).optional().default(''),
  shippingCity: z.string().max(100).optional().default(''),
  shippingState: z.string().max(50).optional().default(''),
  shippingZip: z.string().max(20).optional().default(''),
  shippingCountry: z.string().max(50).optional().default('US'),
  useSeparateShipping: z.boolean().default(false),

  // Contact
  phone: z.string().max(20).optional().default(''),
  email: z.union([
    z.string().email('Invalid email').max(255),
    z.literal(''),
  ]).optional().default(''),
  website: z.union([
    z.string().url('Invalid URL').max(255),
    z.literal(''),
  ]).optional().default(''),

  // Tax
  taxId: z.string().max(50).optional().default(''),
  taxExempt: z.boolean().default(false),
  taxExemptNumber: z.string().max(50).optional().default(''),
  taxExemptExpiryAt: z.string().optional().default(''), // YYYY-MM-DD format

  // Credit
  creditStatus: creditStatusSchema.default('pending'),
  creditLimit: z.string().optional().default('0'),
  openBalance: z.string().optional().default('0'),
  creditTerms: z.string().max(50).optional().default('Net 30'),

  // Settings
  preferredLocationId: z.union([
    z.string().uuid(),
    z.literal(''),
  ]).optional().default(''),
  defaultPaymentMethod: z.string().max(50).optional().default(''),
  status: customerStatusSchema.default('active'),
  internalNotes: z.string().optional().default(''),
});

// ============================================
// LIST PARAMS SCHEMA
// ============================================

export const customerListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  status: customerStatusSchema.optional(),
  channel: customerChannelSchema.optional(),
  creditStatus: creditStatusSchema.optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFormInput = z.infer<typeof customerFormSchema>;
export type CustomerListParamsInput = z.infer<typeof customerListParamsSchema>;

// ============================================
// CUSTOMER CONTACT SCHEMAS
// ============================================

export const contactTypeSchema = z.enum([
  'purchasing',
  'accounts_payable',
  'receiving',
]);

export const createCustomerContactSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  firstName: z.string().min(1, 'First name is required').max(100, 'First name must be 100 characters or less'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name must be 100 characters or less'),
  contactType: contactTypeSchema.default('purchasing'),
  email: z.string().email('Invalid email address').max(255).nullable().optional()
    .or(z.literal('').transform(() => null)),
  phone: z.string().max(20).nullable().optional(),
  mobile: z.string().max(20).nullable().optional(),
});

export const updateCustomerContactSchema = createCustomerContactSchema
  .omit({ customerId: true })
  .partial();

export type CreateCustomerContactInput = z.infer<typeof createCustomerContactSchema>;
export type UpdateCustomerContactInput = z.infer<typeof updateCustomerContactSchema>;

// ============================================
// CONVERSION UTILITIES
// ============================================

/**
 * Convert form values to CreateCustomerDTO
 */
export function formToCreateDTO(form: CustomerFormInput): CreateCustomerInput {
  return {
    customerCode: (form.customerCode || '').toUpperCase(),
    name: form.name,
    legalName: form.legalName || null,
    channel: form.channel,

    // Billing Address
    address1: form.address1 || null,
    address2: form.address2 || null,
    city: form.city || null,
    state: form.state || null,
    zip: form.zip || null,
    country: form.country || 'US',

    // Shipping Address
    shippingAddress1: form.shippingAddress1 || null,
    shippingAddress2: form.shippingAddress2 || null,
    shippingCity: form.shippingCity || null,
    shippingState: form.shippingState || null,
    shippingZip: form.shippingZip || null,
    shippingCountry: form.shippingCountry || 'US',
    useSeparateShipping: form.useSeparateShipping,

    // Contact
    phone: form.phone || null,
    email: form.email || null,
    website: form.website || null,

    // Tax
    taxId: form.taxId || null,
    taxExempt: form.taxExempt,
    taxExemptNumber: form.taxExemptNumber || null,
    taxExemptExpiryAt: form.taxExemptExpiryAt || null,

    // Credit
    creditStatus: form.creditStatus,
    creditLimit: Math.round(parseFloat(form.creditLimit || '0') * 100), // dollars to cents
    openBalance: Math.round(parseFloat(form.openBalance || '0') * 100), // dollars to cents
    creditTerms: form.creditTerms || null,

    // Settings
    preferredLocationId: form.preferredLocationId || null,
    defaultPaymentMethod: form.defaultPaymentMethod || null,
    status: form.status,
    internalNotes: form.internalNotes || null,
  };
}

/**
 * Convert Customer entity to form values
 */
export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    customerCode: customer.customerCode,
    name: customer.name,
    legalName: customer.legalName || '',
    channel: customer.channel,

    // Billing Address
    address1: customer.address1 || '',
    address2: customer.address2 || '',
    city: customer.city || '',
    state: customer.state || '',
    zip: customer.zip || '',
    country: customer.country || 'US',

    // Shipping Address
    shippingAddress1: customer.shippingAddress1 || '',
    shippingAddress2: customer.shippingAddress2 || '',
    shippingCity: customer.shippingCity || '',
    shippingState: customer.shippingState || '',
    shippingZip: customer.shippingZip || '',
    shippingCountry: customer.shippingCountry || 'US',
    useSeparateShipping: customer.useSeparateShipping,

    // Contact
    phone: customer.phone || '',
    email: customer.email || '',
    website: customer.website || '',

    // Tax
    taxId: customer.taxId || '',
    taxExempt: customer.taxExempt,
    taxExemptNumber: customer.taxExemptNumber || '',
    taxExemptExpiryAt: customer.taxExemptExpiryAt || '',

    // Credit
    creditStatus: customer.creditStatus,
    creditLimit: (customer.creditLimit / 100).toFixed(2), // cents to dollars
    openBalance: (customer.openBalance / 100).toFixed(2), // cents to dollars
    creditTerms: customer.creditTerms || 'Net 30',

    // Settings
    preferredLocationId: customer.preferredLocationId || '',
    defaultPaymentMethod: customer.defaultPaymentMethod || '',
    status: customer.status,
    internalNotes: customer.internalNotes || '',
  };
}

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format credit limit for display
 */
export function formatCreditLimit(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format open balance for display
 */
export function formatOpenBalance(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string | null): string {
  if (!phone) {return '';}
  // Simple formatting for US phone numbers
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}
