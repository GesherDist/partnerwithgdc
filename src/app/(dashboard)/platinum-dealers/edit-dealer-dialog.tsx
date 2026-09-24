'use client';

/**
 * EditDealerDialog Component
 *
 * Modal dialog for editing an existing platinum dealer.
 * Fetches current dealer data and allows updating.
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Building2, User, MapPin } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

import {
  getDealerByIdAction,
  updateDealerAction,
} from '@/features/platinum-dealers/actions';

// ============================================
// VALIDATION SCHEMA
// ============================================

const dealerSchema = z.object({
  dealerName: z.string().min(1, 'Dealer name is required'),
  code: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCountry: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  notes: z.string().optional(),
});

type DealerFormData = z.infer<typeof dealerSchema>;

// ============================================
// TYPES
// ============================================

interface EditDealerDialogProps {
  dealerId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function EditDealerDialog({
  dealerId,
  open,
  onClose,
  onSuccess,
}: EditDealerDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DealerFormData>({
    resolver: zodResolver(dealerSchema),
    defaultValues: {
      dealerName: '',
      code: '',
      contactName: '',
      email: '',
      phone: '',
      addressStreet: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: 'US',
      status: 'active',
      notes: '',
    },
  });

  // ----------------------------------------
  // DATA LOADING
  // ----------------------------------------

  useEffect(() => {
    async function loadDealer() {
      if (!dealerId) {
        return;
      }

      setIsLoading(true);
      try {
        const result = await getDealerByIdAction(dealerId);

        if (result.success && result.data) {
          const dealer = result.data;
          form.reset({
            dealerName: dealer.dealerName,
            code: dealer.code || '',
            contactName: dealer.contactName || '',
            email: dealer.email || '',
            phone: dealer.phone || '',
            addressStreet: dealer.addressStreet || '',
            addressCity: dealer.addressCity || '',
            addressState: dealer.addressState || '',
            addressPostalCode: dealer.addressPostalCode || '',
            addressCountry: dealer.addressCountry || 'US',
            status: dealer.status,
            notes: dealer.notes || '',
          });
        } else {
          toast.error(result.error || 'Failed to load dealer');
          onClose();
        }
      } catch (error) {
        console.error('Error loading dealer:', error);
        toast.error('Failed to load dealer');
        onClose();
      } finally {
        setIsLoading(false);
      }
    }

    if (open && dealerId) {
      loadDealer();
    }
  }, [dealerId, open, onClose, form]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const onSubmit = async (data: DealerFormData) => {
    if (!dealerId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateDealerAction(dealerId, data);

      if (result.success) {
        toast.success('Dealer updated successfully');
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(result.error || 'Failed to update dealer');
      }
    } catch (error) {
      console.error('Error updating dealer:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      form.reset();
      onClose();
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Edit Dealer</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    <Building2 className="h-4 w-4" />
                    Basic Information
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dealerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Dealer Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="ABC Tire Distributors" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Code</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    <User className="h-4 w-4" />
                    Contact Information
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} />
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
                            <Input type="email" placeholder="john@example.com" {...field} />
                          </FormControl>
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
                            <Input placeholder="+1-555-0123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    <MapPin className="h-4 w-4" />
                    Address
                  </h3>

                  <FormField
                    control={form.control}
                    name="addressStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="addressCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Kansas City" {...field} />
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
                            <Input placeholder="MO" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="addressPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Postal Code</FormLabel>
                          <FormControl>
                            <Input placeholder="64105" {...field} />
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
                            <Input placeholder="US" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Payment terms, special arrangements, etc."
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting || isLoading}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Dealer'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
