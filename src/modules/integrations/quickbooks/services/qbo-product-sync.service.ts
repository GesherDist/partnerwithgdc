/**
 * QBO Product Sync Service
 *
 * Handles syncing products between our system and QuickBooks Online.
 * Creates/updates items in QBO when products are created/updated in our system.
 * Uses direct fields on product table for sync tracking.
 */

import { getConnectionByProvider } from '@/modules/integrations/core';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import type { Product } from '@/features/products/types';
import type { AccountingProduct } from '@/modules/integrations/core';
import { auditService } from '@/shared/lib/audit/audit-service';

// ============================================
// TYPES
// ============================================

interface SyncProductResult {
  success: boolean;
  qboItemId?: string;
  error?: string;
}

interface ProductSyncData {
  product: Product;
  userId?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map our Product to QBO AccountingProduct format
 */
function mapProductToQboFormat(product: Product): AccountingProduct {
  return {
    name: product.name,
    sku: product.sku,
    description: product.salesDescription || product.description || undefined,
    unitPrice: product.basePrice, // Already in cents, will be converted in provider
    // Use product's item type - maps directly to QBO types: inventory, non_inventory, service
    type: product.itemType || 'non_inventory',
    active: product.status === 'active',
    metadata: {
      gesherProductId: product.id,
      gesherSku: product.sku,
      category: product.category,
      baseCost: product.baseCost,
      // QBO-specific account references (if user selected them)
      qboIncomeAccount: product.qboIncomeAccount || undefined,
      qboExpenseAccount: product.qboExpenseAccount || undefined,
      qboInventoryAssetAccount: product.qboInventoryAssetAccount || undefined,
      // Additional QBO fields
      purchaseDescription: product.purchaseDescription || undefined,
      isTaxable: product.isTaxable,
      barcode: product.barcode || undefined,
    },
  };
}

/**
 * Get the active QBO connection and realm ID
 */
async function getQboConnection(): Promise<{
  connectionId: string;
  realmId: string;
} | null> {
  const connection = await getConnectionByProvider('quickbooks');

  if (!connection || connection.status !== 'connected') {
    return null;
  }

  if (!connection.external_account_id) {
    return null;
  }

  return {
    connectionId: connection.id,
    realmId: connection.external_account_id,
  };
}

// ============================================
// SYNC SERVICE
// ============================================

export const qboProductSyncService = {
  /**
   * Sync a single product to QuickBooks
   * Called when a product is created or updated
   */
  async syncProduct(data: ProductSyncData): Promise<SyncProductResult> {
    const { product } = data;

    try {
      // Get QBO connection
      const qboConnection = await getQboConnection();

      if (!qboConnection) {
        console.log('No QBO connection available, skipping product sync');

        // Log that sync was skipped (fire and forget)
        auditService.log({
          action: 'export',
          module: 'integrations',
          entityType: 'Product',
          entityId: product.id,
          description: `QuickBooks sync skipped: Not connected (Product: ${product.sku})`,
          metadata: {
            integration: 'quickbooks',
            reason: 'not_connected',
            productSku: product.sku,
            productName: product.name,
          },
        }).catch((err) => {
          console.error('Failed to log QBO skip audit:', err);
        });

        return {
          success: false,
          error: 'QuickBooks not connected',
        };
      }

      const { connectionId, realmId } = qboConnection;

      // Get product repository
      const { productRepository } = await import('@/features/products/repositories/product.repository');

      // Check if product already has a QBO ID for this realm
      if (product.qboItemId && product.qboRealmId === realmId) {
        // Product already synced - update in QBO
        return await this.updateProductInQbo(
          product,
          connectionId,
          productRepository
        );
      }

      // Create product in QBO
      return await this.createProductInQbo(
        product,
        connectionId,
        realmId,
        productRepository
      );
    } catch (error) {
      console.error('QboProductSyncService.syncProduct error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },

  /**
   * Create a new product/item in QuickBooks
   */
  async createProductInQbo(
    product: Product,
    connectionId: string,
    realmId: string,
    productRepository: { updateQboSync: (id: string, qboId: string, realmId: string) => Promise<void>; updateQboSyncError: (id: string, error: string) => Promise<void> }
  ): Promise<SyncProductResult> {
    try {
      // Map product to QBO format
      const qboProduct = mapProductToQboFormat(product);

      // Create in QBO
      const result = await quickBooksProvider.createProduct(
        connectionId,
        qboProduct
      );

      if (!result.externalId) {
        throw new Error('QBO did not return an item ID');
      }

      // Update product with QBO sync info
      await productRepository.updateQboSync(
        product.id,
        result.externalId,
        realmId
      );

      console.log(
        `Product ${product.sku} synced to QBO with ID ${result.externalId}`
      );

      // Log audit event for QBO sync (fire and forget)
      auditService.log({
        action: 'export',
        module: 'products',
        entityType: 'Product',
        entityId: product.id,
        description: `Product synced to QuickBooks: ${product.sku} (QBO ID: ${result.externalId})`,
        metadata: {
          syncType: 'create',
          qboItemId: result.externalId,
          qboRealmId: realmId,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync audit:', err);
      });

      return {
        success: true,
        qboItemId: result.externalId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to create product in QBO:', errorMessage);

      // Update product with error
      await productRepository.updateQboSyncError(product.id, errorMessage);

      // Log audit event for sync failure (fire and forget)
      auditService.log({
        action: 'export',
        module: 'products',
        entityType: 'Product',
        entityId: product.id,
        description: `Failed to sync product to QuickBooks: ${product.sku}`,
        metadata: {
          syncType: 'create',
          error: errorMessage,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync error audit:', err);
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Update an existing product/item in QuickBooks
   */
  async updateProductInQbo(
    product: Product,
    connectionId: string,
    productRepository: { updateQboSync: (id: string, qboId: string, realmId: string) => Promise<void>; updateQboSyncError: (id: string, error: string) => Promise<void> }
  ): Promise<SyncProductResult> {
    try {
      if (!product.qboItemId || !product.qboRealmId) {
        throw new Error('No QBO item ID found');
      }

      // Map product to QBO format
      const qboProduct = mapProductToQboFormat(product);

      // Update in QBO
      const result = await quickBooksProvider.updateProduct(
        connectionId,
        product.qboItemId,
        qboProduct
      );

      // Update sync timestamp
      await productRepository.updateQboSync(
        product.id,
        product.qboItemId,
        product.qboRealmId
      );

      console.log(
        `Product ${product.sku} updated in QBO (ID: ${product.qboItemId})`
      );

      // Log audit event for QBO sync (fire and forget)
      auditService.log({
        action: 'export',
        module: 'products',
        entityType: 'Product',
        entityId: product.id,
        description: `Product updated in QuickBooks: ${product.sku} (QBO ID: ${product.qboItemId})`,
        metadata: {
          syncType: 'update',
          qboItemId: product.qboItemId,
          qboRealmId: product.qboRealmId,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync audit:', err);
      });

      return {
        success: true,
        qboItemId: result.externalId || product.qboItemId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to update product in QBO:', errorMessage);

      // Update product with error
      await productRepository.updateQboSyncError(product.id, errorMessage);

      // Log audit event for sync failure (fire and forget)
      auditService.log({
        action: 'export',
        module: 'products',
        entityType: 'Product',
        entityId: product.id,
        description: `Failed to update product in QuickBooks: ${product.sku}`,
        metadata: {
          syncType: 'update',
          qboItemId: product.qboItemId,
          error: errorMessage,
          integration: 'quickbooks',
        },
      }).catch((err) => {
        console.error('Failed to log QBO sync error audit:', err);
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Get sync status for a product
   */
  async getSyncStatus(productId: string): Promise<{
    synced: boolean;
    qboItemId: string | null;
    qboRealmId: string | null;
    qboSyncedAt: Date | null;
    qboSyncError: string | null;
  } | null> {
    try {
      const { productRepository } = await import('@/features/products/repositories/product.repository');
      const product = await productRepository.findById(productId);

      if (!product) {
        return null;
      }

      return {
        synced: !!product.qboItemId,
        qboItemId: product.qboItemId,
        qboRealmId: product.qboRealmId,
        qboSyncedAt: product.qboSyncedAt,
        qboSyncError: product.qboSyncError,
      };
    } catch (error) {
      console.error('Failed to get product sync status:', error);
      return null;
    }
  },

  /**
   * Get QBO item ID for a synced product
   */
  async getQboItemId(productId: string): Promise<string | null> {
    try {
      const { productRepository } = await import('@/features/products/repositories/product.repository');
      const product = await productRepository.findById(productId);
      return product?.qboItemId || null;
    } catch (error) {
      console.error('Failed to get QBO item ID:', error);
      return null;
    }
  },

  /**
   * Check if product is synced to QBO
   */
  async isProductSynced(productId: string): Promise<boolean> {
    const qboConnection = await getQboConnection();
    if (!qboConnection) {
      return false;
    }

    try {
      const { productRepository } = await import('@/features/products/repositories/product.repository');
      const product = await productRepository.findById(productId);
      return !!(product?.qboItemId && product?.qboRealmId === qboConnection.realmId);
    } catch (error) {
      console.error('Failed to check product sync status:', error);
      return false;
    }
  },
};

export type QboProductSyncService = typeof qboProductSyncService;
