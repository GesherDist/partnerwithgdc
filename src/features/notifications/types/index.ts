/**
 * Notification Types and Constants
 *
 * Types, interfaces, and permission mappings for the notification system.
 */

// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType =
  | 'email_po_received'
  | 'quote_created'
  | 'sales_order_created'
  | 'pick_ticket_created'
  | 'purchase_order_created'
  | 'shipment_update'
  | 'inventory_low_stock'
  | 'approval_required'
  | 'supplier_po_assigned'
  | 'supplier_po_confirmed'
  | 'supplier_po_rejected'
  | 'supplier_production_update'
  | 'supplier_shipment_update'
  | 'system';

// ============================================
// DATABASE ROW TYPES
// ============================================

export interface DbNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface DbNotificationRecipient {
  id: string;
  notification_id: string;
  user_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ============================================
// APPLICATION TYPES
// ============================================

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  createdBy: string | null;
}

export interface NotificationRecipient {
  id: string;
  notificationId: string;
  userId: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationWithStatus extends Notification {
  recipientId: string;
  isRead: boolean;
  readAt: Date | null;
}

// ============================================
// CREATE/UPDATE TYPES
// ============================================

export interface CreateNotificationDTO {
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationWithRecipientsDTO extends CreateNotificationDTO {
  recipientUserIds: string[];
}

// ============================================
// LIST/QUERY TYPES
// ============================================

export interface NotificationListParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

// ============================================
// PERMISSION MAPPING
// Maps notification types to required permissions for targeting
// Super Admin always receives ALL notification types
// Other users receive if they have ANY of the required permissions
// ============================================

export const NOTIFICATION_PERMISSION_MAP: Record<NotificationType, string[]> = {
  email_po_received: ['quotes.view_module', 'purchase_orders.view_module'],
  quote_created: ['quotes.view_module'],
  sales_order_created: ['orders.view_module'],
  pick_ticket_created: ['pick_tickets.view'],
  purchase_order_created: ['purchase_orders.view_module'],
  shipment_update: ['orders.view_module', 'operations.view_module'],
  inventory_low_stock: ['inventory.view_module'],
  approval_required: ['quotes.approve', 'orders.approve'],
  supplier_po_assigned: [], // Directly targets supplier user, not permission-based
  supplier_po_confirmed: ['purchase_orders.view_module', 'operations.view_module'],
  supplier_po_rejected: ['purchase_orders.view_module', 'operations.view_module'],
  supplier_production_update: ['purchase_orders.view_module', 'operations.view_module'],
  supplier_shipment_update: ['purchase_orders.view_module', 'operations.view_module'],
  system: [], // Everyone receives system notifications
};

// ============================================
// NOTIFICATION ICONS/COLORS
// UI display configuration
// ============================================

export const NOTIFICATION_CONFIG: Record<NotificationType, {
  icon: string;
  color: string;
  bgColor: string;
}> = {
  email_po_received: {
    icon: 'Mail',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  quote_created: {
    icon: 'FileText',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  sales_order_created: {
    icon: 'ShoppingCart',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  pick_ticket_created: {
    icon: 'ClipboardList',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  purchase_order_created: {
    icon: 'FileBox',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  shipment_update: {
    icon: 'Truck',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  inventory_low_stock: {
    icon: 'AlertTriangle',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  approval_required: {
    icon: 'CheckCircle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  supplier_po_assigned: {
    icon: 'FileBox',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  supplier_po_confirmed: {
    icon: 'CheckCircle',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  supplier_po_rejected: {
    icon: 'AlertTriangle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  supplier_production_update: {
    icon: 'FileBox',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
  },
  supplier_shipment_update: {
    icon: 'Truck',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  system: {
    icon: 'Bell',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
};

// ============================================
// TRIGGER PAYLOAD TYPES
// For use when calling notification triggers
// ============================================

export interface QuoteCreatedPayload {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  totalAmount: number;
  createdBy?: string;
}

export interface SalesOrderCreatedPayload {
  salesOrderId: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  createdBy?: string;
}

export interface PickTicketCreatedPayload {
  pickTicketId: string;
  pickTicketNumber: string;
  salesOrderNumber: string;
  warehouseName: string;
  createdBy?: string;
}

export interface PurchaseOrderCreatedPayload {
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  totalAmount: number;
  createdBy?: string;
}

export interface EmailPOReceivedPayload {
  emailId: string;
  fromEmail: string;
  subject: string;
  attachmentCount: number;
}

export interface ShipmentUpdatePayload {
  shipmentId: string;
  shipmentNumber: string;
  status: string;
  trackingNumber?: string;
  customerPoNumber?: string;
  customerName?: string;
}

// Supplier Portal Payloads
export interface SupplierPOAssignedPayload {
  poId: string;
  poNumber: string;
  supplierId: string;
  totalAmount: number;
  itemCount: number;
  createdBy?: string;
}

export interface SupplierPOConfirmedPayload {
  poId: string;
  poNumber: string;
  supplierName: string;
  expectedDeliveryDate?: string;
}

export interface SupplierPORejectedPayload {
  poId: string;
  poNumber: string;
  supplierName: string;
  reason?: string;
}

export interface SupplierProductionUpdatePayload {
  poId: string;
  poNumber: string;
  supplierName: string;
  productionStatus: string;
}

export interface SupplierShipmentUpdatePayload {
  shipmentId: string;
  shipmentNumber: string;
  poNumber: string;
  supplierName: string;
  updateType: string; // 'eta', 'tracking', 'container', etc.
}
