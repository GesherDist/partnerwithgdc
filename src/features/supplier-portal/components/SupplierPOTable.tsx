'use client';

/**
 * Supplier Purchase Orders Table
 *
 * Table view for supplier's purchase orders.
 */

import { useState } from 'react';
import {
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Factory,
  Package,
  Truck,
} from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn, formatCurrency, formatDate } from '@/shared/lib/utils';
import type { SupplierPurchaseOrder, POStatus, ProductionStatus } from '../types';
import { SupplierPODrawer } from './SupplierPODrawer';

// ============================================
// HELPERS
// ============================================

function getStatusBadge(status: POStatus) {
  const configs: Record<POStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
    draft: { label: 'Draft', variant: 'secondary' },
    sent: { label: 'Sent', variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    confirmed: { label: 'Confirmed', variant: 'outline', className: 'bg-green-50 text-green-700 border-green-200' },
    in_production: { label: 'In Production', variant: 'outline', className: 'bg-violet-50 text-violet-700 border-violet-200' },
    ready_to_ship: { label: 'Ready to Ship', variant: 'outline', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    in_transit: { label: 'In Transit', variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    partial: { label: 'Partial', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    received: { label: 'Received', variant: 'outline', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    cancelled: { label: 'Cancelled', variant: 'destructive' },
  };

  const config = configs[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

function getProductionStatusBadge(status: ProductionStatus) {
  const configs: Record<ProductionStatus, { label: string; icon: React.ElementType; className: string }> = {
    not_started: { label: 'Not Started', icon: Clock, className: 'bg-gray-100 text-gray-700' },
    in_production: { label: 'In Production', icon: Factory, className: 'bg-blue-100 text-blue-700' },
    ready_to_ship: { label: 'Ready to Ship', icon: Package, className: 'bg-green-100 text-green-700' },
    shipped: { label: 'Shipped', icon: Truck, className: 'bg-emerald-100 text-emerald-700' },
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

function getConfirmationStatus(po: SupplierPurchaseOrder) {
  if (po.supplierRejectedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-red-600">
        <XCircle className="h-4 w-4" />
        Rejected
      </span>
    );
  }
  if (po.supplierConfirmedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        Confirmed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-amber-600">
      <Clock className="h-4 w-4" />
      Pending
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface SupplierPOTableProps {
  purchaseOrders: SupplierPurchaseOrder[];
  emptyMessage?: string;
  onRefresh?: () => void;
}

export function SupplierPOTable({
  purchaseOrders,
  emptyMessage = 'No purchase orders found.',
  onRefresh,
}: SupplierPOTableProps) {
  const [selectedPO, setSelectedPO] = useState<SupplierPurchaseOrder | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleRowClick = (po: SupplierPurchaseOrder) => {
    setSelectedPO(po);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedPO(null);
  };

  if (purchaseOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Confirmation</TableHead>
              <TableHead>Production</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchaseOrders.map((po) => (
              <TableRow
                key={po.id}
                className="cursor-pointer"
                onClick={() => handleRowClick(po)}
              >
                <TableCell className="font-medium">{po.poNumber}</TableCell>
                <TableCell>{formatDate(po.poDate)}</TableCell>
                <TableCell>{getStatusBadge(po.status)}</TableCell>
                <TableCell>{getConfirmationStatus(po)}</TableCell>
                <TableCell>{getProductionStatusBadge(po.productionStatus)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(po.grandTotal / 100)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(po);
                    }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SupplierPODrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        purchaseOrder={selectedPO}
        onRefresh={onRefresh}
      />
    </>
  );
}
