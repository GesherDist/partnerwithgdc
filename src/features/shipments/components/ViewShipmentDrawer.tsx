'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Pencil,
  Truck,
  MapPin,
  Package,
  Ship,
  Anchor,
  User,
  FileText,
  Clock,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useShipment } from '../hooks/useShipment';
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS } from '../types';
import type { ViewShipmentDrawerProps } from '../types';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ViewShipmentDrawer({
  open,
  onClose,
  shipmentId,
  onEdit,
}: ViewShipmentDrawerProps) {
  const { data: shipment, isLoading } = useShipment(open ? shipmentId : null);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="space-y-2 pb-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-40" />
                  <Skeleton className="h-4 w-28" />
                </>
              ) : shipment ? (
                <>
                  <SheetTitle className="text-2xl">
                    {shipment.shipmentNumber}
                  </SheetTitle>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <p>Ship Date: {formatDate(shipment.shipmentDate)}</p>
                    {shipment.salesOrder && (
                      <p>Sales Order: <span className="font-mono font-medium text-foreground">{shipment.salesOrder.orderNumber}</span></p>
                    )}
                    {shipment.purchaseOrder && (
                      <p>Purchase Order: <span className="font-mono font-medium text-foreground">{shipment.purchaseOrder.poNumber}</span></p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-6 pt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : shipment ? (
          <div className="space-y-4 pt-2">
            {/* Customer & Ship To - Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Customer Information */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
                <div className="text-sm bg-muted/30 rounded-md p-2">
                  {shipment.salesOrder?.customer ? (
                    <>
                      <p className="font-medium">{shipment.salesOrder.customer.name}</p>
                      {shipment.salesOrder.customer.email && (
                        <p className="text-muted-foreground">{shipment.salesOrder.customer.email}</p>
                      )}
                      {shipment.salesOrder.customer.phone && (
                        <p className="text-muted-foreground">{shipment.salesOrder.customer.phone}</p>
                      )}
                      {shipment.salesOrder.customer.addressStreet && (
                        <p className="text-muted-foreground mt-1">{shipment.salesOrder.customer.addressStreet},</p>
                      )}
                      <p className="text-muted-foreground">
                        {[
                          shipment.salesOrder.customer.addressCity,
                          shipment.salesOrder.customer.addressState,
                          shipment.salesOrder.customer.addressPostalCode,
                          shipment.salesOrder.customer.addressCountry,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      {shipment.salesOrder.customerPoNumber && (
                        <p className="text-muted-foreground mt-1">
                          Customer PO: <span className="font-mono">{shipment.salesOrder.customerPoNumber}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">No customer linked</p>
                  )}
                </div>
              </div>

              {/* Ship To Address */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ship To
                </h3>
                <div className="text-sm bg-muted/30 rounded-md p-2">
                  {shipment.shipToAddressStreet && (
                    <p>{shipment.shipToAddressStreet},</p>
                  )}
                  <p>
                    {[
                      shipment.shipToAddressCity,
                      shipment.shipToAddressState,
                      shipment.shipToAddressPostalCode,
                      shipment.shipToAddressCountry,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {!shipment.shipToAddressStreet && !shipment.shipToAddressCity && (
                    <p className="text-muted-foreground">No address specified</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Shipping Details - Status, Container & Vessel */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Ship className="h-4 w-4" />
                Shipping Details
              </h3>
              <div className="grid grid-cols-4 gap-3 text-sm">
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Status</p>
                  <div className="flex items-center gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium',
                        SHIPMENT_STATUS_COLORS[shipment.status]
                      )}
                    >
                      {SHIPMENT_STATUS_LABELS[shipment.status]}
                    </Badge>
                    {shipment.isDelayed && (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                        Delayed
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Container Number</p>
                  <p className="font-mono font-medium">{shipment.containerNumber || '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Bill of Lading</p>
                  <p className="font-mono font-medium">{shipment.billOfLading || '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Vessel Name</p>
                  <p className="font-medium">{shipment.vesselName || '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Ports & Dates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Anchor className="h-4 w-4" />
                Ports & Dates
              </h3>
              {/* Row 1: Ports and ETD */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Port of Loading</p>
                  <p className="font-medium">{shipment.portOfLoading || '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Port of Discharge</p>
                  <p className="font-medium">{shipment.portOfDischarge || '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">ETD (Departure)</p>
                  <p className="font-medium">{formatDate(shipment.etd)}</p>
                </div>
              </div>
              {/* Row 2: ETA dates */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">ETA Port</p>
                  <p className="font-medium">{formatDate(shipment.etaPort)}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">ETA Customer</p>
                  <p className="font-medium">{formatDate(shipment.etaCustomer)}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Last Free Day (LFD)</p>
                  <p className={cn('font-medium', shipment.lfdDate && 'text-orange-600')}>
                    {formatDate(shipment.lfdDate)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Carrier Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Carrier Information
              </h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Carrier</p>
                  <p className="font-medium">{shipment.carrier || '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Tracking Number</p>
                  <p className="font-mono font-medium">{shipment.trackingNumber || '-'}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Service Type</p>
                  <p className="font-medium">{shipment.serviceType || '-'}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Timeline */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </h3>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Shipped</p>
                  <p className="font-medium">{formatDate(shipment.shipmentDate)}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Est. Arrival</p>
                  <p className="font-medium">{formatDate(shipment.estimatedArrival)}</p>
                </div>
                <div className="bg-muted/30 rounded-md p-2">
                  <p className="text-muted-foreground text-xs mb-1">Actual Arrival</p>
                  <p className={cn('font-medium', shipment.actualArrival && 'text-emerald-600')}>
                    {formatDate(shipment.actualArrival)}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Package className="h-4 w-4" />
                Items ({shipment.items.length})
              </h3>
              <div className="space-y-1.5">
                {shipment.items.length > 0 ? (
                  shipment.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-md"
                    >
                      <div>
                        <p className="font-mono font-medium text-sm">{item.sku}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <p className="font-semibold">Qty: {item.quantityShipped}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground p-2 bg-muted/30 rounded-md">
                    No items in this shipment
                  </p>
                )}
              </div>
            </div>

            {/* Package Info */}
            {(shipment.totalWeight || shipment.totalPackages > 1) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {shipment.totalWeight && (
                    <div className="bg-muted/30 rounded-md p-2">
                      <p className="text-muted-foreground text-xs mb-1">Total Weight</p>
                      <p className="font-medium">
                        {shipment.totalWeight} {shipment.weightUnit}
                      </p>
                    </div>
                  )}
                  <div className="bg-muted/30 rounded-md p-2">
                    <p className="text-muted-foreground text-xs mb-1">Total Packages</p>
                    <p className="font-medium">{shipment.totalPackages}</p>
                  </div>
                </div>
              </>
            )}

            {/* Notes & Instructions */}
            {(shipment.actionRequired || shipment.notes || shipment.deliveryInstructions) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes & Instructions
                  </h3>
                  {shipment.actionRequired && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-xs font-semibold text-amber-700 uppercase mb-1">
                        Action Required
                      </p>
                      <p className="text-sm text-amber-900">{shipment.actionRequired}</p>
                    </div>
                  )}
                  {shipment.deliveryInstructions && (
                    <div className="bg-muted/30 rounded-md p-2">
                      <p className="text-xs text-muted-foreground uppercase mb-1">
                        Delivery Instructions
                      </p>
                      <p className="text-sm">{shipment.deliveryInstructions}</p>
                    </div>
                  )}
                  {shipment.notes && (
                    <div className="bg-muted/30 rounded-md p-2">
                      <p className="text-xs text-muted-foreground uppercase mb-1">Notes</p>
                      <p className="text-sm">{shipment.notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Edit Button at Bottom */}
            {onEdit && (
              <>
                <Separator />
                <div className="pt-2">
                  <Button onClick={() => onEdit(shipment)} className="w-full">
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Shipment
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground py-12">
            Shipment not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
