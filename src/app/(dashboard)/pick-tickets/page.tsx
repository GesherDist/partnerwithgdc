/**
 * Pick Tickets Page
 *
 * Main page for managing warehouse pick tickets.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { PickTicketsPageContent } from './pick-tickets-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function PickTicketsPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'pick_tickets.view_module')) {
    redirect('/no-permission');
  }

  return <PickTicketsPageContent />;
}
