/**
 * NotificationEmpty Component
 *
 * Empty state shown when there are no notifications.
 */

'use client';

import { BellOff } from 'lucide-react';

export function NotificationEmpty() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <BellOff className="h-6 w-6 text-gray-400" />
      </div>
      <p className="mt-3 text-sm font-medium text-gray-900">No notifications</p>
      <p className="mt-1 text-center text-xs text-gray-500">
        You&apos;re all caught up! New notifications will appear here.
      </p>
    </div>
  );
}
