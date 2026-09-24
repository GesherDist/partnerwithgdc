/**
 * Supplier Portal Dashboard Page
 *
 * Main dashboard for supplier portal showing KPIs and pending actions.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierDashboard, supplierPortalService } from '@/features/supplier-portal';

export const metadata: Metadata = {
  title: 'Supplier Dashboard | Gesher Distribution',
  description: 'Supplier portal dashboard',
};

export default async function SupplierPortalDashboardPage() {
  const user = await getCurrentUser();

  if (!user?.supplierId) {
    redirect('/dashboard');
  }

  if (!hasPermission(user, 'supplier_portal.view_module')) {
    redirect('/no-permission');
  }

  // Fetch dashboard data
  const [stats, pendingPOs, supplier] = await Promise.all([
    supplierPortalService.getDashboardStats(user.supplierId),
    supplierPortalService.getPendingPurchaseOrders(user.supplierId),
    supplierPortalService.getSupplier(user.supplierId),
  ]);

  return (
    <SupplierDashboard
      stats={stats}
      pendingPOs={pendingPOs}
      supplierName={supplier?.name || 'Supplier'}
    />
  );
}
