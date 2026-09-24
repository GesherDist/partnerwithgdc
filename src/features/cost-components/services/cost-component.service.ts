/**
 * Cost Components Service
 *
 * Business logic layer for Cost Components module.
 */

import { costComponentRepository } from '../repositories/cost-component.repository';
import type {
  CostComponent,
  CostComponentWithDetails,
  CostComponentListParams,
  CreateCostComponentDTO,
  UpdateCostComponentDTO,
  LandedCostSummary,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// SERVICE
// ============================================

export const costComponentService = {
  /**
   * Get all cost components with optional filtering
   */
  async list(params: CostComponentListParams = {}): Promise<ServiceResult<CostComponent[]>> {
    try {
      const result = await costComponentRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('CostComponentService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch cost components',
      };
    }
  },

  /**
   * Get a single cost component by ID
   */
  async getById(id: string): Promise<ServiceResult<CostComponentWithDetails>> {
    try {
      const component = await costComponentRepository.findById(id);

      if (!component) {
        return {
          success: false,
          error: 'Cost component not found',
        };
      }

      return {
        success: true,
        data: component,
      };
    } catch (error) {
      console.error('CostComponentService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch cost component',
      };
    }
  },

  /**
   * Create a new cost component
   */
  async create(
    data: CreateCostComponentDTO,
    userId?: string
  ): Promise<ServiceResult<CostComponent>> {
    try {
      // Must have either PO or PO item
      if (!data.purchaseOrderId && !data.purchaseOrderItemId) {
        return {
          success: false,
          error: 'Cost component must be linked to a purchase order or purchase order item',
        };
      }

      // Amount must be non-negative
      if (data.amount < 0) {
        return {
          success: false,
          error: 'Amount must be non-negative',
        };
      }

      const component = await costComponentRepository.create(data, userId);

      return {
        success: true,
        data: component,
      };
    } catch (error) {
      console.error('CostComponentService.create error:', error);
      return {
        success: false,
        error: 'Failed to create cost component',
      };
    }
  },

  /**
   * Update an existing cost component
   */
  async update(
    id: string,
    data: UpdateCostComponentDTO,
    userId?: string
  ): Promise<ServiceResult<CostComponent>> {
    try {
      const existing = await costComponentRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Cost component not found',
        };
      }

      // Amount must be non-negative
      if (data.amount !== undefined && data.amount < 0) {
        return {
          success: false,
          error: 'Amount must be non-negative',
        };
      }

      const component = await costComponentRepository.update(id, data, userId);

      return {
        success: true,
        data: component,
      };
    } catch (error) {
      console.error('CostComponentService.update error:', error);
      return {
        success: false,
        error: 'Failed to update cost component',
      };
    }
  },

  /**
   * Delete a cost component
   */
  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      const existing = await costComponentRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Cost component not found',
        };
      }

      await costComponentRepository.delete(id);

      return {
        success: true,
      };
    } catch (error) {
      console.error('CostComponentService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete cost component',
      };
    }
  },

  /**
   * Get landed cost summary for a PO
   */
  async getLandedCostSummary(purchaseOrderId: string): Promise<ServiceResult<LandedCostSummary>> {
    try {
      const summary = await costComponentRepository.getLandedCostSummary(purchaseOrderId);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      console.error('CostComponentService.getLandedCostSummary error:', error);
      return {
        success: false,
        error: 'Failed to fetch landed cost summary',
      };
    }
  },
};

export type CostComponentService = typeof costComponentService;
