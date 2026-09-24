/**
 * Master Inventory Repository
 *
 * Combines inventory data from multiple sources:
 * - Warehouse/GDC inventory (inventory table)
 * - Platinum Dealer inventory (platinum_dealer_inventory table)
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  MasterInventoryItem,
  MasterInventoryFilters,
  MasterInventoryStats,
  ProductInventorySummary,
  PaginatedResult,
} from '../types';

// ============================================
// REPOSITORY
// ============================================

class MasterInventoryRepositoryImpl {
  /**
   * Get combined inventory from all sources with pagination and filters
   */
  async findMany(
    filters: MasterInventoryFilters = {}
  ): Promise<PaginatedResult<MasterInventoryItem>> {
    const {
      page = 1,
      limit = 20,
      search,
      sourceType = 'all',
      locationId,
      dealerId,
      dealerLocationId,
      productId,
      lowStockOnly = false,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = filters;

    const offset = (page - 1) * limit;

    // Fetch warehouse inventory
    let warehouseData: MasterInventoryItem[] = [];
    if (sourceType === 'all' || sourceType === 'warehouse') {
      warehouseData = await this.fetchWarehouseInventory({
        search,
        locationId,
        productId,
        lowStockOnly,
      });
    }

    // Fetch platinum dealer inventory
    let dealerData: MasterInventoryItem[] = [];
    if (sourceType === 'all' || sourceType === 'platinum_dealer') {
      dealerData = await this.fetchPlatinumDealerInventory({
        search,
        dealerId,
        dealerLocationId,
        productId,
        lowStockOnly,
      });
    }

    // Combine data
    let combinedData = [...warehouseData, ...dealerData];

    // Apply sorting
    combinedData = this.sortData(combinedData, sortBy, sortOrder);

    // Pagination
    const total = combinedData.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedData = combinedData.slice(offset, offset + limit);

    return {
      data: paginatedData,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get master inventory stats aggregated across all sources
   */
  async getStats(): Promise<MasterInventoryStats> {
    // Fetch warehouse stats
    const warehouseStats = await this.getWarehouseStats();

    // Fetch platinum dealer stats
    const dealerStats = await this.getPlatinumDealerStats();

    // Fetch on order and in transit (from existing inventory module)
    const { onOrder, inTransit } = await this.getOnOrderAndInTransit();

    return {
      // Total stats
      totalLocations: warehouseStats.locationCount + dealerStats.locationCount,
      totalOnHand: warehouseStats.onHand + dealerStats.onHand,
      totalAllocated: warehouseStats.allocated + dealerStats.allocated,
      totalAvailable: warehouseStats.available + dealerStats.available,
      lowStockCount: warehouseStats.lowStockCount + dealerStats.lowStockCount,

      // Breakdown by source
      warehouse: {
        locationCount: warehouseStats.locationCount,
        onHand: warehouseStats.onHand,
        allocated: warehouseStats.allocated,
        available: warehouseStats.available,
      },
      platinumDealer: {
        dealerCount: dealerStats.dealerCount,
        locationCount: dealerStats.locationCount,
        onHand: dealerStats.onHand,
        allocated: dealerStats.allocated,
        available: dealerStats.available,
      },

      onOrder,
      inTransit,
    };
  }

  /**
   * Get product inventory summary across all locations
   */
  async getProductSummary(productId: string): Promise<ProductInventorySummary | null> {
    // Fetch warehouse inventory for product
    const { data: warehouseRows, error: whError } = await db
      .from('inventory')
      .select(
        `
        on_hand,
        allocated,
        location_id,
        products!inner (
          id,
          sku,
          name
        )
      `
      )
      .eq('product_id', productId);

    if (whError) {
      console.error('Error fetching warehouse inventory:', whError);
    }

    // Fetch platinum dealer inventory for product
    const { data: dealerRows, error: dlError } = await db
      .from('platinum_dealer_inventory')
      .select(
        `
        on_hand,
        allocated,
        dealer_location_id,
        products!inner (
          id,
          sku,
          name
        )
      `
      )
      .eq('product_id', productId);

    if (dlError) {
      console.error('Error fetching dealer inventory:', dlError);
    }

    if ((!warehouseRows || warehouseRows.length === 0) && (!dealerRows || dealerRows.length === 0)) {
      return null;
    }

    // Calculate warehouse totals
    const warehouseOnHand = (warehouseRows || []).reduce((sum, row) => sum + (row.on_hand || 0), 0);
    const warehouseAllocated = (warehouseRows || []).reduce((sum, row) => sum + (row.allocated || 0), 0);
    const warehouseAvailable = warehouseOnHand - warehouseAllocated;
    const warehouseLocationCount = (warehouseRows || []).length;

    // Calculate dealer totals
    const dealerOnHand = (dealerRows || []).reduce((sum, row) => sum + (row.on_hand || 0), 0);
    const dealerAllocated = (dealerRows || []).reduce((sum, row) => sum + (row.allocated || 0), 0);
    const dealerAvailable = dealerOnHand - dealerAllocated;
    const dealerLocationCount = (dealerRows || []).length;

    // Get product info
    const product = warehouseRows?.[0]?.products || dealerRows?.[0]?.products;
    const productArray = Array.isArray(product) ? product[0] : product;

    return {
      productId,
      productSku: productArray?.sku || 'Unknown',
      productName: productArray?.name || 'Unknown',
      totalOnHand: warehouseOnHand + dealerOnHand,
      totalAllocated: warehouseAllocated + dealerAllocated,
      totalAvailable: warehouseAvailable + dealerAvailable,
      warehouseOnHand,
      warehouseAllocated,
      warehouseAvailable,
      dealerOnHand,
      dealerAllocated,
      dealerAvailable,
      warehouseLocationCount,
      dealerLocationCount,
      isLowStock: warehouseAvailable + dealerAvailable <= 0,
    };
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Fetch warehouse inventory
   */
  private async fetchWarehouseInventory(filters: {
    search?: string;
    locationId?: string;
    productId?: string;
    lowStockOnly?: boolean;
  }): Promise<MasterInventoryItem[]> {
    const { search, locationId, productId, lowStockOnly } = filters;

    let query = db.from('inventory').select(
      `
        id,
        product_id,
        location_id,
        on_hand,
        allocated,
        reorder_point,
        reorder_qty,
        created_at,
        updated_at,
        products!inner (
          id,
          sku,
          name
        ),
        locations!inner (
          id,
          location_code,
          name,
          city,
          state
        )
      `
    );

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (search) {
      query = query.or(`products.sku.ilike.%${search}%,products.name.ilike.%${search}%,locations.name.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching warehouse inventory:', error);
      return [];
    }

    let results = (data || []).map((row) => this.mapWarehouseRow(row));

    if (lowStockOnly) {
      results = results.filter((item) => item.isLowStock);
    }

    return results;
  }

  /**
   * Fetch platinum dealer inventory
   */
  private async fetchPlatinumDealerInventory(filters: {
    search?: string;
    dealerId?: string;
    dealerLocationId?: string;
    productId?: string;
    lowStockOnly?: boolean;
  }): Promise<MasterInventoryItem[]> {
    const { search, dealerId, dealerLocationId, productId, lowStockOnly } = filters;

    let query = db.from('platinum_dealer_inventory').select(
      `
        id,
        product_id,
        dealer_id,
        dealer_location_id,
        on_hand,
        allocated,
        available,
        last_counted_at,
        created_at,
        updated_at,
        products!inner (
          id,
          sku,
          name
        ),
        platinum_dealer_locations!inner (
          id,
          location_name,
          location_code,
          address_city,
          address_state
        ),
        platinum_dealers!inner (
          id,
          dealer_name
        )
      `
    );

    if (dealerId) {
      query = query.eq('dealer_id', dealerId);
    }

    if (dealerLocationId) {
      query = query.eq('dealer_location_id', dealerLocationId);
    }

    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (search) {
      query = query.or(
        `products.sku.ilike.%${search}%,products.name.ilike.%${search}%,platinum_dealer_locations.location_name.ilike.%${search}%,platinum_dealers.dealer_name.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching platinum dealer inventory:', error);
      return [];
    }

    let results = (data || []).map((row) => this.mapDealerRow(row));

    if (lowStockOnly) {
      results = results.filter((item) => item.isLowStock);
    }

    return results;
  }

  /**
   * Get warehouse stats
   */
  private async getWarehouseStats(): Promise<{
    locationCount: number;
    onHand: number;
    allocated: number;
    available: number;
    lowStockCount: number;
  }> {
    const { data, error } = await db
      .from('inventory')
      .select('on_hand, allocated, reorder_point, location_id');

    if (error) {
      console.error('Error fetching warehouse stats:', error);
      return {
        locationCount: 0,
        onHand: 0,
        allocated: 0,
        available: 0,
        lowStockCount: 0,
      };
    }

    const uniqueLocations = new Set(data.map((row) => row.location_id));
    const onHand = data.reduce((sum, row) => sum + (row.on_hand || 0), 0);
    const allocated = data.reduce((sum, row) => sum + (row.allocated || 0), 0);
    const available = onHand - allocated;
    const lowStockCount = data.filter(
      (row) => row.on_hand - row.allocated <= (row.reorder_point || 0)
    ).length;

    return {
      locationCount: uniqueLocations.size,
      onHand,
      allocated,
      available,
      lowStockCount,
    };
  }

  /**
   * Get platinum dealer stats
   */
  private async getPlatinumDealerStats(): Promise<{
    dealerCount: number;
    locationCount: number;
    onHand: number;
    allocated: number;
    available: number;
    lowStockCount: number;
  }> {
    const { data, error } = await db
      .from('platinum_dealer_inventory')
      .select('on_hand, allocated, available, dealer_id, dealer_location_id');

    if (error) {
      console.error('Error fetching dealer stats:', error);
      return {
        dealerCount: 0,
        locationCount: 0,
        onHand: 0,
        allocated: 0,
        available: 0,
        lowStockCount: 0,
      };
    }

    const uniqueDealers = new Set(data.map((row) => row.dealer_id));
    const uniqueLocations = new Set(data.map((row) => row.dealer_location_id));
    const onHand = data.reduce((sum, row) => sum + (row.on_hand || 0), 0);
    const allocated = data.reduce((sum, row) => sum + (row.allocated || 0), 0);
    const available = data.reduce((sum, row) => sum + (row.available || 0), 0);
    const lowStockCount = data.filter((row) => (row.available || 0) <= 0).length;

    return {
      dealerCount: uniqueDealers.size,
      locationCount: uniqueLocations.size,
      onHand,
      allocated,
      available,
      lowStockCount,
    };
  }

  /**
   * Get on order and in transit quantities
   */
  private async getOnOrderAndInTransit(): Promise<{ onOrder: number; inTransit: number }> {
    // On Order: Sum of PO items where status is 'confirmed', 'in_production', 'ready_to_ship'
    const { data: poData, error: poError } = await db
      .from('purchase_order_items')
      .select(
        `
        quantity,
        purchase_orders!inner (
          status
        )
      `
      )
      .in('purchase_orders.status', ['confirmed', 'in_production', 'ready_to_ship']);

    const onOrder = poError
      ? 0
      : (poData || []).reduce((sum, row) => sum + (row.quantity || 0), 0);

    // In Transit: Sum of shipment items where status is 'in_transit'
    const { data: shipmentData, error: shipmentError } = await db
      .from('shipment_items')
      .select(
        `
        quantity,
        shipments!inner (
          status
        )
      `
      )
      .eq('shipments.status', 'in_transit');

    const inTransit = shipmentError
      ? 0
      : (shipmentData || []).reduce((sum, row) => sum + (row.quantity || 0), 0);

    return { onOrder, inTransit };
  }

  /**
   * Map warehouse inventory row to MasterInventoryItem
   */
  private mapWarehouseRow(row: {
    id: string;
    product_id: string;
    location_id: string;
    on_hand: number;
    allocated: number;
    reorder_point: number;
    reorder_qty: number;
    created_at: string;
    updated_at: string;
    products: { id: string; sku: string; name: string } | { id: string; sku: string; name: string }[];
    locations:
      | { id: string; location_code: string; name: string; city: string | null; state: string | null }
      | { id: string; location_code: string; name: string; city: string | null; state: string | null }[];
  }): MasterInventoryItem {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const location = Array.isArray(row.locations) ? row.locations[0] : row.locations;
    const available = row.on_hand - row.allocated;
    const isLowStock = available <= row.reorder_point;

    return {
      id: row.id,
      sourceType: 'warehouse',
      sourceId: row.id,
      productId: row.product_id,
      productSku: product?.sku || 'Unknown',
      productName: product?.name || 'Unknown',
      locationId: row.location_id,
      locationName: location?.name || 'Unknown',
      locationCode: location?.location_code || 'Unknown',
      locationCity: location?.city || null,
      locationState: location?.state || null,
      onHand: row.on_hand,
      allocated: row.allocated,
      available,
      isLowStock,
      reorderPoint: row.reorder_point,
      reorderQty: row.reorder_qty,
      dealerId: null,
      dealerName: null,
      dealerLocationId: null,
      lastCountedAt: null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map platinum dealer inventory row to MasterInventoryItem
   */
  private mapDealerRow(row: {
    id: string;
    product_id: string;
    dealer_id: string;
    dealer_location_id: string;
    on_hand: number;
    allocated: number;
    available: number;
    last_counted_at: string | null;
    created_at: string;
    updated_at: string;
    products: { id: string; sku: string; name: string } | { id: string; sku: string; name: string }[];
    platinum_dealer_locations:
      | {
          id: string;
          location_name: string;
          location_code: string | null;
          address_city: string | null;
          address_state: string | null;
        }
      | {
          id: string;
          location_name: string;
          location_code: string | null;
          address_city: string | null;
          address_state: string | null;
        }[];
    platinum_dealers: { id: string; dealer_name: string } | { id: string; dealer_name: string }[];
  }): MasterInventoryItem {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const location = Array.isArray(row.platinum_dealer_locations)
      ? row.platinum_dealer_locations[0]
      : row.platinum_dealer_locations;
    const dealer = Array.isArray(row.platinum_dealers)
      ? row.platinum_dealers[0]
      : row.platinum_dealers;
    const isLowStock = row.available <= 0;

    return {
      id: row.id,
      sourceType: 'platinum_dealer',
      sourceId: row.id,
      productId: row.product_id,
      productSku: product?.sku || 'Unknown',
      productName: product?.name || 'Unknown',
      locationId: row.dealer_location_id,
      locationName: location?.location_name || 'Unknown',
      locationCode: location?.location_code || 'Unknown',
      locationCity: location?.address_city || null,
      locationState: location?.address_state || null,
      onHand: row.on_hand,
      allocated: row.allocated,
      available: row.available,
      isLowStock,
      reorderPoint: null,
      reorderQty: null,
      dealerId: row.dealer_id,
      dealerName: dealer?.dealer_name || 'Unknown',
      dealerLocationId: row.dealer_location_id,
      lastCountedAt: row.last_counted_at ? new Date(row.last_counted_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Sort combined data
   */
  private sortData(
    data: MasterInventoryItem[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): MasterInventoryItem[] {
    const sorted = [...data].sort((a, b) => {
      let aVal: string | number | Date;
      let bVal: string | number | Date;

      switch (sortBy) {
        case 'productSku':
          aVal = a.productSku;
          bVal = b.productSku;
          break;
        case 'productName':
          aVal = a.productName;
          bVal = b.productName;
          break;
        case 'locationName':
          aVal = a.locationName;
          bVal = b.locationName;
          break;
        case 'onHand':
          aVal = a.onHand;
          bVal = b.onHand;
          break;
        case 'allocated':
          aVal = a.allocated;
          bVal = b.allocated;
          break;
        case 'available':
          aVal = a.available;
          bVal = b.available;
          break;
        case 'updatedAt':
        default:
          aVal = a.updatedAt;
          bVal = b.updatedAt;
          break;
      }

      if (aVal < bVal) {return sortOrder === 'asc' ? -1 : 1;}
      if (aVal > bVal) {return sortOrder === 'asc' ? 1 : -1;}
      return 0;
    });

    return sorted;
  }
}

export const masterInventoryRepository = new MasterInventoryRepositoryImpl();
export type MasterInventoryRepository = typeof masterInventoryRepository;
