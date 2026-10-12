'use client';

/**
 * Edit PO Status Dialog V2
 *
 * Sequential flow for editing PO status:
 * 1. Check if Supplier has confirmed the PO
 * 2. If confirmed → Show Production Status (Not Started → In Production → Ready to Ship → Shipped)
 * 3. After Shipped → Show Shipment/Load Status (Available → Open → Hold → In Transit → Sold → Invoiced → Closed)
 */

import { useState, useTransition, useEffect } from 'react';
import {
  Loader2,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  Factory,
  PackageCheck,
  Ship,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';

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

import { updatePOProductionStatus, updateShipmentLoadStatus } from '../actions';

// ============================================
// TYPES
// ============================================

type ProductionStatus = 'not_started' | 'in_production' | 'ready_to_ship' | 'shipped';
type LoadStatus = 'available' | 'open' | 'hold' | 'in_transit' | 'sold' | 'invoiced' | 'closed';
// Extended load status from POListItem (includes additional operations dashboard statuses)
type ExtendedLoadStatus = LoadStatus | 'not_invoiced' | 'po_needed' | 'partially_paid' | 'paid' | 'disputed' | null;

interface EditPOStatusDialogV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
  poNumber: string;
  // Supplier confirmation
  supplierConfirmedAt: string | null;
  // Current statuses
  currentProductionStatus: ProductionStatus | null;
  currentLoadStatus: ExtendedLoadStatus;
  // Shipment info
  shipmentId?: string | null;
  onSuccess?: () => void;
}

// ============================================
// STATUS OPTIONS
// ============================================

