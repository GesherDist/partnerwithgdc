/**
 * Deals Page
 *
 * Main page for managing deals from Pipedrive.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { DealsPageContent } from './deals-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function DealsPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'customers.view_module')) {
    redirect('/no-permission');
  }

  return <DealsPageContent />;
}
