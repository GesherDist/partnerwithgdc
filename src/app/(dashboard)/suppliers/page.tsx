/**
 * Suppliers List Page (Admin)
 *
 * Admin page for managing suppliers.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import * as suppliersService from '@/features/suppliers/services/suppliers.service';
import { SuppliersPageContent } from './suppliers-content';

export const metadata: Metadata = {
  title: 'Suppliers | Gesher Distribution',
  description: 'Manage suppliers',
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function SuppliersPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user || !hasPermission(user, 'suppliers.view_module')) {
    redirect('/no-permission');
  }

  const canCreate = hasPermission(user, 'suppliers.create');
  const canEdit = hasPermission(user, 'suppliers.edit');

  const page = parseInt(params.page || '1', 10);

  const { data: suppliers, total } = await suppliersService.getSuppliers({
    status: params.status,
    search: params.search,
    page,
    pageSize: 20,
  });

  return (
    <SuppliersPageContent
      suppliers={suppliers}
      total={total}
      canCreate={canCreate}
      canEdit={canEdit}
    />
  );
}
