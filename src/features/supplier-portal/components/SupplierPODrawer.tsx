'use client';

/**
 * Supplier Purchase Order Detail Drawer
 *
 * Drawer view for a purchase order in the supplier portal.
 */

import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Factory,
  Package,
  Truck,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
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
  const configs: Record<POStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700' },
    sent: { label: 'Sent', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    confirmed: { label: 'Confirmed', className: 'bg-green-50 text-green-700 border-green-200' },
    in_production: { label: 'In Production', className: 'bg-violet-50 text-violet-700 border-violet-200' },
    ready_to_ship: { label: 'Ready to Ship', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    in_transit: { label: 'In Transit', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    partial: { label: 'Partial', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    received: { label: 'Received', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-700 border-red-200' },
  };

  const config = configs[status];
  return (
    <Badge variant="outline" className={cn('text-sm', config.className)}>
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

interface SupplierPODrawerProps {
  open: boolean;
  onClose: () => void;
  purchaseOrder: SupplierPurchaseOrder | null;
  onRefresh?: () => void;
}

export function SupplierPODrawer({
  open,
  onClose,
  purchaseOrder,
  onRefresh,
}: SupplierPODrawerProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showProductionForm, setShowProductionForm] = useState(false);

  if (!purchaseOrder) {
    return null;
  }

  const isPending =
    !purchaseOrder.supplierConfirmedAt && !purchaseOrder.supplierRejectedAt;
  const isConfirmed = !!purchaseOrder.supplierConfirmedAt;
  const isRejected = !!purchaseOrder.supplierRejectedAt;

  const handleDialogSuccess = () => {
    onRefresh?.();
    onClose();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-xl">{purchaseOrder.poNumber}</SheetTitle>
              {getStatusBadge(purchaseOrder.status)}
            </div>
            <p className="text-sm text-muted-foreground">
              Purchase Order from Gesher Distribution
            </p>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Confirmation Status Banner */}
            {isPending && (
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">
                      Requires your confirmation
                    </p>
                    <p className="text-sm text-amber-700">
                      Please review and accept or reject this order.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isConfirmed && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-800">
                    Confirmed on {formatDate(purchaseOrder.supplierConfirmedAt!)}
                  </p>
                </div>
              </div>
            )}

            {isRejected && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      Rejected on {formatDate(purchaseOrder.supplierRejectedAt!)}
                    </p>
                    {purchaseOrder.supplierRejectionReason && (
                      <p className="text-sm text-red-700">
                        Reason: {purchaseOrder.supplierRejectionReason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Order Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Order Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">PO Date</p>
                  <p className="flex items-center gap-1.5 font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(purchaseOrder.poDate)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expected Delivery</p>
                  <p className="flex items-center gap-1.5 font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {purchaseOrder.expectedDeliveryDate
                      ? formatDate(purchaseOrder.expectedDeliveryDate)
                      : 'Not specified'}
                  </p>
                </div>
                {isConfirmed && (
                  <>
                    <div>
                      <p className="text-muted-foreground">Production Status</p>
                      <div className="mt-1">
                        {getProductionStatusBadge(purchaseOrder.productionStatus)}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected Completion</p>
                      <p className="flex items-center gap-1.5 font-medium">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {purchaseOrder.expectedCompletionDate
                          ? formatDate(purchaseOrder.expectedCompletionDate)
                          : 'Not specified'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items ({purchaseOrder.items?.length || 0})
              </h3>
              <div className="space-y-2">
                {purchaseOrder.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{item.sku}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.quantityOrdered} x {formatCurrency(item.unitPrice / 100)}
                      </p>
                    </div>
                    <p className="text-sm font-medium">
                      {formatCurrency(item.lineTotal / 100)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(purchaseOrder.subtotal / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(purchaseOrder.taxTotal / 100)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{formatCurrency(purchaseOrder.shippingCost / 100)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatCurrency(purchaseOrder.grandTotal / 100)}</span>
              </div>
            </div>

            {/* Notes */}
            {purchaseOrder.vendorNotes && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Notes from Buyer
                  </h3>
                  <p className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap">
                    {purchaseOrder.vendorNotes}
                  </p>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <Separator />
            <div className="flex flex-col gap-2">
              {isPending && (
                <>
                  <Button onClick={() => setShowConfirmDialog(true)} className="w-full">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Accept Order
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 hover:bg-red-50"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Order
                  </Button>
                </>
              )}
              {isConfirmed && (
                <Button onClick={() => setShowProductionForm(true)} className="w-full">
                  <Factory className="mr-2 h-4 w-4" />
                  Update Production Status
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <ConfirmPODialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        poId={purchaseOrder.id}
        poNumber={purchaseOrder.poNumber}
        onSuccess={handleDialogSuccess}
      />

      <RejectPODialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        poId={purchaseOrder.id}
        poNumber={purchaseOrder.poNumber}
        onSuccess={handleDialogSuccess}
      />

      <ProductionStatusForm
        open={showProductionForm}
        onOpenChange={setShowProductionForm}
        purchaseOrder={purchaseOrder}
        onSuccess={handleDialogSuccess}
      />
    </>
  );
}
