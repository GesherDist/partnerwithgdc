/**
 * Historical Import Page
 *
 * Dedicated page for importing historical sales data from Excel files
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { HistoricalImportPageContent } from './historical-import-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function HistoricalImportPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'orders.create')) {
    redirect('/no-permission');
  }

  return <HistoricalImportPageContent />;
}
