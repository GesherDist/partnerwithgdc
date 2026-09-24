'use client';

/**
 * Supplier Purchase Order Detail
 *
 * Detail view for a purchase order in the supplier portal.
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Factory,
  Package,
  Truck,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Separator } from '@/shared/components/ui/separator';
import { cn, formatCurrency, formatDate } from '@/shared/lib/utils';
import type { SupplierPurchaseOrder, POStatus, ProductionStatus } from '../types';
import { ConfirmPODialog } from './ConfirmPODialog';
import { RejectPODialog } from './RejectPODialog';
import { ProductionStatusForm } from './ProductionStatusForm';

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
    <Badge variant={config.variant} className={cn('text-sm', config.className)}>
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
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium', config.className)}>
      <Icon className="h-4 w-4" />
      {config.label}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface SupplierPODetailProps {
  purchaseOrder: SupplierPurchaseOrder;
}

export function SupplierPODetail({ purchaseOrder }: SupplierPODetailProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showProductionForm, setShowProductionForm] = useState(false);

  const isPending =
    !purchaseOrder.supplierConfirmedAt && !purchaseOrder.supplierRejectedAt;
  const isConfirmed = !!purchaseOrder.supplierConfirmedAt;
  const isRejected = !!purchaseOrder.supplierRejectedAt;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/supplier-portal/purchase-orders">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{purchaseOrder.poNumber}</h1>
              {getStatusBadge(purchaseOrder.status)}
            </div>
            <p className="text-muted-foreground">
              Purchase Order from Gesher Distribution
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {isPending && (
            <>
              <Button onClick={() => setShowConfirmDialog(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Accept Order
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50"
                onClick={() => setShowRejectDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Order
              </Button>
            </>
          )}
          {isConfirmed && (
            <Button onClick={() => setShowProductionForm(true)}>
              <Factory className="mr-2 h-4 w-4" />
              Update Production Status
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Status Banner */}
      {isPending && (
        <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                This order requires your confirmation
              </p>
              <p className="text-sm text-amber-700">
                Please review the order details and accept or reject this purchase order.
              </p>
            </div>
          </div>
        </div>
      )}

      {isConfirmed && (
        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Order Confirmed</p>
              <p className="text-sm text-green-700">
                Confirmed on {formatDate(purchaseOrder.supplierConfirmedAt!)}
              </p>
            </div>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Order Rejected</p>
              <p className="text-sm text-red-700">
                Rejected on {formatDate(purchaseOrder.supplierRejectedAt!)}
                {purchaseOrder.supplierRejectionReason && (
                  <>
                    <br />
                    Reason: {purchaseOrder.supplierRejectionReason}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Order Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">PO Date</p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatDate(purchaseOrder.poDate)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Expected Delivery
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {purchaseOrder.expectedDeliveryDate
                    ? formatDate(purchaseOrder.expectedDeliveryDate)
                    : 'Not specified'}
                </p>
              </div>
              {isConfirmed && (
                <>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Production Status
                    </p>
                    <div className="mt-1">
                      {getProductionStatusBadge(purchaseOrder.productionStatus)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Expected Completion
                    </p>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {purchaseOrder.expectedCompletionDate
                        ? formatDate(purchaseOrder.expectedCompletionDate)
                        : 'Not specified'}
                    </p>
                  </div>
                </>
              )}
            </div>

            {purchaseOrder.vendorNotes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Notes from Buyer</p>
                <p className="mt-1 rounded-lg bg-muted p-3 text-sm">
                  {purchaseOrder.vendorNotes}
                </p>
              </div>
            )}

            {purchaseOrder.supplierNotes && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Your Notes</p>
                <p className="mt-1 rounded-lg bg-muted p-3 text-sm">
                  {purchaseOrder.supplierNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(purchaseOrder.subtotal / 100)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(purchaseOrder.taxTotal / 100)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>{formatCurrency(purchaseOrder.shippingCost / 100)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span className="text-lg">
                {formatCurrency(purchaseOrder.grandTotal / 100)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-center">Qty Ordered</TableHead>
                  <TableHead className="text-center">Qty Received</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrder.items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-center">
                      {item.quantityOrdered} {item.unitCode}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.quantityReceived} {item.unitCode}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice / 100)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.lineTotal / 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ConfirmPODialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        poId={purchaseOrder.id}
        poNumber={purchaseOrder.poNumber}
      />

      <RejectPODialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        poId={purchaseOrder.id}
        poNumber={purchaseOrder.poNumber}
      />

      <ProductionStatusForm
        open={showProductionForm}
        onOpenChange={setShowProductionForm}
        purchaseOrder={purchaseOrder}
      />
    </div>
  );
}
