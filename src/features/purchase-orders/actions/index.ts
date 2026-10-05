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
 * - Any status (draft, sent, confirmed, etc.) - user can link to any unallocated PO
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

    // Debug logging (wrapped in try-catch to prevent breaking)
    try {
      const { data: allPOs, error: allError } = await supabase
        .from('purchase_orders')
        .select('id, po_number, sales_order_id, status, deleted_at')
        .is('deleted_at', null)
        .order('po_date', { ascending: false })
        .limit(20);

      if (!allError && allPOs && allPOs.length > 0) {
        console.log('📊 [getUnallocatedPurchaseOrders] Database Analysis:');
        console.log(`  Total recent POs: ${allPOs.length}`);
        console.log(`  ✅ Unallocated (sales_order_id IS NULL): ${allPOs.filter(po => po.sales_order_id === null).length}`);
        console.log(`  ❌ Already linked to SO: ${allPOs.filter(po => po.sales_order_id !== null).length}`);

        const statusBreakdown: Record<string, number> = {};
        allPOs.forEach(po => {
          if (po.status) {
            statusBreakdown[po.status] = (statusBreakdown[po.status] || 0) + 1;
          }
        });
        console.log('  Status breakdown:', statusBreakdown);

        const unallocated = allPOs.filter(po => po.sales_order_id === null);
        if (unallocated.length > 0) {
          console.log('  Unallocated POs:', unallocated.map(po => `${po.po_number} (${po.status})`).join(', '));
        }
      }
    } catch (debugError) {
      console.warn('[getUnallocatedPurchaseOrders] Debug logging failed:', debugError);
      // Continue execution - logging should not break the function
    }

    const { data, error } = await supabase
      .from('purchase_orders')
      .select('id, po_number, po_date, expected_delivery_date, status, grand_total, order_series')
      .is('sales_order_id', null)  // KEY FILTER: Only unallocated POs
      .is('deleted_at', null)       // Not deleted
      // Note: No status filter - any status is allowed (draft, sent, confirmed, etc.)
      .order('created_at', { ascending: false })  // Use created_at instead of po_date
      .limit(100);  // Reasonable limit

    if (error) {
      console.error('[getUnallocatedPurchaseOrders] Database Error:', error);
      return {
        success: false,
        error: `Failed to fetch unallocated POs: ${error.message || 'Unknown error'}`,
      };
    }

    console.log(`✅ [getUnallocatedPurchaseOrders] Found ${data?.length || 0} unallocated POs (any status)`);
    if (data && data.length > 0) {
      console.log('  POs:', data.map(po => `${po.po_number} (${po.status})`).join(', '));
    }

    return {
      success: true,
      data: data || [],
    };
  } catch (err) {
    console.error('[getUnallocatedPurchaseOrders] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred',
    };
  }
}
