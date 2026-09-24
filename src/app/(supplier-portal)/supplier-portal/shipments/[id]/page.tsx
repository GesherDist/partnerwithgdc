/**
 * Supplier Shipment Detail Page
 */

import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { SupplierShipmentDetail, supplierPortalService } from '@/features/supplier-portal';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const shipment = await supplierPortalService.getShipmentById(id);

  return {
    title: shipment
      ? `${shipment.shipmentNumber} | Supplier Portal`
      : 'Shipment | Supplier Portal',
    description: 'Shipment details',
  };
}

export default async function SupplierShipmentDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user?.supplierId) {
    redirect('/dashboard');
  }

  if (!hasPermission(user, 'supplier_portal.view_shipments')) {
    redirect('/no-permission');
  }

  const shipment = await supplierPortalService.getShipmentById(id);

  if (!shipment) {
    notFound();
  }

  // Verify this shipment belongs to the supplier
  if (shipment.supplierId !== user.supplierId) {
    redirect('/supplier-portal/shipments');
  }

  return <SupplierShipmentDetail shipment={shipment} />;
}
