/**
 * Supplier Portal Service
 *
 * Business logic for supplier portal operations.
 */

import * as repo from '../repositories/supplier-portal.repository';
import { purchaseOrderService } from '@/features/purchase-orders/services/purchase-order.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  Supplier,
  SupplierPurchaseOrder,
  SupplierShipment,
  SupplierDashboardStats,
  ConfirmPOInput,
  RejectPOInput,
  UpdateProductionInput,
  UpdateShipmentInput,
} from '../types';

// ============================================
// SUPPLIER
// ============================================

export async function getSupplier(supplierId: string): Promise<Supplier | null> {
  return repo.getSupplierById(supplierId);
}

// ============================================
// PURCHASE ORDERS
// ============================================

export interface GetPurchaseOrdersOptions {
  supplierId: string;
  status?: string;
  productionStatus?: string;
  page?: number;
  pageSize?: number;
}

export async function getPurchaseOrders(
  options: GetPurchaseOrdersOptions
): Promise<{ data: SupplierPurchaseOrder[]; total: number; page: number; pageSize: number }> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 10;
  const offset = (page - 1) * pageSize;

  const repoOptions = {
    status: options.status,
    productionStatus: options.productionStatus as import('../types').ProductionStatus | undefined,
    limit: pageSize,
    offset,
  };

  const { data, count } = await repo.getSupplierPurchaseOrders(options.supplierId, repoOptions);

  return {
    data,
    total: count,
    page,
    pageSize,
  };
}

export async function getPurchaseOrderById(
  poId: string
): Promise<SupplierPurchaseOrder | null> {
  return repo.getSupplierPurchaseOrderById(poId);
}

export async function getPendingPurchaseOrders(
  supplierId: string
): Promise<SupplierPurchaseOrder[]> {
  return repo.getPendingConfirmationPOs(supplierId);
}

export async function confirmPO(
  input: ConfirmPOInput,
  userId: string
): Promise<{ success: boolean; error?: string; shipmentId?: string }> {
  // Validate PO exists and is in correct state
  const po = await repo.getSupplierPurchaseOrderById(input.poId);
  if (!po) {
    return { success: false, error: 'Purchase order not found' };
  }

  if (po.supplierConfirmedAt) {
    return { success: false, error: 'Purchase order already confirmed' };
  }

  if (po.supplierRejectedAt) {
    return { success: false, error: 'Purchase order has been rejected' };
  }

  // First, update supplier-specific fields before status transition
  const db = await createClient();
  const { error: updateError } = await db
    .from('purchase_orders')
    .update({
      supplier_confirmed_at: new Date().toISOString(),
      supplier_confirmed_by: userId,
      expected_completion_date: input.expectedCompletionDate || null,
      supplier_notes: input.supplierNotes || null,
      // Note: supplier_reference_number is stored in shipments table, not purchase_orders
      production_status: 'not_started',
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', input.poId);

  if (updateError) {
    console.error('[confirmPO] Error updating supplier fields:', updateError);
    return { success: false, error: 'Failed to update purchase order details' };
  }

  // Now use the purchase order service to confirm
  // This will:
  // 1. Transition status to 'confirmed'
  // 2. Auto-create shipment via createSupplierShipment()
  const result = await purchaseOrderService.confirm(input.poId, userId);

  if (!result.success) {
    return { success: false, error: result.error || 'Failed to confirm purchase order' };
  }

  // Get the created shipment ID from shipments table
  const { data: shipment } = await db
    .from('shipments')
    .select('id')
    .eq('purchase_order_id', input.poId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Update shipment with supplier reference number if provided
  if (shipment && input.supplierReferenceNumber) {
    await db
      .from('shipments')
      .update({
        supplier_reference_number: input.supplierReferenceNumber,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq('id', shipment.id);
  }

  return {
    success: true,
    shipmentId: shipment?.id,
    error: shipment ? undefined : 'PO confirmed but shipment not found'
  };
}

export async function rejectPO(
  input: RejectPOInput,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate PO exists
  const po = await repo.getSupplierPurchaseOrderById(input.poId);
  if (!po) {
    return { success: false, error: 'Purchase order not found' };
  }

  if (po.supplierRejectedAt) {
    return { success: false, error: 'Purchase order already rejected' };
  }

  if (po.supplierConfirmedAt) {
    return { success: false, error: 'Cannot reject a confirmed purchase order' };
  }

  if (!input.rejectionReason.trim()) {
    return { success: false, error: 'Rejection reason is required' };
  }

  return repo.rejectPurchaseOrder(input.poId, userId, input.rejectionReason);
}

export async function updateProduction(
  input: UpdateProductionInput,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate PO exists and is confirmed
  const po = await repo.getSupplierPurchaseOrderById(input.poId);
  if (!po) {
    return { success: false, error: 'Purchase order not found' };
  }

  if (!po.supplierConfirmedAt) {
    return { success: false, error: 'Purchase order must be confirmed before updating production' };
  }

  // SAFETY CHECK: Ensure shipment exists for this PO
  // If not, auto-create it (in case it wasn't created during PO confirmation)
  const db = await createClient();
  const { data: existingShipment } = await db
    .from('shipments')
    .select('id')
    .eq('purchase_order_id', input.poId)
    .maybeSingle();

  if (!existingShipment) {
    console.log(`[updateProduction] No shipment found for PO ${input.poId}, auto-creating...`);
    try {
      await purchaseOrderService.createSupplierShipment(input.poId, userId);
      console.log(`[updateProduction] ✅ Shipment auto-created for PO ${input.poId}`);
    } catch (error) {
      console.error('[updateProduction] Failed to auto-create shipment:', error);
      // Continue anyway - production status update shouldn't fail if shipment creation fails
    }
  }

  return repo.updateProductionStatus(input.poId, userId, {
    productionStatus: input.productionStatus,
    expectedCompletionDate: input.expectedCompletionDate,
    supplierNotes: input.supplierNotes,
  });
}

// ============================================
// SHIPMENTS
// ============================================

export interface GetShipmentsOptions {
  supplierId: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getShipments(
  options: GetShipmentsOptions
): Promise<{ data: SupplierShipment[]; total: number; page: number; pageSize: number }> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 10;
  const offset = (page - 1) * pageSize;

  const { data, count } = await repo.getSupplierShipments(options.supplierId, {
    status: options.status,
    limit: pageSize,
    offset,
  });

  return {
    data,
    total: count,
    page,
    pageSize,
  };
}

export async function getShipmentById(
  shipmentId: string
): Promise<SupplierShipment | null> {
  return repo.getSupplierShipmentById(shipmentId);
}

export async function updateShipmentDetails(
  input: UpdateShipmentInput,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate shipment exists
  const shipment = await repo.getSupplierShipmentById(input.shipmentId);
  if (!shipment) {
    return { success: false, error: 'Shipment not found' };
  }

  return repo.updateShipment(input.shipmentId, userId, {
    containerNumber: input.containerNumber,
    billOfLading: input.billOfLading,
    vesselName: input.vesselName,
    portOfLoading: input.portOfLoading,
    portOfDischarge: input.portOfDischarge,
    etd: input.etd,
    etaPort: input.etaPort,
    etaCustomer: input.etaCustomer,
    notes: input.notes,
  });
}

// ============================================
// DASHBOARD
// ============================================

export async function getDashboardStats(
  supplierId: string
): Promise<SupplierDashboardStats> {
  return repo.getSupplierDashboardStats(supplierId);
}
