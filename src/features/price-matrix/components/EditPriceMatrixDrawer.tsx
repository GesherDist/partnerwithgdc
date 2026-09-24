'use client';

/**
 * EditPriceMatrixDrawer Component
 *
 * Dialog for editing an existing price matrix entry.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';

import { PriceMatrixForm } from './PriceMatrixForm';
import type { EditPriceMatrixDrawerProps, PriceMatrixFormValues, PriceMatrixWithProduct } from '../types';
import { getPriceMatrixEntry, updatePriceMatrixEntry } from '../actions';
import { entityToFormValues } from '../lib/schemas';

export function EditPriceMatrixDrawer({
  open,
  entryId,
  onClose,
  onSuccess,
}: EditPriceMatrixDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entry, setEntry] = useState<PriceMatrixWithProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch entry data when drawer opens
  useEffect(() => {
    if (open && entryId) {
      fetchEntry();
    } else {
      setEntry(null);
      setError(null);
    }
  }, [open, entryId]);

  const fetchEntry = async () => {
    if (!entryId) { return; }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPriceMatrixEntry(entryId);
      if (result.success && result.data) {
        setEntry(result.data);
      } else {
        setError(result.error || 'Failed to load price entry');
      }
    } catch {
      setError('Failed to load price entry');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting) { return; }
    onClose();
  };

  const handleUpdate = async (formData: PriceMatrixFormValues) => {
    if (!entryId) { return; }

    setIsSubmitting(true);

    try {
      const result = await updatePriceMatrixEntry(entryId, formData);

      if (result.success && result.data) {
        toast.success('Price tier updated successfully');
        onSuccess?.(result.data);
        onClose();
      } else {
        toast.error(result.error || 'Failed to update price tier');
      }
    } catch (error) {
      console.error('Update price matrix error:', error);
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialFormData = entry ? entityToFormValues(entry) : undefined;

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-lg flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : 'Edit Price Tier'}
          </DialogTitle>
          <DialogDescription>
            {entry
              ? `${entry.channel.toUpperCase()} - Qty ${entry.minQuantity}${entry.maxQuantity ? `-${entry.maxQuantity}` : '+'}`
              : 'Update price tier details'}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={fetchEntry} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : entry ? (
              <PriceMatrixForm
                productId={entry.productId}
                initialData={initialFormData}
                onSubmit={handleUpdate}
                isLoading={isSubmitting}
                mode="edit"
              />
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {entry && !isLoading && !error && (
          <>
            <Separator />
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <div className="flex w-full items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="price-matrix-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
