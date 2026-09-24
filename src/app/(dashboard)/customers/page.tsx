/**
 * Customers Page
 *
 * Main page for managing customers.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { CustomersPageContent } from './customers-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function CustomersPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'customers.view_module')) {
    redirect('/no-permission');
  }

  return <CustomersPageContent />;
}
