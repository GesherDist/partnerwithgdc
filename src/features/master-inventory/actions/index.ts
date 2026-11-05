/**
 * Master Inventory Server Actions
 *
 * Server-side actions for master inventory operations
 */

'use server';

import { revalidatePath } from 'next/cache';
import { masterInventoryService } from '../services/master-inventory.service';
import { createClient } from '@/shared/lib/supabase/server';
import { inventoryService } from '@/features/inventory/services/inventory.service';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { MASTER_INVENTORY_PERMISSIONS } from '../lib/permissions';
import { auditService } from '@/shared/lib/audit';
import { logDealerInventoryMovement } from '@/features/inventory/services/inventory-movement.service';
import {
  getDealerInventory,
  updateInventory as upsertDealerInventory,
} from '@/features/platinum-dealers/repositories/platinum-dealers.repository';
import { STOCK_CHANGE_REASONS, type InventorySource } from '../types';
import type {
  MasterInventoryItem,
  MasterInventoryFilters,
  MasterInventoryStats,
  ProductInventorySummary,
  PaginatedResult,
  MasterInventoryFormOptions,
  CreateMasterInventoryInput,
  WarehouseStockLevel,
  UpdateWarehouseStockInput,
} from '../types';

// ============================================
// ACTION RESULT TYPES
// ============================================

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================
// AUTHORIZATION HELPER
// ============================================

/**
 * Returns an error result when the caller is not signed in or lacks the
 * permission (see MASTER_INVENTORY_PERMISSIONS), otherwise null.
 */
async function denyUnless(permission: string): Promise<{ success: false; error: string } | null> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  if (!hasPermission(user, permission)) {
    return { success: false, error: `Permission denied: ${permission}` };
  }

  return null;
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Get master inventory list with pagination and filters
 */
export async function getMasterInventory(
  filters: MasterInventoryFilters = {}
): Promise<ActionResult<PaginatedResult<MasterInventoryItem>>> {
  const denied = await denyUnless(MASTER_INVENTORY_PERMISSIONS.read);
  if (denied) {
    return denied;
  }

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
  const denied = await denyUnless(MASTER_INVENTORY_PERMISSIONS.read);
  if (denied) {
    return denied;
  }

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
  const denied = await denyUnless(MASTER_INVENTORY_PERMISSIONS.read);
  if (denied) {
    return denied;
  }

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
  const denied = await denyUnless(MASTER_INVENTORY_PERMISSIONS.read);
  if (denied) {
    return denied;
  }

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
  const denied = await denyUnless(MASTER_INVENTORY_PERMISSIONS.read);
  if (denied) {
    return denied;
  }

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
  const denied = await denyUnless(MASTER_INVENTORY_PERMISSIONS.read);
  if (denied) {
    return denied;
  }

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
  const denied = await denyUnless(MASTER_INVENTORY_PERMISSIONS.read);
  if (denied) {
    return denied;
  }

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

// ============================================
// ADD INVENTORY (Warehouse or Platinum Dealer)
// ============================================

/** Permission required to add inventory records (Operations + Super Admin) */
const ADD_INVENTORY_PERMISSION = 'inventory.adjust';

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Options for the Add Inventory dialog: inventory products, active warehouse
 * locations, and active platinum dealers with their active locations.
 */
export async function getMasterInventoryFormOptions(): Promise<
  ActionResult<MasterInventoryFormOptions>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }
    if (!hasPermission(user, ADD_INVENTORY_PERMISSION)) {
      return { success: false, error: 'You do not have permission to add inventory' };
    }

    const supabase = await createClient();
    const [productsRes, warehousesRes, dealersRes, dealerLocationsRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, sku, name')
        .eq('item_type', 'inventory')
        .is('deleted_at', null)
        .order('sku', { ascending: true }),
      supabase
        .from('locations')
        .select('id, location_code, name')
        .eq('location_type', 'warehouse')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('name', { ascending: true }),
      supabase
        .from('platinum_dealers')
        .select('id, dealer_name')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('dealer_name', { ascending: true }),
      supabase
        .from('platinum_dealer_locations')
        .select('id, dealer_id, location_name, location_code')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('location_name', { ascending: true }),
    ]);

    const firstError =
      productsRes.error || warehousesRes.error || dealersRes.error || dealerLocationsRes.error;
    if (firstError) {
      console.error('[getMasterInventoryFormOptions] Error:', firstError);
      return { success: false, error: 'Failed to load products and locations' };
    }

    const dealerLocations = dealerLocationsRes.data || [];

    return {
      success: true,
      data: {
        products: (productsRes.data || []).map((p) => ({ id: p.id, sku: p.sku, name: p.name })),
        warehouses: (warehousesRes.data || []).map((l) => ({
          id: l.id,
          locationCode: l.location_code,
          name: l.name,
        })),
        dealers: (dealersRes.data || []).map((d) => ({
          id: d.id,
          dealerName: d.dealer_name,
          locations: dealerLocations
            .filter((loc) => loc.dealer_id === d.id)
            .map((loc) => ({
              id: loc.id,
              locationName: loc.location_name,
              locationCode: loc.location_code,
            })),
        })),
      },
    };
  } catch (error) {
    console.error('[getMasterInventoryFormOptions] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load form options',
    };
  }
}

