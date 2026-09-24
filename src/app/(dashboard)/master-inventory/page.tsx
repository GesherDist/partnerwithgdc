/**
 * Master Inventory Page
 *
 * Unified inventory view across all sources:
 * - Warehouse/GDC inventory
 * - Platinum Dealer inventory
 *
 * Features:
 * - Server-side permission check
 * - Combined inventory data from all sources
 * - Tabs for filtering by source type
 * - Search and filtering capabilities
 * - Aggregated stats across all sources
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/shared/components/layout/PageHeader';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { MasterInventoryPageContent } from '@/features/master-inventory/components/MasterInventoryPageContent';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Master Inventory | Gesher Distribution',
  description: 'Unified inventory view across all warehouses and platinum dealers',
};

// ============================================
// PAGE
// ============================================

export default async function MasterInventoryPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'inventory.view_module')) {
    redirect('/no-permission');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Master Inventory"
        description="Unified inventory view across all warehouses and platinum dealers"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Master Inventory' },
        ]}
      />

      <MasterInventoryPageContent />
    </div>
  );
}
