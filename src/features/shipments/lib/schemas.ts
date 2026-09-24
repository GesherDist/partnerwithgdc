/**
 * Shipments Validation Schemas
 *
 * Zod schemas for shipment validation.
 */

import { z } from 'zod';
import type { CreateShipmentDTO, CreateShipmentItemDTO } from '../types';

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

export const shipmentItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  salesOrderItemId: z.string().uuid().nullable().optional(),
  purchaseOrderItemId: z.string().uuid().nullable().optional(),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().nullable(),
  quantityShipped: z.number().int().positive('Quantity must be positive'),
});

// ============================================
// CREATE SHIPMENT SCHEMA
// ============================================

export const createShipmentSchema = z.object({
  shipmentDate: z.coerce.date(),
  estimatedArrival: z.coerce.date().nullable().optional(),
  salesOrderId: z.string().uuid().nullable().optional(),
  purchaseOrderId: z.string().uuid().nullable().optional(),
  carrier: z.string().nullable().optional(),
  trackingNumber: z.string().nullable().optional(),
  serviceType: z.string().nullable().optional(),
  fromLocationId: z.string().uuid().nullable().optional(),
  shipToName: z.string().nullable().optional(),
  shipToAddress: addressSchema,
  totalWeight: z.number().nullable().optional(),
  weightUnit: z.string().default('lbs'),
  totalPackages: z.number().int().min(1).default(1),
  status: z.enum(['pending', 'in_transit', 'delivered', 'failed'] as const).default('pending'),
  items: z.array(shipmentItemSchema).min(1, 'At least one item is required'),
  notes: z.string().nullable().optional(),
  deliveryInstructions: z.string().nullable().optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

// ============================================
// UPDATE SHIPMENT SCHEMA
// ============================================

export const updateShipmentSchema = z.object({
  shipmentDate: z.coerce.date().optional(),
  estimatedArrival: z.coerce.date().nullable().optional(),
  actualArrival: z.coerce.date().nullable().optional(),
  carrier: z.string().nullable().optional(),
  trackingNumber: z.string().nullable().optional(),
  serviceType: z.string().nullable().optional(),
  fromLocationId: z.string().uuid().nullable().optional(),
  shipToName: z.string().nullable().optional(),
  shipToAddress: addressSchema.optional(),
  totalWeight: z.number().nullable().optional(),
  weightUnit: z.string().optional(),
  totalPackages: z.number().int().min(1).optional(),
  notes: z.string().nullable().optional(),
  deliveryInstructions: z.string().nullable().optional(),
  lfdDate: z.coerce.date().nullable().optional(),
});

export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;

// ============================================
// FORM SCHEMA (for client-side forms)
// ============================================

export const shipmentFormSchema = z.object({
  shipmentDate: z.string().min(1, 'Shipment date is required'),
  estimatedArrival: z.string().optional(),
  salesOrderId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  carrier: z.string().optional(),
  trackingNumber: z.string().optional(),
  serviceType: z.string().optional(),
  fromLocationId: z.string().optional(),
  shipToName: z.string().optional(),
  shipToAddressStreet: z.string().optional(),
  shipToAddressCity: z.string().optional(),
  shipToAddressState: z.string().optional(),
  shipToAddressPostalCode: z.string().optional(),
  shipToAddressCountry: z.string().optional(),
  totalWeight: z.number().optional(),
  weightUnit: z.string().default('lbs'),
  totalPackages: z.number().int().min(1).default(1),
  notes: z.string().optional(),
  deliveryInstructions: z.string().optional(),
});

export type ShipmentFormInput = z.infer<typeof shipmentFormSchema>;

// ============================================
// FORM DATA CONVERSION
// ============================================

export function formToCreateDTO(
  form: ShipmentFormInput,
  items: CreateShipmentItemDTO[]
): CreateShipmentDTO {
  return {
    shipmentDate: new Date(form.shipmentDate),
    estimatedArrival: form.estimatedArrival
      ? new Date(form.estimatedArrival)
      : null,
    salesOrderId: form.salesOrderId || null,
    purchaseOrderId: form.purchaseOrderId || null,
    carrier: form.carrier || null,
    trackingNumber: form.trackingNumber || null,
    serviceType: form.serviceType || null,
    fromLocationId: form.fromLocationId || null,
    shipToName: form.shipToName || null,
    shipToAddress: {
      street: form.shipToAddressStreet || null,
      city: form.shipToAddressCity || null,
      state: form.shipToAddressState || null,
      postalCode: form.shipToAddressPostalCode || null,
      country: form.shipToAddressCountry || null,
    },
    totalWeight: form.totalWeight || null,
    weightUnit: form.weightUnit || 'lbs',
    totalPackages: form.totalPackages || 1,
    status: 'pending',
    items,
    notes: form.notes || null,
    deliveryInstructions: form.deliveryInstructions || null,
  };
}