/**
 * Create a new inventory record from Master Inventory.
 *
 * - Warehouse: creates a row in `inventory` through the Inventory service, which
 *   writes the audit log and logs the opening stock in `inventory_movements`.
 * - Platinum Dealer: creates a row in `platinum_dealer_inventory` and writes an
 *   audit log. Unlike the dealer page dialog, it never overwrites an existing record.
 */
export async function createMasterInventory(
  input: CreateMasterInventoryInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }
    if (!hasPermission(user, ADD_INVENTORY_PERMISSION)) {
      return { success: false, error: 'You do not have permission to add inventory' };
    }

    const auditContext = {
      userId: user.id,
      userEmail: user.email,
      userName: `${user.firstName} ${user.lastName}`.trim(),
    };

    if (!input.productId) {
      return { success: false, error: 'Please select a product' };
    }
    if (!isNonNegativeInteger(input.onHand)) {
      return { success: false, error: 'On Hand must be a whole number of 0 or more' };
    }

    const supabase = await createClient();

    // Product must be an active inventory item (not service / non-inventory)
    const { data: product } = await supabase
      .from('products')
      .select('id, sku, name, item_type')
      .eq('id', input.productId)
      .is('deleted_at', null)
      .single();

    if (!product || product.item_type !== 'inventory') {
      return { success: false, error: 'Selected product is not an inventory item' };
    }

    let createdId: string;

    if (input.sourceType === 'warehouse') {
      if (!input.locationId) {
        return { success: false, error: 'Please select a warehouse location' };
      }
      if (!isNonNegativeInteger(input.reorderPoint) || !isNonNegativeInteger(input.reorderQty)) {
        return {
          success: false,
          error: 'Reorder Point and Reorder Qty must be whole numbers of 0 or more',
        };
      }

      const { data: location } = await supabase
        .from('locations')
        .select('id, location_type, is_active')
        .eq('id', input.locationId)
        .is('deleted_at', null)
        .single();

      if (!location || location.location_type !== 'warehouse' || !location.is_active) {
        return { success: false, error: 'Selected location is not an active warehouse' };
      }

      const result = await inventoryService.create(
        {
          productId: input.productId,
          locationId: input.locationId,
          onHand: input.onHand,
          allocated: 0,
          reorderPoint: input.reorderPoint,
          reorderQty: input.reorderQty,
        },
        user.id,
        {
          userEmail: auditContext.userEmail,
          userName: auditContext.userName,
          origin: 'master_inventory',
        }
      );

      if (!result.success || !result.data) {
        return { success: false, error: result.error || 'Failed to create inventory record' };
      }
      createdId = result.data.id;
    } else if (input.sourceType === 'platinum_dealer') {
      if (!input.dealerId || !input.dealerLocationId) {
        return { success: false, error: 'Please select a dealer and dealer location' };
      }

      const { data: dealerLocation } = await supabase
        .from('platinum_dealer_locations')
        .select('id, dealer_id, location_name, location_code, status')
        .eq('id', input.dealerLocationId)
        .is('deleted_at', null)
        .single();

      if (!dealerLocation || dealerLocation.dealer_id !== input.dealerId) {
        return { success: false, error: 'Selected location does not belong to this dealer' };
      }
      if (dealerLocation.status !== 'active') {
        return { success: false, error: 'Selected dealer location is inactive' };
      }

      const { data: dealer } = await supabase
        .from('platinum_dealers')
        .select('id, dealer_name, status')
        .eq('id', input.dealerId)
        .is('deleted_at', null)
        .single();

      if (!dealer || dealer.status !== 'active') {
        return { success: false, error: 'Selected dealer is not active' };
      }

      const { data: existing, error: existingError } = await getDealerInventory({
        dealerLocationId: input.dealerLocationId,
        productId: input.productId,
      });
      if (existingError) {
        return { success: false, error: 'Failed to check existing dealer inventory' };
      }
      if (existing) {
        return {
          success: false,
          error:
            'Inventory record already exists for this product at this dealer location. Use Adjust on the Platinum Dealers page to change it.',
        };
      }

      const { data, error } = await upsertDealerInventory({
        dealerId: input.dealerId,
        dealerLocationId: input.dealerLocationId,
        productId: input.productId,
        onHand: input.onHand,
      });

      if (error || !data) {
        const message = error?.message ?? '';
        return {
          success: false,
          error: message.includes('unique_platinum_dealer_location_product')
            ? 'Inventory record already exists for this product at this dealer location'
            : message || 'Failed to create dealer inventory',
        };
      }
      createdId = data.id;

      // Movement log: opening stock at the dealer location
      if (data.onHand > 0) {
        const movement = await logDealerInventoryMovement({
          productId: product.id,
          dealerLocationId: dealerLocation.id,
          movementType: 'adjust',
          quantity: data.onHand,
          referenceType: 'adjustment',
          referenceId: data.id,
          reason: 'opening_stock',
          notes: `Opening stock: ${data.onHand} units added at ${dealer.dealer_name} - ${dealerLocation.location_name}`,
          createdBy: user.id,
        });
        if (!movement.success) {
          console.error('[createMasterInventory] Dealer movement log failed:', movement.error);
        }
      }

      // Audit log (awaited so it is written before the request ends;
      // auditService never throws on failure)
      await auditService.logCreate(
        'inventory',
        'PlatinumDealerInventory',
        data.id,
        {
          id: data.id,
          sourceType: 'platinum_dealer',
          dealerId: dealer.id,
          dealerName: dealer.dealer_name,
          dealerLocationId: dealerLocation.id,
          dealerLocationName: dealerLocation.location_name,
          dealerLocationCode: dealerLocation.location_code,
          productId: product.id,
          productSku: product.sku,
          productName: product.name,
          onHand: data.onHand,
          allocated: data.allocated,
          origin: 'master_inventory',
        },
        auditContext,
        `Added dealer inventory: ${product.sku} at ${dealer.dealer_name} - ${dealerLocation.location_name} (On Hand ${data.onHand})`
      );
    } else {
      return { success: false, error: 'Invalid inventory source' };
    }

    revalidatePath('/master-inventory');
    revalidatePath('/inventory');
    revalidatePath('/platinum-dealers');

    return { success: true, data: { id: createdId } };
  } catch (error) {
    console.error('[createMasterInventory] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create inventory record',
    };
  }
}

