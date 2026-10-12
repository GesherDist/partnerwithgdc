'use client';

/**
 * Edit Shipment Status Dialog
 *
 * Dialog for updating shipment's load status and tracking status.
 * Similar to EditPOStatusDialogV2 but for shipments.
 */

import { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShoppingCart,
  PauseCircle,
  FileText,
  DollarSign,
  XCircle,
  Loader2,
} from 'lucide-react';

import { updateShipmentLoadStatus, updateShipmentTrackingStatus } from '../actions';
import type { LoadStatus, ShipmentStatus } from '../types';
import { LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_COLORS } from '../types';

// ============================================
// TYPES
// ============================================

interface EditShipmentStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  shipmentNumber: string;
  currentLoadStatus: LoadStatus;
  currentTrackingStatus: ShipmentStatus;
  onSuccess?: () => void;
}

// ============================================
// STATUS OPTIONS
// ============================================

interface StatusOption {
  value: LoadStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const LOAD_STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'available',
    label: 'Available',
    description: 'Inventory available for sale',
    icon: <Package className="h-4 w-4" />,
  },
  {
    value: 'sold',
    label: 'Sold',
    description: 'Allocated to a customer order',
    icon: <ShoppingCart className="h-4 w-4" />,
  },
  {
    value: 'open',
    label: 'Open',
    description: 'Order in progress, not yet shipped',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: 'hold',
    label: 'Hold',
    description: 'Order on hold, requires attention',
    icon: <PauseCircle className="h-4 w-4" />,
  },
  {
    value: 'in_transit',
    label: 'In Transit',
    description: 'Shipment is on the way',
    icon: <Truck className="h-4 w-4" />,
  },
  {
    value: 'invoiced',
    label: 'Invoiced',
    description: 'Invoice has been sent',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    value: 'paid',
    label: 'Paid',
    description: 'Payment received in full',
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    value: 'partially_paid',
    label: 'Partially Paid',
    description: 'Partial payment received',
    icon: <DollarSign className="h-4 w-4" />,
  },
  {
    value: 'closed',
    label: 'Closed',
    description: 'Order completed and closed',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    value: 'disputed',
    label: 'Disputed',
    description: 'Payment or order in dispute',
    icon: <AlertCircle className="h-4 w-4" />,
  },
];

