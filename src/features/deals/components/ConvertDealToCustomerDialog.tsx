'use client';

/**
 * ConvertDealToCustomerDialog Component
 *
 * Dialog for converting a won deal to a customer with initial quote.
 * Collects shipping address and product items needed for quote creation.
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Switch } from '@/shared/components/ui/switch';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';

import type { Deal } from '../types';
import { convertDealToCustomer } from '../actions';

// ============================================
// TYPES
// ============================================

interface ConvertDealToCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  deal: Deal | null;
  onSuccess?: (customerId: string, quoteId: string) => void;
}

interface ProductItem {
  id?: string;
  productId?: string;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

// ============================================
// SCHEMA
// ============================================

const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().default('USA'),
});

const formSchema = z.object({
  // Customer Info
  customerName: z.string().min(1, 'Customer name is required'),
  email: z.string().email('Valid email is required').nullable(),
  phone: z.string().nullable(),
  channel: z.enum(['oem', 'dealer'] as const),

  // Shipping Address
  shippingAddress: addressSchema,

  // Use same for billing
  useSameBilling: z.boolean().default(true),

  // Billing Address (optional if useSameBilling is true)
  billingAddress: addressSchema.optional(),

  // Create Quote Toggle
  createQuote: z.boolean().default(false),

  // Quote Fields (conditional)
  quoteNumber: z.string().optional(),
  quoteDate: z.date().optional(),
  customerPoNumber: z.string().nullable(),

  // Notes & Terms
  customerNotes: z.string().nullable(),
  internalNotes: z.string().nullable(),
  termsAndConditions: z.string().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

// ============================================
// COMPONENT
// ============================================

export function ConvertDealToCustomerDialog({
  open,
  onClose,
  deal,
  onSuccess,
}: ConvertDealToCustomerDialogProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lineItems, setLineItems] = useState<ProductItem[]>([
    {
      id: `item-${Date.now()}`,
      productId: '',
      sku: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
    },
  ]);
  const [availableProducts, setAvailableProducts] = useState<Array<{
    id: string;
    sku: string;
    name: string;
    description: string | null;
    unitPrice: number;
  }>>([]);

  // ----------------------------------------
  // FORM
  // ----------------------------------------

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: (deal?.organizationName || deal?.contactName || '') as string,
      email: deal?.contactEmail || null,
      phone: deal?.contactPhone || null,
      channel: 'dealer' as const,
      shippingAddress: {
        street: (deal?.organizationAddressStreet || '') as string,
        city: (deal?.organizationAddressCity || '') as string,
        state: (deal?.organizationAddressState || '') as string,
        postalCode: (deal?.organizationAddressPostalCode || '') as string,
        country: (deal?.organizationAddressCountry || 'USA') as string,
      },
      useSameBilling: true,
      billingAddress: {
        street: (deal?.organizationAddressStreet || '') as string,
        city: (deal?.organizationAddressCity || '') as string,
        state: (deal?.organizationAddressState || '') as string,
        postalCode: (deal?.organizationAddressPostalCode || '') as string,
        country: (deal?.organizationAddressCountry || 'USA') as string,
      },
      createQuote: false,
      quoteNumber: undefined,
      quoteDate: undefined,
      customerPoNumber: null,
      customerNotes: null,
      internalNotes: null,
      termsAndConditions: null,
    },
  });

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Populate form when deal changes or dialog opens
  useEffect(() => {
    if (deal && open) {
      form.reset({
        customerName: deal.organizationName || deal.contactName || '',
        email: deal.contactEmail || null,
        phone: deal.contactPhone || null,
        channel: 'dealer',
        shippingAddress: {
          street: deal.organizationAddressStreet || '',
          city: deal.organizationAddressCity || '',
          state: deal.organizationAddressState || '',
          postalCode: deal.organizationAddressPostalCode || '',
          country: deal.organizationAddressCountry || 'USA',
        },
        useSameBilling: true,
        billingAddress: {
          street: deal.organizationAddressStreet || '',
          city: deal.organizationAddressCity || '',
          state: deal.organizationAddressState || '',
          postalCode: deal.organizationAddressPostalCode || '',
          country: deal.organizationAddressCountry || 'USA',
        },
        createQuote: false,
        quoteNumber: '',
        quoteDate: new Date(),
        customerPoNumber: null,
        customerNotes: null,
        internalNotes: null,
        termsAndConditions: null,
      });
    }
  }, [deal, open, form]);

  // Fetch available products when dialog opens
  useEffect(() => {
    if (open) {
      const fetchProducts = async () => {
        try {
          const { createClient } = await import('@/shared/lib/supabase/client');
          const db = createClient();

          const { data, error } = await db
            .from('products')
            .select('id, sku, name, description, base_price')
            .eq('status', 'active')
            .eq('is_sellable', true)
            .is('deleted_at', null)
            .order('name');

          if (error) {
            console.error('Error fetching products:', error);
            return;
          }

          setAvailableProducts(
            (data || []).map((p) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              description: p.description,
              unitPrice: p.base_price || 0,
            }))
          );
        } catch (error) {
          console.error('Error loading products:', error);
        }
      };

      fetchProducts();
    }
  }, [open]);

  // Sync shipping address with billing address when checkbox is checked
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // When checkbox is toggled or billing address changes
      if (value.useSameBilling) {
        if (name === 'useSameBilling' || name?.startsWith('billingAddress')) {
          form.setValue('shippingAddress.street', value.billingAddress?.street || '');
          form.setValue('shippingAddress.city', value.billingAddress?.city || '');
          form.setValue('shippingAddress.state', value.billingAddress?.state || '');
          form.setValue('shippingAddress.postalCode', value.billingAddress?.postalCode || '');
          form.setValue('shippingAddress.country', value.billingAddress?.country || '');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        productId: '',
        sku: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return; // Keep at least one row
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (
    index: number,
    field: keyof ProductItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const updatedItem = { ...item, [field]: value };

        // When product is selected
        if (field === 'productId' && typeof value === 'string') {
          const product = availableProducts.find((p) => p.id === value);
          if (product) {
            updatedItem.sku = product.sku;
            updatedItem.description = product.name;
            updatedItem.unitPrice = product.unitPrice / 100; // Convert from cents to dollars
          }
        }

        return updatedItem;
      })
    );
  };

  const handleSubmit = async (values: FormValues) => {
    // Only validate products if creating quote
    if (values.createQuote) {
      const hasValidItems = lineItems.some(item => item.sku && item.description);
      if (!hasValidItems) {
        toast.error('Please add at least one product for the quote');
        return;
      }
    }

    if (!deal) return;

    setIsSubmitting(true);
    try {
      // Convert line items to products array (only include items with SKU and description)
      const validProducts = lineItems
        .filter(item => item.sku && item.description)
        .map(item => ({
          productId: item.productId || '',
          sku: item.sku,
          description: item.description,
          quantity: item.quantity || 1,
          unitPrice: Math.round((item.unitPrice || 0) * 100), // Convert to cents
        }));

      const result = await convertDealToCustomer(deal.id, {
        customerName: values.customerName,
        email: values.email,
        phone: values.phone,
        channel: values.channel,
        // If useSameBilling is true, shipping = billing
        shippingAddress: values.useSameBilling ? values.billingAddress! : values.shippingAddress,
        useSameBilling: values.useSameBilling,
        billingAddress: values.billingAddress,
        createQuote: values.createQuote,
        quoteNumber: values.quoteNumber,
        quoteDate: values.quoteDate,
        customerPoNumber: values.customerPoNumber,
        products: validProducts,
        customerNotes: values.customerNotes,
        internalNotes: values.internalNotes,
        termsAndConditions: values.termsAndConditions,
      });

      if (result.success) {
        const message = values.createQuote
          ? `Customer and Quote created successfully! ${result.data.quoteId ? `Quote ID: ${result.data.quoteId}` : ''}`
          : 'Customer created successfully (no quote)';
        toast.success(message);

        console.log('[Convert] Result:', result.data);
        console.log('[Convert] Customer ID:', result.data.customerId);
        console.log('[Convert] Quote ID:', result.data.quoteId);

        onSuccess?.(result.data.customerId, result.data.quoteId || '');
        onClose();
      } else {
        // Show general error
        toast.error(result.error || 'Failed to convert deal to customer');

        // If there are field errors, set them on the form
        if (result.errors) {
          console.log('[Convert] Validation errors:', result.errors);

          let firstErrorField: string | null = null;

          Object.entries(result.errors).forEach(([field, messages]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              console.log(`[Convert] Setting error for field: ${field}`, messages);

              // Map backend field names to form field names
              const fieldMapping: Record<string, string> = {
                'customerCode': 'customerName', // customerCode errors show on name field
                'name': 'customerName',
                'email': 'email',
                'phone': 'phone',
                'address1': 'billingAddress.street',
                'city': 'billingAddress.city',
                'state': 'billingAddress.state',
                'zip': 'billingAddress.postalCode',
                'country': 'billingAddress.country',
              };

              const formField = (fieldMapping[field] || field) as any;

              try {
                form.setError(formField, {
                  type: 'manual',
                  message: messages[0],
                });
                console.log(`[Convert] Successfully set error on: ${formField}`);
              } catch (error) {
                console.error(`[Convert] Failed to set error on: ${formField}`, error);
                // Show error in toast if field mapping fails
                toast.error(`${field}: ${messages[0]}`);
              }

              // Track first error field
              if (!firstErrorField) {
                firstErrorField = formField;
              }
            }
          });

          // Scroll to first error field
          if (firstErrorField) {
            setTimeout(() => {
              const element = document.getElementById(firstErrorField!);
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.focus();
              }
            }, 100);
          }
        }
      }
    } catch (error) {
      console.error('Error converting deal:', error);
      toast.error('Failed to convert deal to customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Convert Deal to Customer
          </DialogTitle>
          <DialogDescription>
            Create a new customer and initial quote from this won deal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Customer Information</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="customerName">Company Name *</Label>
                <Input
                  id="customerName"
                  {...form.register('customerName')}
                  placeholder="Enter company name"
                  className={form.formState.errors.customerName ? 'border-destructive' : ''}
                />
                {form.formState.errors.customerName && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.customerName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="channel">Channel *</Label>
                <Select
                  value={form.watch('channel')}
                  onValueChange={(value) => form.setValue('channel', value as 'oem' | 'dealer')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oem">OEM</SelectItem>
                    <SelectItem value="dealer">Dealer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="customer@example.com"
                  className={form.formState.errors.email ? 'border-destructive' : ''}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...form.register('phone')}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing & Shipping Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Billing & Shipping</h3>
            <p className="text-sm text-muted-foreground">Customer billing and shipping addresses.</p>

            <div className="grid grid-cols-2 gap-6">
              {/* Billing Address - Always visible */}
              <div className="space-y-3">
                {/* Billing Address heading with checkbox */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Billing Address</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useSameBilling"
                      checked={form.watch('useSameBilling')}
                      onCheckedChange={(checked) => form.setValue('useSameBilling', checked === true)}
                    />
                    <Label
                      htmlFor="useSameBilling"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Use same address for shipping
                    </Label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="billingStreet">Street</Label>
                  <Input
                    id="billingStreet"
                    {...form.register('billingAddress.street')}
                    placeholder="123 Main St"
                    className={form.formState.errors.billingAddress?.street ? 'border-destructive' : ''}
                  />
                  {form.formState.errors.billingAddress?.street && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.billingAddress.street.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="billingCity">City</Label>
                    <Input
                      id="billingCity"
                      {...form.register('billingAddress.city')}
                      placeholder="New York"
                      className={form.formState.errors.billingAddress?.city ? 'border-destructive' : ''}
                    />
                    {form.formState.errors.billingAddress?.city && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.billingAddress.city.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="billingState">State</Label>
                    <Input
                      id="billingState"
                      {...form.register('billingAddress.state')}
                      placeholder="NY"
                      className={form.formState.errors.billingAddress?.state ? 'border-destructive' : ''}
                    />
                    {form.formState.errors.billingAddress?.state && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.billingAddress.state.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="billingPostalCode">Postal Code</Label>
                    <Input
                      id="billingPostalCode"
                      {...form.register('billingAddress.postalCode')}
                      placeholder="10001"
                      className={form.formState.errors.billingAddress?.postalCode ? 'border-destructive' : ''}
                    />
                    {form.formState.errors.billingAddress?.postalCode && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.billingAddress.postalCode.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="billingCountry">Country</Label>
                    <Input
                      id="billingCountry"
                      {...form.register('billingAddress.country')}
                      placeholder="USA"
                      className={form.formState.errors.billingAddress?.country ? 'border-destructive' : ''}
                    />
                    {form.formState.errors.billingAddress?.country && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.billingAddress.country.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Shipping Address - Only visible when unchecked */}
              {!form.watch('useSameBilling') && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Shipping Address</h4>

                  <div>
                    <Label htmlFor="street">Street *</Label>
                    <Input
                      id="street"
                      {...form.register('shippingAddress.street')}
                      placeholder="123 Main St"
                    />
                    {form.formState.errors.shippingAddress?.street && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.shippingAddress.street.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        {...form.register('shippingAddress.city')}
                        placeholder="New York"
                      />
                      {form.formState.errors.shippingAddress?.city && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.shippingAddress.city.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        {...form.register('shippingAddress.state')}
                        placeholder="NY"
                      />
                      {form.formState.errors.shippingAddress?.state && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.shippingAddress.state.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="postalCode">Postal Code *</Label>
                      <Input
                        id="postalCode"
                        {...form.register('shippingAddress.postalCode')}
                        placeholder="10001"
                      />
                      {form.formState.errors.shippingAddress?.postalCode && (
                        <p className="text-sm text-destructive mt-1">
                          {form.formState.errors.shippingAddress.postalCode.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="country">Country *</Label>
                      <Input
                        id="country"
                        {...form.register('shippingAddress.country')}
                        placeholder="USA"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Create Quote Toggle */}
          <div className="space-y-4">
            <div className={`flex items-center justify-between p-4 border-2 rounded-lg transition-colors ${
              form.watch('createQuote')
                ? 'border-primary bg-primary/10'
                : 'border-muted bg-muted/20'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Create Quote</h3>
                  {form.watch('createQuote') ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {form.watch('createQuote')
                    ? 'Quote will be created with line items below'
                    : 'Only customer will be created (no quote)'}
                </p>
              </div>
              <Switch
                id="createQuote"
                checked={form.watch('createQuote')}
                onCheckedChange={(checked) => form.setValue('createQuote', checked)}
              />
            </div>
          </div>

          {/* Quote Fields - Conditional */}
          {form.watch('createQuote') && (
            <>
              <Separator />

              {/* Quote Details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Quote Details</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="quoteNumber">Quote Number</Label>
                    <Input
                      id="quoteNumber"
                      {...form.register('quoteNumber')}
                      placeholder="Auto-generated (or enter custom)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="quoteDate">Quote Date</Label>
                    <Input
                      id="quoteDate"
                      type="date"
                      value={form.watch('quoteDate')?.toISOString().split('T')[0] || ''}
                      onChange={(e) => form.setValue('quoteDate', new Date(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerPoNumber">Customer PO Number</Label>
                    <Input
                      id="customerPoNumber"
                      {...form.register('customerPoNumber')}
                      placeholder="Customer's PO number"
                    />
                  </div>

                </div>
              </div>

              <Separator />
            </>
          )}

          {/* Line Items - Only show if creating quote */}
          {form.watch('createQuote') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Line Items</h3>
                  <p className="text-sm text-muted-foreground">
                    Add products and quantities to the quote.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddLineItem}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {/* Products Table */}
              <div className="border-2 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase p-3 w-[200px]">Product</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase p-3 w-[120px]">SKU</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase p-3">Description</th>
                        <th className="text-center text-xs font-semibold text-muted-foreground uppercase p-3 w-[80px]">Qty</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase p-3 w-[120px]">Unit Price</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase p-3 w-[80px]">Disc %</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase p-3 w-[120px]">Total</th>
                        <th className="w-12 p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {lineItems.map((item, index) => (
                        <tr key={item.id || index} className="hover:bg-muted/50">
                          {/* Product Dropdown */}
                          <td className="p-2">
                            <Select
                              value={item.productId || ''}
                              onValueChange={(value) => handleLineItemChange(index, 'productId', value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>

                          {/* SKU - Read-only */}
                          <td className="p-2">
                            <Input
                              value={item.sku}
                              onChange={(e) => handleLineItemChange(index, 'sku', e.target.value)}
                              placeholder="SKU"
                              className="h-9 font-mono text-sm"
                              readOnly={!!item.productId}
                            />
                          </td>

                          {/* Description */}
                          <td className="p-2">
                            <Input
                              value={item.description}
                              onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                              placeholder="Description"
                              className="h-9 text-sm"
                            />
                          </td>

                          {/* Quantity */}
                          <td className="p-2">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="h-9 text-center font-medium"
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="p-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleLineItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="h-9 text-right font-medium"
                            />
                          </td>

                          {/* Discount % */}
                          <td className="p-2">
                            <div className="h-9 flex items-center justify-end text-sm text-muted-foreground">
                              0%
                            </div>
                          </td>

                          {/* Line Total */}
                          <td className="p-2">
                            <div className="text-right text-sm font-semibold">
                              ${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
                            </div>
                          </td>

                          {/* Delete Button */}
                          <td className="p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10"
                              onClick={() => handleRemoveLineItem(index)}
                              disabled={lineItems.length === 1}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Quote Summary - Only show if creating quote */}
          {form.watch('createQuote') && (
            <>
              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Quote Summary</h3>
                  <p className="text-sm text-muted-foreground">
                    Quote totals and calculations.
                  </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Subtotal</p>
                    <p className="text-2xl font-bold">
                      ${lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
                    </p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Discount</p>
                    <p className="text-2xl font-bold text-red-600">
                      -$0.00
                    </p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Tax</p>
                    <p className="text-2xl font-bold">
                      $0.00
                    </p>
                  </div>

                  <div className="border rounded-lg p-4 space-y-1 bg-primary/5">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Grand Total</p>
                    <p className="text-2xl font-bold text-primary">
                      ${lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Summary Breakdown - Right aligned */}
                <div className="flex justify-end">
                  <div className="border rounded-lg p-4 w-64 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        ${lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="font-medium">$0.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">$0.00</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base">
                      <span className="font-semibold">Grand Total</span>
                      <span className="font-bold text-lg">
                        ${lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Notes & Terms - Only show if creating quote */}
          {form.watch('createQuote') && (
            <>
              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-medium">Notes & Terms</h3>
                <p className="text-sm text-muted-foreground">
                  Add notes and terms for this quote.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Customer Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="customerNotes">Customer Notes</Label>
                    <Textarea
                      id="customerNotes"
                      {...form.register('customerNotes')}
                      placeholder="Notes visible to customer on the quote..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      These notes will be visible to the customer.
                    </p>
                  </div>

                  {/* Internal Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="internalNotes">Internal Notes</Label>
                    <Textarea
                      id="internalNotes"
                      {...form.register('internalNotes')}
                      placeholder="Internal notes (not visible to customer)..."
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      These notes are for internal use only.
                    </p>
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="space-y-2">
                  <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
                  <Textarea
                    id="termsAndConditions"
                    {...form.register('termsAndConditions')}
                    placeholder="Enter terms and conditions for this quote..."
                    rows={4}
                  />
                </div>
              </div>
            </>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Converting...' : 'Convert to Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
