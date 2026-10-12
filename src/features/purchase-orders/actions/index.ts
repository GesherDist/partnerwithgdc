/**
 * Purchase Orders Server Actions
 *
 * Next.js server actions for Purchase Orders feature.
 *
 * Every action authenticates the caller and checks the matching
 * `purchase_orders.*` permission before touching the service layer.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { purchaseOrderService } from '../services/purchase-order.service';
import { createClient } from '@/shared/lib/supabase/server';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import type { POListParams, SupplierSummary } from '../types';
import type {
  CreatePOInput,
  UpdatePOInput,
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
 * Resolve the current application user and verify a permission.
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

/**
 * Same as `authorize`, but any one of the permissions is enough.
 */
async function authorizeAny(permissions: string[]): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      result: { success: false, error: `Permission denied: requires one of [${permissions.join(', ')}]` },
    };
  }

  return { ok: true, user };
}

// ============================================
// LIST PURCHASE ORDERS
// ============================================

export async function listPurchaseOrders(params: POListParams = {}) {
  const auth = await authorize('purchase_orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.list(params);
  return result;
}

// ============================================
// GET PURCHASE ORDER
// ============================================

export async function getPurchaseOrder(id: string) {
  const auth = await authorizeAny(['purchase_orders.view_detail', 'purchase_orders.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.getById(id);
  return result;
}

// ============================================
// CREATE PURCHASE ORDER
// ============================================

export async function createPurchaseOrder(data: CreatePOInput) {
  const auth = await authorize('purchase_orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  // If linking to a Sales Order, validate that Order Series is selected
  if (data.salesOrderId) {
    const supabase = await createClient();
    const { data: soCheck } = await supabase
      .from('sales_orders')
      .select('order_series')
      .eq('id', data.salesOrderId)
      .single();

    if (!soCheck?.order_series) {
      return {
        success: false,
        error: 'Order Series is required. Please select an Order Series (GDC 1, GDC 2, or GDC 3) on the linked Sales Order before creating a Purchase Order.',
      };
    }
  }

  const result = await purchaseOrderService.create(data, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// UPDATE PURCHASE ORDER
// ============================================

export async function updatePurchaseOrder(id: string, data: UpdatePOInput) {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.update(id, data, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

// ============================================
// DELETE PURCHASE ORDER
// ============================================

export async function deletePurchaseOrder(id: string) {
  const auth = await authorize('purchase_orders.delete');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.delete(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export async function sendPurchaseOrder(id: string) {
  const auth = await authorize('purchase_orders.send');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.send(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function confirmPurchaseOrder(id: string) {
  const auth = await authorize('purchase_orders.confirm');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.confirm(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function markPurchaseOrderPartial(id: string) {
  const auth = await authorize('purchase_orders.receive');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.markPartial(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function markPurchaseOrderReceived(id: string) {
  const auth = await authorize('purchase_orders.receive');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.markReceived(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

export async function cancelPurchaseOrder(id: string) {
  const auth = await authorize('purchase_orders.cancel');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.cancel(id, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

// ============================================
// INLINE UPDATE ACTIONS
// ============================================

/**
 * Update PO supplier (applies to all items)
 */
export async function updatePOSupplier(
  id: string,
  supplierId: string | null,
  supplierName: string | null
): Promise<ActionResult> {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.updateSupplier(id, supplierId, supplierName, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

/**
 * Update PO order series
 */
export async function updatePOOrderSeries(
  id: string,
  orderSeries: string | null
): Promise<ActionResult> {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await purchaseOrderService.updateOrderSeries(id, orderSeries, auth.user.id);

  if (result.success) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
  }

  return result;
}

/**
 * Update PO load status (Operations Dashboard tracking)
 * This updates only the load_status field, not the system PO status
 * @deprecated Use updatePOSupplierStatus instead
 */
export async function updatePOLoadStatus(
  id: string,
  loadStatus: string
): Promise<ActionResult> {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('purchase_orders')
      .update({
        load_status: loadStatus,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .eq('id', id);

    if (error) {
      console.error('[updatePOLoadStatus] Error:', error);
      return {
        success: false,
        error: 'Failed to update load status',
      };
    }

    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${id}`);
    revalidatePath('/dashboard/operations');

    return { success: true };
  } catch (err) {
    console.error('[updatePOLoadStatus] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Update PO Supplier/Production Status
 * This updates the system PO status (draft → confirmed → in_production, etc.)
 * When status changes to "confirmed" or "in_production", shipment is auto-created
 */
export async function updatePOSupplierStatus(
  id: string,
  newStatus: string
): Promise<ActionResult<{ shipmentCreated?: boolean; shipmentNumber?: string }>> {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const result = await purchaseOrderService.updateSupplierStatus(id, newStatus, auth.user.id);

    if (result.success) {
      revalidatePath('/purchase-orders');
      revalidatePath(`/purchase-orders/${id}`);
      revalidatePath('/dashboard/operations');
      revalidatePath('/shipments');
    }

    return result;
  } catch (err) {
    console.error('[updatePOSupplierStatus] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// UPDATE SHIPMENT LOAD STATUS
// ============================================

/**
 * Update Shipment Load Status
 * This updates the shipment's load_status field (AVAILABLE, OPEN, SOLD, IN_TRANSIT, etc.)
 * If no shipment exists, it creates one first
 */
export async function updateShipmentLoadStatus(
  poId: string,
  loadStatus: string,
  shipmentId?: string
): Promise<ActionResult> {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const supabase = await createClient();

    // If we have a shipment ID, update it directly
    if (shipmentId) {
      const { error } = await supabase
        .from('shipments')
        .update({
          load_status: loadStatus,
          updated_at: new Date().toISOString(),
          updated_by: auth.user.id,
        })
        .eq('id', shipmentId);

      if (error) {
        console.error('[updateShipmentLoadStatus] Error updating shipment:', error);
        return { success: false, error: 'Failed to update shipment status' };
      }
    } else {
      // Find existing shipment for this PO
      const { data: existingShipment, error: findError } = await supabase
        .from('shipments')
        .select('id')
        .eq('purchase_order_id', poId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        console.error('[updateShipmentLoadStatus] Error finding shipment:', findError);
        return { success: false, error: 'Failed to find shipment' };
      }

      if (existingShipment) {
        // Update existing shipment
        const { error: updateError } = await supabase
          .from('shipments')
          .update({
            load_status: loadStatus,
            updated_at: new Date().toISOString(),
            updated_by: auth.user.id,
          })
          .eq('id', existingShipment.id);

        if (updateError) {
          console.error('[updateShipmentLoadStatus] Error updating shipment:', updateError);
          return { success: false, error: 'Failed to update shipment status' };
        }
      } else {
        // No shipment exists - create one via the service
        await purchaseOrderService.createSupplierShipment(poId, auth.user.id);

        // Now update the newly created shipment with the load_status
        const { data: newShipment } = await supabase
          .from('shipments')
          .select('id')
          .eq('purchase_order_id', poId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (newShipment) {
          await supabase
            .from('shipments')
            .update({
              load_status: loadStatus,
              updated_at: new Date().toISOString(),
              updated_by: auth.user.id,
            })
            .eq('id', newShipment.id);
        }
      }
    }

    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${poId}`);
    revalidatePath('/dashboard/operations');
    revalidatePath('/operations');

    return { success: true };
  } catch (err) {
    console.error('[updateShipmentLoadStatus] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// UPDATE PO PRODUCTION STATUS
// ============================================

/**
 * Update PO production status (Not Started → In Production → Ready to Ship → Shipped)
 * This is used from the main PO page, not the supplier portal
 */
export async function updatePOProductionStatus(
  poId: string,
  productionStatus: 'not_started' | 'in_production' | 'ready_to_ship' | 'shipped'
): Promise<{ success: boolean; error?: string }> {
  const auth = await authorize('purchase_orders.edit');
  if (!auth.ok) {
    return { success: false, error: 'Permission denied' };
  }

  try {
    const supabase = await createClient();

    // Update PO production_status field
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        production_status: productionStatus,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .eq('id', poId);

    if (updateError) {
      console.error('[updatePOProductionStatus] Error updating PO:', updateError);
      return { success: false, error: 'Failed to update production status' };
    }

    // Map production_status to PO status for workflow tracking
    let newPOStatus: string | null = null;
    if (productionStatus === 'in_production') {
      newPOStatus = 'in_production';
    } else if (productionStatus === 'ready_to_ship') {
      newPOStatus = 'ready_to_ship';
    } else if (productionStatus === 'shipped') {
      newPOStatus = 'in_transit';
    }

    if (newPOStatus) {
      await supabase
        .from('purchase_orders')
        .update({ status: newPOStatus })
        .eq('id', poId);
    }

    // If shipped, update the shipment status to in_transit
    if (productionStatus === 'shipped') {
      const { data: shipment } = await supabase
        .from('shipments')
        .select('id')
        .eq('purchase_order_id', poId)
        .is('deleted_at', null)
        .single();

      if (shipment) {
        await supabase
          .from('shipments')
          .update({
            load_status: 'in_transit',
            status: 'in_transit',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shipment.id);
      }
    }

    // Revalidate paths
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${poId}`);
    revalidatePath('/operations');
    revalidatePath('/dashboard/operations');

    return { success: true };
  } catch (err) {
    console.error('[updatePOProductionStatus] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}

// ============================================
// GET NEXT PO NUMBER
// ============================================

export async function getNextPONumber(): Promise<ActionResult<string>> {
  const auth = await authorize('purchase_orders.create');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('generate_po_number');

    if (error) {
      console.error('[getNextPONumber] Error:', error);
      return { success: false, error: 'Failed to generate PO number' };
    }

    return { success: true, data: data as string };
  } catch (err) {
    console.error('[getNextPONumber] Error:', err);
    return { success: false, error: 'Failed to generate PO number' };
  }
}

// ============================================
// GET SUPPLIERS FOR DROPDOWN
// ============================================

export async function getSuppliersForDropdown(): Promise<SupplierSummary[]> {
  const auth = await authorize('purchase_orders.view_module');
  if (!auth.ok) {
    return [];
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, primary_contact_name')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name');

    if (error) {
      console.error('[getSuppliersForDropdown] Error:', error);
      return [];
    }

    return (data || []).map((s) => ({
      id: s.id,
      name: s.name,
      primaryContactName: s.primary_contact_name,
    }));
  } catch (err) {
    console.error('[getSuppliersForDropdown] Error:', err);
    return [];
  }
}

// ============================================
// GET UNALLOCATED PURCHASE ORDERS
// ============================================

/**
 * Get purchase orders that are not yet linked to any sales order.
 * Used for allocation dialog to link existing POs to customer SOs.
 *
 * Filters:
 * - sales_order_id IS NULL (not linked to any SO)
 * - deleted_at IS NULL (not deleted)
 * - Must have at least one shipment created (shipment exists for this PO)
 * - Not already used in fulfillment_allocations
 * - Must have GDC Inventory location (not Kansas/Nebraska warehouse)
 *
 * @returns Array of unallocated POs with basic info
 */
export async function getUnallocatedPurchaseOrders(): Promise<ActionResult<any[]>> {
  const auth = await authorize('purchase_orders.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  try {
    const supabase = await createClient();

    // First, get the GDC-INV location ID (virtual location for GDC Inventory)
    const { data: gdcInvLocation } = await supabase
      .from('locations')
      .select('id')
      .eq('location_code', 'GDC-INV')
      .maybeSingle();

    const gdcInvLocationId = gdcInvLocation?.id || null;
    console.log(`📊 [getUnallocatedPurchaseOrders] GDC-INV location ID: ${gdcInvLocationId || 'NOT FOUND'}`);

    // Get PO IDs that have shipments created
    const { data: posWithShipments, error: shipmentError } = await supabase
      .from('shipments')
      .select('purchase_order_id')
      .not('purchase_order_id', 'is', null);

    if (shipmentError) {
      console.warn('[getUnallocatedPurchaseOrders] Error fetching POs with shipments:', shipmentError);
    }

    // Get unique PO IDs that have shipments
    const poIdsWithShipments = [...new Set(
      (posWithShipments || [])
        .map(s => s.purchase_order_id)
        .filter((id): id is string => id !== null)
    )];

    console.log(`📊 [getUnallocatedPurchaseOrders] POs with shipments: ${poIdsWithShipments.length}`);

    // If no POs have shipments, return empty array
    if (poIdsWithShipments.length === 0) {
      console.log('⚠️ [getUnallocatedPurchaseOrders] No POs have shipments created yet');
      return {
        success: true,
        data: [],
      };
    }

    // Get PO IDs that are already used in fulfillment_allocations
    const { data: allocatedPOs, error: allocError } = await supabase
      .from('fulfillment_allocations')
      .select('purchase_order_id')
      .not('purchase_order_id', 'is', null);

    if (allocError) {
      console.warn('[getUnallocatedPurchaseOrders] Error fetching allocated POs:', allocError);
    }

    // Get the list of allocated PO IDs
    const allocatedPOIds = (allocatedPOs || [])
      .map(a => a.purchase_order_id)
      .filter((id): id is string => id !== null);

    console.log(`📊 [getUnallocatedPurchaseOrders] Already allocated PO IDs: ${allocatedPOIds.length}`);

    // Filter: POs with shipments but not yet allocated
    const eligiblePOIds = poIdsWithShipments.filter(id => !allocatedPOIds.includes(id));

    console.log(`📊 [getUnallocatedPurchaseOrders] Eligible PO IDs (with shipment, not allocated): ${eligiblePOIds.length}`);

    // If no eligible POs, return empty array
    if (eligiblePOIds.length === 0) {
      console.log('⚠️ [getUnallocatedPurchaseOrders] All POs with shipments are already allocated');
      return {
        success: true,
        data: [],
      };
    }

    // Build query for unallocated POs that have shipments AND GDC Inventory location
    // Only show POs with GDC-INV warehouse (not Kansas/Nebraska)
    let query = supabase
      .from('purchase_orders')
      .select('id, po_number, po_date, expected_delivery_date, status, grand_total, order_series, warehouse_id, warehouse:locations!warehouse_id(name, location_code)')
      .in('id', eligiblePOIds)           // Only POs with shipments and not allocated
      .is('sales_order_id', null)        // Not linked to any SO directly
      .is('deleted_at', null);           // Not deleted

    // Filter by GDC-INV location only
    if (gdcInvLocationId) {
      query = query.eq('warehouse_id', gdcInvLocationId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[getUnallocatedPurchaseOrders] Database Error:', error);
      return {
        success: false,
        error: `Failed to fetch unallocated POs: ${error.message || 'Unknown error'}`,
      };
    }

    // Map location name
    const result = (data || []).map(po => ({
      ...po,
      location_name: (po as any).warehouse?.name || null,
    }));

    console.log(`✅ [getUnallocatedPurchaseOrders] Found ${result.length} POs (GDC Inventory, with shipments, unallocated)`);
    if (result.length > 0) {
      console.log('  POs:', result.map(po => `${po.po_number} (${po.status})`).join(', '));
    }

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    console.error('[getUnallocatedPurchaseOrders] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}
