/**
 * Create New Supplier Page
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierForm } from '@/features/suppliers';

export const metadata: Metadata = {
  title: 'New Supplier | Gesher Distribution',
  description: 'Create a new supplier',
};

export default async function NewSupplierPage() {
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, 'suppliers.create')) {
    redirect('/no-permission');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/suppliers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Supplier</h1>
          <p className="text-muted-foreground">
            Create a new supplier company
          </p>
        </div>
      </div>

      <SupplierForm mode="create" />
    </div>
  );
}