// ============================================
// UPDATE STOCK (warehouse)
// ============================================

/**
 * Current stock of a product at a warehouse, for the Update Stock dialog.
 * Returns exists = false (all zero) when the product has no row there yet.
 */
export async function getWarehouseStock(
  productId: string,
  locationId: string
): Promise<ActionResult<WarehouseStockLevel>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }
    if (!hasPermission(user, ADD_INVENTORY_PERMISSION)) {
      return { success: false, error: 'You do not have permission to update inventory' };
    }

    const result = await inventoryService.getByProductAndLocation(productId, locationId);
    const row = result.success ? result.data : null;
    return {
      success: true,
      data: row
        ? {
            exists: true,
            onHand: row.onHand,
            allocated: row.allocated,
            available: row.onHand - row.allocated,
            lowStockAlertAt: row.reorderPoint,
          }
        : { exists: false, onHand: 0, allocated: 0, available: 0, lowStockAlertAt: 0 },
    };
  } catch (error) {
    console.error('[getWarehouseStock] Error:', error);
    return { success: false, error: 'Failed to load current stock' };
  }
}

/**
 * Add or remove stock of a product at a warehouse and set its low stock alert.
 * Creates the inventory row when the product has none there yet (add only).
 * Every quantity change is logged in inventory_movements with its reason.
 */
