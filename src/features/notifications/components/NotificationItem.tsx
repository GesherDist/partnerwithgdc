/**
 * NotificationItem Component
 *
 * Individual notification item with icon, content, and timestamp.
 */

'use client';

import {
  Bell,
  Mail,
  FileText,
  ShoppingCart,
  ClipboardList,
  FileBox,
  Truck,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { NotificationWithStatus, NotificationType } from '../types';
import { NOTIFICATION_CONFIG } from '../types';

interface NotificationItemProps {
  notification: NotificationWithStatus;
  onClick: () => void;
}

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bell,
  Mail,
  FileText,
  ShoppingCart,
  ClipboardList,
  FileBox,
  Truck,
  AlertTriangle,
  CheckCircle,
};

function getIcon(type: NotificationType) {
  const config = NOTIFICATION_CONFIG[type];
  return ICON_MAP[config.icon] || Bell;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
}

export function NotificationItem({
  notification,
  onClick,
}: NotificationItemProps) {
  const config = NOTIFICATION_CONFIG[notification.type];
  const Icon = getIcon(notification.type);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50',
        !notification.isRead && 'bg-blue-50/50'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          config.bgColor
        )}
      >
        <Icon className={cn('h-4 w-4', config.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-snug',
            notification.isRead ? 'text-gray-600' : 'font-medium text-gray-900'
          )}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.isRead && (
        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
      )}
    </button>
  );
}
