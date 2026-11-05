/**
 * Shipping Page
 *
 * Displays shipping tracking emails and status updates.
 * Server component wrapper for permission check, then renders client component.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { ShippingContent } from './shipping-content';

export const metadata: Metadata = {
  title: 'Shipping | Gesher Distribution',
  description: 'Shipping tracking and email management',
};

export default async function ShippingPage() {
  // Server-side permission check (same as the shipping server actions)
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'shipments.view_module')) {
    redirect('/no-permission');
  }

  return <ShippingContent />;
}
