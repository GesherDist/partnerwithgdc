'use client';

/**
 * EditDealerLocationDialog Component
 *
 * Dialog for editing an existing dealer location.
 * Follows the same pattern as EditLocationDrawer from locations module.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as z from 'zod';

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
import { Input } from '@/shared/components/ui/input';
import { PhoneInput } from '@/shared/components/ui/phone-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Textarea } from '@/shared/components/ui/textarea';

import {
  updateDealerLocationAction,
  getDealerLocationByIdAction,
} from '@/features/platinum-dealers/actions';
import type { PlatinumDealerLocation } from '@/features/platinum-dealers/types';

// ============================================
// TYPES & SCHEMA
// ============================================

interface EditDealerLocationDialogProps {
  open: boolean;
  locationId: string | null;
  onClose: () => void;
  onSuccess?: (location: PlatinumDealerLocation) => void;
}

const locationFormSchema = z.object({
  locationName: z.string().min(1, 'Location name is required'),
  locationCode: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
});

type LocationFormValues = z.infer<typeof locationFormSchema>;

// ============================================
// COMPONENT
// ============================================

export function EditDealerLocationDialog({
  open,
  locationId,
  onClose,
  onSuccess,
}: EditDealerLocationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<PlatinumDealerLocation | null>(null);

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      locationName: '',
      locationCode: '',
      addressStreet: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: 'US',
      contactName: '',
      phone: '',
      email: '',
      notes: '',
    },
  });

  // Fetch location data when dialog opens
  useEffect(() => {
    async function loadLocation() {
      if (!locationId || !open) {
        return;
      }

      setIsLoading(true);
      try {
        const result = await getDealerLocationByIdAction(locationId);

        if (result.success && result.data) {
          setLocation(result.data);

          // Populate form with existing data
          form.reset({
            locationName: result.data.locationName,
            locationCode: result.data.locationCode || '',
            addressStreet: result.data.addressStreet || '',
            addressCity: result.data.addressCity || '',
            addressState: result.data.addressState || '',
            addressPostalCode: result.data.addressPostalCode || '',
            addressCountry: result.data.addressCountry || 'US',
            contactName: result.data.contactName || '',
            phone: result.data.phone || '',
            email: result.data.email || '',
            notes: result.data.notes || '',
          });
        } else {
          toast.error(result.error || 'Failed to load location');
          onClose();
        }
      } catch (error) {
        console.error('Error loading location:', error);
        toast.error('Failed to load location');
        onClose();
      } finally {
        setIsLoading(false);
      }
    }

    loadLocation();
  }, [locationId, open, onClose, form]);

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    form.reset();
    setLocation(null);
    onClose();
  };

  const handleSubmit = async (formData: LocationFormValues) => {
    if (!locationId) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateDealerLocationAction(locationId, {
        locationName: formData.locationName,
        locationCode: formData.locationCode || undefined,
        addressStreet: formData.addressStreet || undefined,
        addressCity: formData.addressCity || undefined,
        addressState: formData.addressState || undefined,
        addressPostalCode: formData.addressPostalCode || undefined,
        addressCountry: formData.addressCountry || 'US',
        contactName: formData.contactName || undefined,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        notes: formData.notes || undefined,
      });

      if (result.success && result.data) {
        toast.success(`Location "${result.data.locationName}" updated successfully`);
        form.reset();
        setLocation(null);
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
            Update location details for {location?.locationName || 'this dealer yard'}.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Form {...form}>
                <form id="location-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-base font-medium">Basic Information</h3>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="locationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location Name *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Kansas Yard" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="locationCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="KS-001" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-4">
                    <h3 className="text-base font-medium">Address</h3>

                    <FormField
                      control={form.control}
                      name="addressStreet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="1234 Main Street" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="addressCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Kansas City" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="addressState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="KS"
                                maxLength={2}
                                style={{ textTransform: 'uppercase' }}
                                onChange={(e) => {
                                  const value = e.target.value.toUpperCase();
                                  field.onChange(value);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="addressPostalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Zip Code</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="66101" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="addressCountry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="US" disabled />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-base font-medium">Contact Information</h3>

                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John Doe" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <PhoneInput {...field} placeholder="+1 (555) 000-0000" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="john@example.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-4">
                    <h3 className="text-base font-medium">Notes</h3>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Internal Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Add any additional notes about this location..."
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
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
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="location-form"
              disabled={isSubmitting || isLoading}
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
