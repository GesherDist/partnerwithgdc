/**
 * Master Inventory Service
 *
 * Business logic layer for master inventory operations
 */

import { masterInventoryRepository } from '../repositories/master-inventory.repository';
import type {
  MasterInventoryItem,
  MasterInventoryFilters,
  MasterInventoryStats,
  ProductInventorySummary,
  PaginatedResult,
} from '../types';

// ============================================
// SERVICE
// ============================================

class MasterInventoryServiceImpl {
  /**
   * Get paginated master inventory list with filters
   */
  async getInventory(
    filters: MasterInventoryFilters = {}
  ): Promise<PaginatedResult<MasterInventoryItem>> {
    return masterInventoryRepository.findMany(filters);
  }

  /**
   * Get master inventory stats
   */
  async getStats(): Promise<MasterInventoryStats> {
    return masterInventoryRepository.getStats();
  }

  /**
   * Get product inventory summary across all sources
   */
  async getProductSummary(productId: string): Promise<ProductInventorySummary | null> {
    if (!productId || productId.trim() === '') {
      throw new Error('Product ID is required');
    }

    return masterInventoryRepository.getProductSummary(productId);
  }

  /**
   * Search inventory by SKU or product name
   */
  async searchInventory(searchTerm: string): Promise<MasterInventoryItem[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    const result = await masterInventoryRepository.findMany({
      search: searchTerm.trim(),
      limit: 50, // Limit search results
    });

    return result.data;
  }

  /**
   * Get low stock items across all sources
   */
  async getLowStockItems(): Promise<MasterInventoryItem[]> {
    const result = await masterInventoryRepository.findMany({
      lowStockOnly: true,
      limit: 100, // Get all low stock items
    });

    return result.data;
  }

  /**
   * Get inventory for a specific product across all locations
   */
  async getInventoryByProduct(productId: string): Promise<MasterInventoryItem[]> {
    if (!productId || productId.trim() === '') {
      throw new Error('Product ID is required');
    }

    const result = await masterInventoryRepository.findMany({
      productId,
      limit: 100, // Get all locations for this product
    });

    return result.data;
  }

  /**
   * Get inventory breakdown by source type
   */
  async getInventoryBySource(sourceType: 'warehouse' | 'platinum_dealer'): Promise<MasterInventoryItem[]> {
    const result = await masterInventoryRepository.findMany({
      sourceType,
      limit: 1000, // Get large set for analysis
    });

    return result.data;
  }
}

export const masterInventoryService = new MasterInventoryServiceImpl();
export type MasterInventoryService = typeof masterInventoryService;
