'use client';

/**
 * Supplier Shipments Table
 *
 * Table view for supplier's shipments.
 */

import Link from 'next/link';
import { ArrowRight, Clock, Truck, CheckCircle2, XCircle } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Button } from '@/shared/components/ui/button';
import { cn, formatDate } from '@/shared/lib/utils';
import type { SupplierShipment, ShipmentStatus } from '../types';

// ============================================
// HELPERS
// ============================================

function getStatusBadge(status: ShipmentStatus) {
  const configs: Record<ShipmentStatus, { label: string; icon: React.ElementType; className: string }> = {
    pending: { label: 'Pending', icon: Clock, className: 'bg-gray-100 text-gray-700' },
    in_transit: { label: 'In Transit', icon: Truck, className: 'bg-blue-100 text-blue-700' },
    delivered: { label: 'Delivered', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
    failed: { label: 'Failed', icon: XCircle, className: 'bg-red-100 text-red-700' },
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface SupplierShipmentTableProps {
  shipments: SupplierShipment[];
  emptyMessage?: string;
}

export function SupplierShipmentTable({
  shipments,
  emptyMessage = 'No shipments found.',
}: SupplierShipmentTableProps) {
  if (shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment #</TableHead>
            <TableHead>PO Number</TableHead>
            <TableHead>Ship Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Container</TableHead>
            <TableHead>ETA Customer</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow key={shipment.id}>
              <TableCell className="font-medium">{shipment.shipmentNumber}</TableCell>
              <TableCell>
                {shipment.purchaseOrder?.poNumber || '-'}
              </TableCell>
              <TableCell>{formatDate(shipment.shipmentDate)}</TableCell>
              <TableCell>{getStatusBadge(shipment.status)}</TableCell>
              <TableCell>{shipment.containerNumber || '-'}</TableCell>
              <TableCell>
                {shipment.etaCustomer ? formatDate(shipment.etaCustomer) : '-'}
              </TableCell>
              <TableCell>
                <Link href={`/supplier-portal/shipments/${shipment.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
