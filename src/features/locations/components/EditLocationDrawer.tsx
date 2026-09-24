'use client';

/**
 * EditLocationDrawer Component
 *
 * Dialog for editing an existing location.
 */

import { useState, useEffect, useCallback } from 'react';
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
import type { EditLocationDrawerProps, Location } from '../types';
import type { LocationFormInput } from '../lib/schemas';
import { formToCreateDTO } from '../lib/schemas';
import { getLocation, updateLocationFromData } from '../actions';

// ============================================
// COMPONENT
// ============================================

export function EditLocationDrawer({
  open,
  locationId,
  onClose,
  onSuccess,
}: EditLocationDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch location data
  const fetchLocation = useCallback(async () => {
    if (!locationId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getLocation(locationId);
      if (result.success && result.data) {
        setLocation(result.data);
      } else {
        setError(result.error || 'Failed to load location');
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setError('Failed to load location');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open && locationId) {
      fetchLocation();
    } else {
      setLocation(null);
      setError(null);
    }
  }, [open, locationId, fetchLocation]);

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  const handleUpdate = async (formData: LocationFormInput) => {
    if (!locationId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const dto = formToCreateDTO(formData);
      const result = await updateLocationFromData(locationId, dto);

      if (result.success && result.data) {
        toast.success(`Location "${result.data.name}" updated successfully`);
        onSuccess?.(result.data);
        onClose();
      } else {
        toast.error(result.error || 'Failed to update location');
      }
    } catch (error) {
      console.error('Update location error:', error);
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
            Edit Location
          </DialogTitle>
          <DialogDescription>
            Update location details.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-4">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center py-12">
                <p className="text-destructive">{error}</p>
              </div>
            )}

            {!isLoading && !error && location && (
              <LocationForm
                initialData={location}
                onCancel={handleCancel}
                onSubmit={handleUpdate}
                isLoading={isSubmitting}
                submitLabel="Update Location"
                isCodeReadOnly
                hideButtons
              />
            )}
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
              disabled={isSubmitting || isLoading || !location}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Location
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
