'use client';

/**
 * Reject PO Dialog
 *
 * Dialog for supplier to reject a purchase order.
 */

import { useState, useTransition } from 'react';
import { XCircle, Loader2, AlertTriangle } from 'lucide-react';
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
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { rejectPurchaseOrderAction } from '../actions';

interface RejectPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
  poNumber: string;
  onSuccess?: () => void;
}

export function RejectPODialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  onSuccess,
}: RejectPODialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }

    setError('');
    startTransition(async () => {
      const result = await rejectPurchaseOrderAction({
        poId,
        rejectionReason: rejectionReason.trim(),
      });

      if (result.success) {
        toast.success('Order Rejected', {
          description: `${poNumber} has been rejected.`,
        });
        onOpenChange(false);
        onSuccess?.();
        router.refresh();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to reject order.',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Reject Purchase Order
          </DialogTitle>
          <DialogDescription>
            You are about to reject {poNumber}. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              Rejecting this order will notify the buyer and they may need to find
              an alternative supplier.
            </p>
          </div>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rejectionReason">
              Reason for Rejection <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                if (error) {
                  setError('');
                }
              }}
              placeholder="Please explain why you cannot fulfill this order..."
              rows={4}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
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
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Reject Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
