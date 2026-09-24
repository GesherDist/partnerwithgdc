'use client';

/**
 * Edit Shipment Dialog
 *
 * Simple dialog for Jenny to update status and notes.
 * Works with both Shipments and Sales Orders.
 */

import { useState, useEffect, useTransition } from 'react';
import { Loader2, Save, Truck, Package, FileText, Calendar } from 'lucide-react';

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
  confirmedEta?: string | null;
  actualDeliveryDate?: string | null;
  qtyDelivered?: number;
  totalQty?: number;
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
  { value: 'INVOICED', label: 'Invoiced', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'OPEN', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'CLOSED', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
  { value: 'HOLD', label: 'Hold', color: 'bg-orange-100 text-orange-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'NOT_INVOICED', label: 'Not Invoiced', color: 'bg-amber-100 text-amber-800' },
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800' },
];

// GDC 1 Inventory statuses (from Jenny's Excel - order matters)
const GDC1_STATUS_OPTIONS: { value: ShipmentStatus; label: string; color: string }[] = [
  { value: 'AVAILABLE', label: 'Available', color: 'bg-green-100 text-green-800' },
  { value: 'NOT_INVOICED', label: 'Not Invoiced', color: 'bg-amber-100 text-amber-800' },
  { value: 'OPEN', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'PAID', label: 'Paid', color: 'bg-teal-100 text-teal-800' },
  { value: 'DISPUTED', label: 'Disputed', color: 'bg-red-100 text-red-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PO_NEEDED', label: 'PO Needed', color: 'bg-pink-100 text-pink-800' },
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
  const [confirmedEta, setConfirmedEta] = useState(shipment?.confirmedEta || '');
  const [actualDeliveryDate, setActualDeliveryDate] = useState(shipment?.actualDeliveryDate || '');

  // Reset form when shipment changes
  useEffect(() => {
    if (shipment) {
      setStatus(shipment.status);
      setActionRequired(shipment.actionRequired || '');
      setConfirmedEta(shipment.confirmedEta || '');
      setActualDeliveryDate(shipment.actualDeliveryDate || '');
    }
  }, [shipment]);

  const handleSave = () => {
    if (!shipment) {
      return;
    }

    startTransition(async () => {
      const result = await updateShipmentOrOrder({
        id: shipment.id,
        status: status,
        etaToPort: confirmedEta || null,
        customerExpectedDelivery: actualDeliveryDate || null,
        actionRequired: actionRequired || null,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
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

        <div className="space-y-4 py-4">
          {/* Current Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current:</span>
            <Badge variant="outline" className={statusOptions.find(s => s.value === shipment.status)?.color || 'bg-gray-100 text-gray-800'}>
              {shipment.status.replace('_', ' ')}
            </Badge>
          </div>

          {/* Status Select */}
          <div className="space-y-2">
            <Label htmlFor="status">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                New Status
              </span>
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

          {/* ETA to Port */}
          <div className="space-y-2">
            <Label htmlFor="confirmedEta">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                ETA to Port
              </span>
            </Label>
            <Input
              id="confirmedEta"
              type="date"
              value={confirmedEta}
              onChange={(e) => setConfirmedEta(e.target.value)}
            />
          </div>

          {/* Customer Expected Delivery */}
          <div className="space-y-2">
            <Label htmlFor="actualDeliveryDate">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Customer Expected Delivery
              </span>
            </Label>
            <Input
              id="actualDeliveryDate"
              type="date"
              value={actualDeliveryDate}
              onChange={(e) => setActualDeliveryDate(e.target.value)}
            />
          </div>

          {/* Action Required / Notes */}
          <div className="space-y-2">
            <Label htmlFor="actionRequired">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Action Required / Notes
              </span>
            </Label>
            <Textarea
              id="actionRequired"
              value={actionRequired}
              onChange={(e) => setActionRequired(e.target.value)}
              placeholder="Add notes or action items..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
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
    </Dialog>
  );
}
