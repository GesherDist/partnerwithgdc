'use client';

/**
 * EditInvoiceDrawer Component
 *
 * Drawer for editing invoice details (dates, address, notes).
 * Items cannot be edited - only header fields.
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { useInvoice } from '../hooks/useInvoice';
import { updateInvoice } from '../actions';
import type { EditInvoiceDrawerProps } from '../types';

// ============================================
// FORM SCHEMA
// ============================================

const editInvoiceFormSchema = z.object({
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  billingAddressStreet: z.string().optional(),
  billingAddressCity: z.string().optional(),
  billingAddressState: z.string().optional(),
  billingAddressPostalCode: z.string().optional(),
  billingAddressCountry: z.string().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  paymentNotes: z.string().optional(),
});

type EditInvoiceFormValues = z.infer<typeof editInvoiceFormSchema>;

// Payment terms options
const PAYMENT_TERMS = [
  { value: '', label: 'No terms specified' },
  { value: 'NET_7', label: 'Net 7 Days' },
  { value: 'NET_15', label: 'Net 15 Days' },
  { value: 'NET_30', label: 'Net 30 Days' },
  { value: 'NET_45', label: 'Net 45 Days' },
  { value: 'NET_60', label: 'Net 60 Days' },
  { value: 'NET_90', label: 'Net 90 Days' },
  { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt' },
  { value: 'PREPAID', label: 'Prepaid' },
];

// ============================================
// COMPONENT
// ============================================

export function EditInvoiceDrawer({
  open,
  onClose,
  invoiceId,
  onSuccess,
}: EditInvoiceDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: invoice, isLoading, refetch } = useInvoice(open ? invoiceId : null);

  const form = useForm<EditInvoiceFormValues>({
    resolver: zodResolver(editInvoiceFormSchema),
    defaultValues: {
      invoiceDate: '',
      dueDate: '',
      paymentTerms: '',
      billingAddressStreet: '',
      billingAddressCity: '',
      billingAddressState: '',
      billingAddressPostalCode: '',
      billingAddressCountry: '',
      customerNotes: '',
      internalNotes: '',
      paymentNotes: '',
    },
  });

  // Populate form when invoice data loads
  useEffect(() => {
    if (invoice) {
      const formatDate = (date: Date | string | null): string => {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0] ?? '';
      };

      form.reset({
        invoiceDate: formatDate(invoice.invoiceDate),
        dueDate: formatDate(invoice.dueDate),
        paymentTerms: invoice.paymentTerms || '',
        billingAddressStreet: invoice.billingAddressStreet || '',
        billingAddressCity: invoice.billingAddressCity || '',
        billingAddressState: invoice.billingAddressState || '',
        billingAddressPostalCode: invoice.billingAddressPostalCode || '',
        billingAddressCountry: invoice.billingAddressCountry || '',
        customerNotes: invoice.customerNotes || '',
        internalNotes: invoice.internalNotes || '',
        paymentNotes: invoice.paymentNotes || '',
      });
    }
  }, [invoice, form]);

  const handleSubmit = async (data: EditInvoiceFormValues) => {
    if (!invoice) return;

    setIsSubmitting(true);
    try {
      const result = await updateInvoice(invoice.id, {
        invoiceDate: new Date(data.invoiceDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        paymentTerms: data.paymentTerms || null,
        billingAddress: {
          street: data.billingAddressStreet || null,
          city: data.billingAddressCity || null,
          state: data.billingAddressState || null,
          postalCode: data.billingAddressPostalCode || null,
          country: data.billingAddressCountry || null,
        },
        customerNotes: data.customerNotes || null,
        internalNotes: data.internalNotes || null,
        paymentNotes: data.paymentNotes || null,
      });

      if (result.success) {
        toast.success(`Invoice ${invoice.invoiceNumber} updated`);
        refetch();
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to update invoice');
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <>Edit Invoice {invoice?.invoiceNumber}</>
            )}
          </SheetTitle>
          <SheetDescription>
            Update invoice details. Items cannot be modified after creation.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : invoice ? (
          <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-6 space-y-6">
            {/* Dates Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dates
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date *</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    {...form.register('invoiceDate')}
                    className={form.formState.errors.invoiceDate ? 'border-destructive' : ''}
                  />
                  {form.formState.errors.invoiceDate && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.invoiceDate.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    {...form.register('dueDate')}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment Terms */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Payment Terms
              </h3>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Terms</Label>
                <Select
                  value={form.watch('paymentTerms') || ''}
                  onValueChange={(value) => form.setValue('paymentTerms', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((term) => (
                      <SelectItem key={term.value} value={term.value || 'none'}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Billing Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Billing Address
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="billingAddressStreet">Street Address</Label>
                  <Input
                    id="billingAddressStreet"
                    placeholder="123 Main St"
                    {...form.register('billingAddressStreet')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="billingAddressCity">City</Label>
                    <Input
                      id="billingAddressCity"
                      placeholder="City"
                      {...form.register('billingAddressCity')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingAddressState">State</Label>
                    <Input
                      id="billingAddressState"
                      placeholder="State"
                      {...form.register('billingAddressState')}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="billingAddressPostalCode">Postal Code</Label>
                    <Input
                      id="billingAddressPostalCode"
                      placeholder="12345"
                      {...form.register('billingAddressPostalCode')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billingAddressCountry">Country</Label>
                    <Input
                      id="billingAddressCountry"
                      placeholder="United States"
                      {...form.register('billingAddressCountry')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Notes
              </h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="customerNotes">Customer Notes</Label>
                  <Textarea
                    id="customerNotes"
                    placeholder="Notes visible to customer..."
                    rows={2}
                    {...form.register('customerNotes')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="internalNotes">Internal Notes</Label>
                  <Textarea
                    id="internalNotes"
                    placeholder="Internal notes (not visible to customer)..."
                    rows={2}
                    {...form.register('internalNotes')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentNotes">Payment Notes</Label>
                  <Textarea
                    id="paymentNotes"
                    placeholder="Notes about payment..."
                    rows={2}
                    {...form.register('paymentNotes')}
                  />
                </div>
              </div>
            </div>

            <SheetFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Invoice not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
