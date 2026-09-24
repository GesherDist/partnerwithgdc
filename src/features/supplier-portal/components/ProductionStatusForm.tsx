'use client';

/**
 * Production Status Form
 *
 * Dialog for supplier to update production status of a PO.
 */

import { useState, useTransition } from 'react';
import { Factory, Calendar, Loader2, Clock, Package, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { updateProductionStatusAction } from '../actions';
import type { SupplierPurchaseOrder, ProductionStatus } from '../types';

const PRODUCTION_STATUSES: {
  value: ProductionStatus;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    value: 'not_started',
    label: 'Not Started',
    description: 'Production has not begun',
    icon: Clock,
  },
  {
    value: 'in_production',
    label: 'In Production',
    description: 'Items are being manufactured',
    icon: Factory,
  },
  {
    value: 'ready_to_ship',
    label: 'Ready to Ship',
    description: 'Production complete, awaiting shipment',
    icon: Package,
  },
  {
    value: 'shipped',
    label: 'Shipped',
    description: 'Items have been shipped',
    icon: Truck,
  },
];

interface ProductionStatusFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: SupplierPurchaseOrder;
  onSuccess?: () => void;
}

export function ProductionStatusForm({
  open,
  onOpenChange,
  purchaseOrder,
  onSuccess,
}: ProductionStatusFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [productionStatus, setProductionStatus] = useState<ProductionStatus>(
    purchaseOrder.productionStatus
  );
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(
    purchaseOrder.expectedCompletionDate?.split('T')[0] || ''
  );
  const [supplierNotes, setSupplierNotes] = useState(
    purchaseOrder.supplierNotes || ''
  );

  const handleSubmit = () => {
    // Validate required field
    if (!expectedCompletionDate) {
      toast.error('Validation Error', {
        description: 'Expected Completion Date is required.',
      });
      return;
    }

    startTransition(async () => {
      const result = await updateProductionStatusAction({
        poId: purchaseOrder.id,
        productionStatus,
        expectedCompletionDate,
        supplierNotes: supplierNotes || undefined,
      });

      if (result.success) {
        toast.success('Status Updated', {
          description: 'Production status has been updated successfully.',
        });
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update status.',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-blue-600" />
            Update Production Status
          </DialogTitle>
          <DialogDescription>
            Update the production status for {purchaseOrder.poNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Selection */}
          <div className="space-y-3">
            <Label>Production Status</Label>
            <RadioGroup
              value={productionStatus}
              onValueChange={(value) => setProductionStatus(value as ProductionStatus)}
              className="grid gap-3"
            >
              {PRODUCTION_STATUSES.map((status) => {
                const Icon = status.icon;
                const isSelected = productionStatus === status.value;

                return (
                  <label
                    key={status.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={status.value} />
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{status.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {status.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Expected Completion Date - Required */}
          <div className="space-y-2">
            <Label htmlFor="expectedCompletionDate">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Expected Completion Date
                <span className="text-destructive">*</span>
              </span>
            </Label>
            <Input
              id="expectedCompletionDate"
              type="date"
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
              className={cn(!expectedCompletionDate && 'border-destructive')}
            />
            {!expectedCompletionDate && (
              <p className="text-sm text-destructive">This field is required</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="supplierNotes">Notes (Optional)</Label>
            <Textarea
              id="supplierNotes"
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              placeholder="Any updates or notes..."
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
          <Button onClick={handleSubmit} disabled={isPending || !expectedCompletionDate}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Status'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
