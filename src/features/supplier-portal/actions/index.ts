'use server';

/**
 * Supplier Portal Server Actions
 *
 * Server actions for supplier portal operations.
 * All actions verify the user is a supplier and has appropriate permissions.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import * as service from '../services/supplier-portal.service';
import type {
  ConfirmPOInput,
  RejectPOInput,
  UpdateProductionInput,
  UpdateShipmentInput,
} from '../types';

import type {
  SupplierPOConfirmedPayload,
  SupplierPORejectedPayload,
  SupplierProductionUpdatePayload,
  SupplierShipmentUpdatePayload,
} from '@/features/notifications/types';

// Notification payload union type
type NotificationPayload =
  | { type: 'po_confirmed'; payload: SupplierPOConfirmedPayload }
  | { type: 'po_rejected'; payload: SupplierPORejectedPayload }
  | { type: 'production_update'; payload: SupplierProductionUpdatePayload }
  | { type: 'shipment_update'; payload: SupplierShipmentUpdatePayload };

// Helper to send notifications without blocking the response
async function sendNotification(notification: NotificationPayload) {
  try {
    const { notificationService } = await import('@/features/notifications/services/notification.service');

    switch (notification.type) {
      case 'po_confirmed':
        await notificationService.notifySupplierPOConfirmed(notification.payload);
        break;
      case 'po_rejected':
        await notificationService.notifySupplierPORejected(notification.payload);
        break;
      case 'production_update':
        await notificationService.notifySupplierProductionUpdate(notification.payload);
        break;
      case 'shipment_update':
        await notificationService.notifySupplierShipmentUpdate(notification.payload);
        break;
    }
  } catch (error) {
    console.error(`[SupplierPortal] Failed to send ${notification.type} notification:`, error);
  }
}

// ============================================
// HELPER
// ============================================

async function getSupplierUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, error: 'Authentication required' };
  }
  if (!user.supplierId) {
    return { user: null, error: 'Not a supplier user' };
  }
  return { user, error: null };
}

// ============================================
// PURCHASE ORDER ACTIONS
// ============================================

export async function confirmPurchaseOrderAction(
  input: ConfirmPOInput
): Promise<{ success: boolean; error?: string; shipmentId?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.confirm_po')) {
    return { success: false, error: 'Permission denied' };
  }

  // Get PO details for notification before confirming
  const po = await service.getPurchaseOrderById(input.poId);

  const result = await service.confirmPO(input, user.id);

  if (result.success) {
    // Revalidate supplier portal pages
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/purchase-orders');
    revalidatePath(`/supplier-portal/purchase-orders/${input.poId}`);
    revalidatePath('/supplier-portal/shipments');

    // Revalidate operations dashboard (Jenny's dashboard)
    revalidatePath('/operations');

    // Send notification (non-blocking)
    if (po) {
      const supplier = await service.getSupplier(user.supplierId!);
      sendNotification({
        type: 'po_confirmed',
        payload: {
          poId: input.poId,
          poNumber: po.poNumber,
          supplierName: supplier?.name || 'Supplier',
          expectedDeliveryDate: input.expectedCompletionDate,
        },
      });
    }
  }

  return result;
}

export async function rejectPurchaseOrderAction(
  input: RejectPOInput
): Promise<{ success: boolean; error?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.reject_po')) {
    return { success: false, error: 'Permission denied' };
  }

  // Get PO details for notification before rejecting
  const po = await service.getPurchaseOrderById(input.poId);

  const result = await service.rejectPO(input, user.id);

  if (result.success) {
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/purchase-orders');
    revalidatePath(`/supplier-portal/purchase-orders/${input.poId}`);

    // Send notification (non-blocking)
    if (po) {
      const supplier = await service.getSupplier(user.supplierId!);
      sendNotification({
        type: 'po_rejected',
        payload: {
          poId: input.poId,
          poNumber: po.poNumber,
          supplierName: supplier?.name || 'Supplier',
          reason: input.rejectionReason,
        },
      });
    }
  }

  return result;
}

export async function updateProductionStatusAction(
  input: UpdateProductionInput
): Promise<{ success: boolean; error?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.update_production')) {
    return { success: false, error: 'Permission denied' };
  }

  // Get PO details for notification
  const po = await service.getPurchaseOrderById(input.poId);

  const result = await service.updateProduction(input, user.id);

  if (result.success) {
    // Revalidate supplier portal pages
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/purchase-orders');
    revalidatePath(`/supplier-portal/purchase-orders/${input.poId}`);
    revalidatePath('/supplier-portal/shipments');

    // Revalidate operations dashboard (Jenny's dashboard)
    // Important when production status changes to "shipped" - shipment becomes in_transit
    revalidatePath('/operations');

    // Send notification (non-blocking)
    if (po) {
      const supplier = await service.getSupplier(user.supplierId!);
      sendNotification({
        type: 'production_update',
        payload: {
          poId: input.poId,
          poNumber: po.poNumber,
          supplierName: supplier?.name || 'Supplier',
          productionStatus: input.productionStatus,
        },
      });
    }
  }

  return result;
}

// ============================================
// SHIPMENT ACTIONS
// ============================================

export async function updateShipmentAction(
  input: UpdateShipmentInput
): Promise<{ success: boolean; error?: string }> {
  const { user, error } = await getSupplierUser();
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  if (!hasPermission(user, 'supplier_portal.update_shipment')) {
    return { success: false, error: 'Permission denied' };
  }

  // Get shipment details for notification
  const shipment = await service.getShipmentById(input.shipmentId);

  const result = await service.updateShipmentDetails(input, user.id);

  if (result.success) {
    // Revalidate supplier portal pages
    revalidatePath('/supplier-portal');
    revalidatePath('/supplier-portal/shipments');
    revalidatePath(`/supplier-portal/shipments/${input.shipmentId}`);

    // Revalidate operations dashboard (Jenny's dashboard)
    revalidatePath('/operations');

    // Send notification (non-blocking)
    if (shipment) {
      const supplier = await service.getSupplier(user.supplierId!);
      // Determine update type based on what changed
      let updateType = 'details';
      if (input.etaPort || input.etaCustomer) updateType = 'eta';
      else if (input.containerNumber) updateType = 'container';
      else if (input.billOfLading) updateType = 'tracking';

      sendNotification({
        type: 'shipment_update',
        payload: {
          shipmentId: input.shipmentId,
          shipmentNumber: shipment.shipmentNumber,
          poNumber: shipment.purchaseOrder?.poNumber || 'N/A',
          supplierName: supplier?.name || 'Supplier',
          updateType,
        },
      });
    }
  }

  return result;
}
