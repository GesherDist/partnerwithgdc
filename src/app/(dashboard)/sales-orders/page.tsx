/**
 * Sales Orders Page
 *
 * Main page for managing sales orders.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { SalesOrdersPageContent } from './sales-orders-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function SalesOrdersPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'orders.view_module')) {
    redirect('/no-permission');
  }

  return <SalesOrdersPageContent />;
}
