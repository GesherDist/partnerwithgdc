/**
 * NotificationBell Component
 *
 * Bell icon with unread badge that triggers the notification dropdown.
 * Subscribes to real-time updates to refresh badge count.
 */

'use client';

import { useState, useCallback } from 'react';
import { Bell } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationSubscription } from '../hooks/useNotificationSubscription';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    total,
    isLoading,
    refresh,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
  } = useNotifications({
    limit: 10,
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds - faster notification detection
  });

  // Handle real-time notification
  const handleNewNotification = useCallback(() => {
    refresh();
  }, [refresh]);

  // Subscribe to real-time updates
  useNotificationSubscription({
    onNewNotification: handleNewNotification,
    enabled: true,
  });

  // Handle notification click
  const handleNotificationClick = useCallback(
    async (recipientId: string, link: string | null) => {
      await markAsRead(recipientId);
      setOpen(false);

      if (link) {
        window.location.href = link;
      }
    },
    [markAsRead]
  );

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-white hover:bg-white/10 hover:text-white"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--sidebar-primary))] px-1 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        sideOffset={8}
      >
        <NotificationDropdown
          notifications={notifications}
          isLoading={isLoading}
          hasMore={hasMore}
          total={total}
          onNotificationClick={handleNotificationClick}
          onMarkAllAsRead={handleMarkAllAsRead}
          onLoadMore={loadMore}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
