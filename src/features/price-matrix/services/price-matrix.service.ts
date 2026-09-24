/**
 * Price Matrix Service
 *
 * Business logic for Price Matrix module.
 * Handles channel-based product pricing operations.
 */

import { priceMatrixRepository, DuplicatePriceTierError } from '../repositories/price-matrix.repository';
import type {
  PriceMatrixEntry,
  PriceMatrixWithProduct,
  PriceLookupResult,
  CreatePriceMatrixDTO,
  UpdatePriceMatrixDTO,
  PriceMatrixListParams,
  PriceMatrixTableRow,
  PaginatedResult,
} from '../types';
import type { CustomerChannel } from '@/features/customers/types';
import { formatCurrency, formatQuantityRange, calculateMargin } from '../lib/schemas';

// ============================================
// SERVICE
// ============================================

class PriceMatrixServiceImpl {
  /**
   * Get paginated list of price entries
   */
  async getList(params: PriceMatrixListParams = {}): Promise<PaginatedResult<PriceMatrixTableRow>> {
    const result = await priceMatrixRepository.findMany(params);

    return {
      data: result.data.map((entry) => this.toTableRow(entry)),
      meta: result.meta,
    };
  }

  /**
   * Get all price entries for a product
   */
  async getByProductId(productId: string): Promise<PriceMatrixEntry[]> {
    return priceMatrixRepository.findByProductId(productId);
  }

  /**
   * Get price entries for a product as table rows
   */
  async getTableRowsByProductId(productId: string): Promise<PriceMatrixTableRow[]> {
    // We need product info for table rows, so fetch with product
    const result = await priceMatrixRepository.findMany({ productId, limit: 1000 });
    return result.data.map((entry) => this.toTableRow(entry));
  }

  /**
   * Get a single entry by ID
   */
  async getById(id: string): Promise<PriceMatrixEntry | null> {
    return priceMatrixRepository.findById(id);
  }

  /**
   * Get a single entry by ID with product info
   */
  async getByIdWithProduct(id: string): Promise<PriceMatrixWithProduct | null> {
    return priceMatrixRepository.findByIdWithProduct(id);
  }

  /**
   * Look up price for a product/channel/quantity
   */
  async lookupPrice(
    productId: string,
    channel: CustomerChannel,
    quantity: number = 1
  ): Promise<PriceLookupResult | null> {
    return priceMatrixRepository.getPrice(productId, channel, quantity);
  }

  /**
   * Create a new price entry
   */
  async create(data: CreatePriceMatrixDTO, userId?: string): Promise<PriceMatrixEntry> {
    // Validate that tier doesn't already exist
    const exists = await priceMatrixRepository.tierExists(
      data.productId,
      data.channel,
      data.minQuantity
    );

    if (exists) {
      throw new DuplicatePriceTierError();
    }

    return priceMatrixRepository.create(data, userId);
  }

  /**
   * Update an existing price entry
   */
  async update(
    id: string,
    data: UpdatePriceMatrixDTO,
    userId?: string
  ): Promise<PriceMatrixEntry> {
    // Check if entry exists
    const existing = await priceMatrixRepository.findById(id);
    if (!existing) {
      throw new Error('Price entry not found');
    }

    // If changing channel or minQuantity, check for duplicates
    if (data.channel !== undefined || data.minQuantity !== undefined) {
      const channel = data.channel ?? existing.channel;
      const minQuantity = data.minQuantity ?? existing.minQuantity;

      const exists = await priceMatrixRepository.tierExists(
        existing.productId,
        channel,
        minQuantity,
        id
      );

      if (exists) {
        throw new DuplicatePriceTierError();
      }
    }

    return priceMatrixRepository.update(id, data, userId);
  }

  /**
   * Delete a price entry
   */
  async delete(id: string, userId?: string): Promise<PriceMatrixEntry> {
    const existing = await priceMatrixRepository.findById(id);
    if (!existing) {
      throw new Error('Price entry not found');
    }

    return priceMatrixRepository.softDelete(id, userId);
  }

  /**
   * Delete all price entries for a product
   */
  async deleteByProductId(productId: string, userId?: string): Promise<number> {
    return priceMatrixRepository.deleteByProductId(productId, userId);
  }

  /**
   * Get count of price entries for a product
   */
  async getCountByProduct(productId: string): Promise<number> {
    return priceMatrixRepository.getCountByProduct(productId);
  }

  /**
   * Convert entry with product to table row
   */
  private toTableRow(entry: PriceMatrixWithProduct): PriceMatrixTableRow {
    const { margin, marginPercent } = calculateMargin(entry.cost, entry.price);

    return {
      id: entry.id,
      productId: entry.productId,
      productSku: entry.product.sku,
      productName: entry.product.name,
      channel: entry.channel,
      minQuantity: entry.minQuantity,
      maxQuantity: entry.maxQuantity,
      quantityRange: formatQuantityRange(entry.minQuantity, entry.maxQuantity),
      cost: entry.cost,
      price: entry.price,
      formattedCost: formatCurrency(entry.cost),
      formattedPrice: formatCurrency(entry.price),
      margin,
      marginPercent,
      status: entry.status,
      effectiveFrom: entry.effectiveFrom,
      effectiveTo: entry.effectiveTo,
    };
  }
}

export const priceMatrixService = new PriceMatrixServiceImpl();
export type PriceMatrixService = typeof priceMatrixService;
