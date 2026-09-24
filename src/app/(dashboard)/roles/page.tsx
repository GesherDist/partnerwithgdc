/**
 * Roles Management Page
 *
 * Page for managing user roles and permissions.
 * Server component wrapper for permission check.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RolesPageContent } from './roles-content';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Roles & Permissions | Gesher Distribution',
  description: 'Manage user roles and permissions',
};

// ============================================
// PAGE
// ============================================

export default async function RolesPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'roles.view_module')) {
    redirect('/no-permission');
  }

  return <RolesPageContent />;
}
