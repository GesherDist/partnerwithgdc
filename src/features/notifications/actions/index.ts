/**
 * Notification Server Actions
 *
 * Server actions for the notifications module.
 * Called from client components to fetch and manage notifications.
 */

'use server';

import { notificationService } from '../services/notification.service';
import { getCurrentUser } from '@/shared/lib/auth';
import type { NotificationWithStatus, NotificationListParams } from '../types';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// AUTHORIZATION HELPER
// ============================================

async function requireAuth(): Promise<{ ok: true; userId: string } | { ok: false; result: ActionResult<never> }> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  return { ok: true, userId: user.id };
}

// ============================================
// GET NOTIFICATIONS
// ============================================

/**
 * Get notifications for the current user
 */
export async function getNotifications(
  params: NotificationListParams = {}
): Promise<ActionResult<{
  data: NotificationWithStatus[];
  total: number;
  unreadCount: number;
}>> {
  const auth = await requireAuth();
  if (!auth.ok) {
    console.log('[NotificationAction] Auth failed');
    return auth.result;
  }

  console.log('[NotificationAction] getNotifications for user:', auth.userId);
  const result = await notificationService.getForUser(auth.userId, params);
  console.log('[NotificationAction] Result:', {
    success: result.success,
    dataCount: result.data?.data?.length,
    total: result.data?.total,
    unreadCount: result.data?.unreadCount,
    error: result.error,
  });
  return result;
}

// ============================================
// GET UNREAD COUNT
// ============================================

/**
 * Get unread notification count for the current user
 */
export async function getUnreadNotificationCount(): Promise<ActionResult<number>> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.result;
  }

  return notificationService.getUnreadCount(auth.userId);
}

// ============================================
// MARK AS READ
// ============================================

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(
  recipientId: string
): Promise<ActionResult<void>> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.result;
  }

  return notificationService.markAsRead(recipientId, auth.userId);
}

// ============================================
// MARK ALL AS READ
// ============================================

/**
 * Mark all notifications as read for the current user
 */
export async function markAllNotificationsAsRead(): Promise<ActionResult<number>> {
  const auth = await requireAuth();
  if (!auth.ok) {
    return auth.result;
  }

  return notificationService.markAllAsRead(auth.userId);
}
