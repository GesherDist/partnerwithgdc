/**
 * Notification Repository
 *
 * Data access layer for notifications module.
 * Handles all database operations using Supabase.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Notification,
  NotificationWithStatus,
  DbNotification,
  CreateNotificationDTO,
  NotificationListParams,
} from '../types';

// ============================================
// REPOSITORY
// ============================================

class NotificationRepositoryImpl {
  // ==========================================
  // CREATE NOTIFICATION
  // ==========================================

  /**
   * Create a notification and assign to recipients
   */
  async createWithRecipients(
    data: CreateNotificationDTO,
    recipientUserIds: string[],
    createdBy?: string
  ): Promise<Notification> {
    // Insert notification
    const { data: notification, error: notifError } = await db
      .from('notifications')
      .insert({
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link || null,
        entity_type: data.entityType || null,
        entity_id: data.entityId || null,
        metadata: data.metadata || {},
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (notifError) {
      throw new Error(`Failed to create notification: ${notifError.message}`);
    }

    // Insert recipients
    if (recipientUserIds.length > 0) {
      const recipients = recipientUserIds.map((userId) => ({
        notification_id: notification.id,
        user_id: userId,
        is_read: false,
      }));

      const { error: recipientError } = await db
        .from('notification_recipients')
        .insert(recipients);

      if (recipientError) {
        console.error('Failed to create notification recipients:', recipientError);
        // Don't fail the whole operation, notification is created
      }
    }

    return this.mapToNotification(notification as DbNotification);
  }

  // ==========================================
  // FIND NOTIFICATIONS FOR USER
  // ==========================================

  /**
   * Find notifications for a specific user with pagination
   */
  async findForUser(
    userId: string,
    params: NotificationListParams = {}
  ): Promise<{
    data: NotificationWithStatus[];
    total: number;
    unreadCount: number;
  }> {
    const { page = 1, limit = 20, unreadOnly = false, type } = params;
    const offset = (page - 1) * limit;

    // Build query for notifications with recipient info
    let query = db
      .from('notification_recipients')
      .select(
        `
        id,
        notification_id,
        user_id,
        is_read,
        read_at,
        created_at,
        notifications!inner (
          id,
          type,
          title,
          message,
          link,
          entity_type,
          entity_id,
          metadata,
          created_at,
          created_by
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply unread filter
    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    // Apply type filter
    if (type) {
      query = query.eq('notifications.type', type);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    console.log('[NotificationRepo] findForUser query result:', {
      userId,
      dataLength: data?.length,
      count,
      error: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      rawData: JSON.stringify(data?.slice(0, 2), null, 2),
    });

    if (error) {
      console.error('[NotificationRepo] Query error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: (error as { hint?: string }).hint,
      });
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    // Get unread count separately
    const { count: unreadCount } = await db
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    // Map with error handling
    const mappedData: NotificationWithStatus[] = [];
    for (const row of data || []) {
      try {
        mappedData.push(this.mapToNotificationWithStatus(row));
      } catch (mapError) {
        console.error('[NotificationRepo] Error mapping row:', {
          rowId: row.id,
          notificationId: row.notification_id,
          notifications: row.notifications,
          error: mapError instanceof Error ? mapError.message : 'Unknown error',
        });
      }
    }

    return {
      data: mappedData,
      total: count || 0,
      unreadCount: unreadCount || 0,
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await db
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }

    return count || 0;
  }

  // ==========================================
  // MARK AS READ
  // ==========================================

  /**
   * Mark a single notification as read
   */
  async markAsRead(recipientId: string, userId: string): Promise<void> {
    const { error } = await db
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', recipientId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const { data, error } = await db
      .from('notification_recipients')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');

    if (error) {
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }

    return data?.length || 0;
  }

  // ==========================================
  // GET USERS BY PERMISSION
  // ==========================================

  /**
   * Get all user IDs that have any of the specified permissions
   * Used for targeting notifications based on permissions
   * IMPORTANT: This excludes supplier portal users (users with supplier_id)
   * to prevent cross-supplier notification leakage
   */
  async getUsersWithPermissions(permissions: string[]): Promise<string[]> {
    const matchingUserIds: Set<string> = new Set();

    // Step 1: Always get Super Admin users first (they get ALL notifications)
    const superAdminIds = await this.getSuperAdminUserIds();
    superAdminIds.forEach((id) => matchingUserIds.add(id));

    console.log(`[NotificationRepo] Found ${superAdminIds.length} super admin users`);

    // Step 2: If no specific permissions required, return all active internal users
    if (permissions.length === 0) {
      const { data, error } = await db
        .from('users')
        .select('id')
        .eq('status', 'active')
        .is('deleted_at', null)
        .is('supplier_id', null); // Exclude supplier portal users

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      (data || []).forEach((u) => matchingUserIds.add(u.id));
      return Array.from(matchingUserIds);
    }

    // Step 3: Get internal users with specific permissions through role_permissions
    // Excludes supplier portal users to prevent cross-supplier notification leakage
    try {
      const { data, error } = await db
        .from('users')
        .select(`
          id,
          role_id,
          roles (
            id,
            is_system_role,
            role_permissions (
              permission_id,
              permissions (
                name
              )
            )
          )
        `)
        .eq('status', 'active')
        .is('deleted_at', null)
        .is('supplier_id', null);

      if (error) {
        console.error('[NotificationRepo] Error fetching users with permissions:', error);
        // Don't throw - we already have super admins
      } else {
        // Filter users who have at least one matching permission
        for (const user of data || []) {
          // Skip if already added (super admin)
          if (matchingUserIds.has(user.id)) continue;

          const role = user.roles as unknown as {
            id: string;
            is_system_role: boolean;
            role_permissions: Array<{
              permission_id: string;
              permissions: { name: string };
            }>;
          } | null;

          if (!role) continue;

          // Check if user's role has any of the required permissions
          const userPermissions = role.role_permissions?.map(
            (rp) => rp.permissions?.name
          ).filter(Boolean) || [];

          const hasPermission = permissions.some((p) => userPermissions.includes(p));
          if (hasPermission) {
            matchingUserIds.add(user.id);
          }
        }
      }
    } catch (err) {
      console.error('[NotificationRepo] Exception fetching permissions:', err);
    }

    console.log(`[NotificationRepo] Total recipients for permissions [${permissions.join(', ')}]: ${matchingUserIds.size}`);
    return Array.from(matchingUserIds);
  }

  /**
   * Get user IDs by supplier ID
   * Used for targeting supplier users when a PO is assigned
   */
  async getUserIdsBySupplierId(supplierId: string): Promise<string[]> {
    const { data, error } = await db
      .from('users')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      console.error(`[NotificationRepo] Error fetching users by supplier: ${error.message}`);
      return [];
    }

    return (data || []).map((u) => u.id);
  }

  /**
   * Get all super admin user IDs
   */
  async getSuperAdminUserIds(): Promise<string[]> {
    const { data, error } = await db
      .from('users')
      .select(`
        id,
        roles!inner (
          is_system_role
        )
      `)
      .eq('status', 'active')
      .is('deleted_at', null)
      .eq('roles.is_system_role', true);

    if (error) {
      throw new Error(`Failed to fetch super admins: ${error.message}`);
    }

    return (data || []).map((u) => u.id);
  }

  // ==========================================
  // MAPPING FUNCTIONS
  // ==========================================

  private mapToNotification(data: DbNotification): Notification {
    return {
      id: data.id,
      type: data.type,
      title: data.title,
      message: data.message,
      link: data.link,
      entityType: data.entity_type,
      entityId: data.entity_id,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      createdBy: data.created_by,
    };
  }

  private mapToNotificationWithStatus(row: {
    id: string;
    notification_id: string;
    user_id: string;
    is_read: boolean;
    read_at: string | null;
    created_at: string;
    notifications: DbNotification | DbNotification[];
  }): NotificationWithStatus {
    // Handle both single object and array (Supabase can return either)
    const notification = Array.isArray(row.notifications)
      ? row.notifications[0]
      : row.notifications;

    // Ensure notification exists
    if (!notification) {
      throw new Error('Notification data missing from row');
    }

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      entityType: notification.entity_type,
      entityId: notification.entity_id,
      metadata: notification.metadata || {},
      createdAt: new Date(notification.created_at),
      createdBy: notification.created_by,
      recipientId: row.id,
      isRead: row.is_read,
      readAt: row.read_at ? new Date(row.read_at) : null,
    };
  }
}

export const notificationRepository = new NotificationRepositoryImpl();
export type NotificationRepository = typeof notificationRepository;
