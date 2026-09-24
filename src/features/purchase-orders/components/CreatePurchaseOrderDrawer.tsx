'use client';

/**
 * Create Purchase Order Modal
 *
 * Modal component for creating new purchase orders.
 * Includes supplier selection dropdown.
 */

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';
import { ScrollArea } from '@/shared/components/ui/scroll-area';

import { poFormSchema } from '../lib/schemas';
import { createPurchaseOrder, getSuppliersForDropdown, getNextPONumber } from '../actions';
import type { SupplierSummary, CreatePOItemDTO } from '../types';
import { ORDER_SERIES } from '@/shared/lib/global-data';
import { POItemsTable } from './POItemsTable';

// ============================================
// TYPES
// ============================================

interface CreatePurchaseOrderDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  // Pre-filled items (e.g., from Sales Order)
  defaultItems?: CreatePOItemDTO[];
  defaultSalesOrderId?: string;
  // defaultOrderSeries removed - Order Series is inherited from linked Sales Order
}

// ============================================
// COMPONENT
// ============================================

export function CreatePurchaseOrderDrawer({
  open,
  onClose,
  onSuccess,
  defaultItems = [],
  defaultSalesOrderId,
}: CreatePurchaseOrderDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierSummary | null>(null);

  // Items with extended properties for the table
  const [items, setItems] = useState<Array<CreatePOItemDTO & { id: string; lineTotal: number }>>(
    defaultItems.map((item, index) => ({
      ...item,
      id: `poi-default-${index}`,
      lineTotal: item.quantityOrdered * item.unitPrice,
    }))
  );

  // Track selected supplier for auto-assigning to items
  const [supplierIdForItems, setSupplierIdForItems] = useState<string>('');

  // State for auto-generating PO number
  const [isGeneratingPONumber, setIsGeneratingPONumber] = useState(false);

  const form = useForm({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      poNumber: '',
      poDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      salesOrderId: defaultSalesOrderId || '',
      warehouseId: '',
      currencyCode: 'USD',
      orderSeries: '',
      vendorAddressStreet: '',
      vendorAddressCity: '',
      vendorAddressState: '',
      vendorAddressPostalCode: '',
      vendorAddressCountry: '',
      shipToAddressStreet: '',
      shipToAddressCity: '',
      shipToAddressState: '',
      shipToAddressPostalCode: '',
      shipToAddressCountry: '',
      shippingCost: 0,
      vendorNotes: '',
      internalNotes: '',
    },
  });

  // Watch PO Date for Expected Delivery Date validation
  const poDate = form.watch('poDate');

  // Load suppliers on mount
  useEffect(() => {
    if (open) {
      loadSuppliers();
    }
  }, [open]);

  // orderSeries auto-fill removed - Order Series is inherited from linked Sales Order

  const loadSuppliers = async () => {
    setIsLoadingSuppliers(true);
    try {
      const data = await getSuppliersForDropdown();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const handleSupplierChange = (supplierId: string) => {
    setSupplierIdForItems(supplierId);
    const supplier = suppliers.find((s) => s.id === supplierId);
    setSelectedSupplier(supplier || null);

    // Auto-fill vendor address if we have supplier info (would need to fetch full supplier data)
    // For now, just set the supplier
  };

  // Auto-generate PO number handler
  const handleAutoGeneratePONumber = useCallback(async () => {
    setIsGeneratingPONumber(true);
    try {
      const result = await getNextPONumber();
      if (result.success && result.data) {
        form.setValue('poNumber', result.data);
      } else {
        toast.error('Failed to generate PO number');
      }
    } catch (error) {
      console.error('Failed to generate PO number:', error);
      toast.error('Failed to generate PO number');
    } finally {
      setIsGeneratingPONumber(false);
    }
  }, [form]);

  const onSubmit = async (data: Record<string, unknown>) => {
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    startTransition(async () => {
      try {
        // If PO-level supplier is selected and items don't have supplier, assign it
        const itemsWithSupplier = items.map((item) => {
          if (!item.supplierId && selectedSupplier) {
            return {
              ...item,
              supplierId: selectedSupplier.id,
              supplierName: selectedSupplier.name,
            };
          }
          return item;
        });

        const result = await createPurchaseOrder({
          poNumber: (data.poNumber as string) || undefined, // Optional - auto-generate if empty
          poDate: new Date(data.poDate as string),
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate as string)
            : null,
          salesOrderId: (data.salesOrderId as string) || null,
          warehouseId: (data.warehouseId as string) || null,
          currencyCode: (data.currencyCode as string) || 'USD',
          status: 'draft',
          orderSeries: (data.orderSeries as string) || null,
          vendorAddress: {
            street: (data.vendorAddressStreet as string) || null,
            city: (data.vendorAddressCity as string) || null,
            state: (data.vendorAddressState as string) || null,
            postalCode: (data.vendorAddressPostalCode as string) || null,
            country: (data.vendorAddressCountry as string) || null,
          },
          shipToAddress: {
            street: (data.shipToAddressStreet as string) || null,
            city: (data.shipToAddressCity as string) || null,
            state: (data.shipToAddressState as string) || null,
            postalCode: (data.shipToAddressPostalCode as string) || null,
            country: (data.shipToAddressCountry as string) || null,
          },
          items: itemsWithSupplier, // Supplier info is on items
          vendorNotes: (data.vendorNotes as string) || null,
          internalNotes: (data.internalNotes as string) || null,
        });

        if (result.success) {
          toast.success('Purchase Order created successfully');
          form.reset();
          setItems([]);
          setSelectedSupplier(null);
          await onSuccess?.();
          onClose();
        } else {
          toast.error(result.error || 'Failed to create Purchase Order');
        }
      } catch (error) {
        console.error('Error creating PO:', error);
        toast.error('Failed to create Purchase Order');
      }
    });
  };

  const handleClose = () => {
    if (!isPending) {
      form.reset();
      setItems([]);
      setSelectedSupplier(null);
      setSupplierIdForItems('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-6xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">Create Purchase Order</DialogTitle>
          <DialogDescription>
            Create a new purchase order to a supplier.
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-6">
            <Form {...form}>
              <form id="create-po-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Supplier Selection (for auto-assigning to items) */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Default Supplier</h3>
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Select a supplier to auto-assign to items without a supplier
                    </label>
                    <Select
                      value={supplierIdForItems}
                      onValueChange={handleSupplierChange}
                      disabled={isLoadingSuppliers}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingSuppliers ? 'Loading...' : 'Select a supplier'} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                            {supplier.primaryContactName && (
                              <span className="text-muted-foreground ml-2">
                                ({supplier.primaryContactName})
                              </span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                {/* Order Details - PO Number, PO Date, Expected Delivery, Order Series */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Order Details</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="poNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PO Number</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                placeholder="Enter or auto-generate"
                                {...field}
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleAutoGeneratePONumber}
                              disabled={isGeneratingPONumber}
                              title="Auto-generate PO number"
                            >
                              <Wand2 className={`h-4 w-4 ${isGeneratingPONumber ? 'animate-pulse' : ''}`} />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Enter a custom number or click the wand to auto-generate
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="poDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>PO Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="expectedDeliveryDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expected Delivery</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              min={poDate || undefined}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="orderSeries"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Order Series *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select order series" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ORDER_SERIES.map((series) => (
                                <SelectItem key={series.id} value={series.code}>
                                  {series.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Items Section - Inline Table */}
                <POItemsTable
                  items={items}
                  onItemsChange={setItems}
                />

                <Separator />

                {/* Notes */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Notes</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vendorNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes for Supplier</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Notes visible to supplier..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="internalNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Internal Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Internal notes (not visible to supplier)..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </ScrollArea>

        {/* Footer */}
        <Separator />
        <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
          <div className="flex w-full items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" form="create-po-form" disabled={isPending || items.length === 0}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Purchase Order
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
