'use client';

/**
 * Edit PO Load Status Dialog
 *
 * Simple dialog to edit Operations Dashboard tracking status (load_status)
 * Does NOT edit system PO status (draft/confirmed/etc.)
 * Works even for confirmed POs - only updates load_status field
 */

import { useState, useTransition } from 'react';
import { Loader2, Package } from 'lucide-react';

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
import { Badge } from '@/shared/components/ui/badge';
import { toast } from 'sonner';

import { updatePOLoadStatus } from '../actions';

// ============================================
// LOAD STATUS OPTIONS (Operations Dashboard)
// ============================================

// These are the statuses used in Operations Dashboard for tracking
// Different from system PO statuses (draft/sent/confirmed)
const LOAD_STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: 'bg-green-100 text-green-800' },
  { value: 'open', label: 'Open', color: 'bg-blue-100 text-blue-800' },
  { value: 'sold', label: 'Sold', color: 'bg-purple-100 text-purple-800' },
  { value: 'hold', label: 'Hold', color: 'bg-orange-100 text-orange-800' },
  { value: 'in_transit', label: 'In Transit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'invoiced', label: 'Invoiced', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'not_invoiced', label: 'Not Invoiced', color: 'bg-amber-100 text-amber-800' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
];

// ============================================
// TYPES
// ============================================

interface EditPOStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: string;
  poNumber: string;
  currentLoadStatus?: string | null;
  currentSystemStatus?: string; // Just for display, not editable
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function EditPOStatusDialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  currentLoadStatus,
  currentSystemStatus,
  onSuccess,
}: EditPOStatusDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [loadStatus, setLoadStatus] = useState<string>(currentLoadStatus || 'open');

  // Update local state when dialog opens with new PO
  useState(() => {
    if (open && currentLoadStatus) {
      setLoadStatus(currentLoadStatus);
    }
  });

  const handleSubmit = () => {
    if (!loadStatus) {
      toast.error('Please select a status');
      return;
    }

    startTransition(async () => {
      const result = await updatePOLoadStatus(poId, loadStatus);

      if (result.success) {
        toast.success('Status updated successfully', {
          description: `${poNumber} is now ${LOAD_STATUS_OPTIONS.find(s => s.value === loadStatus)?.label}`,
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

  const currentStatusOption = LOAD_STATUS_OPTIONS.find(
    s => s.value === (currentLoadStatus || 'open')
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Update Load Status
          </DialogTitle>
          <DialogDescription>
            Change tracking status for <span className="font-semibold">{poNumber}</span> in Operations Dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* System Status - Read Only Info Box */}
          {currentSystemStatus && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-900 mb-1.5">
                    PO Status (System)
                  </p>
                  <Badge variant="secondary" className="capitalize bg-blue-100 text-blue-700 border-blue-200">
                    {currentSystemStatus.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-[10px] text-blue-600 italic">Read-only</p>
              </div>
            </div>
          )}

          {/* Current vs New Status - Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Current Status */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Current Status
              </Label>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 flex items-center justify-center min-h-[42px]">
                <Badge
                  className={`${currentStatusOption?.color || 'bg-gray-100 text-gray-800'} border-0`}
                >
                  {currentStatusOption?.label || 'Open'}
                </Badge>
              </div>
            </div>

            {/* New Status */}
            <div className="space-y-2">
              <Label htmlFor="load-status" className="text-xs font-medium text-muted-foreground">
                New Status
              </Label>
              <Select value={loadStatus} onValueChange={setLoadStatus}>
                <SelectTrigger id="load-status" className="h-[42px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {LOAD_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`}
                        />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Help Text */}
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
            <p className="text-xs text-amber-800 leading-relaxed">
              💡 This status is used for tracking in Operations Dashboard and does not affect the system PO status.
            </p>
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
          <Button type="button" onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
