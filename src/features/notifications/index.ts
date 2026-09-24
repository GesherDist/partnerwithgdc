/**
 * Notifications Feature Module
 *
 * Real-time notification system with role-based delivery.
 */

// Types
export type {
  NotificationType,
  Notification,
  NotificationWithStatus,
  NotificationListParams,
  QuoteCreatedPayload,
  SalesOrderCreatedPayload,
  PickTicketCreatedPayload,
  PurchaseOrderCreatedPayload,
  EmailPOReceivedPayload,
  ShipmentUpdatePayload,
  SupplierPOAssignedPayload,
} from './types';
export { NOTIFICATION_PERMISSION_MAP, NOTIFICATION_CONFIG } from './types';

// Service (for triggering notifications from other modules)
export { notificationService } from './services/notification.service';

// Actions (server actions for client components)
export {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './actions';

// Hooks
export { useNotifications } from './hooks/useNotifications';
export { useNotificationSubscription } from './hooks/useNotificationSubscription';

// Components
export {
  NotificationBell,
  NotificationDropdown,
  NotificationItem,
  NotificationEmpty,
} from './components';
