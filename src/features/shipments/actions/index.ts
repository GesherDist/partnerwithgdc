/**
 * Shipments Server Actions
 *
 * Next.js server actions for Shipments feature.
 * All mutating actions are permission-gated.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { shipmentService } from '../services/shipment.service';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import type { ShipmentListParams } from '../types';
import type {
  CreateShipmentInput,
  UpdateShipmentInput,
} from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Verify current user has the required permission
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

// Note: getCurrentUserId removed - we now use authorize() which returns user.id

// ============================================
// LIST SHIPMENTS
// ============================================

export async function listShipments(params: ShipmentListParams = {}) {
  // List is view-only, requires view_module permission
  const auth = await authorize('shipments.view_module');
  if (!auth.ok) return auth.result;

  const result = await shipmentService.list(params);
  return result;
}

// ============================================
// GET SHIPMENT
// ============================================

export async function getShipment(id: string) {
  // Get detail requires view_detail permission
  const auth = await authorize('shipments.view_detail');
  if (!auth.ok) return auth.result;

  const result = await shipmentService.getById(id);
  return result;
}

// ============================================
// CREATE SHIPMENT
// ============================================

export async function createShipment(data: CreateShipmentInput) {
  const auth = await authorize('shipments.create');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;
  const result = await shipmentService.create(data, userId);

  if (result.success) {
    revalidatePath('/shipments');
  }

  return result;
}

// ============================================
// UPDATE SHIPMENT
// ============================================

export async function updateShipment(id: string, data: UpdateShipmentInput) {
  const auth = await authorize('shipments.edit');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;
  const result = await shipmentService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}

// ============================================
// DELETE SHIPMENT
// ============================================

export async function deleteShipment(id: string) {
  const auth = await authorize('shipments.delete');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;
  const result = await shipmentService.delete(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
  }

  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export async function markShipmentInTransit(id: string) {
  const auth = await authorize('shipments.update_status');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;
  const result = await shipmentService.markInTransit(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}

export async function markShipmentDelivered(id: string) {
  const auth = await authorize('shipments.confirm_delivery');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;
  const result = await shipmentService.markDelivered(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}

export async function markShipmentFailed(id: string) {
  const auth = await authorize('shipments.update_status');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;
  const result = await shipmentService.markFailed(id, userId);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
  }

  return result;
}
