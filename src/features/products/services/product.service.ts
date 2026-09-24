/**
 * Products Service
 *
 * Business logic layer for Products module.
 * Handles validation, business rules, and orchestration.
 */

import { productRepository, DuplicateSkuError } from '../repositories/product.repository';
import { createProductSchema, updateProductSchema, type CreateProductInput, type UpdateProductInput } from '../lib/schemas';
import type { Product, ProductListParams, ProductWithFormattedPrices, ProductTableRow } from '../types';
import { auditService } from '@/shared/lib/audit/audit-service';

// Lazy import to avoid circular dependencies
const getQboProductSyncService = async () => {
  const { qboProductSyncService } = await import('@/modules/integrations/quickbooks/services/qbo-product-sync.service');
  return qboProductSyncService;
};

// Helper to convert product to audit data (exclude large/sensitive fields)
function productToAuditData(product: Product): Record<string, unknown> {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    baseCost: product.baseCost,
    basePrice: product.basePrice,
    status: product.status,
    isSellable: product.isSellable,
    qboItemId: product.qboItemId,
    qboRealmId: product.qboRealmId,
  };
}

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format price from cents to display string
 */
function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Calculate margin and margin percentage
 */
function calculateMargin(cost: number | null | undefined, price: number | null | undefined): { margin: number; marginPercent: number } {
  const safeCost = cost ?? 0;
  const safePrice = price ?? 0;
  const margin = safePrice - safeCost;
  const marginPercent = safeCost > 0 ? ((safePrice - safeCost) / safeCost) * 100 : 0;
  return { margin, marginPercent: Math.round(marginPercent * 100) / 100 };
}

/**
 * Add formatted prices to product
 */
function withFormattedPrices(product: Product): ProductWithFormattedPrices {
  const { margin, marginPercent } = calculateMargin(product.baseCost, product.basePrice);
  return {
    ...product,
    formattedBaseCost: formatPrice(product.baseCost),
    formattedBasePrice: formatPrice(product.basePrice),
    margin,
    marginPercent,
  };
}

/**
 * Convert product to table row format
 */
function toTableRow(product: Product): ProductTableRow {
  const { margin, marginPercent } = calculateMargin(product.baseCost, product.basePrice);
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    itemType: product.itemType,
    baseCost: product.baseCost,
    basePrice: product.basePrice,
    formattedBaseCost: formatPrice(product.baseCost),
    formattedBasePrice: formatPrice(product.basePrice),
    margin,
    marginPercent,
    status: product.status,
    isSellable: product.isSellable,
    createdAt: product.createdAt,
  };
}

// ============================================
// SERVICE
// ============================================

