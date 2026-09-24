/**
 * Supplier Portal Layout
 *
 * Layout for all supplier portal pages.
 * Verifies user has supplierId and provides supplier-specific layout.
 */

import { redirect } from 'next/navigation';
import { getUser } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { AuthHydrator } from '@/shared/components/auth';
import { SupplierLayout } from '@/features/supplier-portal';
import { supplierPortalService } from '@/features/supplier-portal';

export default async function SupplierPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // Get app user
  const appUser = await getAppUserByAuthId(user.id);

  // Must be a supplier user
  if (!appUser?.supplierId) {
    redirect('/dashboard');
  }

  // Get supplier info
  const supplier = await supplierPortalService.getSupplier(appUser.supplierId);

  return (
    <AuthHydrator appUser={appUser}>
      <SupplierLayout supplierName={supplier?.name}>
        {children}
      </SupplierLayout>
    </AuthHydrator>
  );
}
