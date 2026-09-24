'use client';

/**
 * CreateLocationDrawer Component
 *
 * Dialog for creating a new location with auto-generated code.
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

import { LocationForm } from './LocationForm';
import type { CreateLocationDrawerProps } from '../types';
import type { LocationFormInput } from '../lib/schemas';
import { createLocationWithAutoCode } from '../actions';

// ============================================
// COMPONENT
// ============================================

export function CreateLocationDrawer({
  open,
  onClose,
  onSuccess,
}: CreateLocationDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  const handleCreate = async (formData: LocationFormInput) => {
    setIsSubmitting(true);

    try {
      // Remove locationCode from form data since it's auto-generated
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { locationCode, ...dataWithoutCode } = formData;

      const result = await createLocationWithAutoCode(dataWithoutCode);

      if (result.success && result.data) {
        toast.success(`Location "${result.data.name}" created successfully`);
        onSuccess?.(result.data);
        onClose();
      } else {
        toast.error(result.error || 'Failed to create location');
      }
    } catch (error) {
      console.error('Create location error:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            Add Location
          </DialogTitle>
          <DialogDescription>
            Create a new warehouse or shipping location.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-4">
            <LocationForm
              initialData={{
                locationCode: 'AUTO',  // Placeholder - will be auto-generated on server
                name: '',
                locationType: 'warehouse',
                address1: null,
                address2: null,
                city: null,
                state: null,
                zip: null,
                country: 'US',
                contactName: null,
                contactPhone: null,
                contactEmail: null,
                isActive: true,
                isDefault: false,
              }}
              onCancel={handleCancel}
              onSubmit={handleCreate}
              isLoading={isSubmitting}
              submitLabel="Create Location"
              isCodeReadOnly
              hideButtons
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
              form="location-form"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Location
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
