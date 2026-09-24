/**
 * Sales Orders Service
 *
 * Business logic layer for Sales Orders module.
 * Handles validation, business rules, and orchestration.
 */

import { salesOrderRepository } from '../repositories/sales-order.repository';
import {
  createSalesOrderSchema,
  updateSalesOrderSchema,
  formToCreateDTO,
  type CreateSalesOrderInput,
  type UpdateSalesOrderInput,
  type SalesOrderFormInput,
} from '../lib/schemas';
import type {
  SalesOrder,
  SalesOrderWithItems,
  SalesOrderListItem,
  SalesOrderListParams,
  OrderStatus,
  CreateSalesOrderItemDTO,
} from '../types';
import { ORDER_STATUS_TRANSITIONS as STATUS_TRANSITIONS } from '../types';
import { auditService } from '@/shared/lib/audit';

// Helper to convert sales order to audit data (exclude large/sensitive fields)
function salesOrderToAuditData(order: SalesOrder | SalesOrderWithItems): Record<string, unknown> {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    taxTotal: order.taxTotal,
    grandTotal: order.grandTotal,
    requestedDeliveryDate: order.requestedDeliveryDate,
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

/**
 * Validate status transition
 */
function isValidStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}


// ============================================
// SERVICE
// ============================================

export const salesOrderService = {
  /**
   * Get paginated list of sales orders
   */
  async list(params: SalesOrderListParams = {}): Promise<PaginatedServiceResult<SalesOrderListItem>> {
    try {
      const result = await salesOrderRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('SalesOrderService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch sales orders',
      };
    }
  },

  /**
   * Get a single sales order by ID
   */
  async getById(id: string): Promise<ServiceResult<SalesOrderWithItems>> {
    try {
      const order = await salesOrderRepository.findById(id);

      if (!order) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch sales order',
      };
    }
  },

  /**
   * Get a single sales order by order number
   */
  async getByOrderNumber(orderNumber: string): Promise<ServiceResult<SalesOrderWithItems>> {
    try {
      const order = await salesOrderRepository.findByOrderNumber(orderNumber);

      if (!order) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.getByOrderNumber error:', error);
      return {
        success: false,
        error: 'Failed to fetch sales order',
      };
    }
  },

  /**
   * Create a new sales order from form data
   */
  async createFromForm(
    input: SalesOrderFormInput,
    userId?: string
  ): Promise<ServiceResult<SalesOrderWithItems>> {
    try {
      // Convert form data to DTO
      const dto = formToCreateDTO(input);

      // Validate with schema
      const validation = createSalesOrderSchema.safeParse(dto);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check for duplicate order number if manually entered
      if (input.orderNumber && input.orderNumber.trim() !== '') {
        const existing = await salesOrderRepository.findByOrderNumber(input.orderNumber.trim());
        if (existing) {
          return {
            success: false,
            error: `Sales order number "${input.orderNumber}" already exists.`,
            errors: { orderNumber: [`Order number "${input.orderNumber}" already exists`] },
          };
        }
      }

      // Create order
      const order = await salesOrderRepository.create(validation.data, userId);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.createFromForm error:', error);
      return {
        success: false,
        error: 'Failed to create sales order',
      };
    }
  },

  /**
   * Create a new sales order from DTO
   */
  async create(
    input: CreateSalesOrderInput,
    userId?: string
  ): Promise<ServiceResult<SalesOrderWithItems>> {
    try {
      // Validate input
      const validation = createSalesOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Create order
      const order = await salesOrderRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'sales_orders',
        'SalesOrder',
        order.id,
        salesOrderToAuditData(order),
        { userId },
        `Created sales order: ${order.orderNumber}`
      ).catch((err) => {
        console.error('Failed to log sales order create audit:', err);
      });

      // Send notification (async, non-blocking)
      this.sendSalesOrderCreatedNotification(order, userId).catch((err) => {
        console.error('Failed to send sales order created notification:', err);
      });

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.create error:', error);
      return {
        success: false,
        error: 'Failed to create sales order',
      };
    }
  },

  /**
   * Send notification for sales order created (helper method)
   */
  async sendSalesOrderCreatedNotification(
    order: SalesOrderWithItems,
    userId?: string
  ): Promise<void> {
    console.log('[SalesOrderService] Sending notification for SO:', order.orderNumber);
    try {
      const { notificationService } = await import('@/features/notifications/services/notification.service');
      await notificationService.notifySalesOrderCreated({
        salesOrderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer?.name || 'Unknown Customer',
        totalAmount: order.grandTotal,
        createdBy: userId,
      });
      console.log('[SalesOrderService] Notification sent successfully for SO:', order.orderNumber);
    } catch (error) {
      console.error('[SalesOrderService] Failed to send notification:', error);
      throw error;
    }
  },

  /**
   * Update an existing sales order
   */
  async update(
    id: string,
    input: UpdateSalesOrderInput,
    userId?: string
  ): Promise<ServiceResult<SalesOrder>> {
    try {
      // Check if order exists
      const existing = await salesOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      // Check if order can be edited (draft, pending, confirmed, processing)
      if (['cancelled', 'shipped', 'delivered'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit order in ${existing.status} status. Order has been ${existing.status}.`,
        };
      }

      // Validate input
      const validation = updateSalesOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Capture old data for audit before update
      const oldAuditData = salesOrderToAuditData(existing);

      // Update order
      const order = await salesOrderRepository.update(id, validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'sales_orders',
        'SalesOrder',
        order.id,
        oldAuditData,
        salesOrderToAuditData(order),
        { userId },
        `Updated sales order: ${order.orderNumber}`
      ).catch((err) => {
        console.error('Failed to log sales order update audit:', err);
      });

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.update error:', error);
      return {
        success: false,
        error: 'Failed to update sales order',
      };
    }
  },

  /**
   * Update order series only (allowed in any status)
   * Order Series is a categorization field, not business-critical
   */
  async updateOrderSeries(
    id: string,
    orderSeries: string | null,
    userId?: string
  ): Promise<ServiceResult<SalesOrder>> {
    try {
      // Check if order exists
      const existing = await salesOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      // No status check - Order Series can be updated in any status
      // Update order with just orderSeries
      const order = await salesOrderRepository.update(id, { orderSeries }, userId);

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.updateOrderSeries error:', error);
      return {
        success: false,
        error: 'Failed to update order series',
      };
    }
  },

  /**
   * Update order items
   */
  async updateItems(
    id: string,
    items: CreateSalesOrderItemDTO[],
    userId?: string
  ): Promise<ServiceResult<SalesOrderWithItems>> {
    try {
      // Check if order exists
      const existing = await salesOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      // Check if order can be edited (draft, pending, confirmed, processing)
      if (['cancelled', 'shipped', 'delivered'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit items for order in ${existing.status} status. Order has been ${existing.status}.`,
        };
      }

      // Validate items
      if (items.length === 0) {
        return {
          success: false,
          error: 'At least one item is required',
        };
      }

      // Replace items
      await salesOrderRepository.replaceItems(id, items, userId);

      // Return updated order
      const order = await salesOrderRepository.findById(id);

      return {
        success: true,
        data: order!,
      };
    } catch (error) {
      console.error('SalesOrderService.updateItems error:', error);
      return {
        success: false,
        error: 'Failed to update order items',
      };
    }
  },

  /**
   * Soft delete a sales order
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<SalesOrder>> {
    try {
      // Check if order exists
      const existing = await salesOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      // Only allow deletion of draft orders
      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft orders can be deleted',
        };
      }

      const order = await salesOrderRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'sales_orders',
        'SalesOrder',
        order.id,
        salesOrderToAuditData(existing),
        { userId },
        `Deleted sales order: ${order.orderNumber}`
      ).catch((err) => {
        console.error('Failed to log sales order delete audit:', err);
      });

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete sales order',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Submit order (draft -> pending)
   */
  async submit(id: string, userId?: string): Promise<ServiceResult<SalesOrder>> {
    return this.transitionStatus(id, 'pending', userId);
  },

  /**
   * Confirm order (pending -> confirmed)
   */
  async confirm(id: string, userId?: string): Promise<ServiceResult<SalesOrder>> {
    return this.transitionStatus(id, 'confirmed', userId);
  },

  /**
   * Start processing (confirmed -> processing)
   */
  async process(id: string, userId?: string): Promise<ServiceResult<SalesOrder>> {
    return this.transitionStatus(id, 'processing', userId);
  },

  /**
   * Ship order (processing -> shipped)
   */
  async ship(id: string, userId?: string): Promise<ServiceResult<SalesOrder>> {
    return this.transitionStatus(id, 'shipped', userId);
  },

  /**
   * Deliver order (shipped -> delivered)
   */
  async deliver(id: string, userId?: string): Promise<ServiceResult<SalesOrder>> {
    return this.transitionStatus(id, 'delivered', userId);
  },

  /**
   * Cancel order (any except delivered -> cancelled)
   */
  async cancel(
    id: string,
    reason?: string,
    userId?: string
  ): Promise<ServiceResult<SalesOrder>> {
    try {
      const existing = await salesOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, 'cancelled')) {
        return {
          success: false,
          error: `Cannot cancel order in ${existing.status} status`,
        };
      }

      const order = await salesOrderRepository.updateStatus(
        id,
        'cancelled',
        userId,
        reason
      );

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.cancel error:', error);
      return {
        success: false,
        error: 'Failed to cancel sales order',
      };
    }
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: OrderStatus,
    userId?: string
  ): Promise<ServiceResult<SalesOrder>> {
    try {
      const existing = await salesOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Sales order not found',
        };
      }

      // Check if already in the target status
      if (existing.status === newStatus) {
        return {
          success: false,
          error: `Sales order is already ${newStatus}`,
        };
      }

      // Check if transition is valid
      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const order = await salesOrderRepository.updateStatus(id, newStatus, userId);

      // Log audit event for status change (fire and forget)
      auditService.log({
        action: 'update', // status_change
        module: 'sales_orders',
        entityType: 'SalesOrder',
        entityId: order.id,
        oldData: { status: existing.status },
        newData: { status: newStatus },
        userId,
        description: `Sales order ${order.orderNumber} status changed: ${existing.status} → ${newStatus}`,
      }).catch((err) => {
        console.error('Failed to log sales order status change audit:', err);
      });

      return {
        success: true,
        data: order,
      };
    } catch (error) {
      console.error('SalesOrderService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update order status',
      };
    }
  },

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get order counts by status
   */
  async getStatusCounts(): Promise<ServiceResult<Record<OrderStatus, number>>> {
    try {
      const counts = await salesOrderRepository.getCountsByStatus();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('SalesOrderService.getStatusCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
      };
    }
  },

  /**
   * Get next order number
   */
  async getNextOrderNumber(): Promise<ServiceResult<string>> {
    try {
      const orderNumber = await salesOrderRepository.getNextOrderNumber();
      return {
        success: true,
        data: orderNumber,
      };
    } catch (error) {
      console.error('SalesOrderService.getNextOrderNumber error:', error);
      return {
        success: false,
        error: 'Failed to generate order number',
      };
    }
  },
};

export type SalesOrderService = typeof salesOrderService;
