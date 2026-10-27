'use client';

/**
 * Edit Shipment Dialog
 *
 * Simple dialog for Jenny to update status and notes.
 * Works with both Shipments and Sales Orders.
 */

import { useState, useEffect, useTransition } from 'react';
import { Loader2, Save, Truck, Package, FileText, Calendar, Container, PackageCheck } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';

import { updateShipmentOrOrder } from '../actions';
import { findReceivablePurchaseOrderId } from '@/features/purchase-orders/actions';
import { ReceivePurchaseOrderDialog } from '@/features/purchase-orders/components/ReceivePurchaseOrderDialog';
import { useAuthStore } from '@/shared/stores';
import type { ShipmentStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface ShipmentData {
  id: string;
  loadNumber: string;
  customer: string;
  status: ShipmentStatus;
  actionRequired: string;
  etaToPort?: string | null;
  confirmedEta?: string | null;
  customerExpectedDelivery?: string | null;
  actualDeliveryDate?: string | null;
  qtyDelivered?: number;
  outstandingQty?: number;
  totalQty?: number;
  /** Shown (and editable) only when the row has a shipment */
  containerNumber?: string | null;
  hasShipment?: boolean;
}

export type EditSource = 'supplier' | 'gdc1' | 'gdc' | 'shipment';

interface EditShipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: ShipmentData | null;
  onSuccess?: () => void;
  source?: EditSource; // Which table the edit is from
}

// ============================================
// STATUS OPTIONS (Based on Jenny's Master Sheet)
// ============================================

