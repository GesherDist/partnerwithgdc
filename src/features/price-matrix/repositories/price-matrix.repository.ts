/**
 * Price Matrix Repository
 *
 * Data access layer for Price Matrix module.
 * Handles all database operations for channel-based product pricing.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  PriceMatrixEntry,
  PriceMatrixWithProduct,
  PriceLookupResult,
  CreatePriceMatrixDTO,
  UpdatePriceMatrixDTO,
  PriceMatrixListParams,
  PriceStatus,
} from '../types';
import type { CustomerChannel } from '@/features/customers/types';

// ============================================
// DATABASE ROW TYPE
// ============================================

interface DbPriceMatrix {
  id: string;
  product_id: string;
  channel: CustomerChannel;
  min_quantity: number;
  max_quantity: number | null;
  cost: number;
  price: number;
  status: PriceStatus;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbPriceMatrixWithProduct extends DbPriceMatrix {
  products: {
    id: string;
    sku: string;
    name: string;
  };
}

// ============================================
// TYPES
// ============================================

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// CONSTANTS
// ============================================

const SORTABLE_COLUMNS: Record<string, string> = {
  channel: 'channel',
  minQuantity: 'min_quantity',
  maxQuantity: 'max_quantity',
  cost: 'cost',
  price: 'price',
  status: 'status',
  effectiveFrom: 'effective_from',
  createdAt: 'created_at',
};

const DEFAULT_SORT_COLUMN = 'min_quantity';

// ============================================
// ERRORS
// ============================================

export class DuplicatePriceTierError extends Error {
  constructor() {
    super('A price tier with this channel and quantity range already exists');
    this.name = 'DuplicatePriceTierError';
  }
}

const UNIQUE_VIOLATION = '23505';

// ============================================
// REPOSITORY
// ============================================

class PriceMatrixRepositoryImpl {
  /**
   * Find all price entries with pagination and filtering
   */
  async findMany(params: PriceMatrixListParams = {}): Promise<PaginatedResult<PriceMatrixWithProduct>> {
    const {
      productId,
      channel,
      status,
      page = 1,
      limit = 50,
      sortBy = 'minQuantity',
      sortOrder = 'asc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query with product join
    let query = db
      .from('price_matrix')
      .select(`
        *,
        products!inner (
          id,
          sku,
          name
        )
      `, { count: 'exact' })
      .is('deleted_at', null);

    // Apply filters
    if (productId) {
      query = query.eq('product_id', productId);
    }

    if (channel) {
      query = query.eq('channel', channel);
    }

    if (status) {
      query = query.eq('status', status);
    }

    // Apply sorting
    const dbSortField = SORTABLE_COLUMNS[sortBy as string] ?? DEFAULT_SORT_COLUMN;
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch price matrix: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToEntryWithProduct(row as DbPriceMatrixWithProduct)),
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
   * Find all price entries for a specific product
   */
  async findByProductId(productId: string): Promise<PriceMatrixEntry[]> {
    const { data, error } = await db
      .from('price_matrix')
      .select('*')
      .eq('product_id', productId)
      .is('deleted_at', null)
      .order('channel', { ascending: true })
      .order('min_quantity', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch price matrix: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToEntry(row as DbPriceMatrix));
  }

  /**
   * Find a single entry by ID
   */
  async findById(id: string): Promise<PriceMatrixEntry | null> {
    const { data, error } = await db
      .from('price_matrix')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { return null; }
      throw new Error(`Failed to fetch price entry: ${error.message}`);
    }

    return data ? this.mapToEntry(data as DbPriceMatrix) : null;
  }

  /**
   * Find entry by ID with product info
   */
  async findByIdWithProduct(id: string): Promise<PriceMatrixWithProduct | null> {
    const { data, error } = await db
      .from('price_matrix')
      .select(`
        *,
        products!inner (
          id,
          sku,
          name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { return null; }
      throw new Error(`Failed to fetch price entry: ${error.message}`);
    }

    return data ? this.mapToEntryWithProduct(data as DbPriceMatrixWithProduct) : null;
  }

  /**
   * Get price for a product/channel/quantity using the database function
   */
  async getPrice(
    productId: string,
    channel: CustomerChannel,
    quantity: number = 1
  ): Promise<PriceLookupResult | null> {
    const { data, error } = await db.rpc('get_product_price', {
      p_product_id: productId,
      p_channel: channel,
      p_quantity: quantity,
    });

    if (error) {
      throw new Error(`Failed to get price: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const row = data[0];
    return {
      cost: row.cost,
      price: row.price,
      minQuantity: row.min_quantity,
      maxQuantity: row.max_quantity,
    };
  }

  /**
   * Create a new price entry
   */
  async create(data: CreatePriceMatrixDTO, userId?: string): Promise<PriceMatrixEntry> {
    const { data: result, error } = await db
      .from('price_matrix')
      .insert({
        product_id: data.productId,
        channel: data.channel,
        min_quantity: data.minQuantity,
        max_quantity: data.maxQuantity ?? null,
        cost: data.cost,
        price: data.price,
        status: data.status || 'active',
        effective_from: data.effectiveFrom?.toISOString() || new Date().toISOString(),
        effective_to: data.effectiveTo?.toISOString() || null,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DuplicatePriceTierError();
      }
      throw new Error(`Failed to create price entry: ${error.message}`);
    }

    return this.mapToEntry(result as DbPriceMatrix);
  }

  /**
   * Update an existing price entry
   */
  async update(id: string, data: UpdatePriceMatrixDTO, userId?: string): Promise<PriceMatrixEntry> {
    const updateData: Record<string, unknown> = {
      updated_by: userId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (data.channel !== undefined) { updateData.channel = data.channel; }
    if (data.minQuantity !== undefined) { updateData.min_quantity = data.minQuantity; }
    if (data.maxQuantity !== undefined) { updateData.max_quantity = data.maxQuantity; }
    if (data.cost !== undefined) { updateData.cost = data.cost; }
    if (data.price !== undefined) { updateData.price = data.price; }
    if (data.status !== undefined) { updateData.status = data.status; }
    if (data.effectiveFrom !== undefined) { updateData.effective_from = data.effectiveFrom.toISOString(); }
    if (data.effectiveTo !== undefined) { updateData.effective_to = data.effectiveTo?.toISOString() || null; }

    const { data: result, error } = await db
      .from('price_matrix')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new DuplicatePriceTierError();
      }
      throw new Error(`Failed to update price entry: ${error.message}`);
    }

    return this.mapToEntry(result as DbPriceMatrix);
  }

  /**
   * Soft delete a price entry
   */
  async softDelete(id: string, userId?: string): Promise<PriceMatrixEntry> {
    const { data, error } = await db
      .from('price_matrix')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete price entry: ${error.message}`);
    }

    return this.mapToEntry(data as DbPriceMatrix);
  }

  /**
   * Delete all price entries for a product (used when removing product)
   */
  async deleteByProductId(productId: string, userId?: string): Promise<number> {
    const { data, error } = await db
      .from('price_matrix')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      throw new Error(`Failed to delete price entries: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Check if a price tier exists for the same product/channel/quantity range
   */
  async tierExists(
    productId: string,
    channel: CustomerChannel,
    minQuantity: number,
    excludeId?: string
  ): Promise<boolean> {
    let query = db
      .from('price_matrix')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('channel', channel)
      .eq('min_quantity', minQuantity)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check tier: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Get count of price entries by product
   */
  async getCountByProduct(productId: string): Promise<number> {
    const { count, error } = await db
      .from('price_matrix')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get count: ${error.message}`);
    }

    return count ?? 0;
  }

  // ============================================
  // MAPPERS
  // ============================================

  private mapToEntry(data: DbPriceMatrix): PriceMatrixEntry {
    return {
      id: data.id,
      productId: data.product_id,
      channel: data.channel,
      minQuantity: data.min_quantity,
      maxQuantity: data.max_quantity,
      cost: data.cost,
      price: data.price,
      status: data.status,
      effectiveFrom: new Date(data.effective_from),
      effectiveTo: data.effective_to ? new Date(data.effective_to) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToEntryWithProduct(data: DbPriceMatrixWithProduct): PriceMatrixWithProduct {
    return {
      ...this.mapToEntry(data),
      product: {
        id: data.products.id,
        sku: data.products.sku,
        name: data.products.name,
      },
    };
  }
}

export const priceMatrixRepository = new PriceMatrixRepositoryImpl();
export type PriceMatrixRepository = typeof priceMatrixRepository;
