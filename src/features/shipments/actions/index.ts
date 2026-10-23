/**
 * Shipments Server Actions
 *
 * Next.js server actions for Shipments feature.
 * All mutating actions are permission-gated.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { shipmentService } from '../services/shipment.service';
import { poReceivingService } from '@/features/inventory/services/po-receiving.service';
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

/**
 * Pipedrive deal of the shipment's sales order: ERP Order Status, Shipment ETA
 * and Container Status (gdc/order-status.service). Background; never fails.
 */
function syncShipmentToPipedrive(shipmentId: string): void {
  void import('@/features/pipedrive/gdc/order-status.service')
    .then(({ syncShipmentDealInBackground }) => syncShipmentDealInBackground(shipmentId))
    .catch((error) => console.error('[Pipedrive] Shipment sync could not start:', error));
}

// ============================================
// UPDATE SHIPMENT
// ============================================

export async function updateShipment(id: string, data: UpdateShipmentInput) {
  const auth = await authorize('shipments.edit');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;

  // Container numbers are matched exactly by the CMA CGM API
  if (data.containerNumber) {
    data = { ...data, containerNumber: data.containerNumber.replace(/\s+/g, '').toUpperCase() };
  }
  const before = data.containerNumber ? await shipmentService.getById(id) : null;

  const result = await shipmentService.update(id, data, userId);

  if (result.success) {
    // A new or changed container number is tracked right away instead of
    // waiting for the daily sync. Tracking problems never fail the save.
    if (data.containerNumber && before?.data?.containerNumber !== data.containerNumber) {
      try {
        const { syncShipmentContainer } = await import('@/features/shipping/services');
        await syncShipmentContainer(id);
      } catch (error) {
        console.error('[updateShipment] Container tracking failed:', error);
      }
    }

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    syncShipmentToPipedrive(id);
  }

  return result;
}

// ============================================
// TRACK CONTAINER NOW (CMA CGM)
// ============================================

export async function trackShipmentNow(
  id: string
): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const auth = await authorize('shipments.track');
  if (!auth.ok) {return { success: false, error: auth.result.error || 'Not allowed' };}

  const { syncShipmentContainer } = await import('@/features/shipping/services');
  const result = await syncShipmentContainer(id);

  if (result.success) {
    revalidatePath('/shipments');
    revalidatePath('/operations');
    syncShipmentToPipedrive(id);
  }

  return result.success
    ? { success: true as const, message: result.message }
    : { success: false as const, error: result.message };
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
    syncShipmentToPipedrive(id);
  }

  return result;
}

export async function markShipmentDelivered(id: string) {
  const auth = await authorize('shipments.confirm_delivery');
  if (!auth.ok) return auth.result;

  const userId = auth.user.id;
  // Read before the update: stock is received only on the change to delivered
  const wasDelivered = await poReceivingService.isShipmentDelivered(id);
  const result = await shipmentService.markDelivered(id, userId);

  if (result.success) {
    // Container delivered: put clear stock POs into warehouse stock (once)
    if (!wasDelivered) {
      await poReceivingService.autoReceiveForShipment(id, userId);
      revalidatePath('/inventory');
    }
    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    syncShipmentToPipedrive(id);
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
    syncShipmentToPipedrive(id);
  }

  return result;
}

// ============================================
// UPDATE LOAD STATUS (Operations Dashboard)
// ============================================

import type { LoadStatus } from '../types';
import { db } from '@/shared/lib/supabase/database';

/**
 * Update shipment's load status (for Operations Dashboard)
 * Available, Sold, Open, Hold, In Transit, Invoiced, etc.
 */
