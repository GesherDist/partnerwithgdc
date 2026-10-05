'use client';

/**
 * CreateInvoiceDrawer Component
 *
 * Drawer for creating new invoices (manual invoice creation without Sales Order).
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';

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

import { createInvoice } from '../actions';
import type { CreateInvoiceDrawerProps } from '../types';
import { calculateInvoiceTotals } from '../lib/schemas';

// ============================================
// FORM SCHEMA
// ============================================

const createInvoiceFormSchema = z.object({
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().optional(),
  customerId: z.string().min(1, 'Customer is required'),
  paymentTerms: z.string().optional(),
  billingAddressStreet: z.string().optional(),
  billingAddressCity: z.string().optional(),
  billingAddressState: z.string().optional(),
  billingAddressPostalCode: z.string().optional(),
  billingAddressCountry: z.string().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
});

type CreateInvoiceFormValues = z.infer<typeof createInvoiceFormSchema>;

// Item line type
type InvoiceItemLine = {
  id: string;
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
};

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

export function CreateInvoiceDrawer({
  open,
  onClose,
  onSuccess,
}: CreateInvoiceDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<InvoiceItemLine[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; sku: string; name: string; itemType: string; unitPrice: number }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: {
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      customerId: '',
      paymentTerms: 'NET_30',
      billingAddressStreet: '',
      billingAddressCity: '',
      billingAddressState: '',
      billingAddressPostalCode: '',
      billingAddressCountry: 'US',
      customerNotes: '',
      internalNotes: '',
    },
  });

  // ============================================
  // LOAD DATA
  // ============================================

  useEffect(() => {
    if (open) {
      loadData();
    } else {
      // Reset form when drawer closes
      form.reset();
      setItems([]);
    }
  }, [open]);

  async function loadData() {
    setIsLoadingData(true);
    try {
      // Load customers
      const customersRes = await fetch('/api/customers?limit=1000');
      const customersData = await customersRes.json();
      setCustomers(customersData.data || []);

      // Load products
      const productsRes = await fetch('/api/products?limit=1000');
      const productsData = await productsRes.json();
      setProducts(productsData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load customers and products');
    } finally {
      setIsLoadingData(false);
    }
  }

  // ============================================
  // ITEMS MANAGEMENT
  // ============================================

  const addItem = () => {
    const newItem: InvoiceItemLine = {
      id: crypto.randomUUID(),
      productId: '',
      sku: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxRate: 0,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId));
  };

  const updateItem = (itemId: string, field: keyof InvoiceItemLine, value: any) => {
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleProductChange = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItem(itemId, 'productId', productId);
      updateItem(itemId, 'sku', product.sku);
      updateItem(itemId, 'description', product.name);
      updateItem(itemId, 'unitPrice', product.unitPrice);
    }
  };

  // ============================================
  // TOTALS CALCULATION
  // ============================================

  const totals = calculateInvoiceTotals(
    items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
    }))
  );

  // ============================================
  // SUBMIT
  // ============================================

  const onSubmit = async (data: CreateInvoiceFormValues) => {
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    // Validate all items have products
    const invalidItems = items.filter((item) => !item.productId || !item.sku);
    if (invalidItems.length > 0) {
      toast.error('All items must have a product selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        invoiceDate: new Date(data.invoiceDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        customerId: data.customerId,
        salesOrderId: null,
        shipmentId: null,
        currencyCode: 'USD',
        status: 'draft' as const,
        paymentTerms: data.paymentTerms || null,
        billingAddress: {
          street: data.billingAddressStreet || null,
          city: data.billingAddressCity || null,
          state: data.billingAddressState || null,
          postalCode: data.billingAddressPostalCode || null,
          country: data.billingAddressCountry || null,
        },
        items: items.map((item) => ({
          productId: item.productId,
          salesOrderItemId: null,
          shipmentItemId: null,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          unitCode: 'EA',
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxRate: item.taxRate,
        })),
        customerNotes: data.customerNotes || null,
        internalNotes: data.internalNotes || null,
      };

      const result = await createInvoice(payload);

      if (result.success) {
        toast.success('Invoice created successfully');
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Invoice</SheetTitle>
          <SheetDescription>
            Create a new invoice manually (without Sales Order).
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-6">
          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date *</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  {...form.register('invoiceDate')}
                />
                {form.formState.errors.invoiceDate && (
                  <p className="text-sm text-destructive">{form.formState.errors.invoiceDate.message}</p>
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
                <Label htmlFor="customerId">Customer *</Label>
                <Select
                  value={form.watch('customerId')}
                  onValueChange={(value) => form.setValue('customerId', value)}
                  disabled={isLoadingData}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingData ? "Loading..." : "Select customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.customerId && (
                  <p className="text-sm text-destructive">{form.formState.errors.customerId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select
                  value={form.watch('paymentTerms')}
                  onValueChange={(value) => form.setValue('paymentTerms', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((term) => (
                      <SelectItem key={term.value} value={term.value}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Billing Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="billingAddressStreet">Street</Label>
                <Input
                  id="billingAddressStreet"
                  {...form.register('billingAddressStreet')}
                  placeholder="123 Main St"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingAddressCity">City</Label>
                <Input
                  id="billingAddressCity"
                  {...form.register('billingAddressCity')}
                  placeholder="New York"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingAddressState">State</Label>
                <Input
                  id="billingAddressState"
                  {...form.register('billingAddressState')}
                  placeholder="NY"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingAddressPostalCode">Postal Code</Label>
                <Input
                  id="billingAddressPostalCode"
                  {...form.register('billingAddressPostalCode')}
                  placeholder="10001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billingAddressCountry">Country</Label>
                <Input
                  id="billingAddressCountry"
                  {...form.register('billingAddressCountry')}
                  placeholder="US"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Items</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={isLoadingData}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="border rounded-md p-8 text-center text-muted-foreground">
                No items added yet. Click "Add Item" to get started.
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Product</TableHead>
                      <TableHead className="w-[150px]">SKU</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[80px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Unit Price</TableHead>
                      <TableHead className="w-[80px]">Disc %</TableHead>
                      <TableHead className="w-[80px]">Tax %</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Select
                            value={item.productId}
                            onValueChange={(value) => handleProductChange(item.id, value)}
                            disabled={isLoadingData}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.sku}
                            onChange={(e) => updateItem(item.id, 'sku', e.target.value)}
                            className="h-8"
                            disabled
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-8"
                            min="1"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unitPrice / 100}
                            onChange={(e) => updateItem(item.id, 'unitPrice', Math.round(parseFloat(e.target.value) * 100) || 0)}
                            className="h-8"
                            step="0.01"
                            min="0"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.discountPercent}
                            onChange={(e) => updateItem(item.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                            className="h-8"
                            step="0.01"
                            min="0"
                            max="100"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.taxRate}
                            onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="h-8"
                            step="0.01"
                            min="0"
                            max="100"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Totals */}
            {items.length > 0 && (
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">${(totals.subtotal / 100).toFixed(2)}</span>
                  </div>
                  {totals.discountTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="font-medium text-destructive">-${(totals.discountTotal / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {totals.taxTotal > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax:</span>
                      <span className="font-medium">${(totals.taxTotal / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total:</span>
                    <span>${(totals.grandTotal / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Notes</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerNotes">Customer Notes</Label>
                <Textarea
                  id="customerNotes"
                  {...form.register('customerNotes')}
                  placeholder="Visible to customer"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="internalNotes">Internal Notes</Label>
                <Textarea
                  id="internalNotes"
                  {...form.register('internalNotes')}
                  placeholder="Internal use only"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || items.length === 0}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Invoice
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
