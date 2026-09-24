/**
 * Pick Tickets Validation Schemas
 *
 * Zod schemas for pick ticket validation.
 */

import { z } from 'zod';
import type {
  CreatePickTicketDTO,
  CreatePickTicketItemDTO,
  CreatePackingListDTO,
  CreatePackingListItemDTO,
} from '../types';

// ============================================
// PICK TICKET ITEM SCHEMA
// ============================================

export const pickTicketItemSchema = z.object({
  salesOrderItemId: z.string().uuid('Invalid sales order item ID'),
  productId: z.string().uuid('Invalid product ID'),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().nullable(),
  binLocation: z.string().nullable().optional(),
  quantityToPick: z.number().int().positive('Quantity must be positive'),
});

// ============================================
// CREATE PICK TICKET SCHEMA
// ============================================

export const createPickTicketSchema = z.object({
  pickTicketNumber: z.string().max(50).nullable().optional(), // Optional: auto-generate if not provided
  salesOrderId: z.string().uuid('Invalid sales order ID'),
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  assignedTo: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent'] as const).default('normal'),
  notes: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
  items: z.array(pickTicketItemSchema).min(1, 'At least one item is required'),
});

export type CreatePickTicketInput = z.infer<typeof createPickTicketSchema>;

// ============================================
// UPDATE PICK TICKET SCHEMA
// ============================================

export const updatePickTicketSchema = z.object({
  assignedTo: z.string().uuid().nullable().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent'] as const).optional(),
  notes: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
});

export type UpdatePickTicketInput = z.infer<typeof updatePickTicketSchema>;

// ============================================
// PICK ITEM SCHEMA (for marking items as picked)
// ============================================

export const pickItemSchema = z.object({
  pickTicketItemId: z.string().uuid('Invalid pick ticket item ID'),
  quantityPicked: z.number().int().min(0, 'Quantity cannot be negative'),
});

export type PickItemInput = z.infer<typeof pickItemSchema>;

export const pickItemsSchema = z.object({
  items: z.array(pickItemSchema).min(1, 'At least one item is required'),
});

export type PickItemsInput = z.infer<typeof pickItemsSchema>;

// ============================================
// PACKING LIST ITEM SCHEMA
// ============================================

export const packingListItemSchema = z.object({
  pickTicketItemId: z.string().uuid('Invalid pick ticket item ID'),
  productId: z.string().uuid('Invalid product ID'),
  sku: z.string().min(1, 'SKU is required'),
  description: z.string().nullable(),
  quantityPacked: z.number().int().positive('Quantity must be positive'),
  packageNumber: z.number().int().positive('Package number must be positive'),
  weight: z.number().nullable().optional(),
});

// ============================================
// CREATE PACKING LIST SCHEMA
// ============================================

export const createPackingListSchema = z.object({
  pickTicketId: z.string().uuid('Invalid pick ticket ID'),
  salesOrderId: z.string().uuid('Invalid sales order ID'),
  totalPackages: z.number().int().min(1).default(1),
  totalWeight: z.number().nullable().optional(),
  weightUnit: z.string().default('lbs'),
  notes: z.string().nullable().optional(),
  items: z.array(packingListItemSchema).min(1, 'At least one item is required'),
});

export type CreatePackingListInput = z.infer<typeof createPackingListSchema>;

// ============================================
// FORM SCHEMA (for client-side forms)
// ============================================

export const pickTicketFormSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales order is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  assignedTo: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent'] as const).default('normal'),
  notes: z.string().optional(),
  specialInstructions: z.string().optional(),
});

export type PickTicketFormInput = z.infer<typeof pickTicketFormSchema>;

// ============================================
// FORM DATA CONVERSION
// ============================================

export function formToCreateDTO(
  form: PickTicketFormInput,
  items: CreatePickTicketItemDTO[]
): CreatePickTicketDTO {
  return {
    salesOrderId: form.salesOrderId,
    warehouseId: form.warehouseId,
    assignedTo: form.assignedTo || null,
    priority: form.priority || 'normal',
    notes: form.notes || null,
    specialInstructions: form.specialInstructions || null,
    items,
  };
}

export function formToPackingListDTO(
  pickTicketId: string,
  salesOrderId: string,
  items: CreatePackingListItemDTO[],
  options?: {
    totalPackages?: number;
    totalWeight?: number | null;
    weightUnit?: string;
    notes?: string | null;
  }
): CreatePackingListDTO {
  return {
    pickTicketId,
    salesOrderId,
    totalPackages: options?.totalPackages || 1,
    totalWeight: options?.totalWeight || null,
    weightUnit: options?.weightUnit || 'lbs',
    notes: options?.notes || null,
    items,
  };
}

// ============================================
// ASSIGN PICK TICKET SCHEMA
// ============================================

export const assignPickTicketSchema = z.object({
  assignedTo: z.string().uuid('Invalid user ID'),
});

export type AssignPickTicketInput = z.infer<typeof assignPickTicketSchema>;

// ============================================
// STATUS TRANSITION SCHEMA
// ============================================

export const transitionStatusSchema = z.object({
  status: z.enum([
    'pending',
    'assigned',
    'picking',
    'picked',
    'packing',
    'packed',
    'shipped',
    'cancelled',
  ] as const),
});

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;