export const productService = {
  /**
   * Get paginated list of products
   */
  async list(params: ProductListParams = {}): Promise<ServiceResult<{
    data: ProductTableRow[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>> {
    try {
      // Clamp pagination — server actions receive these straight from the client
      const safeParams: ProductListParams = {
        ...params,
        page: Math.max(1, Math.floor(params.page ?? 1)),
        limit: Math.min(100, Math.max(1, Math.floor(params.limit ?? 10))),
      };

      const result = await productRepository.findMany(safeParams);

      return {
        success: true,
        data: {
          data: result.data.map(toTableRow),
          meta: result.meta,
        },
      };
    } catch (error) {
      console.error('ProductService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch products',
      };
    }
  },

  /**
   * Get a single product by ID
   */
  async getById(id: string): Promise<ServiceResult<ProductWithFormattedPrices>> {
    try {
      const product = await productRepository.findById(id);

      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      return {
        success: true,
        data: withFormattedPrices(product),
      };
    } catch (error) {
      console.error('ProductService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch product',
      };
    }
  },

  /**
   * Get a single product by SKU
   */
  async getBySku(sku: string): Promise<ServiceResult<ProductWithFormattedPrices>> {
    try {
      const product = await productRepository.findBySku(sku);

      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      return {
        success: true,
        data: withFormattedPrices(product),
      };
    } catch (error) {
      console.error('ProductService.getBySku error:', error);
      return {
        success: false,
        error: 'Failed to fetch product',
      };
    }
  },

  /**
   * Create a new product
   */
  async create(input: CreateProductInput, userId?: string): Promise<ServiceResult<Product>> {
    try {
      // Validate input
      const validation = createProductSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const data = validation.data;

      // Check if SKU already exists
      const skuExists = await productRepository.skuExists(data.sku);
      if (skuExists) {
        return {
          success: false,
          error: 'SKU already exists',
          errors: { sku: ['A product with this SKU already exists'] },
        };
      }

      // Validate business rules (only if baseCost is provided)
      if (data.baseCost !== null && data.basePrice < data.baseCost) {
        return {
          success: false,
          error: 'Price cannot be less than cost',
          errors: { basePrice: ['Price must be greater than or equal to cost'] },
        };
      }

      // Create product
      const product = await productRepository.create(data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'products',
        'Product',
        product.id,
        productToAuditData(product),
        { userId },
        `Created product: ${product.sku} - ${product.name}`
      ).catch((err) => {
        console.error('Failed to log product create audit:', err);
      });

      // Trigger QBO sync (fire and forget) - COMMENTED OUT FOR NOW
      // this.syncProductToQbo(product, userId).catch((err) => {
      //   console.error('Failed to trigger QBO product sync:', err);
      // });

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      if (error instanceof DuplicateSkuError) {
        return {
          success: false,
          error: 'SKU already exists',
          errors: { sku: [error.message] },
        };
      }
      console.error('ProductService.create error:', error);
      return {
        success: false,
        error: 'Failed to create product',
      };
    }
  },

  /**
   * Update an existing product
   */
  async update(id: string, input: UpdateProductInput, userId?: string): Promise<ServiceResult<Product>> {
    try {
      // Check if product exists
      const existing = await productRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      // Validate input
      const validation = updateProductSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const data = validation.data;

      // Check if SKU already exists (if changing)
      if (data.sku && data.sku !== existing.sku) {
        const skuExists = await productRepository.skuExists(data.sku, id);
        if (skuExists) {
          return {
            success: false,
            error: 'SKU already exists',
            errors: { sku: ['A product with this SKU already exists'] },
          };
        }
      }

      // Validate business rules
      const newCost = data.baseCost ?? existing.baseCost;
      const newPrice = data.basePrice ?? existing.basePrice;
      if (newPrice < newCost) {
        return {
          success: false,
          error: 'Price cannot be less than cost',
          errors: { basePrice: ['Price must be greater than or equal to cost'] },
        };
      }

      // Capture old data for audit before update
      const oldAuditData = productToAuditData(existing);

      // Update product
      const product = await productRepository.update(id, data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'products',
        'Product',
        product.id,
        oldAuditData,
        productToAuditData(product),
        { userId },
        `Updated product: ${product.sku} - ${product.name}`
      ).catch((err) => {
        console.error('Failed to log product update audit:', err);
      });

      // Trigger QBO sync (fire and forget) - COMMENTED OUT FOR NOW
      // this.syncProductToQbo(product, userId).catch((err) => {
      //   console.error('Failed to trigger QBO product sync:', err);
      // });

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      if (error instanceof DuplicateSkuError) {
        return {
          success: false,
          error: 'SKU already exists',
          errors: { sku: [error.message] },
        };
      }
      console.error('ProductService.update error:', error);
      return {
        success: false,
        error: 'Failed to update product',
      };
    }
  },

  /**
   * Soft delete a product
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Product>> {
    try {
      // Check if product exists
      const existing = await productRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      // TODO: Check if product is used in any orders (future phase)
      // For now, just soft delete

      const product = await productRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'products',
        'Product',
        product.id,
        productToAuditData(existing),
        { userId },
        `Deleted product: ${product.sku} - ${product.name}`
      ).catch((err) => {
        console.error('Failed to log product delete audit:', err);
      });

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      console.error('ProductService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete product',
      };
    }
  },

  /**
   * Restore a soft-deleted product
   */
  async restore(id: string, userId?: string): Promise<ServiceResult<Product>> {
    try {
      const existing = await productRepository.findByIdIncludingDeleted(id);

      if (!existing) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      if (!existing.deletedAt) {
        return {
          success: false,
          error: 'Product is not deleted',
        };
      }

      // A different active product may have claimed the SKU while this one was
      // deleted — the unique index only covers non-deleted rows.
      const skuTaken = await productRepository.skuExists(existing.sku, id);
      if (skuTaken) {
        return {
          success: false,
          error: 'SKU already exists',
          errors: { sku: [`Another product now uses SKU "${existing.sku}"`] },
        };
      }

      const product = await productRepository.restore(id, userId);

      // Log audit event (fire and forget)
      auditService.logRestore(
        'products',
        'Product',
        product.id,
        { userId },
        `Restored product: ${product.sku} - ${product.name}`
      ).catch((err) => {
        console.error('Failed to log product restore audit:', err);
      });

      return {
        success: true,
        data: product,
      };
    } catch (error) {
      if (error instanceof DuplicateSkuError) {
        return {
          success: false,
          error: 'SKU already exists',
          errors: { sku: [error.message] },
        };
      }
      console.error('ProductService.restore error:', error);
      return {
        success: false,
        error: 'Failed to restore product',
      };
    }
  },

  /**
   * Get all unique categories
   */
  async getCategories(): Promise<ServiceResult<string[]>> {
    try {
      const categories = await productRepository.getCategories();
      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      console.error('ProductService.getCategories error:', error);
      return {
        success: false,
        error: 'Failed to fetch categories',
      };
    }
  },

  /**
   * Get product counts by status
   */
  async getStatusCounts(): Promise<ServiceResult<Record<string, number>>> {
    try {
      const counts = await productRepository.getCountsByStatus();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('ProductService.getStatusCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
      };
    }
  },

  /**
   * Validate SKU uniqueness
   */
  async validateSku(sku: string, excludeId?: string): Promise<ServiceResult<boolean>> {
    try {
      const exists = await productRepository.skuExists(sku, excludeId);
      return {
        success: true,
        data: !exists,
      };
    } catch (error) {
      console.error('ProductService.validateSku error:', error);
      return {
        success: false,
        error: 'Failed to validate SKU',
      };
    }
  },

  // ============================================
  // QBO SYNC METHODS
  // ============================================

  /**
   * Sync a product to QuickBooks (internal helper)
   */
  async syncProductToQbo(product: Product, userId?: string): Promise<void> {
    try {
      const syncService = await getQboProductSyncService();
      await syncService.syncProduct({ product, userId });
    } catch (error) {
      // Log but don't throw - sync is fire and forget
      console.error('QBO product sync failed:', error);
    }
  },

  /**
   * Get QBO sync status for a product
   */
  async getQboSyncStatus(productId: string) {
    try {
      const syncService = await getQboProductSyncService();
      return await syncService.getSyncStatus(productId);
    } catch (error) {
      console.error('Failed to get QBO sync status:', error);
      return null;
    }
  },

  /**
   * Manually trigger QBO sync for a product
   */
  async resyncProductToQbo(productId: string, userId?: string): Promise<ServiceResult<boolean>> {
    try {
      const product = await productRepository.findById(productId);
      if (!product) {
        return {
          success: false,
          error: 'Product not found',
        };
      }

      const syncService = await getQboProductSyncService();
      const result = await syncService.syncProduct({ product, userId });

      return {
        success: result.success,
        data: result.success,
        error: result.error,
      };
    } catch (error) {
      console.error('ProductService.resyncProductToQbo error:', error);
      return {
        success: false,
        error: 'Failed to sync product to QuickBooks',
      };
    }
  },
};

export type ProductService = typeof productService;
