/**
 * Locations Module - Zod Validation Schemas
 */

import { z } from 'zod';

// ============================================
// BASE SCHEMAS
// ============================================

/**
 * Location type enum
 */
export const locationTypeSchema = z.enum(['warehouse', 'drop_ship', 'virtual']);

/**
 * Location code format validation (uppercase alphanumeric with hyphens)
 */
export const locationCodeSchema = z
  .string()
  .min(1, 'Location code is required')
  .max(20, 'Location code must be 20 characters or less')
  .regex(/^[A-Z0-9\-]+$/, 'Location code must be uppercase letters, numbers, and hyphens only')
  .transform((val) => val.toUpperCase());

/**
 * Email validation
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .or(z.literal(''))
  .optional()
  .nullable();

/**
 * Phone validation (simple)
 */
export const phoneSchema = z
  .string()
  .max(20, 'Phone number too long')
  .optional()
  .nullable();

// ============================================
// CREATE LOCATION SCHEMA
// ============================================

export const createLocationSchema = z.object({
  locationCode: locationCodeSchema,
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less'),
  locationType: locationTypeSchema.default('warehouse'),
  address1: z.string().max(200, 'Address too long').optional().nullable(),
  address2: z.string().max(200, 'Address too long').optional().nullable(),
  city: z.string().max(100, 'City too long').optional().nullable(),
  state: z.string().max(50, 'State too long').optional().nullable(),
  zip: z.string().max(20, 'ZIP code too long').optional().nullable(),
  country: z.string().max(50, 'Country too long').default('US').optional().nullable(),
  contactName: z.string().max(100, 'Contact name too long').optional().nullable(),
  contactPhone: phoneSchema,
  contactEmail: emailSchema,
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

// ============================================
// UPDATE LOCATION SCHEMA
// ============================================

export const updateLocationSchema = z.object({
  locationCode: locationCodeSchema.optional(),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less')
    .optional(),
  locationType: locationTypeSchema.optional(),
  address1: z.string().max(200, 'Address too long').optional().nullable(),
  address2: z.string().max(200, 'Address too long').optional().nullable(),
  city: z.string().max(100, 'City too long').optional().nullable(),
  state: z.string().max(50, 'State too long').optional().nullable(),
  zip: z.string().max(20, 'ZIP code too long').optional().nullable(),
  country: z.string().max(50, 'Country too long').optional().nullable(),
  contactName: z.string().max(100, 'Contact name too long').optional().nullable(),
  contactPhone: phoneSchema,
  contactEmail: emailSchema,
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

// ============================================
// FORM SCHEMA (for client-side forms)
// ============================================

export const locationFormSchema = z.object({
  locationCode: z
    .string()
    .min(1, 'Location code is required')
    .max(20, 'Location code must be 20 characters or less')
    .regex(/^[A-Za-z0-9\-]+$/, 'Location code must be letters, numbers, and hyphens only'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be 100 characters or less'),
  locationType: locationTypeSchema,
  address1: z.string().max(200, 'Address too long').optional(),
  address2: z.string().max(200, 'Address too long').optional(),
  city: z.string().max(100, 'City too long').optional(),
  state: z.string().max(50, 'State too long').optional(),
  zip: z.string().max(20, 'ZIP code too long').optional(),
  country: z.string().max(50, 'Country too long').optional(),
  contactName: z.string().max(100, 'Contact name too long').optional(),
  contactPhone: z.string().max(20, 'Phone number too long').optional(),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  isActive: z.boolean(),
  isDefault: z.boolean(),
});

export type LocationFormInput = z.infer<typeof locationFormSchema>;

// ============================================
// QUERY PARAMS SCHEMA
// ============================================

export const locationListParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
  locationType: locationTypeSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sortBy: z
    .enum(['locationCode', 'name', 'locationType', 'city', 'state', 'isActive', 'createdAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type LocationListParamsInput = z.infer<typeof locationListParamsSchema>;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert form values to API DTO
 */
export function formToCreateDTO(values: LocationFormInput): CreateLocationInput {
  return {
    locationCode: values.locationCode.toUpperCase(),
    name: values.name,
    locationType: values.locationType,
    address1: values.address1 || null,
    address2: values.address2 || null,
    city: values.city || null,
    state: values.state || null,
    zip: values.zip || null,
    country: values.country || 'US',
    contactName: values.contactName || null,
    contactPhone: values.contactPhone || null,
    contactEmail: values.contactEmail || null,
    isActive: values.isActive,
    isDefault: values.isDefault,
  };
}

/**
 * Convert API data to form values
 */
export function locationToFormValues(location: {
  locationCode: string;
  name: string;
  locationType: 'warehouse' | 'drop_ship' | 'virtual';
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
  isDefault: boolean;
}): LocationFormInput {
  return {
    locationCode: location.locationCode,
    name: location.name,
    locationType: location.locationType,
    address1: location.address1 || '',
    address2: location.address2 || '',
    city: location.city || '',
    state: location.state || '',
    zip: location.zip || '',
    country: location.country || 'US',
    contactName: location.contactName || '',
    contactPhone: location.contactPhone || '',
    contactEmail: location.contactEmail || '',
    isActive: location.isActive,
    isDefault: location.isDefault,
  };
}

/**
 * Format address for display
 */
export function formatAddress(location: {
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}): string {
  const parts: string[] = [];

  if (location.address1) {parts.push(location.address1);}
  if (location.address2) {parts.push(location.address2);}

  const cityStateZip: string[] = [];
  if (location.city) {cityStateZip.push(location.city);}
  if (location.state) {cityStateZip.push(location.state);}
  if (location.zip) {cityStateZip.push(location.zip);}

  if (cityStateZip.length > 0) {parts.push(cityStateZip.join(', '));}
  if (location.country && location.country !== 'US') {parts.push(location.country);}

  return parts.join('\n');
}
