'use client';

/**
 * CreateQuoteModal Component
 *
 * Modal dialog for creating a new quote.
 * Uses the Dialog component from shadcn/ui.
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
import { Skeleton } from '@/shared/components/ui/skeleton';

import { QuoteForm } from './QuoteForm';
import { createQuoteFromData, getQuoteMasterData } from '../actions';
import { formToCreateDTO, type QuoteFormInput } from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface CreateQuoteDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface MasterData {
  customers: Array<{
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    description: string | null;
    unitPrice: number;
    itemType: 'inventory' | 'non_inventory' | 'service';
  }>;
  salesReps: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  currentUserId: string;
}

// ============================================
// COMPONENT
// ============================================

export function CreateQuoteDrawer({ open, onClose, onSuccess }: CreateQuoteDrawerProps) {
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>(undefined);
  const [_isFormValid, setIsFormValid] = useState(false);

  // Fetch master data when drawer opens
  useEffect(() => {
    if (open) {
      setServerErrors(undefined);
      fetchMasterData();
    }
  }, [open]);

  const fetchMasterData = async () => {
    setIsLoading(true);
    try {
      const result = await getQuoteMasterData();
      if (result.success && result.data) {
        setMasterData(result.data);
      } else {
        toast.error('Failed to load form data');
        onClose();
      }
    } catch {
      toast.error('Failed to load form data');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: QuoteFormInput) => {
    setIsSubmitting(true);
    setServerErrors(undefined);
    try {
      const dto = formToCreateDTO(data);
      const result = await createQuoteFromData(dto);

      if (result.success) {
        toast.success('Quote created successfully');
        onSuccess?.();
        onClose();
      } else {
        // Set server errors for form display
        if (result.errors) {
          setServerErrors(result.errors);
          // Show detailed error toast
          const errorCount = Object.keys(result.errors).length;
          toast.error(`Validation failed: ${errorCount} field${errorCount > 1 ? 's' : ''} need${errorCount === 1 ? 's' : ''} correction`, {
            description: 'Please check the highlighted fields above.',
          });
        } else {
          toast.error(result.error || 'Failed to create quote');
        }
      }
    } catch {
      toast.error('Failed to create quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-6xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            Create Quote
          </DialogTitle>
          <DialogDescription>
            Fill in the details to create a new quote.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="space-y-8">
                {/* Info Section Skeleton */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-px w-full" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                {/* Address Section Skeleton */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-px w-full" />
                  <div className="grid grid-cols-2 gap-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                </div>
                {/* Items Section Skeleton */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-px w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            ) : masterData ? (
              <QuoteForm
                mode="create"
                initialData={{ salesRepId: masterData.currentUserId }}
                customers={masterData.customers}
                products={masterData.products}
                salesReps={masterData.salesReps}
                onSubmit={handleSubmit}
                onCancel={handleClose}
                isSubmitting={isSubmitting}
                serverErrors={serverErrors}
                onValidationChange={setIsFormValid}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  Failed to load form data. Please try again.
                </p>
                <Button variant="outline" onClick={fetchMasterData}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {!isLoading && masterData && (
          <>
            <Separator />
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <div className="flex w-full items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="quote-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Quote
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
