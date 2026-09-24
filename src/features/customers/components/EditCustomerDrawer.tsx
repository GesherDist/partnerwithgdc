'use client';

/**
 * EditCustomerModal Component
 *
 * Modal for editing an existing customer.
 * Fetches customer data and pre-fills the form.
 */

import { useEffect, useState } from 'react';
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
import { getCustomer, updateCustomerFromData } from '../actions';
import { customerToFormValues } from '../lib/schemas';
import type { Customer } from '../types';
import type { CustomerFormInput } from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface ServerErrors {
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

interface EditCustomerDrawerProps {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (customer: Customer) => void;
}

// ============================================
// COMPONENT
// ============================================

export function EditCustomerDrawer({
  customerId,
  open,
  onClose,
  onSuccess,
}: EditCustomerDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<ServerErrors | null>(null);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  useEffect(() => {
    if (open && customerId) {
      fetchCustomer();
    } else {
      setCustomer(null);
      setError(null);
      setServerErrors(null);
    }
  }, [open, customerId]);

  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const fetchCustomer = async () => {
    if (!customerId) {return;}

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCustomer(customerId);
      if (result.success && result.data) {
        setCustomer(result.data);
      } else {
        setError(result.error || 'Failed to load customer');
      }
    } catch {
      setError('Failed to load customer');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleUpdate = async (formData: CustomerFormInput) => {
    if (!customerId || !customer) {
      return;
    }

    setIsSubmitting(true);
    setServerErrors(null);

    try {
      const result = await updateCustomerFromData(customerId, formData);

      if (result.success && result.data) {
        toast.success(`Customer "${result.data.name}" updated successfully`);
        onSuccess?.(result.data);
        onClose();
      } else {
        // Set server errors for form display
        setServerErrors({
          message: result.error || 'Failed to update customer',
          fieldErrors: result.errors,
        });

        // Also show toast for visibility
        toast.error(result.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Update customer error:', error);
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
  // COMPUTED VALUES
  // ----------------------------------------

  const initialFormData = customer ? customerToFormValues(customer) : undefined;

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-4xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${customer?.name || 'Customer'}`}
          </DialogTitle>
          <DialogDescription>
            {customer?.customerCode || 'Update customer information'}
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
                <Button variant="outline" onClick={fetchCustomer} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : customer ? (
              <CustomerForm
                initialData={initialFormData}
                onSubmit={handleUpdate}
                isLoading={isSubmitting}
                mode="edit"
                serverErrors={serverErrors}
              />
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {customer && !isLoading && !error && (
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
                  form="customer-form"
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