export async function updateShipmentLoadStatus(
  id: string,
  loadStatus: LoadStatus
): Promise<ActionResult> {
  const auth = await authorize('shipments.edit');
  if (!auth.ok) return auth.result;

  try {
    const { error } = await db
      .from('shipments')
      .update({
        load_status: loadStatus,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      console.error('updateShipmentLoadStatus error:', error);
      return { success: false, error: 'Failed to update shipment status' };
    }

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    revalidatePath('/operations');

    return { success: true };
  } catch (error) {
    console.error('updateShipmentLoadStatus error:', error);
    return { success: false, error: 'Failed to update shipment status' };
  }
}

/**
 * Update shipment's tracking status (pending, in_transit, delivered, failed)
 */
export async function updateShipmentTrackingStatus(
  id: string,
  status: 'pending' | 'in_transit' | 'delivered' | 'failed'
): Promise<ActionResult> {
  const auth = await authorize('shipments.update_status');
  if (!auth.ok) return auth.result;

  try {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };

    // If marking as delivered, also set actual_arrival
    if (status === 'delivered') {
      updateData.actual_arrival = new Date().toISOString().split('T')[0];
    }

    // If marking as in_transit, also update load_status
    if (status === 'in_transit') {
      updateData.load_status = 'in_transit';
    }

    // Read before the update: stock is received only on the change to delivered
    const wasDelivered = await poReceivingService.isShipmentDelivered(id);

    const { error } = await db
      .from('shipments')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      console.error('updateShipmentTrackingStatus error:', error);
      return { success: false, error: 'Failed to update shipment status' };
    }

    // Container delivered: put clear stock POs into warehouse stock (once)
    if (status === 'delivered' && !wasDelivered) {
      await poReceivingService.autoReceiveForShipment(id, auth.user.id);
      revalidatePath('/inventory');
    }

    revalidatePath('/shipments');
    revalidatePath(`/shipments/${id}`);
    revalidatePath('/operations');
    syncShipmentToPipedrive(id);

    return { success: true };
  } catch (error) {
    console.error('updateShipmentTrackingStatus error:', error);
    return { success: false, error: 'Failed to update shipment status' };
  }
}

// ============================================
// CREATE SHIPMENT FROM PURCHASE ORDER
// ============================================

/**
 * Shipments normally appear automatically when a PO is confirmed. These
 * actions back the "Create Shipment" button for POs that ended up without
 * one, reusing the same creation logic as the automatic flow.
 */

/** PO statuses that come before supplier confirmation or are closed */
const PO_STATUSES_WITHOUT_SHIPMENT = ['draft', 'sent', 'cancelled'];

export interface PurchaseOrderWithoutShipment {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string | null;
}

export async function listPurchaseOrdersWithoutShipment(): Promise<
  { success: true; data: PurchaseOrderWithoutShipment[] } | { success: false; error: string }
> {
  const auth = await authorize('shipments.create');
  if (!auth.ok) {return { success: false, error: auth.result.error || 'Not allowed' };}

  const [{ data: pos, error: poError }, { data: shipments, error: shipmentError }] = await Promise.all([
    db
      .from('purchase_orders')
      .select('id, po_number, status, po_date')
      .is('deleted_at', null)
      .not('status', 'in', `(${PO_STATUSES_WITHOUT_SHIPMENT.join(',')})`)
      .order('created_at', { ascending: false }),
    db
      .from('shipments')
      .select('purchase_order_id')
      .not('purchase_order_id', 'is', null)
      .is('deleted_at', null),
  ]);

  if (poError || shipmentError) {
    console.error('[listPurchaseOrdersWithoutShipment]', poError || shipmentError);
    return { success: false, error: 'Failed to load purchase orders' };
  }

  const withShipment = new Set((shipments || []).map((s) => s.purchase_order_id));

  return {
    success: true,
    data: (pos || [])
      .filter((po) => !withShipment.has(po.id))
      .map((po) => ({
        id: po.id,
        poNumber: po.po_number,
        status: po.status,
        orderDate: po.po_date,
      })),
  };
}

export async function createShipmentFromPurchaseOrder(
  purchaseOrderId: string
): Promise<{ success: true; shipmentId: string; shipmentNumber: string } | { success: false; error: string }> {
  const auth = await authorize('shipments.create');
  if (!auth.ok) {return { success: false, error: auth.result.error || 'Not allowed' };}

  const { data: po } = await db
    .from('purchase_orders')
    .select('id, status')
    .eq('id', purchaseOrderId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!po) {
    return { success: false, error: 'Purchase order not found' };
  }
  if (PO_STATUSES_WITHOUT_SHIPMENT.includes(po.status)) {
    return { success: false, error: 'The supplier must confirm this PO before it can ship' };
  }

  try {
    const { purchaseOrderService } = await import('@/features/purchase-orders/services');
    // Returns early (no duplicate) when the PO already has a shipment
    await purchaseOrderService.createSupplierShipment(purchaseOrderId, auth.user.id);
  } catch (error) {
    console.error('[createShipmentFromPurchaseOrder]', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create shipment' };
  }

  const { data: shipment } = await db
    .from('shipments')
    .select('id, shipment_number')
    .eq('purchase_order_id', purchaseOrderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shipment) {
    return { success: false, error: 'Shipment could not be created' };
  }

  revalidatePath('/shipments');
  revalidatePath('/operations');

  return { success: true, shipmentId: shipment.id, shipmentNumber: shipment.shipment_number };
}
