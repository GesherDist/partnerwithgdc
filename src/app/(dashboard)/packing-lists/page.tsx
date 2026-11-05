/**
 * Packing Lists Page
 *
 * Main page for managing packing lists.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { PackingListsPageContent } from './packing-lists-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function PackingListsPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'pick_tickets.view_module')) {
    redirect('/no-permission');
  }

  return <PackingListsPageContent />;
}
