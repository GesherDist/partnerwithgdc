/**
 * Supplier Purchase Orders List Page
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ClipboardList } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierPOTable, supplierPortalService } from '@/features/supplier-portal';

export const metadata: Metadata = {
  title: 'Purchase Orders | Supplier Portal',
  description: 'View and manage purchase orders',
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    production_status?: string;
    page?: string;
  }>;
}

export default async function SupplierPurchaseOrdersPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (!user?.supplierId) {
    redirect('/dashboard');
  }

  if (!hasPermission(user, 'supplier_portal.view_pos')) {
    redirect('/no-permission');
  }

  const page = parseInt(params.page || '1', 10);

  const { data: purchaseOrders, total } = await supplierPortalService.getPurchaseOrders({
    supplierId: user.supplierId,
    status: params.status,
    productionStatus: params.production_status,
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <p className="text-muted-foreground">
          View and manage your purchase orders
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            All Orders ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierPOTable
            purchaseOrders={purchaseOrders}
            emptyMessage="No purchase orders yet. Orders from Gesher Distribution will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
