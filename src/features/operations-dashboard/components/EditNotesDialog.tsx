'use client';

/**
 * Edit Notes Dialog Component
 *
 * Quick dialog to edit Action Required / Notes field on shipments.
 * Designed for fast note updates without opening full edit dialog.
 */

import { useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';

import { updateShipmentNotes, updateSalesOrderNotes } from '../actions';
import type { ImmediateAttentionItem } from '../types';

// ============================================
// TYPES
// ============================================

interface EditNotesDialogProps {
  item: ImmediateAttentionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function EditNotesDialog({
  item,
  open,
  onOpenChange,
  onSuccess,
}: EditNotesDialogProps) {
  const [notes, setNotes] = useState(item?.actionRequired || '');
  const [isSaving, setIsSaving] = useState(false);

  // Reset notes when item changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && item) {
      setNotes(item.actionRequired || '');
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    if (!item) return;

    setIsSaving(true);
    try {
      // Determine if this is a shipment (SH-) or sales order (SO-)
      const isShipment = item.loadNumber.startsWith('SH-');

      const result = isShipment
        ? await updateShipmentNotes(item.id, notes.trim())
        : await updateSalesOrderNotes(item.id, notes.trim());

      if (result.success) {
        toast.success('Notes updated', {
          description: 'Action required notes have been saved.',
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update notes.',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'An unexpected error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Edit Notes
          </DialogTitle>
          <DialogDescription>
            {item.loadNumber} - {item.customer}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="notes">Action Required / Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter notes, action items, or follow-up tasks..."
              className="min-h-[120px] resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Examples: &quot;LFD tomorrow - carrier will contact&quot;, &quot;Waiting for Seaair update&quot;
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Notes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
