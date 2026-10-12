/**
 * Master Inventory Server Actions
 *
 * Server-side actions for master inventory operations
 */

'use server';

import { masterInventoryService } from '../services/master-inventory.service';
import { createClient } from '@/shared/lib/supabase/server';
import type { InventorySource } from '../types';
import type {
  MasterInventoryItem,
  MasterInventoryFilters,
  MasterInventoryStats,
  ProductInventorySummary,
  PaginatedResult,
} from '../types';

// ============================================
// ACTION RESULT TYPES
// ============================================

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Get master inventory list with pagination and filters
 */
export async function getMasterInventory(
  filters: MasterInventoryFilters = {}
): Promise<ActionResult<PaginatedResult<MasterInventoryItem>>> {
  try {
    const result = await masterInventoryService.getInventory(filters);
    return { success: true, data: result };
  } catch (error) {
    console.error('[getMasterInventory] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch master inventory',
    };
  }
}

/**
 * Get master inventory stats
 */
export async function getMasterInventoryStats(): Promise<ActionResult<MasterInventoryStats>> {
  try {
    const stats = await masterInventoryService.getStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('[getMasterInventoryStats] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch master inventory stats',
    };
  }
}

/**
 * Get product inventory summary
 */
export async function getProductInventorySummary(
  productId: string
): Promise<ActionResult<ProductInventorySummary | null>> {
  try {
    if (!productId || productId.trim() === '') {
      return { success: false, error: 'Product ID is required' };
    }

    const summary = await masterInventoryService.getProductSummary(productId);
    return { success: true, data: summary };
  } catch (error) {
    console.error('[getProductInventorySummary] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch product inventory summary',
    };
  }
}

/**
 * Search master inventory
 */
export async function searchMasterInventory(
  searchTerm: string
): Promise<ActionResult<MasterInventoryItem[]>> {
  try {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return { success: true, data: [] };
    }

    const items = await masterInventoryService.searchInventory(searchTerm);
    return { success: true, data: items };
  } catch (error) {
    console.error('[searchMasterInventory] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search inventory',
    };
  }
}

/**
 * Get low stock items
 */
export async function getLowStockItems(): Promise<ActionResult<MasterInventoryItem[]>> {
  try {
    const items = await masterInventoryService.getLowStockItems();
    return { success: true, data: items };
  } catch (error) {
    console.error('[getLowStockItems] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch low stock items',
    };
  }
}

/**
 * Get inventory by product
 */
export async function getInventoryByProduct(
  productId: string
): Promise<ActionResult<MasterInventoryItem[]>> {
  try {
    if (!productId || productId.trim() === '') {
      return { success: false, error: 'Product ID is required' };
    }

    const items = await masterInventoryService.getInventoryByProduct(productId);
    return { success: true, data: items };
  } catch (error) {
    console.error('[getInventoryByProduct] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch inventory by product',
    };
  }
}

// ============================================
// ALLOCATION TYPES
// ============================================

interface AllocationDetail {
  id: string;
  quantity: number;
  status: string;
  fulfillmentSource: string;
  createdAt: Date;
  salesOrderId: string;
  salesOrderNumber: string;
  salesOrderStatus: string;
  customerId: string;
  customerName: string;
  salesOrderItemId: string;
  sku: string;
  description: string;
}

/**
 * Get all allocations for a specific product at a location
 * Shows which Sales Orders have this inventory allocated
 *
 * @param productId - Product ID
 * @param locationId - Location ID (warehouse location or dealer location)
 * @param sourceType - 'warehouse' for GDC inventory, 'platinum_dealer' for dealer
 * @param dealerId - Optional dealer ID for fetching fulfillment allocations
 */
export async function getInventoryAllocationsForMaster(
  productId: string,
  locationId: string,
  sourceType: InventorySource,
  dealerId?: string | null
): Promise<ActionResult<AllocationDetail[]>> {
  try {
    const supabase = await createClient();

    // For platinum dealers, we need to fetch both:
    // 1. Inventory allocations (by dealer_location_id)
    // 2. Fulfillment allocations (by platinum_dealer_id, no location)
    if (sourceType === 'platinum_dealer' && dealerId) {
      // Query 1: Inventory allocations at this dealer location
      const inventoryQuery = supabase
        .from('fulfillment_allocations')
        .select(`
          id,
          quantity,
          status,
          fulfillment_source,
          created_at,
          location_id,
          dealer_location_id,
          platinum_dealer_id,
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
        .eq('dealer_location_id', locationId)
        .order('created_at', { ascending: false });

      // Query 2: Fulfillment allocations by this dealer (no location required)
      const fulfillmentQuery = supabase
        .from('fulfillment_allocations')
        .select(`
          id,
          quantity,
          status,
          fulfillment_source,
          created_at,
          location_id,
          dealer_location_id,
          platinum_dealer_id,
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
        .eq('platinum_dealer_id', dealerId)
        .eq('fulfillment_source', 'platinum_dealer_fulfillment')
        .order('created_at', { ascending: false });

      // Run both queries in parallel
      const [inventoryResult, fulfillmentResult] = await Promise.all([
        inventoryQuery,
        fulfillmentQuery
      ]);

      if (inventoryResult.error) {
        console.error('[getInventoryAllocationsForMaster] Inventory query error:', inventoryResult.error);
        return { success: false, error: 'Failed to fetch inventory allocations' };
      }

      if (fulfillmentResult.error) {
        console.error('[getInventoryAllocationsForMaster] Fulfillment query error:', fulfillmentResult.error);
        return { success: false, error: 'Failed to fetch fulfillment allocations' };
      }

      // Combine results and deduplicate by id
      const allData = [...(inventoryResult.data || []), ...(fulfillmentResult.data || [])];
      const uniqueData = allData.filter((item, index, self) =>
        index === self.findIndex(t => t.id === item.id)
      );

      // Map the data to our type
      const allocations: AllocationDetail[] = uniqueData.map((item: any) => ({
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
      }));

      // Sort by created date descending
      allocations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { success: true, data: allocations };
    }

    // For warehouse or platinum_dealer without dealerId - single query
    let query = supabase
      .from('fulfillment_allocations')
      .select(`
        id,
        quantity,
        status,
        fulfillment_source,
        created_at,
        location_id,
        dealer_location_id,
        platinum_dealer_id,
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
      console.error('[getInventoryAllocationsForMaster] Error:', error);
      return { success: false, error: 'Failed to fetch allocations' };
    }

    // Map the data to our type
    const allocations: AllocationDetail[] = (data || []).map((item: any) => ({
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
    }));

    return { success: true, data: allocations };
  } catch (error) {
    console.error('[getInventoryAllocationsForMaster] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
