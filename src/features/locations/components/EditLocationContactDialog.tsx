'use client';

/**
 * EditLocationContactDialog Component
 *
 * Dialog for editing a location contact.
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';

import type { EditLocationContactDialogProps } from '../types';
import type { LocationContact } from '../repositories/location-contacts.repository';
import { getLocationContact, updateLocationContact } from '../actions/location-contacts';

// ============================================
// SCHEMA
// ============================================

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  isActive: z.boolean(),
});

type ContactFormValues = z.infer<typeof contactSchema>;

// ============================================
// COMPONENT
// ============================================

export function EditLocationContactDialog({
  open,
  contactId,
  onClose,
  onSuccess,
}: EditLocationContactDialogProps) {
  const [contact, setContact] = useState<LocationContact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      isActive: true,
    },
  });

  // Fetch contact details
  const fetchContact = useCallback(async () => {
    if (!contactId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getLocationContact(contactId);
      if (result.success && result.data) {
        setContact(result.data);
        form.reset({
          name: result.data.name,
          email: result.data.email,
          phone: result.data.phone || '',
          isActive: result.data.isActive,
        });
      } else {
        setError(result.error || 'Failed to load contact');
      }
    } catch (err) {
      console.error('Error fetching contact:', err);
      setError('Failed to load contact');
    } finally {
      setIsLoading(false);
    }
  }, [contactId, form]);

  useEffect(() => {
    if (open && contactId) {
      fetchContact();
    } else {
      setContact(null);
      setError(null);
      form.reset();
    }
  }, [open, contactId, fetchContact, form]);

  const handleSubmit = async (values: ContactFormValues) => {
    if (!contactId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateLocationContact(contactId, {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        isActive: values.isActive,
      });

      if (result.success) {
        toast.success(`${values.name} has been updated`);
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to update contact');
      }
    } catch (err) {
      console.error('Error updating contact:', err);
      toast.error('Failed to update contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Contact
          </DialogTitle>
          <DialogDescription>
            {isLoading ? 'Loading...' : contact?.name || 'Update contact details'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchContact} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : contact ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormDescription>
                      Pick ticket notifications will be sent to this email.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+1 555 000 1234" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5 pr-4">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        Only active contacts receive email notifications.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
