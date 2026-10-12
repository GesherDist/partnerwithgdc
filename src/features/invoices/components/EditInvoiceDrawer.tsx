'use client';

/**
 * EditInvoiceDrawer Component
 *
 * Modal for editing invoice details (dates, address, notes).
 * Items cannot be edited - only header fields.
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Save, X, Lock } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { formatCurrency } from '@/shared/lib/utils';

import { useInvoice } from '../hooks/useInvoice';
import { updateInvoice } from '../actions';
import type { EditInvoiceDrawerProps, InvoiceType, InvoiceStatus } from '../types';
import { INVOICE_TYPE_LABELS, INVOICE_STATUS_LABELS, INVOICE_STATUSES } from '../types';

// ============================================
// FORM SCHEMA
// ============================================

const editInvoiceFormSchema = z.object({
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled']),
  invoiceType: z.enum(['customer', 'commission']),
  salesRepId: z.string().optional(),
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
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const { data: invoice, isLoading, refetch } = useInvoice(open ? invoiceId : null);

  // Load users for sales rep selection
  useEffect(() => {
    if (open && users.length === 0) {
      setIsLoadingUsers(true);
      fetch('/api/users?limit=1000')
        .then(res => res.json())
        .then(data => setUsers(data.data || []))
        .catch(err => console.error('Failed to load users:', err))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [open, users.length]);

  const form = useForm<EditInvoiceFormValues>({
    resolver: zodResolver(editInvoiceFormSchema),
    defaultValues: {
      invoiceDate: '',
      dueDate: '',
      deliveryDate: '',
      status: 'draft',
      invoiceType: 'customer',
      salesRepId: '',
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
        deliveryDate: formatDate(invoice.deliveryDate),
        status: invoice.status || 'draft',
        invoiceType: invoice.invoiceType || 'customer',
        salesRepId: invoice.salesRepId || '',
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
      // Get sales rep name if selected
      const selectedSalesRep = data.salesRepId ? users.find(u => u.id === data.salesRepId) : null;
      const salesRepName = selectedSalesRep ? `${selectedSalesRep.firstName} ${selectedSalesRep.lastName}` : null;

      const result = await updateInvoice(invoice.id, {
        invoiceDate: new Date(data.invoiceDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        status: data.status as InvoiceStatus,
        invoiceType: data.invoiceType as InvoiceType,
        salesRepId: data.salesRepId || null,
        salesRepName: salesRepName,
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>
            {isLoading ? (
              <Skeleton className="h-6 w-40" />
            ) : (
              <>Edit Invoice {invoice?.invoiceNumber}</>
            )}
          </DialogTitle>
          <DialogDescription>
            Update invoice details. Items cannot be modified after creation.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="px-6 py-6 space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : invoice ? (
          <>
          <ScrollArea className="max-h-[calc(90vh-180px)] px-6">
          <form id="edit-invoice-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
            {/* Invoice Type, Status & Sales Rep */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Invoice Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.watch('status')}
                    onValueChange={(value) => form.setValue('status', value as InvoiceStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {INVOICE_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceType">Invoice Type</Label>
                  <Select
                    value={form.watch('invoiceType')}
                    onValueChange={(value) => form.setValue('invoiceType', value as 'customer' | 'commission')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{INVOICE_TYPE_LABELS.customer}</SelectItem>
                      <SelectItem value="commission">{INVOICE_TYPE_LABELS.commission}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salesRepId">Sales Rep</Label>
                  <Select
                    value={form.watch('salesRepId') || ''}
                    onValueChange={(value) => form.setValue('salesRepId', value)}
                    disabled={isLoadingUsers}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingUsers ? "Loading..." : "Select sales rep"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No sales rep</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

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
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Delivery Date</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    {...form.register('deliveryDate')}
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

            {/* Billing Address - Only show if NOT synced to QuickBooks */}
            {!invoice.quickbooksInvoiceId && (
              <>
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
              </>
            )}

            {/* Billing Address - Read Only when synced to QuickBooks */}
            {invoice.quickbooksInvoiceId && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Billing Address
                    </h3>
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs">
                      <Lock className="h-3 w-3" />
                      <span>Synced to QuickBooks</span>
                    </div>
                  </div>
                  <div className="bg-muted/50 border rounded-lg p-4">
                    {invoice.billingAddressStreet || invoice.billingAddressCity || invoice.billingAddressState ? (
                      <div className="space-y-1 text-sm">
                        {invoice.billingAddressStreet && (
                          <p>{invoice.billingAddressStreet}</p>
                        )}
                        <p>
                          {[
                            invoice.billingAddressCity,
                            invoice.billingAddressState,
                            invoice.billingAddressPostalCode
                          ].filter(Boolean).join(', ')}
                        </p>
                        {invoice.billingAddressCountry && (
                          <p className="text-muted-foreground">{invoice.billingAddressCountry}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No billing address</p>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Invoice Items - Read Only */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Invoice Items (Read Only)
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[200px]">SKU / Description</TableHead>
                      <TableHead className="text-right w-[80px]">Qty</TableHead>
                      <TableHead className="text-right w-[100px]">Unit Price</TableHead>
                      <TableHead className="text-right w-[100px]">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items && invoice.items.length > 0 ? (
                      invoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.sku}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {item.description}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice / 100)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.lineTotal / 100)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                          No items
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(invoice.subtotal / 100)}</span>
                  </div>
                  {invoice.discountTotal > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount:</span>
                      <span>-{formatCurrency(invoice.discountTotal / 100)}</span>
                    </div>
                  )}
                  {invoice.taxTotal > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax:</span>
                      <span>{formatCurrency(invoice.taxTotal / 100)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Grand Total:</span>
                    <span>{formatCurrency(invoice.grandTotal / 100)}</span>
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

          </form>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" form="edit-invoice-form" disabled={isSubmitting}>
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
          </DialogFooter>
          </>
        ) : (
          <div className="px-6 py-6 text-center text-muted-foreground">
            Invoice not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
