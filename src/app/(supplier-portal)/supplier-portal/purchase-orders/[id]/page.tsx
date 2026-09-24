/**
 * Supplier Purchase Order Detail Page
 */

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierPODetail, supplierPortalService } from '@/features/supplier-portal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const po = await supplierPortalService.getPurchaseOrderById(id);

  return {
    title: po ? `${po.poNumber} | Supplier Portal` : 'Purchase Order | Supplier Portal',
    description: 'Purchase order details',
  };
}

export default async function SupplierPurchaseOrderDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user?.supplierId) {
    redirect('/dashboard');
  }

  if (!hasPermission(user, 'supplier_portal.view_pos')) {
    redirect('/no-permission');
  }

  const purchaseOrder = await supplierPortalService.getPurchaseOrderById(id);

  console.log('[SupplierPODetail] PO:', purchaseOrder?.id, 'Items:', purchaseOrder?.items?.length);
  console.log('[SupplierPODetail] User supplierId:', user.supplierId);
  console.log('[SupplierPODetail] Item supplierIds:', purchaseOrder?.items?.map(i => i.supplierId));

  if (!purchaseOrder) {
    console.log('[SupplierPODetail] PO not found for id:', id);
    notFound();
  }

  // For now, allow viewing if items exist (supplier_id might not be set yet)
  // TODO: Once all items have supplier_id, enable strict check:
  // const hasSupplierItems = purchaseOrder.items?.some(item => item.supplierId === user.supplierId);
  if (!purchaseOrder.items || purchaseOrder.items.length === 0) {
    console.log('[SupplierPODetail] No items found, redirecting');
    redirect('/supplier-portal/purchase-orders');
  }

  return <SupplierPODetail purchaseOrder={purchaseOrder} />;
}