const PRODUCTION_STATUS_OPTIONS: {
  value: ProductionStatus;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  {
    value: 'not_started',
    label: 'Not Started',
    description: 'Production has not begun',
    icon: Clock,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  {
    value: 'in_production',
    label: 'In Production',
    description: 'Items are being manufactured',
    icon: Factory,
    color: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  {
    value: 'ready_to_ship',
    label: 'Ready to Ship',
    description: 'Production complete, awaiting shipment',
    icon: PackageCheck,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  {
    value: 'shipped',
    label: 'Shipped',
    description: 'Items have been shipped',
    icon: Ship,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
];

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

// Extended status labels for display-only (operations dashboard statuses)
const EXTENDED_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_invoiced: { label: 'Not Invoiced', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  po_needed: { label: 'PO Needed', color: 'bg-red-100 text-red-700 border-red-200' },
  partially_paid: { label: 'Partially Paid', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700 border-green-200' },
  disputed: { label: 'Disputed', color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

// ============================================
// COMPONENT
// ============================================

export function EditPOStatusDialogV2({
  open,
  onOpenChange,
  poId,
  poNumber,
  supplierConfirmedAt,
  currentProductionStatus,
  currentLoadStatus,
  shipmentId,
  onSuccess,
}: EditPOStatusDialogV2Props) {
  const [isPending, startTransition] = useTransition();

  // Determine which step to show
  const isSupplierConfirmed = !!supplierConfirmedAt;
  const isShipped = currentProductionStatus === 'shipped';

  // State for selections
  const [selectedProductionStatus, setSelectedProductionStatus] = useState<ProductionStatus | null>(null);
  const [selectedLoadStatus, setSelectedLoadStatus] = useState<LoadStatus | null>(null);

  // Current step: 'confirmation' | 'production' | 'shipment'
  const [currentStep, setCurrentStep] = useState<'confirmation' | 'production' | 'shipment'>('confirmation');

  // Helper to check if a status is a base LoadStatus
  const isBaseLoadStatus = (status: ExtendedLoadStatus): status is LoadStatus => {
    const baseStatuses: LoadStatus[] = ['available', 'open', 'hold', 'in_transit', 'sold', 'invoiced', 'closed'];
    return status !== null && baseStatuses.includes(status as LoadStatus);
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedProductionStatus(currentProductionStatus);
      // Only set selectedLoadStatus if it's a base LoadStatus (not extended like 'paid', 'disputed')
      setSelectedLoadStatus(isBaseLoadStatus(currentLoadStatus) ? currentLoadStatus : null);

      // Determine initial step
      if (!isSupplierConfirmed) {
        setCurrentStep('confirmation');
      } else if (!isShipped) {
        setCurrentStep('production');
      } else {
        setCurrentStep('shipment');
      }
    }
  }, [open, currentProductionStatus, currentLoadStatus, isSupplierConfirmed, isShipped]);

  // Handle production status update
  const handleUpdateProductionStatus = () => {
    if (!selectedProductionStatus) {
      toast.error('Please select a production status');
      return;
    }

    startTransition(async () => {
      const result = await updatePOProductionStatus(poId, selectedProductionStatus);

      if (result.success) {
        const statusOption = PRODUCTION_STATUS_OPTIONS.find(s => s.value === selectedProductionStatus);
        toast.success('Production status updated', {
          description: `${poNumber} is now "${statusOption?.label}"`,
        });

        // If shipped, move to shipment status step
        if (selectedProductionStatus === 'shipped') {
          setCurrentStep('shipment');
        } else {
          onSuccess?.();
          onOpenChange(false);
        }
      } else {
        toast.error('Failed to update status', {
          description: result.error || 'Please try again',
        });
      }
    });
  };

  // Handle load status update
  const handleUpdateLoadStatus = () => {
    if (!selectedLoadStatus) {
      toast.error('Please select a shipment status');
      return;
    }

    startTransition(async () => {
      const result = await updateShipmentLoadStatus(poId, selectedLoadStatus, shipmentId || undefined);

      if (result.success) {
        const statusOption = LOAD_STATUS_OPTIONS.find(s => s.value === selectedLoadStatus);
        toast.success('Shipment status updated', {
          description: `${poNumber} shipment is now "${statusOption?.label}"`,
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

  // Get current production status option
  const currentProductionOption = PRODUCTION_STATUS_OPTIONS.find(
    opt => opt.value === currentProductionStatus
  );

  // Get current load status option - check base options first, then extended
  const currentLoadOption = LOAD_STATUS_OPTIONS.find(
    opt => opt.value === currentLoadStatus
  );

  // Get extended status info if not a base status
  const extendedStatusInfo = currentLoadStatus && !currentLoadOption && EXTENDED_STATUS_LABELS[currentLoadStatus]
    ? EXTENDED_STATUS_LABELS[currentLoadStatus]
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Edit Status
          </DialogTitle>
          <DialogDescription>
            Update status for <span className="font-semibold">{poNumber}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-2 px-1 mb-2">
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
            currentStep === 'confirmation' || !isSupplierConfirmed
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          )}>
            {isSupplierConfirmed ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            Confirmation
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
            currentStep === 'production'
              ? "bg-blue-100 text-blue-700"
              : isShipped
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          )}>
            {isShipped ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Factory className="h-3.5 w-3.5" />
            )}
            Production
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full",
            currentStep === 'shipment'
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500"
          )}>
            <Truck className="h-3.5 w-3.5" />
            Shipment
          </div>
        </div>

        <div className="space-y-4 py-2">
          {/* Step 1: Supplier Confirmation Check */}
          {currentStep === 'confirmation' && !isSupplierConfirmed && (
            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-amber-100 p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-800 mb-1">
                    Awaiting Supplier Confirmation
                  </h4>
                  <p className="text-sm text-amber-700 mb-3">
                    This Purchase Order has not been confirmed by the supplier yet.
                    The supplier needs to accept or reject this order from their Supplier Portal.
                  </p>
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Status will update automatically when supplier responds</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Production Status */}
          {currentStep === 'production' && isSupplierConfirmed && (
            <>
              {/* Current Status Display */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Current Production Status</Label>
                <div className="flex items-center gap-2">
                  {currentProductionOption ? (
                    <Badge variant="outline" className={cn('text-sm', currentProductionOption.color)}>
                      {currentProductionOption.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-600">
                      Not Started
                    </Badge>
                  )}
                </div>
              </div>

              {/* Status Selection */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground">Update Production Status</Label>
                <RadioGroup
                  value={selectedProductionStatus || ''}
                  onValueChange={(value) => setSelectedProductionStatus(value as ProductionStatus)}
                  className="grid gap-2"
                >
                  {PRODUCTION_STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedProductionStatus === option.value;
                    const isCurrent = currentProductionOption?.value === option.value;

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

              {/* Info about shipped */}
              {selectedProductionStatus === 'shipped' && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Note:</strong> After marking as &quot;Shipped&quot;, you can update the Shipment Status (Available, In Transit, Invoiced, etc.)
                  </p>
                </div>
              )}
            </>
          )}

          {/* Step 3: Shipment/Load Status */}
          {currentStep === 'shipment' && isShipped && (
            <>
              {/* Success message for shipped */}
              <div className="rounded-md bg-green-50 border border-green-200 p-3 mb-2">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Order has been shipped!</span>
                </div>
                <p className="text-xs text-green-700 mt-1 ml-6">
                  Now update the shipment tracking status below.
                </p>
              </div>

              {/* Current Status Display */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Current Shipment Status</Label>
                <div className="flex items-center gap-2">
                  {currentLoadOption ? (
                    <Badge variant="outline" className={cn('text-sm', currentLoadOption.color)}>
                      {currentLoadOption.label}
                    </Badge>
                  ) : extendedStatusInfo ? (
                    <Badge variant="outline" className={cn('text-sm', extendedStatusInfo.color)}>
                      {extendedStatusInfo.label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-600">
                      No Status
                    </Badge>
                  )}
                </div>
              </div>

              {/* Status Selection */}
              <div className="space-y-3">
                <Label className="text-xs font-medium text-muted-foreground">Update Shipment Status</Label>
                <RadioGroup
                  value={selectedLoadStatus || ''}
                  onValueChange={(value) => setSelectedLoadStatus(value as LoadStatus)}
                  className="grid gap-2 max-h-[300px] overflow-y-auto pr-1"
                >
                  {LOAD_STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedLoadStatus === option.value;
                    const isCurrent = currentLoadOption?.value === option.value;

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
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {currentStep === 'confirmation' && !isSupplierConfirmed ? 'Close' : 'Cancel'}
          </Button>

          {/* Production Status Button */}
          {currentStep === 'production' && isSupplierConfirmed && (
            <Button
              type="button"
              onClick={handleUpdateProductionStatus}
              disabled={isPending || !selectedProductionStatus || selectedProductionStatus === currentProductionStatus}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedProductionStatus === 'shipped' ? 'Mark as Shipped' : 'Update Status'}
            </Button>
          )}

          {/* Shipment Status Button */}
          {currentStep === 'shipment' && isShipped && (
            <Button
              type="button"
              onClick={handleUpdateLoadStatus}
              disabled={isPending || !selectedLoadStatus || selectedLoadStatus === currentLoadStatus}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Shipment Status
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
