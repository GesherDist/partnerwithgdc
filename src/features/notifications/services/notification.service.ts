/**
 * Notification Service
 *
 * Business logic layer for notifications module.
 * Provides trigger helpers for creating notifications from other modules.
 */

import { notificationRepository } from '../repositories/notification.repository';
import {
  NOTIFICATION_PERMISSION_MAP,
  type NotificationType,
  type NotificationWithStatus,
  type NotificationListParams,
  type QuoteCreatedPayload,
  type SalesOrderCreatedPayload,
  type PickTicketCreatedPayload,
  type PurchaseOrderCreatedPayload,
  type EmailPOReceivedPayload,
  type ShipmentUpdatePayload,
  type SupplierPOAssignedPayload,
  type SupplierPOConfirmedPayload,
  type SupplierPORejectedPayload,
  type SupplierProductionUpdatePayload,
  type SupplierShipmentUpdatePayload,
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
// HELPER FUNCTIONS
// ============================================

/**
 * Get recipient user IDs based on notification type permissions
 */
async function getRecipientsByType(type: NotificationType): Promise<string[]> {
  const requiredPermissions = NOTIFICATION_PERMISSION_MAP[type] || [];
  console.log(`[NotificationService] Getting recipients for type: ${type}, permissions: [${requiredPermissions.join(', ')}]`);

  try {
    const recipients = await notificationRepository.getUsersWithPermissions(requiredPermissions);
    console.log(`[NotificationService] Found ${recipients.length} recipients for ${type}`);
    return recipients;
  } catch (error) {
    console.error(`[NotificationService] Error getting recipients for ${type}:`, error);
    return [];
  }
}

/**
 * Format currency amount for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100); // Assuming amount is in cents
}

// ============================================
// SERVICE
// ============================================

export const notificationService = {
  // ==========================================
  // QUERY METHODS
  // ==========================================

  /**
   * Get notifications for a user
   */
  async getForUser(
    userId: string,
    params: NotificationListParams = {}
  ): Promise<ServiceResult<{
    data: NotificationWithStatus[];
    total: number;
    unreadCount: number;
  }>> {
    try {
      const result = await notificationRepository.findForUser(userId, params);
      return { success: true, data: result };
    } catch (error) {
      console.error('NotificationService.getForUser error:', error);
      return { success: false, error: 'Failed to fetch notifications' };
    }
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<ServiceResult<number>> {
    try {
      const count = await notificationRepository.getUnreadCount(userId);
      return { success: true, data: count };
    } catch (error) {
      console.error('NotificationService.getUnreadCount error:', error);
      return { success: false, error: 'Failed to fetch unread count' };
    }
  },

  // ==========================================
  // MUTATION METHODS
  // ==========================================

  /**
   * Mark a notification as read
   */
  async markAsRead(
    recipientId: string,
    userId: string
  ): Promise<ServiceResult<void>> {
    try {
      await notificationRepository.markAsRead(recipientId, userId);
      return { success: true };
    } catch (error) {
      console.error('NotificationService.markAsRead error:', error);
      return { success: false, error: 'Failed to mark as read' };
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<ServiceResult<number>> {
    try {
      const count = await notificationRepository.markAllAsRead(userId);
      return { success: true, data: count };
    } catch (error) {
      console.error('NotificationService.markAllAsRead error:', error);
      return { success: false, error: 'Failed to mark all as read' };
    }
  },

  // ==========================================
  // TRIGGER METHODS (called from other modules)
  // ==========================================

  /**
   * Notify when a quote is created
   */
  async notifyQuoteCreated(payload: QuoteCreatedPayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('quote_created');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for quote_created');
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'quote_created',
          title: 'New Quote Created',
          message: `Quote ${payload.quoteNumber} for ${payload.customerName} (${formatCurrency(payload.totalAmount)})`,
          link: `/quotes?id=${payload.quoteId}`,
          entityType: 'quote',
          entityId: payload.quoteId,
          metadata: {
            quoteNumber: payload.quoteNumber,
            customerName: payload.customerName,
            totalAmount: payload.totalAmount,
          },
        },
        recipientIds,
        payload.createdBy
      );

      console.log(`[NotificationService] Quote created notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifyQuoteCreated error:', error);
    }
  },

  /**
   * Notify when a sales order is created
   */
  async notifySalesOrderCreated(payload: SalesOrderCreatedPayload): Promise<void> {
    console.log('[NotificationService] notifySalesOrderCreated called with:', {
      salesOrderId: payload.salesOrderId,
      orderNumber: payload.orderNumber,
      customerName: payload.customerName,
    });

    try {
      const recipientIds = await getRecipientsByType('sales_order_created');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for sales_order_created');
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'sales_order_created',
          title: 'New Sales Order',
          message: `Order ${payload.orderNumber} for ${payload.customerName} (${formatCurrency(payload.totalAmount)})`,
          link: `/sales-orders?id=${payload.salesOrderId}`,
          entityType: 'sales_order',
          entityId: payload.salesOrderId,
          metadata: {
            orderNumber: payload.orderNumber,
            customerName: payload.customerName,
            totalAmount: payload.totalAmount,
          },
        },
        recipientIds,
        payload.createdBy
      );

      console.log(`[NotificationService] Sales order created notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifySalesOrderCreated error:', error);
    }
  },

  /**
   * Notify when a pick ticket is created
   */
  async notifyPickTicketCreated(payload: PickTicketCreatedPayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('pick_ticket_created');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for pick_ticket_created');
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'pick_ticket_created',
          title: 'New Pick Ticket',
          message: `Pick Ticket ${payload.pickTicketNumber} for SO# ${payload.salesOrderNumber} at ${payload.warehouseName}`,
          link: `/pick-tickets?id=${payload.pickTicketId}`,
          entityType: 'pick_ticket',
          entityId: payload.pickTicketId,
          metadata: {
            pickTicketNumber: payload.pickTicketNumber,
            salesOrderNumber: payload.salesOrderNumber,
            warehouseName: payload.warehouseName,
          },
        },
        recipientIds,
        payload.createdBy
      );

      console.log(`[NotificationService] Pick ticket created notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifyPickTicketCreated error:', error);
    }
  },

  /**
   * Notify when a purchase order is created
   */
  async notifyPurchaseOrderCreated(payload: PurchaseOrderCreatedPayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('purchase_order_created');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for purchase_order_created');
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'purchase_order_created',
          title: 'New Purchase Order',
          message: `PO ${payload.poNumber} for ${payload.supplierName} (${formatCurrency(payload.totalAmount)})`,
          link: `/purchase-orders?id=${payload.purchaseOrderId}`,
          entityType: 'purchase_order',
          entityId: payload.purchaseOrderId,
          metadata: {
            poNumber: payload.poNumber,
            supplierName: payload.supplierName,
            totalAmount: payload.totalAmount,
          },
        },
        recipientIds,
        payload.createdBy
      );

      console.log(`[NotificationService] Purchase order created notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifyPurchaseOrderCreated error:', error);
    }
  },

  /**
   * Notify supplier user when a PO is assigned to their supplier
   * This directly targets the supplier user, not based on permissions
   */
  async notifySupplierPOAssigned(payload: SupplierPOAssignedPayload): Promise<void> {
    try {
      // Get users linked to this supplier
      const supplierUserIds = await notificationRepository.getUserIdsBySupplierId(payload.supplierId);

      if (supplierUserIds.length === 0) {
        console.log(`[NotificationService] No users found for supplier ${payload.supplierId}`);
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'supplier_po_assigned',
          title: 'New Purchase Order Assigned',
          message: `PO ${payload.poNumber} has been assigned to you (${payload.itemCount} items, ${formatCurrency(payload.totalAmount)})`,
          link: `/supplier-portal/purchase-orders?id=${payload.poId}`,
          entityType: 'purchase_order',
          entityId: payload.poId,
          metadata: {
            poNumber: payload.poNumber,
            supplierId: payload.supplierId,
            totalAmount: payload.totalAmount,
            itemCount: payload.itemCount,
          },
        },
        supplierUserIds,
        payload.createdBy
      );

      console.log(`[NotificationService] Supplier PO assigned notification sent to ${supplierUserIds.length} supplier users`);
    } catch (error) {
      console.error('[NotificationService] notifySupplierPOAssigned error:', error);
    }
  },

  /**
   * Notify when a PO email is received
   */
  async notifyEmailPOReceived(payload: EmailPOReceivedPayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('email_po_received');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for email_po_received');
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'email_po_received',
          title: 'PO Email Received',
          message: `Email from ${payload.fromEmail}: "${payload.subject}" (${payload.attachmentCount} attachments)`,
          link: `/inbound-emails?id=${payload.emailId}`,
          entityType: 'inbound_email',
          entityId: payload.emailId,
          metadata: {
            fromEmail: payload.fromEmail,
            subject: payload.subject,
            attachmentCount: payload.attachmentCount,
          },
        },
        recipientIds
      );

      console.log(`[NotificationService] Email PO received notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifyEmailPOReceived error:', error);
    }
  },

  /**
   * Notify when a shipment is updated
   */
  async notifyShipmentUpdate(payload: ShipmentUpdatePayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('shipment_update');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for shipment_update');
        return;
      }

      const trackingInfo = payload.trackingNumber
        ? ` - Tracking: ${payload.trackingNumber}`
        : '';
      const customerInfo = payload.customerName
        ? ` for ${payload.customerName}`
        : '';
      const poInfo = payload.customerPoNumber
        ? ` (PO: ${payload.customerPoNumber})`
        : '';

      await notificationRepository.createWithRecipients(
        {
          type: 'shipment_update',
          title: 'Shipment Update',
          message: `Shipment ${payload.shipmentNumber}${customerInfo}${poInfo} status: ${payload.status}${trackingInfo}`,
          link: `/shipments?id=${payload.shipmentId}`,
          entityType: 'shipment',
          entityId: payload.shipmentId,
          metadata: {
            shipmentNumber: payload.shipmentNumber,
            status: payload.status,
            trackingNumber: payload.trackingNumber,
            customerPoNumber: payload.customerPoNumber,
            customerName: payload.customerName,
          },
        },
        recipientIds
      );

      console.log(`[NotificationService] Shipment update notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifyShipmentUpdate error:', error);
    }
  },

  /**
   * Notify when a supplier confirms a PO
   */
  async notifySupplierPOConfirmed(payload: SupplierPOConfirmedPayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('supplier_po_confirmed');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for supplier_po_confirmed');
        return;
      }

      const etaInfo = payload.expectedDeliveryDate
        ? ` - Expected: ${payload.expectedDeliveryDate}`
        : '';

      await notificationRepository.createWithRecipients(
        {
          type: 'supplier_po_confirmed',
          title: 'PO Confirmed by Supplier',
          message: `${payload.supplierName} confirmed PO ${payload.poNumber}${etaInfo}`,
          link: `/purchase-orders?id=${payload.poId}`,
          entityType: 'purchase_order',
          entityId: payload.poId,
          metadata: {
            poNumber: payload.poNumber,
            supplierName: payload.supplierName,
            expectedDeliveryDate: payload.expectedDeliveryDate,
          },
        },
        recipientIds
      );

      console.log(`[NotificationService] Supplier PO confirmed notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifySupplierPOConfirmed error:', error);
    }
  },

  /**
   * Notify when a supplier rejects a PO
   */
  async notifySupplierPORejected(payload: SupplierPORejectedPayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('supplier_po_rejected');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for supplier_po_rejected');
        return;
      }

      const reasonInfo = payload.reason
        ? ` - Reason: ${payload.reason}`
        : '';

      await notificationRepository.createWithRecipients(
        {
          type: 'supplier_po_rejected',
          title: 'PO Rejected by Supplier',
          message: `${payload.supplierName} rejected PO ${payload.poNumber}${reasonInfo}`,
          link: `/purchase-orders?id=${payload.poId}`,
          entityType: 'purchase_order',
          entityId: payload.poId,
          metadata: {
            poNumber: payload.poNumber,
            supplierName: payload.supplierName,
            reason: payload.reason,
          },
        },
        recipientIds
      );

      console.log(`[NotificationService] Supplier PO rejected notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifySupplierPORejected error:', error);
    }
  },

  /**
   * Notify when a supplier updates production status
   */
  async notifySupplierProductionUpdate(payload: SupplierProductionUpdatePayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('supplier_production_update');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for supplier_production_update');
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'supplier_production_update',
          title: 'Production Status Update',
          message: `${payload.supplierName} updated PO ${payload.poNumber}: ${payload.productionStatus}`,
          link: `/purchase-orders?id=${payload.poId}`,
          entityType: 'purchase_order',
          entityId: payload.poId,
          metadata: {
            poNumber: payload.poNumber,
            supplierName: payload.supplierName,
            productionStatus: payload.productionStatus,
          },
        },
        recipientIds
      );

      console.log(`[NotificationService] Supplier production update notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifySupplierProductionUpdate error:', error);
    }
  },

  /**
   * Notify when a supplier updates shipment info
   */
  async notifySupplierShipmentUpdate(payload: SupplierShipmentUpdatePayload): Promise<void> {
    try {
      const recipientIds = await getRecipientsByType('supplier_shipment_update');

      if (recipientIds.length === 0) {
        console.log('[NotificationService] No recipients for supplier_shipment_update');
        return;
      }

      await notificationRepository.createWithRecipients(
        {
          type: 'supplier_shipment_update',
          title: 'Supplier Shipment Update',
          message: `${payload.supplierName} updated shipment for PO ${payload.poNumber} (${payload.updateType})`,
          link: `/shipments?id=${payload.shipmentId}`,
          entityType: 'shipment',
          entityId: payload.shipmentId,
          metadata: {
            shipmentNumber: payload.shipmentNumber,
            poNumber: payload.poNumber,
            supplierName: payload.supplierName,
            updateType: payload.updateType,
          },
        },
        recipientIds
      );

      console.log(`[NotificationService] Supplier shipment update notification sent to ${recipientIds.length} users`);
    } catch (error) {
      console.error('[NotificationService] notifySupplierShipmentUpdate error:', error);
    }
  },
};

export type NotificationService = typeof notificationService;