// GDC 0 / Galileo/Supplier Orders statuses (from Jenny's Excel)
const SUPPLIER_STATUS_OPTIONS: { value: ShipmentStatus; label: string; color: string }[] = [
  { value: 'OPEN', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
  { value: 'HOLD', label: 'Hold', color: 'bg-orange-100 text-orange-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'NOT_INVOICED', label: 'Not Invoiced', color: 'bg-amber-100 text-amber-800' },
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800' },
  { value: 'INVOICED', label: 'Invoiced', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'SOLD', label: 'Sold', color: 'bg-purple-100 text-purple-800' },
  { value: 'PO_NEEDED', label: 'PO Needed', color: 'bg-pink-100 text-pink-800' },
];

// GDC 1,2,3 Inventory statuses (from Jenny's Excel - order matters)
const GDC1_STATUS_OPTIONS: { value: ShipmentStatus; label: string; color: string }[] = [
  { value: 'NOT_INVOICED', label: 'Not Invoiced', color: 'bg-amber-100 text-amber-800' },
  { value: 'INVOICED', label: 'Invoiced', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'OPEN', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'PAID', label: 'Paid', color: 'bg-teal-100 text-teal-800' },
  { value: 'DISPUTED', label: 'Disputed', color: 'bg-red-100 text-red-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PO_NEEDED', label: 'PO Needed', color: 'bg-pink-100 text-pink-800' },
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800' },
  { value: 'SOLD', label: 'Sold', color: 'bg-purple-100 text-purple-800' },
  { value: 'HOLD', label: 'Hold', color: 'bg-orange-100 text-orange-800' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
];

// GDC Inventory statuses (PO statuses)
const GDC_STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'sent', label: 'Sent', color: 'bg-blue-100 text-blue-700' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-green-100 text-green-700' },
  { value: 'partial', label: 'Partial', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'received', label: 'Received', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
];

// Default statuses (for Immediate Attention / Shipments)
const DEFAULT_STATUS_OPTIONS: { value: ShipmentStatus; label: string; color: string }[] = [
  { value: 'OPEN', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800' },
  { value: 'SOLD', label: 'Sold', color: 'bg-purple-100 text-purple-800' },
  { value: 'HOLD', label: 'Hold', color: 'bg-orange-100 text-orange-800' },
  { value: 'INVOICED', label: 'Invoiced', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-slate-100 text-slate-800' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function EditShipmentDialog({
  open,
  onOpenChange,
  shipment,
  onSuccess,
  source = 'shipment',
}: EditShipmentDialogProps) {
  const [isPending, startTransition] = useTransition();

  // Get status options based on source
  const getStatusOptions = () => {
    switch (source) {
      case 'supplier':
        return SUPPLIER_STATUS_OPTIONS;
      case 'gdc1':
        return GDC1_STATUS_OPTIONS;
      case 'gdc':
        return GDC_STATUS_OPTIONS;
      default:
        return DEFAULT_STATUS_OPTIONS;
    }
  };

  const statusOptions = getStatusOptions();

  // Form state
  const [status, setStatus] = useState<string>(shipment?.status || 'OPEN');
  const [actionRequired, setActionRequired] = useState(shipment?.actionRequired || '');
  const [etaToPort, setEtaToPort] = useState(shipment?.etaToPort || '');
  const [confirmedEta, setConfirmedEta] = useState(shipment?.confirmedEta || '');
  const [customerExpectedDelivery, setCustomerExpectedDelivery] = useState(shipment?.customerExpectedDelivery || '');
  const [actualDeliveryDate, setActualDeliveryDate] = useState(shipment?.actualDeliveryDate || '');
  const [qtyDelivered, setQtyDelivered] = useState<number>(shipment?.qtyDelivered || 0);
  const [outstandingQty, setOutstandingQty] = useState<number>(shipment?.outstandingQty || 0);
  const [containerNumber, setContainerNumber] = useState(shipment?.containerNumber || '');

  // Receive into Warehouse (rows backed by a purchase order)
  const { hasPermission } = useAuthStore();
  const canReceive = hasPermission('purchase_orders.receive');
  const [receivePoId, setReceivePoId] = useState<string | null>(null);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);

  useEffect(() => {
    setReceivePoId(null);
    if (!open || !shipment || !canReceive) {
      return;
    }
    let cancelled = false;
    findReceivablePurchaseOrderId(shipment.id)
      .then((result) => {
        if (!cancelled && result.success) {
          setReceivePoId(result.data || null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, shipment, canReceive]);

  // Reset form when shipment changes
  useEffect(() => {
    if (shipment) {
      setStatus(shipment.status);
      setActionRequired(shipment.actionRequired || '');
      setEtaToPort(shipment.etaToPort || '');
      setConfirmedEta(shipment.confirmedEta || '');
      setCustomerExpectedDelivery(shipment.customerExpectedDelivery || '');
      setActualDeliveryDate(shipment.actualDeliveryDate || '');
      setQtyDelivered(shipment.qtyDelivered || 0);
      setOutstandingQty(shipment.outstandingQty || 0);
      setContainerNumber(shipment.containerNumber || '');
    }
  }, [shipment]);

  const handleSave = () => {
    if (!shipment) {
      return;
    }

    // Send only the fields that were changed: a field this row did not load
    // (e.g. dates on Immediate Attention rows) shows empty and must not wipe
    // the saved value, such as an ETA written by CMA CGM tracking.
    const changed = <T,>(value: T, initial: T): T | undefined =>
      value !== initial ? value : undefined;
    const changedText = (value: string, initial: string | null | undefined) =>
      value !== (initial || '') ? value || null : undefined;

    startTransition(async () => {
      const result = await updateShipmentOrOrder({
        id: shipment.id,
        status: status,
        etaToPort: changedText(etaToPort, shipment.etaToPort),
        confirmedEta: changedText(confirmedEta, shipment.confirmedEta),
        customerExpectedDelivery: changedText(customerExpectedDelivery, shipment.customerExpectedDelivery),
        actualDeliveryDate: changedText(actualDeliveryDate, shipment.actualDeliveryDate),
        actionRequired: changedText(actionRequired, shipment.actionRequired),
        qtyDelivered: changed(qtyDelivered, shipment.qtyDelivered || 0),
        outstandingQty: changed(outstandingQty, shipment.outstandingQty || 0),
        containerNumber: shipment.hasShipment
          ? changedText(containerNumber.trim(), shipment.containerNumber)
          : undefined,
      });

      if (result.success) {
        toast.success('Status Updated', {
          description: `${shipment.loadNumber} updated successfully`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update',
        });
      }
    });
  };

  if (!shipment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Edit Status
          </DialogTitle>
          <DialogDescription>
            Update status for{' '}
            <span className="font-semibold">{shipment.loadNumber}</span>
            {shipment.customer && (
              <>
                {' — '}
                <span className="font-semibold">{shipment.customer}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 -mr-2">
          <div className="space-y-5 py-4">
            {/* ========== STATUS SECTION ========== */}
            <div className="space-y-3">
              {/* Current Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Current:</span>
                <Badge variant="outline" className={statusOptions.find(s => s.value === shipment.status)?.color || 'bg-gray-100 text-gray-800'}>
                  {shipment.status.replace('_', ' ')}
                </Badge>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-sm font-medium">
                  New Status
                </Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Container Number (tracked via CMA CGM) */}
              {shipment.hasShipment && (
                <div className="space-y-1.5">
                  <Label htmlFor="containerNumber" className="text-sm font-medium flex items-center gap-2">
                    <Container className="h-4 w-4 text-muted-foreground" />
                    Container Number
                  </Label>
                  <Input
                    id="containerNumber"
                    value={containerNumber}
                    onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. CMAU1234567"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tracking starts as soon as you save.
                  </p>
                </div>
              )}
            </div>

            {/* ========== DATES SECTION ========== */}
            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dates
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {/* ETA to Port */}
                <div className="space-y-1.5">
                  <Label htmlFor="etaToPort" className="text-xs text-muted-foreground">
                    ETA to Port
                  </Label>
                  <Input
                    id="etaToPort"
                    type="date"
                    value={etaToPort}
                    onChange={(e) => setEtaToPort(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Confirmed ETA */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmedEta" className="text-xs text-muted-foreground">
                    Confirmed ETA
                  </Label>
                  <Input
                    id="confirmedEta"
                    type="date"
                    value={confirmedEta}
                    onChange={(e) => setConfirmedEta(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Customer Expected Delivery */}
                <div className="space-y-1.5">
                  <Label htmlFor="customerExpectedDelivery" className="text-xs text-muted-foreground">
                    Customer Expected
                  </Label>
                  <Input
                    id="customerExpectedDelivery"
                    type="date"
                    value={customerExpectedDelivery}
                    onChange={(e) => setCustomerExpectedDelivery(e.target.value)}
                    className="text-sm"
                  />
                </div>

                {/* Actual Delivery Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="actualDeliveryDate" className="text-xs text-muted-foreground">
                    Actual Delivery
                  </Label>
                  <Input
                    id="actualDeliveryDate"
                    type="date"
                    value={actualDeliveryDate}
                    onChange={(e) => setActualDeliveryDate(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ========== QUANTITIES SECTION ========== */}
            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Quantities
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {/* Qty Delivered */}
                <div className="space-y-1.5">
                  <Label htmlFor="qtyDelivered" className="text-xs text-muted-foreground">
                    Qty Delivered
                  </Label>
                  <Input
                    id="qtyDelivered"
                    type="number"
                    min="0"
                    value={qtyDelivered}
                    onChange={(e) => setQtyDelivered(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>

                {/* Outstanding PO Qty */}
                <div className="space-y-1.5">
                  <Label htmlFor="outstandingQty" className="text-xs text-muted-foreground">
                    Outstanding Qty
                  </Label>
                  <Input
                    id="outstandingQty"
                    type="number"
                    min="0"
                    value={outstandingQty}
                    onChange={(e) => setOutstandingQty(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ========== NOTES SECTION ========== */}
            <div className="space-y-3 pt-2 border-t">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </h4>
              <Textarea
                id="actionRequired"
                value={actionRequired}
                onChange={(e) => setActionRequired(e.target.value)}
                placeholder="Add notes or action items..."
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t pt-4 mt-2">
          {receivePoId && (
            <Button
              variant="outline"
              onClick={() => setShowReceiveDialog(true)}
              disabled={isPending}
              className="sm:mr-auto"
            >
              <PackageCheck className="mr-2 h-4 w-4" />
              Receive into Warehouse
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ReceivePurchaseOrderDialog
        open={showReceiveDialog}
        purchaseOrderId={receivePoId}
        onClose={() => setShowReceiveDialog(false)}
        onSuccess={() => onSuccess?.()}
      />
    </Dialog>
  );
}
