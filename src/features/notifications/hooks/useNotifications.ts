/**
 * useNotifications Hook
 *
 * Fetches and manages notifications for the current user.
 * Handles loading states, pagination, and read status updates.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../actions';
import type { NotificationWithStatus, NotificationListParams } from '../types';

interface UseNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseNotificationsReturn {
  notifications: NotificationWithStatus[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (recipientId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    limit = 20,
    unreadOnly = false,
    autoRefresh = true,
    refreshInterval = 60000, // 60 seconds
  } = options;

  const [notifications, setNotifications] = useState<NotificationWithStatus[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevUnreadCountRef = useRef(0);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (pageNum: number = 1, append: boolean = false) => {
      try {
        setIsLoading(true);
        setError(null);

        const params: NotificationListParams = {
          page: pageNum,
          limit,
          unreadOnly,
        };

        const result = await getNotifications(params);

        if (result.success && result.data) {
          setNotifications((prev) =>
            append ? [...prev, ...result.data!.data] : result.data!.data
          );
          setTotal(result.data.total);
          setUnreadCount(result.data.unreadCount);
          prevUnreadCountRef.current = result.data.unreadCount; // Keep ref in sync
          setPage(pageNum);
        } else {
          setError(result.error || 'Failed to fetch notifications');
        }
      } catch (err) {
        console.error('useNotifications fetch error:', err);
        setError('Failed to fetch notifications');
      } finally {
        setIsLoading(false);
      }
    },
    [limit, unreadOnly]
  );

  // Refresh unread count and check if we need to fetch new notifications
  const refreshUnreadCount = useCallback(async () => {
    try {
      const result = await getUnreadNotificationCount();
      if (result.success && typeof result.data === 'number') {
        const newCount = result.data;
        const prevCount = prevUnreadCountRef.current;

        // Update the ref
        prevUnreadCountRef.current = newCount;

        // If count increased, fetch full list to show new notifications
        if (newCount > prevCount) {
          console.log('[useNotifications] New notifications detected, refreshing list...', { prevCount, newCount });
          await fetchNotifications(1, false);
        } else {
          setUnreadCount(newCount);
        }
      }
    } catch (err) {
      console.error('useNotifications refreshUnreadCount error:', err);
    }
  }, [fetchNotifications]);

  // Full refresh
  const refresh = useCallback(async () => {
    await fetchNotifications(1, false);
  }, [fetchNotifications]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    await fetchNotifications(nextPage, true);
  }, [page, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (recipientId: string) => {
      try {
        const result = await markNotificationAsRead(recipientId);
        if (result.success) {
          // Update local state
          setNotifications((prev) =>
            prev.map((n) =>
              n.recipientId === recipientId
                ? { ...n, isRead: true, readAt: new Date() }
                : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('useNotifications markAsRead error:', err);
      }
    },
    []
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      const result = await markAllNotificationsAsRead();
      if (result.success) {
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('useNotifications markAllAsRead error:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(1, false);
  }, [fetchNotifications]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshUnreadCount();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshUnreadCount]);

  const hasMore = notifications.length < total;

  return {
    notifications,
    unreadCount,
    total,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
  };
}
