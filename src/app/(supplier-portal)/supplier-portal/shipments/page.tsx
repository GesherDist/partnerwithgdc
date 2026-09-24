/**
 * Supplier Shipments List Page
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Truck } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierShipmentTable, supplierPortalService } from '@/features/supplier-portal';

export const metadata: Metadata = {
  title: 'Shipments | Supplier Portal',
  description: 'View and manage shipments',
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function SupplierShipmentsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user?.supplierId) {
    redirect('/dashboard');
  }

  if (!hasPermission(user, 'supplier_portal.view_shipments')) {
    redirect('/no-permission');
  }

  const page = parseInt(params.page || '1', 10);

  const { data: shipments, total } = await supplierPortalService.getShipments({
    supplierId: user.supplierId,
    status: params.status,
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shipments</h1>
        <p className="text-muted-foreground">
          View and update your shipment information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            All Shipments ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierShipmentTable
            shipments={shipments}
            emptyMessage="No shipments yet. Shipments will appear here once created."
          />
        </CardContent>
      </Card>
    </div>
  );
}
