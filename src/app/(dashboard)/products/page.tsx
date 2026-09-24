/**
 * Products List Page
 *
 * Displays the product catalog with server-side search, filtering and paging.
 *
 * Performance:
 * - Server-side permission check before anything renders
 * - First page fetched on the server and handed to React Query as initialData
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/shared/components/layout/PageHeader';
import { ProductsTable } from '@/features/products/components';
import { getProducts, getProductCategories } from '@/features/products/actions';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Products | Gesher Distribution',
  description: 'Manage your product catalog',
};

// ============================================
// PAGE
// ============================================

export default async function ProductsPage() {
  // Server-side permission check
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'products.view_module')) {
    redirect('/no-permission');
  }

  // Fetch the first page and the category list in parallel
  const [productsResult, categoriesResult] = await Promise.all([
    getProducts({ page: 1, limit: 10 }),
    getProductCategories(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Products"
        description="Manage your product catalog"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Products' },
        ]}
      />

      <ProductsTable
        initialData={productsResult.success ? productsResult.data : undefined}
        initialCategories={categoriesResult.success ? categoriesResult.data : undefined}
      />
    </div>
  );
}
