/**
 * New Location Page
 *
 * Form for creating a new location.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { LOCATION_PERMISSIONS } from '@/features/locations/lib/permissions';
import { NewLocationPageContent } from './new-location-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function NewLocationPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, LOCATION_PERMISSIONS.create)) {
    redirect('/no-permission');
  }

  return <NewLocationPageContent />;
}
