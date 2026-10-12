'use client';

/**
 * CreateInvoiceDrawer Component
 *
 * Modal for creating new invoices (manual invoice creation without Sales Order).
 */

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Check } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
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

import { createInvoice, getInvoiceMasterData, getCustomerSalesOrders, getSalesOrderWithItems } from '../actions';
import type { CreateInvoiceDrawerProps, InvoiceType } from '../types';
import { INVOICE_TYPE_LABELS } from '../types';
import { calculateInvoiceTotals } from '../lib/schemas';

// ============================================
// FORM SCHEMA
// ============================================

const createInvoiceFormSchema = z.object({
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  customerId: z.string().min(1, 'Customer is required'),
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
  salesOrderItemId?: string; // Reference to original SO item
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
  const [customers, setCustomers] = useState<Array<{
    id: string;
    name: string;
    address1: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{
    id: string;
    name: string;
    address1: string | null;
    address2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  }>>([]);
  const [products, setProducts] = useState<Array<{ id: string; sku: string; name: string; itemType: string; unitPrice: number }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Sales Order selection state (for customer invoices)
  const [salesOrders, setSalesOrders] = useState<Array<{
    id: string;
    orderNumber: string;
    customerPoNumber: string | null;
    orderDate: string;
    status: string;
    grandTotal: number;
    hasInvoice: boolean;
  }>>([]);
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<string>('');
  const [isLoadingSalesOrders, setIsLoadingSalesOrders] = useState(false);
  const [salesOrderSearch, setSalesOrderSearch] = useState<string>('');

  // Ref to track if invoice type change effect should run
  const isFirstInvoiceTypeRender = useRef(true);

  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceFormSchema),
    defaultValues: {
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      deliveryDate: '',
      customerId: '',
      invoiceType: 'customer',
      salesRepId: '',
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
      // Reset the first render ref when drawer opens
      isFirstInvoiceTypeRender.current = true;
    } else {
      // Reset form when drawer closes
      form.reset({
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        deliveryDate: '',
        customerId: '',
        invoiceType: 'customer',
        salesRepId: '',
        paymentTerms: 'NET_30',
        billingAddressStreet: '',
        billingAddressCity: '',
        billingAddressState: '',
        billingAddressPostalCode: '',
        billingAddressCountry: 'US',
        customerNotes: '',
        internalNotes: '',
      });
      setItems([]);
      setSalesOrders([]);
      setSelectedSalesOrderId('');
      setSalesOrderSearch('');
      // Reset the first render ref when drawer closes
      isFirstInvoiceTypeRender.current = true;
    }
  }, [open, form]);

  // Watch for customer and invoiceType changes
  const watchedCustomerId = form.watch('customerId');
  const watchedInvoiceType = form.watch('invoiceType');

  // Load sales orders when customer changes (for customer invoices)
  useEffect(() => {
    if (watchedInvoiceType === 'customer' && watchedCustomerId) {
      loadCustomerSalesOrders(watchedCustomerId);
    } else {
      setSalesOrders([]);
      setSelectedSalesOrderId('');
      setItems([]);
    }
  }, [watchedCustomerId, watchedInvoiceType]);

  // Auto-populate billing address when customer/supplier changes
  useEffect(() => {
    if (watchedCustomerId) {
      // Find in the appropriate list based on invoice type
      const selectedEntity = watchedInvoiceType === 'commission'
        ? suppliers.find(s => s.id === watchedCustomerId)
        : customers.find(c => c.id === watchedCustomerId);

      if (selectedEntity) {
        // Build street address from address1 and address2
        const street = [selectedEntity.address1, selectedEntity.address2]
          .filter(Boolean)
          .join(', ');

        form.setValue('billingAddressStreet', street || '');
        form.setValue('billingAddressCity', selectedEntity.city || '');
        form.setValue('billingAddressState', selectedEntity.state || '');
        form.setValue('billingAddressPostalCode', selectedEntity.zip || '');
        form.setValue('billingAddressCountry', selectedEntity.country || 'US');
      }
    }
  }, [watchedCustomerId, customers, suppliers, watchedInvoiceType, form]);

  // Filter sales orders based on search
  const filteredSalesOrders = salesOrders.filter((so) => {
    if (!salesOrderSearch.trim()) return true;
    const searchLower = salesOrderSearch.toLowerCase().trim();
    return (
      so.orderNumber.toLowerCase().includes(searchLower) ||
      (so.customerPoNumber && so.customerPoNumber.toLowerCase().includes(searchLower))
    );
  });

  async function loadCustomerSalesOrders(customerId: string) {
    setIsLoadingSalesOrders(true);
    setSalesOrders([]);
    setSelectedSalesOrderId('');
    setItems([]);
    setSalesOrderSearch('');

    try {
      const result = await getCustomerSalesOrders(customerId);
      if (result.success && result.data) {
        setSalesOrders(result.data);
      }
    } catch (error) {
      console.error('Failed to load sales orders:', error);
    } finally {
      setIsLoadingSalesOrders(false);
    }
  }

  async function handleSalesOrderSelect(salesOrderId: string) {
    if (!salesOrderId) {
      setSelectedSalesOrderId('');
      setItems([]);
      return;
    }

    try {
      const result = await getSalesOrderWithItems(salesOrderId);
      if (result.success && result.data) {
        // Populate items from sales order
        const newItems: InvoiceItemLine[] = result.data.items.map(item => ({
          id: crypto.randomUUID(),
          productId: item.productId,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          taxRate: item.taxRate,
          salesOrderItemId: item.id,
        }));

        // Set items FIRST, then set selectedSalesOrderId to trigger UI update
        setItems(newItems);
        setSelectedSalesOrderId(salesOrderId);

        // Also populate billing address from SO - only overwrite if SO has actual values
        // If SO has no address, keep the customer's address that was auto-filled
        if (result.data.billingAddress) {
          const soAddress = result.data.billingAddress;
          // Only update each field if SO has a value for it
          if (soAddress.street) {
            form.setValue('billingAddressStreet', soAddress.street);
          }
          if (soAddress.city) {
            form.setValue('billingAddressCity', soAddress.city);
          }
          if (soAddress.state) {
            form.setValue('billingAddressState', soAddress.state);
          }
          if (soAddress.postalCode) {
            form.setValue('billingAddressPostalCode', soAddress.postalCode);
          }
          if (soAddress.country) {
            form.setValue('billingAddressCountry', soAddress.country);
          }
        }
      } else {
        toast.error('Failed to load sales order items');
      }
    } catch (error) {
      console.error('Failed to load sales order items:', error);
      toast.error('Failed to load sales order items');
    }
  }

  async function loadData() {
    setIsLoadingData(true);
    try {
      const result = await getInvoiceMasterData();

      if (result.success && result.data) {
        setCustomers(result.data.customers);
        setSuppliers(result.data.suppliers);
        setProducts(result.data.products);
        setUsers(result.data.users);
      } else {
        console.error('Failed to load data:', result.error);
        toast.error(result.error || 'Failed to load data');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoadingData(false);
    }
  }

  // Clear customer/supplier and items when invoice type changes (skip initial render)
  useEffect(() => {
    if (isFirstInvoiceTypeRender.current) {
      isFirstInvoiceTypeRender.current = false;
      return;
    }

    // Clear selection when invoice type changes
    form.setValue('customerId', '');
    setSalesOrders([]);
    setSelectedSalesOrderId('');

    // Add initial empty item for commission invoice, clear for customer invoice
    if (watchedInvoiceType === 'commission') {
      setItems([{
        id: crypto.randomUUID(),
        productId: '',
        sku: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        taxRate: 0,
      }]);
    } else {
      setItems([]);
    }
  }, [watchedInvoiceType, form]);

  // Get filtered products based on invoice type
  const filteredProducts = watchedInvoiceType === 'commission'
    ? products.filter(p => p.itemType === 'service')
    : products;

  // Get entity list based on invoice type (customers or suppliers)
  const entityList = watchedInvoiceType === 'commission' ? suppliers : customers;

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
    // Search in all products since we need to find any product by ID
    const product = products.find((p) => p.id === productId);
    if (product) {
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === itemId
            ? {
                ...item,
                productId: productId,
                sku: product.sku,
                description: product.name,
                unitPrice: product.unitPrice,
              }
            : item
        )
      );
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

    // For customer invoices, require a sales order to be selected
    if (data.invoiceType === 'customer' && !selectedSalesOrderId) {
      toast.error('Please select a sales order for customer invoice');
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
      // Get sales rep name if selected
      const selectedSalesRep = data.salesRepId ? users.find(u => u.id === data.salesRepId) : null;
      const salesRepName = selectedSalesRep ? `${selectedSalesRep.firstName} ${selectedSalesRep.lastName}` : null;

      const payload = {
        invoiceDate: new Date(data.invoiceDate),
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        customerId: data.customerId,
        salesOrderId: data.invoiceType === 'customer' ? selectedSalesOrderId : null,
        shipmentId: null,
        currencyCode: 'USD',
        status: 'draft' as const,
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
        items: items.map((item) => ({
          productId: item.productId,
          salesOrderItemId: item.salesOrderItemId || null,
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* Invoice Information Section */}
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Invoice Information</h3>
            <p className="text-sm text-muted-foreground">Basic invoice details and customer information.</p>
          </div>

          {/* Row 1: Invoice Type, Invoice Date, Due Date */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceType">Invoice Type *</Label>
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
          </div>

          {/* Row 2: Customer/Supplier, Sales Rep, Payment Terms */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">
                {watchedInvoiceType === 'commission' ? 'Supplier *' : 'Customer *'}
              </Label>
              <Select
                value={form.watch('customerId')}
                onValueChange={(value) => form.setValue('customerId', value)}
                disabled={isLoadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingData ? "Loading..." : watchedInvoiceType === 'commission' ? "Select supplier" : "Select customer"} />
                </SelectTrigger>
                <SelectContent>
                  {entityList.map((entity) => (
                    <SelectItem key={entity.id} value={entity.id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.customerId && (
                <p className="text-sm text-destructive">{form.formState.errors.customerId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesRepId">Sales Representative</Label>
              <Select
                value={form.watch('salesRepId')}
                onValueChange={(value) => form.setValue('salesRepId', value)}
                disabled={isLoadingData}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingData ? "Loading..." : "Select sales rep"} />
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

          {/* Row 3: Delivery Date */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Delivery Date</Label>
              <Input
                id="deliveryDate"
                type="date"
                {...form.register('deliveryDate')}
              />
            </div>
          </div>

          {/* Billing Address Section */}
          <Separator className="my-4" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Billing Address</h3>
            <p className="text-sm text-muted-foreground">Address for invoice billing. Auto-filled from customer.</p>
          </div>

          <div className="space-y-4">
            {/* Row 1: Street Address */}
            <div className="space-y-2">
              <Label htmlFor="billingAddressStreet">Street Address</Label>
              <Input
                id="billingAddressStreet"
                placeholder="123 Main St, Suite 100"
                {...form.register('billingAddressStreet')}
              />
            </div>
            {/* Row 2: City, State, Postal Code, Country */}
            <div className="grid grid-cols-4 gap-4">
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
                  placeholder="US"
                  {...form.register('billingAddressCountry')}
                />
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Sales Order Selection (only for Customer Invoice type) */}
          {watchedInvoiceType === 'customer' && watchedCustomerId && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <Label>Select Sales Order *</Label>

              {/* Show selected SO summary when one is selected */}
              {selectedSalesOrderId ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-background">
                  {(() => {
                    const selectedSO = salesOrders.find(so => so.id === selectedSalesOrderId);
                    if (!selectedSO) return null;
                    return (
                      <>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {selectedSO.orderNumber}
                              {selectedSO.customerPoNumber && (
                                <span className="text-muted-foreground ml-2">
                                  (PO: {selectedSO.customerPoNumber})
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Amount: ${(selectedSO.grandTotal / 100).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSalesOrderId('');
                            setItems([]);
                          }}
                        >
                          Change
                        </Button>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    Choose a sales order to create invoice from. Items will be auto-populated.
                  </p>

                  {isLoadingSalesOrders ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading sales orders...</span>
                    </div>
                  ) : salesOrders.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      No sales orders found for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Search Input */}
                      <Input
                        placeholder="Search by PO or SO number..."
                        value={salesOrderSearch}
                        onChange={(e) => setSalesOrderSearch(e.target.value)}
                        className="max-w-xs"
                      />

                      {/* Table with fixed height */}
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[200px] overflow-y-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-background z-10">
                              <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Customer PO</TableHead>
                                <TableHead>Customer SO</TableHead>
                                <TableHead className="text-right">Invoice Amount</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredSalesOrders.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                                    No matching sales orders found.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                filteredSalesOrders.map((so) => {
                                  const isDisabled = so.hasInvoice;

                                  return (
                                    <TableRow
                                      key={so.id}
                                      className={`cursor-pointer transition-colors ${
                                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                                      }`}
                                      onClick={() => !isDisabled && handleSalesOrderSelect(so.id)}
                                    >
                                      <TableCell className="text-center">
                                        <div
                                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mx-auto ${
                                            isDisabled
                                              ? 'border-muted-foreground/30'
                                              : 'border-muted-foreground/50'
                                          }`}
                                        />
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {so.customerPoNumber || '-'}
                                      </TableCell>
                                      <TableCell>
                                        {so.orderNumber}
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        ${(so.grandTotal / 100).toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </TableCell>
                                      <TableCell>
                                        {so.hasInvoice ? (
                                          <span className="text-xs text-amber-600 font-medium">Already Invoiced</span>
                                        ) : (
                                          <span className="text-xs text-green-600 font-medium capitalize">
                                            {so.status}
                                          </span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Show count */}
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredSalesOrders.length} of {salesOrders.length} sales orders
                      </p>
                    </div>
                  )}

                  {salesOrders.length > 0 && (
                    <p className="text-sm text-amber-600">Please select a sales order to continue</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Line Items Section */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Line Items</h3>
                <p className="text-sm text-muted-foreground">
                  {watchedInvoiceType === 'customer'
                    ? 'Items from selected sales order.'
                    : 'Add products or services to the invoice.'}
                </p>
              </div>
              {/* Only show Add Item button for commission invoices */}
              {watchedInvoiceType === 'commission' && (
                <Button type="button" variant="outline" size="sm" onClick={addItem} disabled={isLoadingData}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="border rounded-lg p-8 text-center text-muted-foreground bg-muted/30">
              {watchedInvoiceType === 'customer'
                ? 'Select a sales order above to populate items.'
                : 'No items added yet. Click "Add Item" to get started.'}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Product</TableHead>
                      <TableHead className="w-[150px]">SKU</TableHead>
                      <TableHead>Description</TableHead>
                      {watchedInvoiceType !== 'commission' && (
                        <TableHead className="w-[80px]">Qty</TableHead>
                      )}
                      <TableHead className="w-[120px]">{watchedInvoiceType === 'commission' ? 'Amount' : 'Unit Price'}</TableHead>
                      {watchedInvoiceType !== 'commission' && (
                        <TableHead className="w-[80px]">Disc %</TableHead>
                      )}
                      <TableHead className="w-[80px]">Tax %</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {/* For customer invoices from SO - show product name as text */}
                          {watchedInvoiceType === 'customer' && item.salesOrderItemId ? (
                            <span className="text-sm font-medium">{item.description || item.sku}</span>
                          ) : (
                            <Select
                              value={item.productId}
                              onValueChange={(value) => handleProductChange(item.id, value)}
                              disabled={isLoadingData}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredProducts.map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
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
                            disabled={watchedInvoiceType === 'customer' && !!item.salesOrderItemId}
                          />
                        </TableCell>
                        {watchedInvoiceType !== 'commission' && (
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              className="h-8"
                              min="1"
                              disabled={watchedInvoiceType === 'customer' && !!item.salesOrderItemId}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Input
                            type="number"
                            value={item.unitPrice / 100}
                            onChange={(e) => updateItem(item.id, 'unitPrice', Math.round(parseFloat(e.target.value) * 100) || 0)}
                            className="h-8"
                            step="0.01"
                            min="0"
                            disabled={watchedInvoiceType === 'customer' && !!item.salesOrderItemId}
                          />
                        </TableCell>
                        {watchedInvoiceType !== 'commission' && (
                          <TableCell>
                            <Input
                              type="number"
                              value={item.discountPercent}
                              onChange={(e) => updateItem(item.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                              className="h-8"
                              step="0.01"
                              min="0"
                              max="100"
                              disabled={watchedInvoiceType === 'customer' && !!item.salesOrderItemId}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Input
                            type="number"
                            value={item.taxRate}
                            onChange={(e) => updateItem(item.id, 'taxRate', parseFloat(e.target.value) || 0)}
                            className="h-8"
                            step="0.01"
                            min="0"
                            max="100"
                            disabled={watchedInvoiceType === 'customer' && !!item.salesOrderItemId}
                          />
                        </TableCell>
                        <TableCell>
                          {/* Only show delete button for commission invoices */}
                          {watchedInvoiceType === 'commission' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(item.id)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
              <div className="w-72 space-y-2 border rounded-lg p-4 bg-muted/30">
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

          {/* Notes Section */}
          <div className="space-y-1 pt-2">
            <h3 className="text-base font-semibold">Notes</h3>
            <p className="text-sm text-muted-foreground">Add any additional notes for this invoice.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerNotes">Customer Notes</Label>
              <Textarea
                id="customerNotes"
                {...form.register('customerNotes')}
                placeholder="Notes visible to customer on the invoice"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="internalNotes">Internal Notes</Label>
              <Textarea
                id="internalNotes"
                {...form.register('internalNotes')}
                placeholder="Internal notes (not visible to customer)"
                rows={3}
              />
            </div>
          </div>
        </form>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-background rounded-b-lg shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            onClick={form.handleSubmit(onSubmit)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Invoice'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
