/**
 * Purchase Orders Page
 *
 * Main page for managing purchase orders.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { PurchaseOrdersPageContent } from './purchase-orders-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function PurchaseOrdersPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'purchase_orders.view_module')) {
    redirect('/no-permission');
  }

  return <PurchaseOrdersPageContent />;
}
