'use client';

/**
 * ApproveQuoteDialog Component
 *
 * Dialog for approving or rejecting a quote.
 * Includes a textarea for approval/rejection notes.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';

import { approveQuote, rejectQuoteApproval } from '../actions';

// ============================================
// TYPES
// ============================================

interface ApproveQuoteDialogProps {
  open: boolean;
  onClose: () => void;
  quoteId: string | null;
  quoteNumber: string | null;
  action: 'approve' | 'reject';
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function ApproveQuoteDialog({
  open,
  onClose,
  quoteId,
  quoteNumber,
  action,
  onSuccess,
}: ApproveQuoteDialogProps) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApprove = action === 'approve';
  const title = isApprove ? 'Approve Quote' : 'Reject Quote';
  const description = isApprove
    ? `Are you sure you want to approve quote ${quoteNumber}? Once approved, the quote can be converted to a sales order.`
    : `Are you sure you want to reject quote ${quoteNumber}? This action cannot be undone.`;
  const noteLabel = isApprove ? 'Approval Note (optional)' : 'Rejection Reason (optional)';
  const notePlaceholder = isApprove
    ? 'Enter any notes about this approval...'
    : 'Enter the reason for rejection...';
  const submitLabel = isApprove ? 'Approve Quote' : 'Reject Quote';

  const handleSubmit = async () => {
    if (!quoteId) { return; }

    setIsSubmitting(true);
    try {
      const result = isApprove
        ? await approveQuote(quoteId, note || null)
        : await rejectQuoteApproval(quoteId, note || null);

      if (result.success) {
        toast.success(
          isApprove
            ? `Quote ${quoteNumber} approved successfully`
            : `Quote ${quoteNumber} rejected`
        );
        handleClose();
        onSuccess?.();
      } else {
        toast.error(result.error || `Failed to ${action} quote`);
      }
    } catch {
      toast.error(`Failed to ${action} quote`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNote('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="note">{noteLabel}</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={notePlaceholder}
              rows={3}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isApprove ? 'Approving...' : 'Rejecting...'}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
