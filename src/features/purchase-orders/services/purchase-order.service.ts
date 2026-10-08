/**
 * Purchase Orders Service
 *
 * Business logic layer for Purchase Orders module.
 */

import { purchaseOrderRepository } from '../repositories/purchase-order.repository';
import { db } from '@/shared/lib/supabase/database';
import { auditService } from '@/shared/lib/audit';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  type CreatePOInput,
  type UpdatePOInput,
} from '../lib/schemas';
import type {
  PurchaseOrder,
  PurchaseOrderWithItems,
  POListItem,
  POListParams,
  POStatus,
} from '../types';
import { PO_STATUS_TRANSITIONS } from '../types';

// Helper to convert purchase order to audit data (exclude large/sensitive fields)
function purchaseOrderToAuditData(po: PurchaseOrder | PurchaseOrderWithItems): Record<string, unknown> {
  return {
    id: po.id,
    poNumber: po.poNumber,
    salesOrderId: po.salesOrderId,
    status: po.status,
    subtotal: po.subtotal,
    taxTotal: po.taxTotal,
    grandTotal: po.grandTotal,
    orderSeries: po.orderSeries,
    expectedDeliveryDate: po.expectedDeliveryDate,
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

function isValidStatusTransition(currentStatus: POStatus, newStatus: POStatus): boolean {
  const allowedTransitions = PO_STATUS_TRANSITIONS[currentStatus];
  return allowedTransitions.includes(newStatus);
}

// ============================================
// SERVICE
// ============================================

export const purchaseOrderService = {
  /**
   * Get paginated list of purchase orders
   */
  async list(params: POListParams = {}): Promise<PaginatedServiceResult<POListItem>> {
    try {
      const result = await purchaseOrderRepository.findMany(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('PurchaseOrderService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch purchase orders',
      };
    }
  },

  /**
   * Get a single PO by ID
   */
  async getById(id: string): Promise<ServiceResult<PurchaseOrderWithItems>> {
    try {
      const po = await purchaseOrderRepository.findById(id);

      if (!po) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch purchase order',
      };
    }
  },

  /**
   * Create a new PO
   */
  async create(
    input: CreatePOInput,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrderWithItems>> {
    try {
      const validation = createPurchaseOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check for duplicate PO number if manually entered
      if (input.poNumber && input.poNumber.trim() !== '') {
        const existing = await purchaseOrderRepository.findByPONumber(input.poNumber.trim());
        if (existing) {
          return {
            success: false,
            error: `Purchase order number "${input.poNumber}" already exists.`,
            errors: { poNumber: [`PO number "${input.poNumber}" already exists`] },
          };
        }
      }

      const po = await purchaseOrderRepository.create(validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logCreate(
        'purchase_orders',
        'PurchaseOrder',
        po.id,
        purchaseOrderToAuditData(po),
        { userId },
        `Created purchase order: ${po.poNumber}`
      ).catch((err) => {
        console.error('Failed to log purchase order create audit:', err);
      });

      // Send notification (async, non-blocking)
      this.sendPurchaseOrderCreatedNotification(po, userId).catch((err) => {
        console.error('Failed to send purchase order created notification:', err);
      });

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.create error:', error);
      return {
        success: false,
        error: 'Failed to create purchase order',
      };
    }
  },

  /**
   * Send notification for purchase order created (helper method)
   */
  async sendPurchaseOrderCreatedNotification(
    po: PurchaseOrderWithItems,
    userId?: string
  ): Promise<void> {
    const { notificationService } = await import('@/features/notifications/services/notification.service');

    // Get supplier name from items (supplier is at item level)
    const supplierName = po.items?.[0]?.supplierName || 'Unknown Supplier';

    // Notify internal users about PO creation
    await notificationService.notifyPurchaseOrderCreated({
      purchaseOrderId: po.id,
      poNumber: po.poNumber,
      supplierName,
      totalAmount: po.grandTotal,
      createdBy: userId,
    });

    // Notify supplier users about PO assignment
    // Get unique supplier IDs from items
    const supplierIds = [...new Set(
      po.items
        ?.map(item => item.supplierId)
        .filter((id): id is string => !!id) || []
    )];

    // Send notification to each supplier
    for (const supplierId of supplierIds) {
      const supplierItems = po.items?.filter(item => item.supplierId === supplierId) || [];
      await notificationService.notifySupplierPOAssigned({
        poId: po.id,
        poNumber: po.poNumber,
        supplierId,
        totalAmount: po.grandTotal,
        itemCount: supplierItems.length,
        createdBy: userId,
      });
    }
  },

  /**
   * Update an existing PO
   */
  async update(
    id: string,
    input: UpdatePOInput,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit purchase order in ${existing.status} status`,
        };
      }

      const validation = updatePurchaseOrderSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Capture old data for audit before update
      const oldAuditData = purchaseOrderToAuditData(existing);

      const po = await purchaseOrderRepository.update(id, validation.data, userId);

      // Log audit event (fire and forget)
      auditService.logUpdate(
        'purchase_orders',
        'PurchaseOrder',
        po.id,
        oldAuditData,
        purchaseOrderToAuditData(po),
        { userId },
        `Updated purchase order: ${po.poNumber}`
      ).catch((err) => {
        console.error('Failed to log purchase order update audit:', err);
      });

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.update error:', error);
      return {
        success: false,
        error: 'Failed to update purchase order',
      };
    }
  },

  /**
   * Soft delete a PO
   */
  async delete(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (existing.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft purchase orders can be deleted',
        };
      }

      const po = await purchaseOrderRepository.softDelete(id, userId);

      // Log audit event (fire and forget)
      auditService.logDelete(
        'purchase_orders',
        'PurchaseOrder',
        po.id,
        purchaseOrderToAuditData(existing),
        { userId },
        `Deleted purchase order: ${po.poNumber}`
      ).catch((err) => {
        console.error('Failed to log purchase order delete audit:', err);
      });

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete purchase order',
      };
    }
  },

  // ==========================================
  // INLINE UPDATE METHODS
  // ==========================================

  /**
   * Update supplier for all items in a PO
   */
  async updateSupplier(
    id: string,
    supplierId: string | null,
    supplierName: string | null,
    userId?: string
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit purchase order in ${existing.status} status`,
        };
      }

      // Use db (service role) to bypass RLS
      const { error } = await db
        .from('purchase_order_items')
        .update({
          supplier_id: supplierId,
          supplier_name: supplierName,
          updated_by: userId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('purchase_order_id', id);

      if (error) {
        console.error('[updateSupplier] Error:', error);
        return {
          success: false,
          error: 'Failed to update supplier',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('PurchaseOrderService.updateSupplier error:', error);
      return {
        success: false,
        error: 'Failed to update supplier',
      };
    }
  },

  /**
   * Update order series for a PO
   */
  async updateOrderSeries(
    id: string,
    orderSeries: string | null,
    userId?: string
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!['draft', 'sent'].includes(existing.status)) {
        return {
          success: false,
          error: `Cannot edit purchase order in ${existing.status} status`,
        };
      }

      // Use db (service role) to bypass RLS
      const { error } = await db
        .from('purchase_orders')
        .update({
          order_series: orderSeries,
          updated_by: userId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('[updateOrderSeries] Error:', error);
        return {
          success: false,
          error: 'Failed to update order series',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('PurchaseOrderService.updateOrderSeries error:', error);
      return {
        success: false,
        error: 'Failed to update order series',
      };
    }
  },

  // ==========================================
  // STATUS TRANSITIONS
  // ==========================================

  /**
   * Send PO (draft -> sent)
   */
  async send(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'sent', userId);
  },

  /**
   * Confirm PO (sent -> confirmed)
   * Also auto-creates a shipment with source='supplier' for Supplier Schedule
   */
  async confirm(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    const result = await this.transitionStatus(id, 'confirmed', userId);

    // If PO confirmed successfully, auto-create shipment with source='supplier'
    if (result.success && result.data) {
      try {
        await this.createSupplierShipment(id, userId);
      } catch (error) {
        console.error('Failed to auto-create supplier shipment:', error);
        // Don't fail the PO confirmation if shipment creation fails
      }
    }

    return result;
  },

  /**
   * Auto-create shipment from PO for Supplier Schedule (source='supplier')
   * Uses service role client to bypass RLS (suppliers can't INSERT shipments directly)
   */
  async createSupplierShipment(poId: string, userId?: string): Promise<void> {
    // Import db client for service role access (bypass RLS)
    const { db } = await import('@/shared/lib/supabase/database');

    // Get PO with items
    const po = await purchaseOrderRepository.findById(poId);
    if (!po) {
      throw new Error('Purchase order not found');
    }

    // Generate shipment number from PO number
    // PO format: PO-2600075 → Shipment format: SO2600075
    // Extract the 7-digit number from PO (remove "PO-" prefix)
    const poNumberMatch = po.poNumber.match(/PO-?(\d{7})/);
    if (!poNumberMatch) {
      throw new Error(`Invalid PO number format: ${po.poNumber}`);
    }
    const shipmentNumber = `SO${poNumberMatch[1]}`; // e.g., SO2600075

    // Calculate total quantity
    const totalQty = po.items.reduce((sum, item) => sum + item.quantityOrdered, 0);

    // Get supplier_id from first PO item (item-level supplier)
    const supplierId = po.items[0]?.supplierId || null;

    // Map PO status to shipment status
    const getShipmentStatus = (poStatus: string): string => {
      switch (poStatus) {
        case 'confirmed':
          return 'confirmed';
        case 'in_production':
          return 'in_production';
        case 'ready_to_ship':
          return 'ready_to_ship';
        case 'in_transit':
          return 'in_transit';
        case 'partial':
          return 'partial';
        case 'received':
          return 'delivered';
        default:
          return 'pending';
      }
    };

    const shipmentStatus = getShipmentStatus(po.status);

    // Create shipment with source='supplier' (using service role to bypass RLS)
    const { data: shipment, error: shipmentError } = await db
      .from('shipments')
      .insert({
        shipment_number: shipmentNumber,
        shipment_date: new Date().toISOString().split('T')[0],
        estimated_arrival: po.expectedDeliveryDate?.toISOString().split('T')[0] || null,
        sales_order_id: po.salesOrderId || null,
        purchase_order_id: po.id,
        supplier_id: supplierId,
        source: 'supplier',
        load_status: 'available',
        total_qty: totalQty,
        outstanding_qty: totalQty,
        ship_to_address_street: po.shipToAddressStreet,
        ship_to_address_city: po.shipToAddressCity,
        ship_to_address_state: po.shipToAddressState,
        ship_to_address_postal_code: po.shipToAddressPostalCode,
        ship_to_address_country: po.shipToAddressCountry,
        status: shipmentStatus, // Mapped from PO status
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (shipmentError) {
      throw new Error(`Failed to create shipment: ${shipmentError.message}`);
    }

    // Create shipment items
    const shipmentItems = po.items.map((item, index) => ({
      shipment_id: shipment.id,
      product_id: item.productId,
      purchase_order_item_id: item.id,
      sku: item.sku,
      description: item.description,
      quantity_shipped: item.quantityOrdered,
      sort_order: index,
      created_by: userId || null,
      updated_by: userId || null,
    }));

    const { error: itemsError } = await db
      .from('shipment_items')
      .insert(shipmentItems);

    if (itemsError) {
      // Clean up shipment if items insertion fails
      await db.from('shipments').delete().eq('id', shipment.id);
      throw new Error(`Failed to create shipment items: ${itemsError.message}`);
    }

    console.log(`[PO Confirm] Auto-created shipment ${shipmentNumber} with source='supplier' for PO ${po.poNumber}`);
  },

  /**
   * Mark as partially received (confirmed -> partial)
   */
  async markPartial(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'partial', userId);
  },

  /**
   * Mark as fully received (confirmed/partial -> received)
   */
  async markReceived(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'received', userId);
  },

  /**
   * Cancel PO
   */
  async cancel(id: string, userId?: string): Promise<ServiceResult<PurchaseOrder>> {
    return this.transitionStatus(id, 'cancelled', userId);
  },

  /**
   * Generic status transition
   */
  async transitionStatus(
    id: string,
    newStatus: POStatus,
    userId?: string
  ): Promise<ServiceResult<PurchaseOrder>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      if (!isValidStatusTransition(existing.status, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      const po = await purchaseOrderRepository.updateStatus(id, newStatus, userId);

      // Log audit event for status change (fire and forget)
      auditService.log({
        action: 'update', // status_change
        module: 'purchase_orders',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        oldData: { status: existing.status },
        newData: { status: newStatus },
        userId,
        description: `Purchase order ${po.poNumber} status changed: ${existing.status} → ${newStatus}`,
      }).catch((err) => {
        console.error('Failed to log purchase order status change audit:', err);
      });

      return {
        success: true,
        data: po,
      };
    } catch (error) {
      console.error('PurchaseOrderService.transitionStatus error:', error);
      return {
        success: false,
        error: 'Failed to update purchase order status',
      };
    }
  },

  /**
   * Update Supplier/Production Status
   * Updates PO status and creates shipment if needed
   * When status changes to "confirmed" or "in_production", shipment is auto-created
   */
  async updateSupplierStatus(
    id: string,
    newStatus: string,
    userId?: string
  ): Promise<ServiceResult<{ shipmentCreated?: boolean; shipmentNumber?: string }>> {
    try {
      const existing = await purchaseOrderRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Purchase order not found',
        };
      }

      // Check if valid status transition
      if (!isValidStatusTransition(existing.status, newStatus as POStatus)) {
        return {
          success: false,
          error: `Cannot transition from ${existing.status} to ${newStatus}`,
        };
      }

      // Update PO status
      const po = await purchaseOrderRepository.updateStatus(id, newStatus as POStatus, userId);

      // Check if shipment should be created
      // Create shipment when:
      // 1. Status changes to "confirmed" OR "in_production"
      // 2. AND no shipment exists yet
      const shouldCreateShipment =
        (newStatus === 'confirmed' || newStatus === 'in_production') &&
        (existing.status === 'draft' || existing.status === 'sent');

      let shipmentCreated = false;
      let shipmentNumber: string | undefined;

      if (shouldCreateShipment) {
        // Check if shipment already exists
        const { data: existingShipments } = await db
          .from('shipments')
          .select('id, shipment_number')
          .eq('purchase_order_id', id)
          .limit(1);

        if (!existingShipments || existingShipments.length === 0) {
          // Create shipment using existing logic
          try {
            await this.createSupplierShipment(id, userId);
            shipmentCreated = true;

            // Get the created shipment number
            const { data: newShipment } = await db
              .from('shipments')
              .select('shipment_number')
              .eq('purchase_order_id', id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            shipmentNumber = newShipment?.shipment_number;

            console.log(`[updateSupplierStatus] Auto-created shipment ${shipmentNumber} for PO ${po.poNumber} (status: ${newStatus})`);
          } catch (shipmentError) {
            console.error('[updateSupplierStatus] Failed to create shipment:', shipmentError);
            // Continue - status was updated successfully, shipment creation is secondary
          }
        }
      } else {
        // Update existing shipment status if shipment exists
        const getShipmentStatusFromPO = (poStatus: string): string => {
          switch (poStatus) {
            case 'confirmed':
              return 'confirmed';
            case 'in_production':
              return 'in_production';
            case 'ready_to_ship':
              return 'ready_to_ship';
            case 'in_transit':
              return 'in_transit';
            case 'partial':
              return 'partial';
            case 'received':
              return 'delivered';
            default:
              return 'pending';
          }
        };

        const { data: existingShipments } = await db
          .from('shipments')
          .select('id, shipment_number, status')
          .eq('purchase_order_id', id)
          .limit(1);

        const shipment = existingShipments?.[0];
        if (shipment) {
          const newShipmentStatus = getShipmentStatusFromPO(newStatus);

          if (shipment.status !== newShipmentStatus) {
            await db
              .from('shipments')
              .update({
                status: newShipmentStatus,
                updated_at: new Date().toISOString(),
                updated_by: userId,
              })
              .eq('id', shipment.id);

            console.log(`[updateSupplierStatus] Updated shipment ${shipment.shipment_number} status: ${shipment.status} → ${newShipmentStatus}`);
          }
        }
      }

      // Log audit event
      auditService.log({
        action: 'update',
        module: 'purchase_orders',
        entityType: 'PurchaseOrder',
        entityId: po.id,
        oldData: { status: existing.status },
        newData: { status: newStatus, shipmentCreated },
        userId,
        description: `Purchase order ${po.poNumber} status changed: ${existing.status} → ${newStatus}${shipmentCreated ? ` (shipment ${shipmentNumber} created)` : ''}`,
      }).catch((err) => {
        console.error('Failed to log purchase order status change audit:', err);
      });

      return {
        success: true,
        data: {
          shipmentCreated,
          shipmentNumber,
        },
      };
    } catch (error) {
      console.error('PurchaseOrderService.updateSupplierStatus error:', error);
      return {
        success: false,
        error: 'Failed to update supplier status',
      };
    }
  },
};

export type PurchaseOrderService = typeof purchaseOrderService;
