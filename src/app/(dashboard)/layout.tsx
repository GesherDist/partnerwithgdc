/**
 * Dashboard Layout
 *
 * Layout for all authenticated dashboard pages.
 * Includes sidebar, header, and main content area.
 *
 * Note: Always fetches fresh user data from database to ensure
 * permissions are up-to-date without requiring re-login.
 */

import { redirect } from 'next/navigation';
import { getUser } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { AppLayout } from '@/shared/components/layout';
import { AuthHydrator } from '@/shared/components/auth';

// ============================================
// LAYOUT
// ============================================

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // Always fetch fresh user data from database
  // This ensures permissions are always up-to-date without re-login
  const appUser = await getAppUserByAuthId(user.id);

  return (
    <AuthHydrator appUser={appUser}>
      <AppLayout>{children}</AppLayout>
    </AuthHydrator>
  );
}
