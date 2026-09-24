/**
 * Audit Logs Page
 *
 * View system audit logs and user activity.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuditLogsContent } from './audit-logs-content';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Audit Logs | Gesher Distribution',
  description: 'View system audit logs and activity',
};

// ============================================
// PAGE
// ============================================

export default async function AuditLogsPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'audit.view_module')) {
    redirect('/no-permission');
  }

  return <AuditLogsContent />;
}