interface TrackingStatusOption {
  value: ShipmentStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const TRACKING_STATUS_OPTIONS: TrackingStatusOption[] = [
  {
    value: 'pending',
    label: 'Pending',
    description: 'Shipment not yet dispatched',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: 'in_transit',
    label: 'In Transit',
    description: 'Shipment is on the way',
    icon: <Truck className="h-4 w-4" />,
  },
  {
    value: 'delivered',
    label: 'Delivered',
    description: 'Shipment delivered to destination',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    value: 'failed',
    label: 'Failed',
    description: 'Delivery failed or cancelled',
    icon: <XCircle className="h-4 w-4" />,
  },
];

// ============================================
// COMPONENT
// ============================================

export function EditShipmentStatusDialog({
  open,
  onOpenChange,
  shipmentId,
  shipmentNumber,
  currentLoadStatus,
  currentTrackingStatus,
  onSuccess,
}: EditShipmentStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<'load' | 'tracking'>('load');
  const [selectedLoadStatus, setSelectedLoadStatus] = useState<LoadStatus>(currentLoadStatus);
  const [selectedTrackingStatus, setSelectedTrackingStatus] = useState<ShipmentStatus>(currentTrackingStatus);

  // Reset selections when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelectedLoadStatus(currentLoadStatus);
      setSelectedTrackingStatus(currentTrackingStatus);
      setActiveTab('load');
    }
    onOpenChange(isOpen);
  };

  const handleUpdateLoadStatus = () => {
    if (selectedLoadStatus === currentLoadStatus) {
      toast.info('No changes to save');
      return;
    }

    startTransition(async () => {
      const result = await updateShipmentLoadStatus(shipmentId, selectedLoadStatus);
      if (result.success) {
        toast.success('Load Status Updated', {
          description: `${shipmentNumber} is now "${LOAD_STATUS_LABELS[selectedLoadStatus]}"`,
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error('Failed to update status', {
          description: result.error,
        });
      }
    });
  };

  const handleUpdateTrackingStatus = () => {
    if (selectedTrackingStatus === currentTrackingStatus) {
      toast.info('No changes to save');
      return;
    }

    startTransition(async () => {
      const result = await updateShipmentTrackingStatus(shipmentId, selectedTrackingStatus);
      if (result.success) {
        toast.success('Tracking Status Updated', {
          description: `${shipmentNumber} is now "${SHIPMENT_STATUS_LABELS[selectedTrackingStatus]}"`,
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error('Failed to update status', {
          description: result.error,
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            Edit Status
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Update status for <span className="font-medium">{shipmentNumber}</span>
          </p>
        </DialogHeader>

        {/* Tab Buttons */}
        <div className="flex gap-2 border-b pb-2">
          <Button
            variant={activeTab === 'load' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('load')}
            className="flex-1"
          >
            <Package className="mr-2 h-4 w-4" />
            Load Status
          </Button>
          <Button
            variant={activeTab === 'tracking' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('tracking')}
            className="flex-1"
          >
            <Truck className="mr-2 h-4 w-4" />
            Tracking Status
          </Button>
        </div>

        {/* Load Status Tab */}
        {activeTab === 'load' && (
          <div className="space-y-4">
            {/* Current Status */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Current Load Status
              </Label>
              <Badge className={cn('text-sm', LOAD_STATUS_COLORS[currentLoadStatus])}>
                {LOAD_STATUS_LABELS[currentLoadStatus]}
              </Badge>
            </div>

            <Separator />

            {/* Status Options */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Update Load Status
              </Label>
              <RadioGroup
                value={selectedLoadStatus}
                onValueChange={(value) => setSelectedLoadStatus(value as LoadStatus)}
                className="space-y-2 max-h-[300px] overflow-y-auto pr-2"
              >
                {LOAD_STATUS_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      selectedLoadStatus === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:bg-muted/50',
                      option.value === currentLoadStatus && 'ring-1 ring-primary/30'
                    )}
                    onClick={() => setSelectedLoadStatus(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`load-${option.value}`} />
                    <div className="flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{option.icon}</span>
                        <div>
                          <Label
                            htmlFor={`load-${option.value}`}
                            className="font-medium cursor-pointer"
                          >
                            {option.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </div>
                      </div>
                      {option.value === currentLoadStatus && (
                        <Badge variant="outline" className="text-xs">Current</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleUpdateLoadStatus} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Load Status
              </Button>
            </div>
          </div>
        )}

        {/* Tracking Status Tab */}
        {activeTab === 'tracking' && (
          <div className="space-y-4">
            {/* Current Status */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Current Tracking Status
              </Label>
              <Badge className={cn('text-sm', SHIPMENT_STATUS_COLORS[currentTrackingStatus])}>
                {SHIPMENT_STATUS_LABELS[currentTrackingStatus]}
              </Badge>
            </div>

            <Separator />

            {/* Status Options */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Update Tracking Status
              </Label>
              <RadioGroup
                value={selectedTrackingStatus}
                onValueChange={(value) => setSelectedTrackingStatus(value as ShipmentStatus)}
                className="space-y-2"
              >
                {TRACKING_STATUS_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      'flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      selectedTrackingStatus === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:bg-muted/50',
                      option.value === currentTrackingStatus && 'ring-1 ring-primary/30'
                    )}
                    onClick={() => setSelectedTrackingStatus(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`tracking-${option.value}`} />
                    <div className="flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{option.icon}</span>
                        <div>
                          <Label
                            htmlFor={`tracking-${option.value}`}
                            className="font-medium cursor-pointer"
                          >
                            {option.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{option.description}</p>
                        </div>
                      </div>
                      {option.value === currentTrackingStatus && (
                        <Badge variant="outline" className="text-xs">Current</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTrackingStatus} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Tracking Status
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
