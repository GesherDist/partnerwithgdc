/**
 * useNotificationSubscription Hook
 *
 * Subscribes to real-time notification updates using Supabase Realtime.
 * Triggers a callback when new notifications are received for the current user.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/stores';

interface UseNotificationSubscriptionOptions {
  onNewNotification?: () => void;
  enabled?: boolean;
}

export function useNotificationSubscription(
  options: UseNotificationSubscriptionOptions = {}
): void {
  const { onNewNotification, enabled = true } = options;

  const { appUser } = useAuthStore();
  const userId = appUser?.id;
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const callbackRef = useRef(onNewNotification);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onNewNotification;
  }, [onNewNotification]);

  // Stable callback for the subscription
  const handleInsert = useCallback(() => {
    callbackRef.current?.();
  }, []);

  useEffect(() => {
    // Don't subscribe if disabled or no user
    if (!enabled || !userId) {
      return;
    }

    const supabase = createClient();

    // Create a unique channel name for this user
    const channelName = `notifications:${userId}`;

    // Subscribe to notification_recipients inserts for this user
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_recipients',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[NotificationSubscription] New notification received:', payload);
          handleInsert();
        }
      )
      .subscribe((status) => {
        console.log('[NotificationSubscription] Subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        console.log('[NotificationSubscription] Unsubscribing...');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, handleInsert]);
}
