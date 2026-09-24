/**
 * Inventory Service
 *
 * Business logic layer for Inventory module.
 */

import { inventoryRepository } from '../repositories/inventory.repository';
import { auditService } from '@/shared/lib/audit';
import type {
  Inventory,
  InventoryWithDetails,
  InventoryListItem,
  InventoryListParams,
  CreateInventoryDTO,
  UpdateInventoryDTO,
} from '../types';

// Helper to convert inventory to audit data
function inventoryToAuditData(inventory: Inventory | InventoryWithDetails): Record<string, unknown> {
  return {
    id: inventory.id,
    productId: inventory.productId,
    locationId: inventory.locationId,
    onHand: inventory.onHand,
    allocated: inventory.allocated,
    reorderPoint: inventory.reorderPoint,
    reorderQty: inventory.reorderQty,
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

interface PaginatedServiceResult<T> {
  success: boolean;
  data?: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
  error?: string;
}

// ============================================
// SERVICE
// ============================================

export const inventoryService = {
  /**
   * Get paginated list of inventory records
   */
  async list(params: InventoryListParams = {}): Promise<PaginatedServiceResult<InventoryListItem>> {
    try {
      const result = await inventoryRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('InventoryService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
      };
    }
  },

  /**
   * Get a single inventory record by ID
   */
  async getById(id: string): Promise<ServiceResult<InventoryWithDetails>> {
    try {
      const inventory = await inventoryRepository.findById(id);

      if (!inventory) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
      };
    }
  },

  /**
   * Get inventory for multiple products across all locations
   */
  async getByProductIds(productIds: string[]): Promise<ServiceResult<InventoryListItem[]>> {
    try {
      const inventory = await inventoryRepository.findByProductIds(productIds);
      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.getByProductIds error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory for products',
      };
    }
  },

  /**
   * Get inventory by product and location
   */
  async getByProductAndLocation(
    productId: string,
    locationId: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(
        productId,
        locationId
      );

      if (!inventory) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.getByProductAndLocation error:', error);
      return {
        success: false,
        error: 'Failed to fetch inventory',
      };
    }
  },

  /**
   * Create a new inventory record
   */
  async create(
    data: CreateInventoryDTO,
    userId?: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      // Check if inventory already exists for this product/location combo
      const existing = await inventoryRepository.findByProductAndLocation(
        data.productId,
        data.locationId
      );

      if (existing) {
        return {
          success: false,
          error: 'Inventory record already exists for this product and location',
        };
      }

      // Validate allocated <= onHand
      const onHand = data.onHand ?? 0;
      const allocated = data.allocated ?? 0;
      if (allocated > onHand) {
        return {
          success: false,
          error: 'Allocated quantity cannot exceed on-hand quantity',
        };
      }

      const inventory = await inventoryRepository.create(data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'inventory',
        'Inventory',
        inventory.id,
        inventoryToAuditData(inventory),
        { userId },
        `Created inventory record for product ${data.productId} at location ${data.locationId}`
      ).catch((err) => {
        console.error('Failed to log inventory create audit:', err);
      });

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.create error:', error);
      return {
        success: false,
        error: 'Failed to create inventory',
      };
    }
  },

  /**
   * Update an existing inventory record
   */
  async update(
    id: string,
    data: UpdateInventoryDTO,
    userId?: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      const existing = await inventoryRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      // Calculate new values
      const newOnHand = data.onHand ?? existing.onHand;
      const newAllocated = data.allocated ?? existing.allocated;

      // Validate allocated <= onHand
      if (newAllocated > newOnHand) {
        return {
          success: false,
          error: 'Allocated quantity cannot exceed on-hand quantity',
        };
      }

      // Capture old data for audit before update
      const oldAuditData = inventoryToAuditData(existing);

      const inventory = await inventoryRepository.update(id, data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'inventory',
        'Inventory',
        inventory.id,
        oldAuditData,
        inventoryToAuditData(inventory),
        { userId },
        `Updated inventory record`
      ).catch((err) => {
        console.error('Failed to log inventory update audit:', err);
      });

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.update error:', error);
      return {
        success: false,
        error: 'Failed to update inventory',
      };
    }
  },

  /**
   * Adjust on-hand quantity
   */
  async adjust(
    id: string,
    adjustment: number,
    userId?: string
  ): Promise<ServiceResult<Inventory>> {
    try {
      // Get existing data for audit
      const existing = await inventoryRepository.findById(id);
      const oldOnHand = existing?.onHand ?? 0;

      const inventory = await inventoryRepository.adjustOnHand(id, adjustment, userId);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'update',
        module: 'inventory',
        entityType: 'Inventory',
        entityId: inventory.id,
        oldData: { onHand: oldOnHand },
        newData: { onHand: inventory.onHand, adjustment },
        userId,
        description: `Inventory adjusted by ${adjustment > 0 ? '+' : ''}${adjustment} units`,
      }).catch((err) => {
        console.error('Failed to log inventory adjust audit:', err);
      });

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.adjust error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to adjust inventory',
      };
    }
  },

  /**
   * Allocate inventory (reserve for sales order)
   */
  async allocate(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Allocation quantity must be positive',
        };
      }

      // Get existing data for audit
      const existing = await inventoryRepository.findById(id);
      const oldAllocated = existing?.allocated ?? 0;

      const inventory = await inventoryRepository.allocate(id, quantity, userId, reference);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'update', // allocate
        module: 'inventory',
        entityType: 'Inventory',
        entityId: inventory.id,
        oldData: { allocated: oldAllocated },
        newData: { allocated: inventory.allocated, quantity, reference },
        userId,
        description: `Allocated ${quantity} units${reference ? ` for ${reference.type} ${reference.number}` : ''}`,
      }).catch((err) => {
        console.error('Failed to log inventory allocate audit:', err);
      });

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.allocate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate inventory',
      };
    }
  },

  /**
   * Allocate inventory by product and location
   */
  async allocateByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);
      if (!inventory) {
        return {
          success: false,
          error: `No inventory found for product at this location`,
        };
      }

      return this.allocate(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.allocateByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate inventory',
      };
    }
  },

  /**
   * Deallocate inventory
   */
  async deallocate(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Deallocation quantity must be positive',
        };
      }

      // Get existing data for audit
      const existing = await inventoryRepository.findById(id);
      const oldAllocated = existing?.allocated ?? 0;

      const inventory = await inventoryRepository.deallocate(id, quantity, userId, reference);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'update', // deallocate
        module: 'inventory',
        entityType: 'Inventory',
        entityId: inventory.id,
        oldData: { allocated: oldAllocated },
        newData: { allocated: inventory.allocated, quantity, reference },
        userId,
        description: `Deallocated ${quantity} units${reference ? ` for ${reference.type} ${reference.number}` : ''}`,
      }).catch((err) => {
        console.error('Failed to log inventory deallocate audit:', err);
      });

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.deallocate error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deallocate inventory',
      };
    }
  },

  /**
   * Deallocate inventory by product and location
   */
  async deallocateByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);
      if (!inventory) {
        return {
          success: false,
          error: `No inventory found for product at this location`,
        };
      }

      return this.deallocate(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.deallocateByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deallocate inventory',
      };
    }
  },

  /**
   * Ship inventory (reduce on_hand and allocated when pick ticket completes)
   */
  async ship(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Ship quantity must be positive',
        };
      }

      // Get existing data for audit
      const existing = await inventoryRepository.findById(id);
      const oldData = existing ? { onHand: existing.onHand, allocated: existing.allocated } : {};

      const inventory = await inventoryRepository.ship(id, quantity, userId, reference);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'update', // ship
        module: 'inventory',
        entityType: 'Inventory',
        entityId: inventory.id,
        oldData,
        newData: { onHand: inventory.onHand, allocated: inventory.allocated, quantity, reference },
        userId,
        description: `Shipped ${quantity} units${reference ? ` for ${reference.type} ${reference.number}` : ''}`,
      }).catch((err) => {
        console.error('Failed to log inventory ship audit:', err);
      });

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.ship error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ship inventory',
      };
    }
  },

  /**
   * Ship inventory by product and location
   */
  async shipByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      const inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);
      if (!inventory) {
        return {
          success: false,
          error: `No inventory found for product at this location`,
        };
      }

      return this.ship(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.shipByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ship inventory',
      };
    }
  },

  /**
   * Receive inventory (increase on_hand when shipment arrives)
   */
  async receive(
    id: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      if (quantity <= 0) {
        return {
          success: false,
          error: 'Receive quantity must be positive',
        };
      }

      // Get existing data for audit
      const existing = await inventoryRepository.findById(id);
      const oldOnHand = existing?.onHand ?? 0;

      const inventory = await inventoryRepository.receive(id, quantity, userId, reference);

      // Log audit event (fire and forget)
      auditService.log({
        action: 'update', // receive
        module: 'inventory',
        entityType: 'Inventory',
        entityId: inventory.id,
        oldData: { onHand: oldOnHand },
        newData: { onHand: inventory.onHand, quantity, reference },
        userId,
        description: `Received ${quantity} units${reference ? ` for ${reference.type} ${reference.number}` : ''}`,
      }).catch((err) => {
        console.error('Failed to log inventory receive audit:', err);
      });

      return {
        success: true,
        data: inventory,
      };
    } catch (error) {
      console.error('InventoryService.receive error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to receive inventory',
      };
    }
  },

  /**
   * Receive inventory by product and location (or create if doesn't exist)
   */
  async receiveByProductLocation(
    productId: string,
    locationId: string,
    quantity: number,
    userId?: string,
    reference?: { type: string; id: string; number: string }
  ): Promise<ServiceResult<Inventory>> {
    try {
      let inventory = await inventoryRepository.findByProductAndLocation(productId, locationId);

      // Create inventory record if doesn't exist
      if (!inventory) {
        inventory = await inventoryRepository.create({
          productId,
          locationId,
          onHand: 0,
          allocated: 0,
          reorderPoint: 0,
          reorderQty: 0,
        }, userId);
      }

      return this.receive(inventory.id, quantity, userId, reference);
    } catch (error) {
      console.error('InventoryService.receiveByProductLocation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to receive inventory',
      };
    }
  },

  /**
   * Delete an inventory record
   */
  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      const existing = await inventoryRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Inventory record not found',
        };
      }

      // Don't allow deletion if there's allocated inventory
      if (existing.allocated > 0) {
        return {
          success: false,
          error: 'Cannot delete inventory with allocated quantity',
        };
      }

      await inventoryRepository.delete(id);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'inventory',
        'Inventory',
        id,
        inventoryToAuditData(existing),
        {},
        `Deleted inventory record`
      ).catch((err) => {
        console.error('Failed to log inventory delete audit:', err);
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error('InventoryService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete inventory',
      };
    }
  },

  /**
   * Get low stock items
   */
  async getLowStockItems(): Promise<ServiceResult<InventoryListItem[]>> {
    try {
      const items = await inventoryRepository.getLowStockItems();

      return {
        success: true,
        data: items,
      };
    } catch (error) {
      console.error('InventoryService.getLowStockItems error:', error);
      return {
        success: false,
        error: 'Failed to fetch low stock items',
      };
    }
  },
};

export type InventoryService = typeof inventoryService;
