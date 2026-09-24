/**
 * Edit Supplier Page
 */

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierForm } from '@/features/suppliers';
import * as suppliersService from '@/features/suppliers/services/suppliers.service';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supplier = await suppliersService.getSupplierById(id);

  return {
    title: supplier
      ? `Edit ${supplier.name} | Suppliers`
      : 'Edit Supplier | Gesher Distribution',
    description: 'Edit supplier details',
  };
}

export default async function EditSupplierPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user || !hasPermission(user, 'suppliers.edit')) {
    redirect('/no-permission');
  }

  const supplier = await suppliersService.getSupplierById(id);

  if (!supplier) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/suppliers/${supplier.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Supplier</h1>
          <p className="text-muted-foreground">
            {supplier.name} ({supplier.supplierCode})
          </p>
        </div>
      </div>

      <SupplierForm mode="edit" supplier={supplier} />
    </div>
  );
}
