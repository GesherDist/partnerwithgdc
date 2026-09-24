/**
 * Packing List Server Actions
 *
 * Next.js server actions for Packing Lists feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { PackingListService } from '../services';
import { createClient } from '@/shared/lib/supabase/server';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser, hasAnyPermission } from '@/shared/lib/auth';
import type {
  PackingListListParams,
  CreatePackingListDTO,
  PackingListStatus,
  PackingListWithItems,
  PickTicketPdfSalesOrderFields,
} from '../types';

// ============================================
// HELPER: Get current user ID
// ============================================

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return undefined;
    }

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    return data?.id;
  } catch {
    return undefined;
  }
}

// ============================================
// LIST PACKING LISTS
// ============================================

export async function listPackingLists(params: PackingListListParams = {}) {
  const result = await PackingListService.getPackingLists(params);
  return result;
}

// ============================================
// GET PACKING LIST
// ============================================

export async function getPackingList(id: string) {
  const result = await PackingListService.getPackingListById(id);
  return result;
}

// ============================================
// GET PACKING LIST PDF DATA
// ============================================

/**
 * Everything the packing list PDF needs, in one authorized call.
 *
 * The packing list join does not carry the ship-to address or the customer PO,
 * so those are read from the sales order here — API routes in this codebase
 * never touch `db` directly.
 */
export async function getPackingListPdfData(id: string): Promise<{
  success: boolean;
  data?: {
    packingList: PackingListWithItems;
    salesOrder: PickTicketPdfSalesOrderFields | null;
  };
  error?: string;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  if (!hasAnyPermission(user, ['pick_tickets.view', 'pick_tickets.edit'])) {
    return { success: false, error: 'Permission denied: pick_tickets.view' };
  }

  const result = await PackingListService.getPackingListById(id);

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Packing list not found' };
  }

  const packingList = result.data;
  let salesOrder: PickTicketPdfSalesOrderFields | null = null;

  if (packingList.salesOrderId) {
    const { data, error } = await db
      .from('sales_orders')
      .select(
        `
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        requested_delivery_date,
        customer_po_number
      `
      )
      .eq('id', packingList.salesOrderId)
      .single();

    if (error) {
      // The PDF is still useful without these fields, so log and carry on.
      console.error('[getPackingListPdfData] Sales order lookup failed:', error);
    } else {
      salesOrder = data as unknown as PickTicketPdfSalesOrderFields;
    }
  }

  return { success: true, data: { packingList, salesOrder } };
}

// ============================================
// GET PACKING LIST BY PICK TICKET
// ============================================

export async function getPackingListByPickTicket(pickTicketId: string) {
  const result = await PackingListService.getPackingListByPickTicketId(pickTicketId);
  return result;
}

// ============================================
// CREATE PACKING LIST
// ============================================

export async function createPackingList(data: CreatePackingListDTO) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.createPackingList(data, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath('/pick-tickets');
  }

  return result;
}

// ============================================
// CREATE PACKING LIST FROM PICK TICKET
// ============================================

export async function createPackingListFromPickTicket(pickTicketId: string) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.createFromPickTicket(pickTicketId, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${pickTicketId}`);
  }

  return result;
}

// ============================================
// MARK AS PACKED
// ============================================

export async function markPackingListAsPacked(id: string) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.markAsPacked(id, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath(`/packing-lists/${id}`);
    revalidatePath('/pick-tickets');
  }

  return result;
}

// ============================================
// TRANSITION STATUS
// ============================================

export async function transitionPackingListStatus(id: string, status: PackingListStatus) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.transitionStatus(id, status, userId);

  if (result.success && result.data) {
    // NOTE: Warehouse orders no longer create shipments
    // Packing list itself tracks delivery (tracking number, carrier, delivered date)
    // Only supplier/dropship orders create shipments (from PO confirmation)

    // When transitioning to 'delivered', update sales order status
    if (status === 'delivered') {
      try {
        const { db } = await import('@/shared/lib/supabase/database');
        await db
          .from('sales_orders')
          .update({
            status: 'delivered',
            updated_at: new Date().toISOString(),
            updated_by: userId || null,
          })
          .eq('id', result.data.salesOrderId);

        console.log(`[Packing List DELIVERED] Updated SO ${result.data.salesOrderId} to delivered status`);
      } catch (error) {
        console.error('[transitionPackingListStatus] Failed to update sales order status:', error);
      }
    }

    revalidatePath('/packing-lists');
    revalidatePath(`/packing-lists/${id}`);
    revalidatePath('/pick-tickets');
    revalidatePath('/inventory');
    revalidatePath('/operations');
    revalidatePath('/sales-orders');
  }

  return result;
}

// NOTE: Removed createShipmentFromPackingList function
// Warehouse orders no longer create shipments - packing list tracks delivery directly

// ============================================
// DELETE PACKING LIST
// ============================================

export async function deletePackingList(id: string) {
  const userId = await getCurrentUserId();
  const result = await PackingListService.deletePackingList(id, userId);

  if (result.success) {
    revalidatePath('/packing-lists');
    revalidatePath('/pick-tickets');
  }

  return result;
}
