/**
 * Supplier Detail Page
 */

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Building2, User, MapPin, Settings } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import * as suppliersService from '@/features/suppliers/services/suppliers.service';
import { formatDate } from '@/shared/lib/utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supplier = await suppliersService.getSupplierById(id);

  return {
    title: supplier
      ? `${supplier.name} | Suppliers`
      : 'Supplier | Gesher Distribution',
    description: 'Supplier details',
  };
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user || !hasPermission(user, 'suppliers.view_module')) {
    redirect('/no-permission');
  }

  const supplier = await suppliersService.getSupplierById(id);

  if (!supplier) {
    notFound();
  }

  const canEdit = hasPermission(user, 'suppliers.edit');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/suppliers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{supplier.name}</h1>
              <span className="text-sm text-muted-foreground">
                ({supplier.supplierCode})
              </span>
            </div>
            {supplier.legalName && (
              <p className="text-muted-foreground">{supplier.legalName}</p>
            )}
          </div>
        </div>
        {canEdit && (
          <Link href={`/suppliers/${supplier.id}/edit`}>
            <Button>
              <Edit className="mr-2 h-4 w-4" />
              Edit Supplier
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Supplier Code
                </p>
                <p className="font-medium">{supplier.supplierCode}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{supplier.status}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p>{formatDate(supplier.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </p>
                <p>{formatDate(supplier.updatedAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Primary Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p>{supplier.primaryContactName || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p>{supplier.primaryContactEmail || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p>{supplier.primaryContactPhone || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplier.addressStreet || supplier.addressCity ? (
              <div>
                {supplier.addressStreet && <p>{supplier.addressStreet}</p>}
                <p>
                  {[
                    supplier.addressCity,
                    supplier.addressState,
                    supplier.addressPostalCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p>{supplier.addressCountry}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">No address provided</p>
            )}
          </CardContent>
        </Card>

        {/* Business Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Business Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Currency</p>
                <p>{supplier.currencyCode}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Payment Terms
                </p>
                <p>{supplier.paymentTerms || '-'}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">Tax ID</p>
                <p>{supplier.taxId || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {supplier.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{supplier.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
