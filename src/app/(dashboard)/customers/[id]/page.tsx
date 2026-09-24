/**
 * Customer Detail Page
 *
 * /customers/[id]
 *
 * Full page view for customer details with tabs for Details, Contacts, and Documents.
 *
 * Performance Optimizations:
 * - Uses React cache() to deduplicate getCustomer() calls between page and generateMetadata
 */

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import { getCustomer } from '@/features/customers/actions';
import { CustomerDetailView } from '@/features/customers/components/CustomerDetailView';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';

// ============================================
// CACHED DATA FETCHING
// ============================================

/**
 * Cached version of getCustomer - deduplicates calls within the same render pass.
 * Both page component and generateMetadata use this, but only 1 actual API call happens.
 */
const getCachedCustomer = cache(async (id: string) => {
  return await getCustomer(id);
});

// ============================================
// TYPES
// ============================================

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'customers.view_detail')) {
    redirect('/no-permission');
  }

  const { id } = await params;

  // Fetch customer data (uses cached version - deduplicated with generateMetadata)
  const result = await getCachedCustomer(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CustomerDetailView customer={result.data} />
    </Suspense>
  );
}

// ============================================
// METADATA
// ============================================

export async function generateMetadata({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  // Uses cached result from page component - no duplicate API call
  const result = await getCachedCustomer(id);

  if (!result.success || !result.data) {
    return {
      title: 'Customer Not Found',
    };
  }

  return {
    title: `${result.data.name} | Customers`,
    description: `View details for customer ${result.data.customerCode}`,
  };
}
