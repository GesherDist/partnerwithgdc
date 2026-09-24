'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { NotificationItem } from '@/features/notifications/components/NotificationItem';
import { NotificationEmpty } from '@/features/notifications/components/NotificationEmpty';

export function NotificationsContent() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    total,
    isLoading,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
  } = useNotifications({
    limit: 20,
    autoRefresh: false,
  });

  const handleNotificationClick = useCallback(
    async (recipientId: string, link: string | null) => {
      await markAsRead(recipientId);
      if (link) {
        router.push(link);
      }
    },
    [markAsRead, router]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              {total > 0 && ` · ${total} total`}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">All Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-8">
              <NotificationEmpty />
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.recipientId}
                  notification={notification}
                  onClick={() =>
                    handleNotificationClick(notification.recipientId, notification.link)
                  }
                />
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="border-t p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={loadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more notifications'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
