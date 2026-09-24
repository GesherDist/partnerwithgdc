/**
 * Packing List Service
 *
 * Business logic layer for Packing Lists.
 * Handles workflow, validation, and orchestration.
 */

import { db } from '@/shared/lib/supabase/database';
import { PackingListRepository } from '../repositories';
import { PickTicketRepository } from '../repositories';
import type {
  PackingListWithItems,
  PackingListListItem,
  PackingListListParams,
  CreatePackingListDTO,
  PackingListStatus,
  PaginatedResult,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Valid status transitions
const PACKING_LIST_STATUS_TRANSITIONS: Record<PackingListStatus, PackingListStatus[]> = {
  draft: ['packed'],
  packed: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
};

// ============================================
// SERVICE
// ============================================

export const PackingListService = {
  /**
   * Get paginated list of packing lists
   */
  async getPackingLists(
    params: PackingListListParams = {}
  ): Promise<ServiceResult<PaginatedResult<PackingListListItem>>> {
    try {
      const result = await PackingListRepository.findMany(params);
      return { success: true, data: result };
    } catch (error) {
      console.error('[PackingListService.getPackingLists] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch packing lists',
      };
    }
  },

  /**
   * Get packing list by ID with all related data
   */
  async getPackingListById(
    id: string
  ): Promise<ServiceResult<PackingListWithItems>> {
    try {
      const packingList = await PackingListRepository.findById(id);
      if (!packingList) {
        return { success: false, error: 'Packing list not found' };
      }
      return { success: true, data: packingList };
    } catch (error) {
      console.error('[PackingListService.getPackingListById] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch packing list',
      };
    }
  },

  /**
   * Get packing list by pick ticket ID
   */
  async getPackingListByPickTicketId(
    pickTicketId: string
  ): Promise<ServiceResult<PackingListWithItems | null>> {
    try {
      const packingList = await PackingListRepository.findByPickTicketId(pickTicketId);
      return { success: true, data: packingList };
    } catch (error) {
      console.error('[PackingListService.getPackingListByPickTicketId] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch packing list',
      };
    }
  },

  /**
   * Create packing list from a picked pick ticket
   */
  async createPackingList(
    dto: CreatePackingListDTO,
    userId?: string
  ): Promise<ServiceResult<PackingListWithItems>> {
    try {
      // Validate pick ticket exists and is in 'picked' status
      const pickTicket = await PickTicketRepository.findById(dto.pickTicketId);
      if (!pickTicket) {
        return { success: false, error: 'Pick ticket not found' };
      }

      if (pickTicket.status !== 'picked') {
        return {
          success: false,
          error: `Cannot create packing list: Pick ticket must be in 'picked' status (current: ${pickTicket.status})`,
        };
      }

      // Check if packing list already exists for this pick ticket
      const existingPackingList = await PackingListRepository.findByPickTicketId(dto.pickTicketId);
      if (existingPackingList) {
        return {
          success: false,
          error: 'A packing list already exists for this pick ticket',
        };
      }

      // Validate items
      if (!dto.items || dto.items.length === 0) {
        return { success: false, error: 'At least one item is required' };
      }

      // Create the packing list
      const packingList = await PackingListRepository.create(dto, userId);

      // Update pick ticket status to 'packing'
      await PickTicketRepository.updateStatus(dto.pickTicketId, 'packing', userId);

      // Fetch full packing list with items
      const fullPackingList = await PackingListRepository.findById(packingList.id);
      if (!fullPackingList) {
        return { success: false, error: 'Failed to fetch created packing list' };
      }

      return { success: true, data: fullPackingList };
    } catch (error) {
      console.error('[PackingListService.createPackingList] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create packing list',
      };
    }
  },

  /**
   * Create packing list from pick ticket with all items
   */
  async createFromPickTicket(
    pickTicketId: string,
    userId?: string
  ): Promise<ServiceResult<PackingListWithItems>> {
    try {
      // Fetch pick ticket with items
      const pickTicket = await PickTicketRepository.findById(pickTicketId);
      if (!pickTicket) {
        return { success: false, error: 'Pick ticket not found' };
      }

      if (pickTicket.status !== 'picked') {
        return {
          success: false,
          error: `Cannot create packing list: Pick ticket must be in 'picked' status (current: ${pickTicket.status})`,
        };
      }

      // Check if packing list already exists
      const existingPackingList = await PackingListRepository.findByPickTicketId(pickTicketId);
      if (existingPackingList) {
        return {
          success: false,
          error: 'A packing list already exists for this pick ticket',
        };
      }

      // Fetch product weights for all items
      const productIds = pickTicket.items.map((item) => item.productId);
      const { data: products, error: productsError } = await db
        .from('products')
        .select('id, weight_lbs')
        .in('id', productIds);

      if (productsError) {
        console.error('[PackingListService.createFromPickTicket] Failed to fetch product weights:', productsError);
      }

      // Create a map of productId -> weight_lbs
      const productWeightMap = new Map<string, number>();
      if (products) {
        products.forEach((product) => {
          if (product.weight_lbs) {
            productWeightMap.set(product.id, product.weight_lbs);
          }
        });
      }

      // Map pick ticket items to packing list items with calculated weights
      let totalWeight = 0;
      const items = pickTicket.items.map((item) => {
        const productWeight = productWeightMap.get(item.productId) || 0;
        const itemWeight = item.quantityPicked * productWeight;
        totalWeight += itemWeight;

        return {
          pickTicketItemId: item.id,
          productId: item.productId,
          sku: item.sku,
          description: item.description,
          quantityPacked: item.quantityPicked, // Pack what was picked
          packageNumber: 1, // Default to single package
          weight: itemWeight > 0 ? itemWeight : null,
        };
      });

      // Create packing list
      const dto: CreatePackingListDTO = {
        pickTicketId,
        salesOrderId: pickTicket.salesOrderId,
        totalPackages: 1,
        totalWeight: totalWeight > 0 ? totalWeight : null,
        weightUnit: 'lbs',
        notes: null,
        items,
      };

      return this.createPackingList(dto, userId);
    } catch (error) {
      console.error('[PackingListService.createFromPickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create packing list',
      };
    }
  },

  /**
   * Mark packing list as packed
   */
  async markAsPacked(
    id: string,
    userId?: string
  ): Promise<ServiceResult<PackingListWithItems>> {
    try {
      const packingList = await PackingListRepository.findById(id);
      if (!packingList) {
        return { success: false, error: 'Packing list not found' };
      }

      if (packingList.status !== 'draft') {
        return {
          success: false,
          error: `Cannot mark as packed: Packing list must be in 'draft' status (current: ${packingList.status})`,
        };
      }

      // Update status
      await PackingListRepository.updateStatus(id, 'packed', userId);

      // Update pick ticket status to 'packed'
      await PickTicketRepository.updateStatus(packingList.pickTicketId, 'packed', userId);

      // Fetch updated packing list
      const updatedPackingList = await PackingListRepository.findById(id);
      return { success: true, data: updatedPackingList! };
    } catch (error) {
      console.error('[PackingListService.markAsPacked] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark packing list as packed',
      };
    }
  },

  /**
   * Transition packing list status with validation
   */
  async transitionStatus(
    id: string,
    newStatus: PackingListStatus,
    userId?: string
  ): Promise<ServiceResult<PackingListWithItems>> {
    try {
      const packingList = await PackingListRepository.findById(id);
      if (!packingList) {
        return { success: false, error: 'Packing list not found' };
      }

      const allowedTransitions = PACKING_LIST_STATUS_TRANSITIONS[packingList.status];
      if (!allowedTransitions.includes(newStatus)) {
        return {
          success: false,
          error: `Cannot transition from '${packingList.status}' to '${newStatus}'`,
        };
      }

      await PackingListRepository.updateStatus(id, newStatus, userId);

      // Update pick ticket status accordingly
      if (newStatus === 'packed') {
        await PickTicketRepository.updateStatus(packingList.pickTicketId, 'packed', userId);
      } else if (newStatus === 'shipped') {
        await PickTicketRepository.updateStatus(packingList.pickTicketId, 'shipped', userId);
      } else if (newStatus === 'delivered') {
        // Pick ticket remains 'shipped' - packing list tracks final delivery
        // Sales order status will be updated in the action layer
      }

      const updatedPackingList = await PackingListRepository.findById(id);
      return { success: true, data: updatedPackingList! };
    } catch (error) {
      console.error('[PackingListService.transitionStatus] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to transition status',
      };
    }
  },

  /**
   * Delete packing list (soft delete)
   */
  async deletePackingList(
    id: string,
    userId?: string
  ): Promise<ServiceResult<void>> {
    try {
      const packingList = await PackingListRepository.findById(id);
      if (!packingList) {
        return { success: false, error: 'Packing list not found' };
      }

      // Can only delete draft packing lists
      if (packingList.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft packing lists can be deleted',
        };
      }

      await PackingListRepository.delete(id, userId);

      // Revert pick ticket status to 'picked'
      await PickTicketRepository.updateStatus(packingList.pickTicketId, 'picked', userId);

      return { success: true };
    } catch (error) {
      console.error('[PackingListService.deletePackingList] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete packing list',
      };
    }
  },
};
