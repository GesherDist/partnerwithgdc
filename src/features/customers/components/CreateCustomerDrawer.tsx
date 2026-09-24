'use client';

/**
 * CreateCustomerModal Component
 *
 * Modal dialog for creating a new customer.
 * Uses the Dialog component from shadcn/ui.
 *
 * Contains:
 * - Header with title and close button
 * - Scrollable content area with CustomerForm
 * - Footer with action buttons
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

import { CustomerForm } from './CustomerForm';
import type { CreateCustomerDrawerProps } from '../types';
import type { CustomerFormInput } from '../lib/schemas';
import { createCustomerFromData } from '../actions';

// ============================================
// TYPES
// ============================================

interface ServerErrors {
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

// ============================================
// COMPONENT
// ============================================

export function CreateCustomerDrawer({
  open,
  onClose,
  onSuccess,
}: CreateCustomerDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<ServerErrors | null>(null);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    setServerErrors(null);
    onClose();
  };

  const handleCreate = async (formData: CustomerFormInput) => {
    setIsSubmitting(true);
    setServerErrors(null);

    try {
      const result = await createCustomerFromData(formData);

      if (result.success && result.data) {
        toast.success(`Customer "${result.data.name}" created successfully`);
        onSuccess?.(result.data);
        onClose();
      } else {
        // Set server errors for form display
        setServerErrors({
          message: result.error || 'Failed to create customer',
          fieldErrors: result.errors,
        });

        // Also show toast for visibility
        toast.error(result.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Create customer error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setServerErrors({
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-4xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            Add Customer
          </DialogTitle>
          <DialogDescription>
            Fill in the details to create a new customer.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-4">
            <CustomerForm
              onCancel={handleCancel}
              onSubmit={handleCreate}
              isLoading={isSubmitting}
              mode="create"
              serverErrors={serverErrors}
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
              form="customer-form"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Customer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
