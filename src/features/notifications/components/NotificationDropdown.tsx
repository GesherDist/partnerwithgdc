/**
 * NotificationDropdown Component
 *
 * Dropdown list showing notifications with header, items, and actions.
 */

'use client';

import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Loader2, CheckCheck } from 'lucide-react';
import type { NotificationWithStatus } from '../types';
import { NotificationItem } from './NotificationItem';
import { NotificationEmpty } from './NotificationEmpty';

interface NotificationDropdownProps {
  notifications: NotificationWithStatus[];
  isLoading: boolean;
  hasMore: boolean;
  total: number;
  onNotificationClick: (recipientId: string, link: string | null) => void;
  onMarkAllAsRead: () => void;
  onLoadMore: () => void;
  onClose?: () => void;
}

export function NotificationDropdown({
  notifications,
  isLoading,
  hasMore,
  total,
  onNotificationClick,
  onMarkAllAsRead,
  onLoadMore,
  onClose,
}: NotificationDropdownProps) {
  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs text-blue-600 hover:text-blue-700"
            onClick={onMarkAllAsRead}
          >
            <CheckCheck className="mr-1 h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notification List */}
      <ScrollArea className="max-h-80">
        {isLoading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : notifications.length === 0 ? (
          <NotificationEmpty />
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.recipientId}
                notification={notification}
                onClick={() =>
                  onNotificationClick(notification.recipientId, notification.link)
                }
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with View All */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-2">
          {hasMore ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-gray-600"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : null}
              Load more
            </Button>
          ) : (
            <span className="text-xs text-gray-400">
              {total} notification{total !== 1 ? 's' : ''}
            </span>
          )}
          <Link
            href="/notifications"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
            onClick={onClose}
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
