/**
 * Quotes Page
 *
 * Main page for managing quotes.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { QuotesPageContent } from './quotes-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function QuotesPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'quotes.view_module')) {
    redirect('/no-permission');
  }

  return <QuotesPageContent />;
}
