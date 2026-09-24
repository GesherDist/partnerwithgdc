'use client';

/**
 * CreateSalesOrderModal Component
 *
 * Modal dialog for creating a new sales order.
 * Uses the Dialog component from shadcn/ui.
 *
 * Contains:
 * - Header with title and close button
 * - Scrollable content area with SalesOrderForm
 * - Footer with action buttons
 */

import { useState, useRef } from 'react';
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

import { SalesOrderForm } from './SalesOrderForm';
import type { CreateSalesOrderDrawerProps } from '../types';
import { createSalesOrderFromData } from '../actions';

// ============================================
// COMPONENT
// ============================================

export function CreateSalesOrderDrawer({
  open,
  onClose,
  masterData,
}: CreateSalesOrderDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [_isFormValid, setIsFormValid] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formRef = useRef<{ getFormData: () => any | null }>(null);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleCancel = () => {
    if (isSubmitting || isSavingDraft) {return;}
    onClose();
  };

  const handleSaveDraft = async () => {
    // For now, use the same logic as create but with draft status
    // In the future, this could auto-save without validation
    const formData = formRef.current?.getFormData();
    if (!formData) {
      toast.error('Please fill in the required fields');
      return;
    }

    setIsSavingDraft(true);
    setServerErrors(undefined);
    try {
      const result = await createSalesOrderFromData({
        ...formData,
        status: 'draft',
      });

      if (result.success && result.data) {
        toast.success(`Draft order ${result.data.orderNumber} saved`);
        onClose();
      } else {
        toast.error(result.error || 'Failed to save draft');
        if (result.errors) {
          setServerErrors(result.errors);
          const errorCount = Object.keys(result.errors).length;
          toast.error(`Validation failed: ${errorCount} field${errorCount > 1 ? 's' : ''} need correction`);
        }
      }
    } catch (error) {
      console.error('Save draft error:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreate = async (formData: any) => {
    // Simple 1:1 creation - no splitting
    await createSingleOrder(formData);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createSingleOrder = async (formData: any) => {
    setIsSubmitting(true);
    setServerErrors(undefined);
    try {
      const result = await createSalesOrderFromData({
        ...formData,
        status: 'draft', // Always start as draft
      });

      if (result.success && result.data) {
        toast.success(`Sales order ${result.data.orderNumber} created successfully`);
        onClose();
      } else {
        toast.error(result.error || 'Failed to create sales order');
        if (result.errors) {
          setServerErrors(result.errors);
          const errorCount = Object.keys(result.errors).length;
          toast.error(`Validation failed: ${errorCount} field${errorCount > 1 ? 's' : ''} need correction`);
        }
      }
    } catch (error) {
      console.error('Create order error:', error);
      toast.error('Failed to create sales order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || isSavingDraft;

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <>
      <Dialog open={open} onOpenChange={handleCancel}>
        <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-[1400px] flex-col overflow-hidden p-0">
          {/* Header */}
          <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
            <DialogTitle className="text-xl font-semibold">
              Create Sales Order
            </DialogTitle>
            <DialogDescription>
              Fill in the details to create a new sales order.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 h-0 min-h-0">
            <div className="px-6 py-6">
              <SalesOrderForm
                masterData={masterData}
                onCancel={handleCancel}
                onSaveDraft={handleSaveDraft}
                onSubmit={handleCreate}
                onValidationChange={setIsFormValid}
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
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={isLoading}
              >
                {isSavingDraft && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Draft
              </Button>
              <Button
                type="submit"
                form="sales-order-form"
                disabled={isLoading}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Sales Order
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
