/**
 * Inventory Page
 *
 * Displays inventory levels across all locations with filtering and actions.
 *
 * Features:
 * - Server-side permission check
 * - Real-time inventory data with search and filters
 * - View, edit, and adjust inventory actions
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/shared/components/layout/PageHeader';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { InventoryPageContent } from '@/features/inventory/components/InventoryPageContent';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Inventory | Gesher Distribution',
  description: 'Manage inventory levels across all locations',
};

// ============================================
// PAGE
// ============================================

export default async function InventoryPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'inventory.view_module')) {
    redirect('/no-permission');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventory"
        description="Track inventory levels across all locations"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Inventory' },
        ]}
      />

      <InventoryPageContent />
    </div>
  );
}
