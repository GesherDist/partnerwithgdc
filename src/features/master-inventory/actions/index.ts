/**
 * Master Inventory Server Actions
 *
 * Server-side actions for master inventory operations
 */

'use server';

import { masterInventoryService } from '../services/master-inventory.service';
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
