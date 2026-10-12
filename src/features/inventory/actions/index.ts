/**
 * Inventory Server Actions
 *
 * Next.js server actions for Inventory feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { inventoryService } from '../services/inventory.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  InventoryListParams,
  CreateInventoryDTO,
  UpdateInventoryDTO,
  InventoryAllocationDetail,
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

    if (!user) {return undefined;}

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
// LIST INVENTORY
// ============================================

export async function listInventory(params: InventoryListParams = {}) {
  const result = await inventoryService.list(params);
  return result;
}

// ============================================
// GET INVENTORY
// ============================================

export async function getInventory(id: string) {
  const result = await inventoryService.getById(id);
  return result;
}

export async function getInventoryByProductAndLocation(
  productId: string,
  locationId: string
) {
  const result = await inventoryService.getByProductAndLocation(productId, locationId);
  return result;
}

export async function getInventoryByProductIds(productIds: string[]) {
  const result = await inventoryService.getByProductIds(productIds);
  return result;
}

// ============================================
// CREATE INVENTORY
// ============================================

export async function createInventory(data: CreateInventoryDTO) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.create(data, userId);

  if (result.success) {
    revalidatePath('/inventory');
  }

  return result;
}

// ============================================
// UPDATE INVENTORY
// ============================================

export async function updateInventory(id: string, data: UpdateInventoryDTO) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

// ============================================
// ADJUST INVENTORY
// ============================================

export async function adjustInventory(id: string, adjustment: number) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.adjust(id, adjustment, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

// ============================================
// ALLOCATE/DEALLOCATE INVENTORY
// ============================================

export async function allocateInventory(id: string, quantity: number) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.allocate(id, quantity, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

export async function deallocateInventory(id: string, quantity: number) {
  const userId = await getCurrentUserId();
  const result = await inventoryService.deallocate(id, quantity, userId);

  if (result.success) {
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
  }

  return result;
}

// ============================================
// DELETE INVENTORY
// ============================================

export async function deleteInventory(id: string) {
  const result = await inventoryService.delete(id);

  if (result.success) {
    revalidatePath('/inventory');
  }

  return result;
}

// ============================================
// LOW STOCK
// ============================================

export async function getLowStockItems() {
  const result = await inventoryService.getLowStockItems();
  return result;
}

// ============================================
// ON ORDER & IN TRANSIT STATS
// ============================================

export interface InventoryStats {
  onOrder: number;      // From purchase orders (confirmed/partial)
  inTransit: number;    // From shipments (in transit status)
}

/**
 * Get On Order and In Transit inventory stats
 * - On Order: Sum of pending quantities from confirmed/partial purchase orders
 * - In Transit: Sum of quantities from shipments with in-transit status
 */
export async function getInventoryStats(): Promise<{ success: boolean; data?: InventoryStats; error?: string }> {
  try {
    const supabase = await createClient();

    // Get On Order quantities from purchase orders
    // On Order = quantity_ordered - quantity_received for confirmed/partial POs
    const { data: poData, error: poError } = await supabase
      .from('purchase_order_items')
      .select(`
        quantity_ordered,
        quantity_received,
        purchase_orders!inner (
          status,
          deleted_at
        )
      `)
      .in('purchase_orders.status', ['confirmed', 'partial'])
      .is('purchase_orders.deleted_at', null);

    if (poError) {
      console.error('Error fetching on-order quantities:', poError);
      return { success: false, error: 'Failed to fetch on-order quantities' };
    }

    // Calculate total on order
    const onOrder = (poData || []).reduce((sum, item) => {
      const pending = (item.quantity_ordered || 0) - (item.quantity_received || 0);
      return sum + Math.max(0, pending);
    }, 0);

    // Get In Transit quantities from shipments
    // In Transit = total_qty from shipments where tracking_status indicates in transit
    const { data: shipmentData, error: shipmentError } = await supabase
      .from('shipments')
      .select('total_qty')
      .in('tracking_status', ['departed_origin', 'in_transit', 'arrived_port', 'customs_clearance', 'out_for_delivery'])
      .is('deleted_at', null);

    if (shipmentError) {
      console.error('Error fetching in-transit quantities:', shipmentError);
      return { success: false, error: 'Failed to fetch in-transit quantities' };
    }

    // Calculate total in transit
    const inTransit = (shipmentData || []).reduce((sum, item) => sum + (item.total_qty || 0), 0);

    return {
      success: true,
      data: {
        onOrder,
        inTransit,
      },
    };
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    return { success: false, error: 'Failed to fetch inventory stats' };
  }
}

// ============================================
// GET INVENTORY ALLOCATIONS
// ============================================

/**
 * Get all allocations for a specific product at a location
 * Shows which Sales Orders have this inventory allocated
 *
 * @param productId - Product ID
 * @param locationId - Location ID (warehouse or dealer location)
 * @param sourceType - 'warehouse' for GDC inventory, 'dealer' for platinum dealer
 */
export async function getInventoryAllocations(
  productId: string,
  locationId: string,
  sourceType: 'warehouse' | 'dealer' = 'warehouse'
): Promise<{ success: boolean; data?: InventoryAllocationDetail[]; error?: string }> {
  try {
    const supabase = await createClient();

    // Build the query based on source type
    let query = supabase
      .from('fulfillment_allocations')
      .select(`
        id,
        quantity,
        status,
        fulfillment_source,
        created_at,
        location:locations(id, name),
        platinum_dealer:platinum_dealers(id, dealer_name),
        sales_order_item:sales_order_items!inner(
          id,
          sku,
          description,
          product_id,
          sales_order:sales_orders!inner(
            id,
            order_number,
            status,
            customer:customers(
              id,
              name
            )
          )
        )
      `)
      .eq('sales_order_item.product_id', productId)
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });

    // Filter by location based on source type
    if (sourceType === 'warehouse') {
      query = query.eq('location_id', locationId);
    } else {
      query = query.eq('dealer_location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching inventory allocations:', error);
      return { success: false, error: 'Failed to fetch allocations' };
    }

    // Map the data to our type
    const allocations: InventoryAllocationDetail[] = (data || []).map((item: any) => ({
      id: item.id,
      quantity: item.quantity,
      status: item.status,
      fulfillmentSource: item.fulfillment_source,
      createdAt: new Date(item.created_at),
      salesOrderId: item.sales_order_item?.sales_order?.id || '',
      salesOrderNumber: item.sales_order_item?.sales_order?.order_number || '',
      salesOrderStatus: item.sales_order_item?.sales_order?.status || '',
      customerId: item.sales_order_item?.sales_order?.customer?.id || '',
      customerName: item.sales_order_item?.sales_order?.customer?.name || 'Unknown Customer',
      salesOrderItemId: item.sales_order_item?.id || '',
      sku: item.sales_order_item?.sku || '',
      description: item.sales_order_item?.description || '',
      locationName: item.location?.name,
      dealerName: item.platinum_dealer?.dealer_name,
    }));

    return { success: true, data: allocations };
  } catch (error) {
    console.error('Error in getInventoryAllocations:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
