'use client';

/**
 * View Shipment Detail Dialog
 *
 * Shows complete shipment details in a modal dialog:
 * - Shipping Details (Container, BOL, Vessel)
 * - Ports & Dates
 * - Customer Information
 * - Items
 * - Timeline
 * - Notes
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import {
  Package,
  Ship,
  Anchor,
  MapPin,
  Truck,
  User,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { getShipmentDetailById } from '../actions';

// Status colors
const STATUS_COLORS: Record<string, string> = {
  // Shipment statuses
  pending: 'bg-stone-100 text-stone-700',
  in_transit: 'bg-sky-100 text-sky-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  // PO statuses
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-700',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface ShipmentDetail {
  id: string;
  shipmentNumber: string;
  shipmentDate: string;
  status: string;
  // Shipping Details
  containerNumber: string | null;
  billOfLading: string | null;
  vesselName: string | null;
  // Ports
  portOfLoading: string | null;
  portOfDischarge: string | null;
finalDestination: string | null;
  // Dates
  etd: string | null;
  etaPort: string | null;
  etaCustomer: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  lastFreeDay: string | null;
  // Customer
  customerName: string | null;
  customerPo: string | null;
  salesOrderNumber: string | null;
  // Ship To
  shipToName: string | null;
  shipToAddressStreet: string | null;
  shipToAddressCity: string | null;
  shipToAddressState: string | null;
  shipToAddressPostalCode: string | null;
  shipToAddressCountry: string | null;
  // Carrier
  carrier: string | null;
  trackingNumber: string | null;
  serviceType: string | null;
  // Items
  items: Array<{
    id: string;
    sku: string;
    description: string | null;
    quantityShipped: number;
  }>;
  // Package Info
  totalWeight: number | null;
  weightUnit: string;
  totalPackages: number;
  // Notes
  notes: string | null;
  actionRequired: string | null;
  deliveryInstructions: string | null;
  // Flags
  isDelayed: boolean;
}

interface ViewShipmentDetailDialogProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string | null;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ViewShipmentDetailDialog({
  open,
  onClose,
  shipmentId,
}: ViewShipmentDetailDialogProps) {
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('ViewShipmentDetailDialog useEffect - open:', open, 'shipmentId:', shipmentId);
    if (open && shipmentId) {
      setIsLoading(true);
      setError(null);
      console.log('Fetching shipment details for:', shipmentId);
      getShipmentDetailById(shipmentId)
        .then((data) => {
          console.log('Shipment data received:', data);
          setShipment(data);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching shipment:', err);
          setError(err.message || 'Failed to load shipment details');
          setIsLoading(false);
        });
    } else {
      setShipment(null);
    }
  }, [open, shipmentId]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-1">
            {isLoading ? (
              <DialogTitle className="text-xl text-muted-foreground">
                Loading...
              </DialogTitle>
            ) : shipment ? (
              <>
                <DialogTitle className="text-xl flex items-center gap-2">
                  {shipment.shipmentNumber}
                  {shipment.isDelayed && (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Ship Date: {formatDate(shipment.shipmentDate)}
                </p>
              </>
            ) : null}
          </div>
        </DialogHeader>

        {/* Status Display */}
        {shipment && !isLoading && (
          <div className="flex items-center gap-3 px-1 py-2 border-b">
            <label className="text-sm font-medium text-muted-foreground min-w-[80px]">
              Status:
            </label>
            <Badge
              variant="outline"
              className={cn('text-xs font-medium', STATUS_COLORS[shipment.status])}
            >
              {shipment.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">Loading details...</p>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">{error}</div>
        ) : shipment ? (
          <div className="space-y-6 mt-4">
            {/* Customer & Order Info */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="ml-2 font-medium">{shipment.customerName || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer PO:</span>
                    <span className="ml-2 font-mono">{shipment.customerPo || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sales Order:</span>
                    <span className="ml-2 font-mono">{shipment.salesOrderNumber || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ship To
                </h3>
                <div className="text-sm">
                  {shipment.shipToName && <p className="font-medium">{shipment.shipToName}</p>}
                  {shipment.shipToAddressStreet && <p>{shipment.shipToAddressStreet}</p>}
                  <p>
                    {[
                      shipment.shipToAddressCity,
                      shipment.shipToAddressState,
                      shipment.shipToAddressPostalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {shipment.shipToAddressCountry && <p>{shipment.shipToAddressCountry}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* Shipping Details */}
            {(shipment.containerNumber || shipment.billOfLading || shipment.vesselName) && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Ship className="h-4 w-4" />
                    Shipping Details
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Container Number</p>
                      <p className="font-mono font-medium">{shipment.containerNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bill of Lading</p>
                      <p className="font-mono font-medium">{shipment.billOfLading || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vessel Name</p>
                      <p className="font-medium">{shipment.vesselName || '-'}</p>
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Ports & Dates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Anchor className="h-4 w-4" />
                Ports & Dates
              </h3>
              {/* Row 1: Ports and ETD */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Port of Loading</p>
                  <p className="font-medium">{shipment.portOfLoading || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Port of Discharge</p>
                  <p className="font-medium">{shipment.portOfDischarge || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Final Destination</p>
                  <p className="font-medium">{shipment.finalDestination || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ETD (Departure)</p>
                  <p className="font-medium">{formatDate(shipment.etd)}</p>
                </div>
              </div>
              {/* Row 2: ETA dates */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ETA Port</p>
                  <p className="font-medium">{formatDate(shipment.etaPort)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ETA Customer</p>
                  <p className="font-medium">{formatDate(shipment.etaCustomer)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Free Day (LFD)</p>
                  <p className={cn('font-medium', shipment.lastFreeDay && 'text-orange-600')}>
                    {formatDate(shipment.lastFreeDay)}
                  </p>
                </div>
              </div>
              {/* Row 3: Actual Arrival */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Actual Arrival</p>
                  <p className={cn('font-medium', shipment.actualArrival && 'text-emerald-600')}>
                    {formatDate(shipment.actualArrival)}
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
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Carrier</p>
                  <p className="font-medium">{shipment.carrier || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tracking Number</p>
                  <p className="font-mono font-medium">{shipment.trackingNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Service Type</p>
                  <p className="font-medium">{shipment.serviceType || '-'}</p>
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
              <div className="space-y-2">
                {shipment.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.sku}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <p className="font-semibold">Qty: {item.quantityShipped}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Package Info */}
            {(shipment.totalWeight || shipment.totalPackages > 1) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {shipment.totalWeight && (
                    <div>
                      <p className="text-muted-foreground">Total Weight</p>
                      <p className="font-medium">
                        {shipment.totalWeight} {shipment.weightUnit}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Total Packages</p>
                    <p className="font-medium">{shipment.totalPackages}</p>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {(shipment.actionRequired || shipment.notes || shipment.deliveryInstructions) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes & Instructions
                  </h3>
                  {shipment.actionRequired && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs font-semibold text-amber-700 uppercase mb-1">
                        Action Required
                      </p>
                      <p className="text-sm text-amber-900">{shipment.actionRequired}</p>
                    </div>
                  )}
                  {shipment.deliveryInstructions && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">
                        Delivery Instructions
                      </p>
                      <p className="text-sm">{shipment.deliveryInstructions}</p>
                    </div>
                  )}
                  {shipment.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-1">Notes</p>
                      <p className="text-sm">{shipment.notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Shipment not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
