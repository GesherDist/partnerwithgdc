'use client';

/**
 * CreatePriceMatrixDrawer Component
 *
 * Dialog for creating a new price matrix entry.
 */

import { useState } from 'react';
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
import type { CreatePriceMatrixDrawerProps, PriceMatrixFormValues } from '../types';
import { createPriceMatrixEntry } from '../actions';

export function CreatePriceMatrixDrawer({
  open,
  productId,
  onClose,
  onSuccess,
}: CreatePriceMatrixDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = () => {
    if (isSubmitting) { return; }
    onClose();
  };

  const handleCreate = async (formData: PriceMatrixFormValues) => {
    setIsSubmitting(true);

    try {
      const result = await createPriceMatrixEntry(formData);

      if (result.success && result.data) {
        toast.success('Price tier created successfully');
        onSuccess?.(result.data);
        onClose();
      } else {
        toast.error(result.error || 'Failed to create price tier');
      }
    } catch (error) {
      console.error('Create price matrix error:', error);
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-lg flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            Add Price Tier
          </DialogTitle>
          <DialogDescription>
            Create a new pricing tier for this product.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-4">
            <PriceMatrixForm
              productId={productId}
              onSubmit={handleCreate}
              isLoading={isSubmitting}
              mode="create"
            />
          </div>
        </ScrollArea>

        {/* Footer */}
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
              Create Price Tier
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
