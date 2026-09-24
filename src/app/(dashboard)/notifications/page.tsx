/**
 * Notifications Page
 *
 * Full page view of all notifications with filtering and pagination.
 */

import { Metadata } from 'next';
import { NotificationsContent } from './notifications-content';

export const metadata: Metadata = {
  title: 'Notifications | Gesher Distribution',
  description: 'View all your notifications',
};

export default function NotificationsPage() {
  return <NotificationsContent />;
}
