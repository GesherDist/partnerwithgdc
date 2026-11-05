/**
 * Edit Location Page
 *
 * Form for editing an existing location.
 * Server component wrapper for permission check, then renders client component.
 */

import { redirect } from 'next/navigation';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { LOCATION_PERMISSIONS } from '@/features/locations/lib/permissions';
import { EditLocationPageContent } from './edit-location-content';

// ============================================
// SERVER COMPONENT - Permission Check
// ============================================

export default async function EditLocationPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, LOCATION_PERMISSIONS.edit)) {
    redirect('/no-permission');
  }

  return <EditLocationPageContent />;
}
