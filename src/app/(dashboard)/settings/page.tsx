/**
 * Settings Page
 *
 * Application settings and preferences.
 * Currently shows only Integration settings (QuickBooks & Pipedrive).
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/shared/components/layout';
import { IntegrationsSettings } from '@/features/integrations';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Settings | Gesher Distribution',
  description: 'Application settings and preferences',
};

// ============================================
// PAGE
// ============================================

export default async function SettingsPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'settings.view_module')) {
    redirect('/no-permission');
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Settings"
        description="Manage your application preferences"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      <div className="grid gap-6">
        {/* Integrations - QuickBooks & Pipedrive */}
        <IntegrationsSettings />
      </div>
    </div>
  );
}