export async function updateWarehouseStock(
  input: UpdateWarehouseStockInput
): Promise<ActionResult<WarehouseStockLevel>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }
    if (!hasPermission(user, ADD_INVENTORY_PERMISSION)) {
      return { success: false, error: 'You do not have permission to update inventory' };
    }

    if (!input.productId) {
      return { success: false, error: 'Please select a product' };
    }
    if (!input.locationId) {
      return { success: false, error: 'Please select a warehouse' };
    }
    if (input.direction !== 'add' && input.direction !== 'remove') {
      return { success: false, error: 'Choose Add stock or Remove stock' };
    }
    if (!isNonNegativeInteger(input.quantity) || !isNonNegativeInteger(input.lowStockAlertAt)) {
      return { success: false, error: 'Quantities must be whole numbers of 0 or more' };
    }
    // Reason is optional; an unknown value is ignored
    const reason = STOCK_CHANGE_REASONS.find((r) => r.value === input.reason);
    const note = input.note?.trim().slice(0, 500) || undefined;

    const supabase = await createClient();
    const [{ data: product }, { data: location }] = await Promise.all([
      supabase
        .from('products')
        .select('id, sku, item_type')
        .eq('id', input.productId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('locations')
        .select('id, name, location_type, is_active')
        .eq('id', input.locationId)
        .is('deleted_at', null)
        .single(),
    ]);
    if (!product || product.item_type !== 'inventory') {
      return { success: false, error: 'Selected product is not an inventory item' };
    }
    if (!location || location.location_type !== 'warehouse' || !location.is_active) {
      return { success: false, error: 'Selected location is not an active warehouse' };
    }

    const { inventoryRepository } = await import('@/features/inventory/repositories/inventory.repository');
    const delta = input.direction === 'add' ? input.quantity : -input.quantity;
    const notes = [reason?.label, note].filter(Boolean).join(' - ') || undefined;

    let row = await inventoryRepository.findByProductAndLocation(input.productId, input.locationId);
    const before = row ? { onHand: row.onHand, lowStockAlertAt: row.reorderPoint } : null;

    if (!row) {
      if (delta < 0) {
        return { success: false, error: `There is no ${product.sku} stock at ${location.name} to remove` };
      }
      // New row: created empty, then the added qty is logged like any other change
      row = await inventoryRepository.create({
        productId: input.productId,
        locationId: input.locationId,
        onHand: 0,
        allocated: 0,
        reorderPoint: input.lowStockAlertAt,
        reorderQty: 0,
      }, user.id);
    }

    if (delta !== 0) {
      row = await inventoryRepository.changeOnHand(row.id, delta, user.id, { reason: reason?.value, notes });
    }
    if (row.reorderPoint !== input.lowStockAlertAt) {
      row = await inventoryRepository.update(row.id, { reorderPoint: input.lowStockAlertAt }, user.id);
    }

    await auditService.log({
      action: before ? 'update' : 'create',
      module: 'inventory',
      entityType: 'Inventory',
      entityId: row.id,
      oldData: before ?? undefined,
      newData: { onHand: row.onHand, lowStockAlertAt: row.reorderPoint, change: delta, reason: reason?.value ?? null, note: note ?? null },
      userId: user.id,
      description: `${delta > 0 ? `Added ${delta}` : delta < 0 ? `Removed ${-delta}` : 'Updated low stock alert for'} ${product.sku} at ${location.name}${reason ? ` (${reason.label})` : ''}`,
    });

    revalidatePath('/master-inventory');
    revalidatePath('/inventory');

    return {
      success: true,
      data: {
        exists: true,
        onHand: row.onHand,
        allocated: row.allocated,
        available: row.onHand - row.allocated,
        lowStockAlertAt: row.reorderPoint,
      },
    };
  } catch (error) {
    console.error('[updateWarehouseStock] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update stock',
    };
  }
}


// ============================================
// PLATINUM DEALER: UPDATE STOCK (same flow as warehouses)
// ============================================

