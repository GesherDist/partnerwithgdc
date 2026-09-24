'use client';

/**
 * Confirm PO Dialog
 *
 * Dialog for supplier to accept/confirm a purchase order.
 */

import { useState, useTransition } from 'react';
import { CheckCircle2, Calendar, Loader2, FileText } from 'lucide-react';
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
import { toast } from 'sonner';
import { confirmPurchaseOrderAction } from '../actions';

interface ConfirmPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
  poNumber: string;
  onSuccess?: () => void;
}

export function ConfirmPODialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  onSuccess,
}: ConfirmPODialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [supplierReferenceNumber, setSupplierReferenceNumber] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await confirmPurchaseOrderAction({
        poId,
        supplierReferenceNumber: supplierReferenceNumber || undefined,
        expectedCompletionDate: expectedCompletionDate || undefined,
        supplierNotes: supplierNotes || undefined,
      });

      if (result.success) {
        toast.success('Order Confirmed', {
          description: `${poNumber} has been confirmed. Shipment record created.`,
        });
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to confirm order.',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Confirm Purchase Order
          </DialogTitle>
          <DialogDescription>
            You are about to accept {poNumber}. This confirms that you will fulfill
            this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="supplierReferenceNumber">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Your Sales Order # (Optional)
              </span>
            </Label>
            <Input
              id="supplierReferenceNumber"
              type="text"
              value={supplierReferenceNumber}
              onChange={(e) => setSupplierReferenceNumber(e.target.value)}
              placeholder="e.g., SO2600028"
            />
            <p className="text-xs text-muted-foreground">
              Your internal sales order or reference number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedCompletionDate">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Expected Completion Date
              </span>
            </Label>
            <Input
              id="expectedCompletionDate"
              type="date"
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              When do you expect to complete production?
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplierNotes">Notes (Optional)</Label>
            <Textarea
              id="supplierNotes"
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              placeholder="Any notes for the buyer..."
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
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Confirm Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
