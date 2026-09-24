/**
 * Shipments Service
 *
 * Business logic layer for Shipments module.
 */

import { shipmentRepository } from '../repositories/shipment.repository';
import { auditService } from '@/shared/lib/audit';
import {
  createShipmentSchema,
  updateShipmentSchema,
  type CreateShipmentInput,
  type UpdateShipmentInput,
} from '../lib/schemas';
import type {
  Shipment,
  ShipmentWithItems,
  ShipmentListItem,
  ShipmentListParams,
  ShipmentStatus,
} from '../types';
import { SHIPMENT_STATUS_TRANSITIONS } from '../types';

// Helper to convert shipment to audit data (exclude large/sensitive fields)
function shipmentToAuditData(shipment: Shipment | ShipmentWithItems): Record<string, unknown> {
  return {
    id: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    salesOrderId: shipment.salesOrderId,
    purchaseOrderId: shipment.purchaseOrderId,
    status: shipment.status,
    shipmentDate: shipment.shipmentDate,
    estimatedArrival: shipment.estimatedArrival,
    actualArrival: shipment.actualArrival,
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    totalQty: shipment.totalQty,
    source: shipment.source,
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
// UTILITY FUNCTIONS
// ============================================

function isValidStatusTransition(currentStatus: ShipmentStatus, newStatus: ShipmentStatus): boolean {
  const allowedTransitions = SHIPMENT_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const shipmentService = {
  /**
   * Get paginated list of shipments
   */
  async list(params: ShipmentListParams = {}): Promise<PaginatedServiceResult<ShipmentListItem>> {
    try {
      const result = await shipmentRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('ShipmentService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch shipments',
      };
    }
  },

  /**
   * Get a single shipment by ID
   */
  async getById(id: string): Promise<ServiceResult<ShipmentWithItems>> {
    try {
      const shipment = await shipmentRepository.findById(id);

      if (!shipment) {
        return {
          success: false,
          error: 'Shipment not found',
        };
      }

      return {
        success: true,
        data: shipment,
      };
    } catch (error) {
      console.error('ShipmentService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch shipment',
      };
    }
  },

  /**
   * Create a new shipment
   */
  async create(
    input: CreateShipmentInput,
    userId?: string
  ): Promise<ServiceResult<ShipmentWithItems>> {
    try {
      const validation = createShipmentSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      const shipment = await shipmentRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'shipments',
        'Shipment',
        shipment.id,
        shipmentToAuditData(shipment),
        { userId },
        `Created shipment: ${shipment.shipmentNumber}`
      ).catch((err) => {
        console.error('Failed to log shipment create audit:', err);
      });

      return {
        success: true,
        data: shipment,
      };
    } catch (error) {
      console.error('ShipmentService.create error:', error);
      return {
        success: false,
        error: 'Failed to create shipment',
      };
    }
  },

  /**
   * Update an existing shipment
   */
  async update(
    id: string,
    input: UpdateShipmentInput,
    userId?: string
  ): Promise<ServiceResult<Shipment>> {
    try {
      const existing = await shipmentRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Shipment not found',
        };
      }

      if (!['pending', 'in_transit'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit shipment in ${existing.status} status`,
        };
      }

      const validation = updateShipmentSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Capture old data for audit before update
      const oldAuditData = shipmentToAuditData(existing);

      const shipment = await shipmentRepository.update(id, validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'shipments',
        'Shipment',
        shipment.id,
        oldAuditData,
        shipmentToAuditData(shipment),
        { userId },
        `Updated shipment: ${shipment.shipmentNumber}`
      ).catch((err) => {
        console.error('Failed to log shipment update audit:', err);
      });

      return {
        success: true,
        data: shipment,
      };
    } catch (error) {
      console.error('ShipmentService.update error:', error);
      return {
        success: false,
        error: 'Failed to update shipment',
      };
    }
  },

  /**
   * Soft delete a shipment
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<Shipment>> {
    try {
      const existing = await shipmentRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Shipment not found',
        };
      }

      if (existing.status !== 'pending') {
        return {
          success: false,
          error: 'Only pending shipments can be deleted',
        };
      }

      const shipment = await shipmentRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'shipments',
        'Shipment',
        shipment.id,
        shipmentToAuditData(existing),
        { userId },
        `Deleted shipment: ${shipment.shipmentNumber}`
      ).catch((err) => {
        console.error('Failed to log shipment delete audit:', err);
      });

      return {
        success: true,
        data: shipment,
      };
    } catch (error) {
      console.error('ShipmentService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete shipment',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Mark as in transit (pending -> in_transit)
   */
  async markInTransit(id: string, userId?: string): Promise<ServiceResult<Shipment>> {
    return this.transitionStatus(id, 'in_transit', userId);
  },

  /**
   * Mark as delivered (in_transit -> delivered)
   */
  async markDelivered(id: string, userId?: string): Promise<ServiceResult<Shipment>> {
    return this.transitionStatus(id, 'delivered', userId);
  },

  /**
   * Mark as failed (pending/in_transit -> failed)
   */
  async markFailed(id: string, userId?: string): Promise<ServiceResult<Shipment>> {
    return this.transitionStatus(id, 'failed', userId);
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: ShipmentStatus,
    userId?: string
  ): Promise<ServiceResult<Shipment>> {
    try {
      const existing = await shipmentRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Shipment not found',
        };
      }

      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const shipment = await shipmentRepository.updateStatus(id, newStatus, userId);

      // Log audit event for status change (fire and forget)
      auditService.log({
        action: 'update', // status_change
        module: 'shipments',
        entityType: 'Shipment',
        entityId: shipment.id,
        oldData: { status: existing.status },
        newData: { status: newStatus },
        userId,
        description: `Shipment ${shipment.shipmentNumber} status changed: ${existing.status} → ${newStatus}`,
      }).catch((err) => {
        console.error('Failed to log shipment status change audit:', err);
      });

      return {
        success: true,
        data: shipment,
      };
    } catch (error) {
      console.error('ShipmentService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update shipment status',
      };
    }
  },
};

export type ShipmentService = typeof shipmentService;