/**
 * Current stock of a product at a platinum dealer location, for the
 * Update Stock dialog. exists = false (all zero) when there is no row yet.
 */
export async function getDealerStock(
  productId: string,
  dealerLocationId: string
): Promise<ActionResult<WarehouseStockLevel>> {
  const denied = await denyUnless(ADD_INVENTORY_PERMISSION);
  if (denied) {
    return denied;
  }
  try {
    const { data, error } = await getDealerInventory({ dealerLocationId, productId });
    if (error) {
      return { success: false, error: 'Failed to load current dealer stock' };
    }
    return {
      success: true,
      data: data
        ? {
            exists: true,
            onHand: data.onHand,
            allocated: data.allocated,
            available: data.onHand - data.allocated,
            lowStockAlertAt: 0,
          }
        : { exists: false, onHand: 0, allocated: 0, available: 0, lowStockAlertAt: 0 },
    };
  } catch (error) {
    console.error('[getDealerStock] Error:', error);
    return { success: false, error: 'Failed to load current dealer stock' };
  }
}

/**
 * Add or remove stock of a product at a platinum dealer location.
 * No row yet → creates it (Add only, same as Add Inventory). Existing row →
 * same adjustment as Platinum Dealers → View Inventory → Adjust.
 */
export async function updateDealerStock(input: {
  productId: string;
  dealerId: string;
  dealerLocationId: string;
  direction: 'add' | 'remove';
  quantity: number;
  reason?: string;
  note?: string;
}): Promise<ActionResult<WarehouseStockLevel>> {
  const denied = await denyUnless(ADD_INVENTORY_PERMISSION);
  if (denied) {
    return denied;
  }
  try {
    if (!input.productId) {
      return { success: false, error: 'Please select a product' };
    }
    if (!input.dealerId || !input.dealerLocationId) {
      return { success: false, error: 'Please select a dealer and dealer location' };
    }
    if (input.direction !== 'add' && input.direction !== 'remove') {
      return { success: false, error: 'Choose Add stock or Remove stock' };
    }
    if (!isNonNegativeInteger(input.quantity) || input.quantity === 0) {
      return { success: false, error: 'Enter a quantity to add or remove' };
    }

    const { data: current, error: currentError } = await getDealerInventory({
      dealerLocationId: input.dealerLocationId,
      productId: input.productId,
    });
    if (currentError) {
      return { success: false, error: 'Failed to load current dealer stock' };
    }

    // No stock there yet: same path as before (creates the record)
    if (!current) {
      if (input.direction === 'remove') {
        return { success: false, error: 'There is no stock of this product at this dealer location to remove' };
      }
      const created = await createMasterInventory({
        sourceType: 'platinum_dealer',
        productId: input.productId,
        dealerId: input.dealerId,
        dealerLocationId: input.dealerLocationId,
        onHand: input.quantity,
      } as CreateMasterInventoryInput);
      if (!created.success) {
        return { success: false, error: created.error };
      }
      return {
        success: true,
        data: { exists: true, onHand: input.quantity, allocated: 0, available: input.quantity, lowStockAlertAt: 0 },
      };
    }

    const newOnHand = current.onHand + (input.direction === 'add' ? input.quantity : -input.quantity);
    if (newOnHand < current.allocated) {
      return {
        success: false,
        error: `Only ${current.onHand - current.allocated} available to remove (${current.allocated} allocated to orders)`,
      };
    }

    const reason = STOCK_CHANGE_REASONS.find((r) => r.value === input.reason);
    const { updateDealerInventoryAction } = await import('@/features/platinum-dealers/actions');
    const result = await updateDealerInventoryAction({
      dealerId: input.dealerId,
      dealerLocationId: input.dealerLocationId,
      productId: input.productId,
      onHand: newOnHand,
      reason: reason?.value,
      note: [reason?.label, input.note?.trim()].filter(Boolean).join(' - ') || undefined,
    });
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update dealer stock' };
    }

    revalidatePath('/master-inventory');
    return {
      success: true,
      data: {
        exists: true,
        onHand: result.data.onHand,
        allocated: result.data.allocated,
        available: result.data.onHand - result.data.allocated,
        lowStockAlertAt: 0,
      },
    };
  } catch (error) {
    console.error('[updateDealerStock] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update dealer stock' };
  }
}
