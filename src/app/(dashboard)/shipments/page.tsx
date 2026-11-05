/**
 * Shipments Page
 *
 * Main page for managing shipments.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { ShipmentsPageContent } from './shipments-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function ShipmentsPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'shipments.view_module')) {
    redirect('/no-permission');
  }

  return <ShipmentsPageContent />;
}
