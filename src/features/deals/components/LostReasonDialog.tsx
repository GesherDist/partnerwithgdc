'use client';

/**
 * LostReasonDialog
 *
 * Asks for one of the GDC lost reasons before a deal is marked lost.
 * The same reason text is sent to Pipedrive as the deal's lost_reason.
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { GDC_LOST_REASONS, type GdcLostReason } from '@/features/pipedrive/gdc/config';

interface LostReasonDialogProps {
  open: boolean;
  dealTitle?: string;
  submitting?: boolean;
  onConfirm: (reason: GdcLostReason) => void;
  onClose: () => void;
}

export function LostReasonDialog({ open, dealTitle, submitting, onConfirm, onClose }: LostReasonDialogProps) {
  const [reason, setReason] = useState<GdcLostReason | ''>('');

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setReason('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark deal as lost</DialogTitle>
          <DialogDescription>
            {dealTitle ? `Why was "${dealTitle}" lost?` : 'Why was this deal lost?'} A reason is required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="lost-reason">Lost reason</Label>
          <Select value={reason} onValueChange={(value) => setReason(value as GdcLostReason)}>
            <SelectTrigger id="lost-reason">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {GDC_LOST_REASONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!reason || submitting}
            onClick={() => reason && onConfirm(reason)}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark as lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
