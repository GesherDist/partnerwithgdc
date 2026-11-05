/**
 * Platinum Dealers Page
 *
 * Manage platinum dealers and their inventory.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { DEALER_PERMISSIONS } from '@/features/platinum-dealers/lib/permissions';
import { PlatinumDealersContent } from './platinum-dealers-content';

export const metadata = {
  title: 'Platinum Dealers | GDC',
  description: 'Manage platinum dealers and their inventory',
};

export default async function PlatinumDealersPage() {
  // Server-side permission check (same permission as the sidebar link)
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, DEALER_PERMISSIONS.viewModule)) {
    redirect('/no-permission');
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <Suspense fallback={<div>Loading...</div>}>
        <PlatinumDealersContent />
      </Suspense>
    </div>
  );
}
