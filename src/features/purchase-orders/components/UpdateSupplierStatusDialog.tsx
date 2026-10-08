'use client';

/**
 * Update Supplier Status Dialog
 *
 * Updates the shipment load_status (AVAILABLE, OPEN, SOLD, IN_TRANSIT, etc.)
 * This is the "Shipment Status" shown in the Purchase Orders table
 */

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Truck, Package, CheckCircle2, Clock, AlertCircle, FileText, DollarSign } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

import { updateShipmentLoadStatus } from '../actions';

// ============================================
// LOAD STATUS OPTIONS
// ============================================

// Database enum values are lowercase
type LoadStatus =
  | 'available'
  | 'open'
  | 'hold'
  | 'in_transit'
  | 'sold'
  | 'invoiced'
  | 'closed';

const LOAD_STATUS_OPTIONS: {
  value: LoadStatus;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: 'available',
    label: 'Available',
    description: 'Inventory available for sale',
    icon: Package,
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  {
    value: 'open',
    label: 'Open',
    description: 'Order in progress, not yet shipped',
    icon: Clock,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    value: 'hold',
    label: 'Hold',
    description: 'Order on hold, requires attention',
    icon: AlertCircle,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    value: 'in_transit',
    label: 'In Transit',
    description: 'Shipment is on the way',
    icon: Truck,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  {
    value: 'sold',
    label: 'Sold',
    description: 'Items sold, pending delivery',
    icon: DollarSign,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  {
    value: 'invoiced',
    label: 'Invoiced',
    description: 'Invoice generated',
    icon: FileText,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  {
    value: 'closed',
    label: 'Closed',
    description: 'Order completed and closed',
    icon: CheckCircle2,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
];

// ============================================
// TYPES
// ============================================

interface UpdateSupplierStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
  poNumber: string;
  currentStatus: string | null;
  shipmentId?: string | null;
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function UpdateSupplierStatusDialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  currentStatus,
  shipmentId,
  onSuccess,
}: UpdateSupplierStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedStatus, setSelectedStatus] = useState<LoadStatus | null>(null);

  // Reset selected status when dialog opens
  useEffect(() => {
    if (open) {
      // Try to match current status to our options (convert to lowercase)
      const normalizedStatus = currentStatus?.toLowerCase()?.replace(/[^a-z_]/g, '') as LoadStatus;
      const matchedOption = LOAD_STATUS_OPTIONS.find(opt => opt.value === normalizedStatus);
      setSelectedStatus(matchedOption?.value || null);
    }
  }, [open, currentStatus]);

  const handleSubmit = () => {
    if (!selectedStatus) {
      toast.error('Please select a status');
      return;
    }

    startTransition(async () => {
      const result = await updateShipmentLoadStatus(poId, selectedStatus, shipmentId || undefined);

      if (result.success) {
        const statusOption = LOAD_STATUS_OPTIONS.find(s => s.value === selectedStatus);
        toast.success('Status updated successfully', {
          description: `${poNumber} shipment status is now "${statusOption?.label}"`,
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        toast.error('Failed to update status', {
          description: result.error || 'Please try again',
        });
      }
    });
  };

  const currentOption = LOAD_STATUS_OPTIONS.find(
    opt => opt.value === currentStatus?.toLowerCase()?.replace(/[^a-z_]/g, '')
  );

  const hasShipment = !!shipmentId || currentStatus !== 'No shipment';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Update Shipment Status
          </DialogTitle>
          <DialogDescription>
            Change shipment status for <span className="font-semibold">{poNumber}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Status Display */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Current Status</Label>
            <div className="flex items-center gap-2">
              {hasShipment && currentOption ? (
                <Badge variant="outline" className={cn('text-sm', currentOption.color)}>
                  {currentOption.label}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-600">
                  {currentStatus || 'No shipment'}
                </Badge>
              )}
            </div>
          </div>

          {/* No Shipment Warning */}
          {!hasShipment && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-800">
                ⚠️ No shipment exists for this PO. A shipment will be created when you select a status.
              </p>
            </div>
          )}

          {/* Status Selection */}
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground">Select New Status</Label>
            <RadioGroup
              value={selectedStatus || ''}
              onValueChange={(value) => setSelectedStatus(value as LoadStatus)}
              className="grid gap-2"
            >
              {LOAD_STATUS_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedStatus === option.value;
                const isCurrent = currentOption?.value === option.value;

                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-all',
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                      isCurrent && !isSelected && 'border-dashed'
                    )}
                  >
                    <RadioGroupItem value={option.value} className="sr-only" />
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full',
                      isSelected ? 'bg-blue-100' : 'bg-gray-100'
                    )}>
                      <Icon className={cn(
                        'h-4 w-4',
                        isSelected ? 'text-blue-600' : 'text-gray-500'
                      )} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'font-medium text-sm',
                          isSelected ? 'text-blue-900' : 'text-gray-900'
                        )}>
                          {option.label}
                        </span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    )}
                  </label>
                );
              })}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !selectedStatus || selectedStatus === currentOption?.value}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
