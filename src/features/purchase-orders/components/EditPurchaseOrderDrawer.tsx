'use client';

/**
 * EditPurchaseOrderDrawer Component
 *
 * Modal dialog for editing an existing purchase order.
 * Features toggle for single supplier vs product-wise supplier assignment.
 * Only draft POs can be edited.
 */

import { useEffect, useState, useTransition, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';

import { poFormSchema } from '../lib/schemas';
import { getPurchaseOrder, updatePurchaseOrder, getSuppliersForDropdown } from '../actions';
import type { PurchaseOrderWithItems, PurchaseOrderItem, SupplierSummary, EditPurchaseOrderDrawerProps, CreatePOItemDTO } from '../types';
import { ORDER_SERIES } from '@/shared/lib/global-data';
import { AddPOItemDialog } from './AddPOItemDialog';

// ============================================
// COMPONENT
// ============================================

export function EditPurchaseOrderDrawer({
  open,
  onClose,
  poId,
  onSuccess,
}: EditPurchaseOrderDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [po, setPO] = useState<PurchaseOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle for single supplier assignment
  const [useSingleSupplier, setUseSingleSupplier] = useState(true);
  const [singleSupplierId, setSingleSupplierId] = useState<string>('');

  // Items with individual supplier assignments
  const [itemSuppliers, setItemSuppliers] = useState<Record<string, string>>({});

  // Editable items state (local copy for add/edit/delete)
  const [editableItems, setEditableItems] = useState<PurchaseOrderItem[]>([]);

  // Item editing dialogs
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);

  const form = useForm({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      poDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '',
      salesOrderId: '',
      warehouseId: '',
      currencyCode: 'USD',
      orderSeries: '',  // For unallocated POs (no linked SO)
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

  // Load PO and suppliers when opened
  useEffect(() => {
    if (open && poId) {
      loadPO();
      loadSuppliers();
    } else {
      setPO(null);
      setError(null);
      setUseSingleSupplier(true);
      setSingleSupplierId('');
      setItemSuppliers({});
      setEditableItems([]);
      setShowAddItemDialog(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poId]);

  const loadPO = async () => {
    if (!poId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPurchaseOrder(poId);
      if (result.success && result.data) {
        // Check if PO can be edited (allow draft and sent, block after supplier confirms)
        if (!['draft', 'sent'].includes(result.data.status)) {
          setError(`Cannot edit PO in "${result.data.status}" status. Only draft and sent POs can be edited before supplier confirmation.`);
          setPO(null);
        } else {
          setPO(result.data);
          // Pre-fill form with PO data
          form.reset({
            poDate: new Date(result.data.poDate).toISOString().split('T')[0],
            expectedDeliveryDate: result.data.expectedDeliveryDate
              ? new Date(result.data.expectedDeliveryDate).toISOString().split('T')[0]
              : '',
            salesOrderId: result.data.salesOrderId || '',
            warehouseId: result.data.warehouseId || '',
            currencyCode: result.data.currencyCode || 'USD',
            orderSeries: result.data.orderSeries || '',  // For unallocated POs
            vendorAddressStreet: result.data.vendorAddressStreet || '',
            vendorAddressCity: result.data.vendorAddressCity || '',
            vendorAddressState: result.data.vendorAddressState || '',
            vendorAddressPostalCode: result.data.vendorAddressPostalCode || '',
            vendorAddressCountry: result.data.vendorAddressCountry || '',
            shipToAddressStreet: result.data.shipToAddressStreet || '',
            shipToAddressCity: result.data.shipToAddressCity || '',
            shipToAddressState: result.data.shipToAddressState || '',
            shipToAddressPostalCode: result.data.shipToAddressPostalCode || '',
            shipToAddressCountry: result.data.shipToAddressCountry || '',
            shippingCost: result.data.shippingCost / 100, // Convert from cents
            vendorNotes: result.data.vendorNotes || '',
            internalNotes: result.data.internalNotes || '',
          });

          // Initialize per-item supplier assignments
          const itemSupplierMap: Record<string, string> = {};
          let hasPerItemSuppliers = false;
          for (const item of result.data.items) {
            if (item.supplierId) {
              itemSupplierMap[item.id] = item.supplierId;
              hasPerItemSuppliers = true;
            }
          }
          setItemSuppliers(itemSupplierMap);

          // If items have individual suppliers, switch to per-item mode
          if (hasPerItemSuppliers) {
            setUseSingleSupplier(false);
          }

          // Initialize editable items (local copy for editing)
          setEditableItems([...result.data.items]);
        }
      } else {
        setError(result.error || 'Failed to load purchase order');
      }
    } catch {
      setError('Failed to load purchase order');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSingleSupplierChange = (supplierId: string) => {
    setSingleSupplierId(supplierId);
  };

  const handleItemSupplierChange = (itemId: string, supplierId: string) => {
    setItemSuppliers((prev) => ({
      ...prev,
      [itemId]: supplierId,
    }));
  };

  // Item management handlers
  const handleAddItem = (newItem: CreatePOItemDTO) => {
    const item: PurchaseOrderItem = {
      id: `temp_${Date.now()}`, // Temporary ID for new items
      purchaseOrderId: poId || '',
      productId: newItem.productId,
      salesOrderItemId: null,
      sku: newItem.sku,
      description: newItem.description || '',
      quantityOrdered: newItem.quantityOrdered,
      quantityReceived: 0,
      unitCode: newItem.unitCode,
      unitPrice: newItem.unitPrice,
      taxRate: newItem.taxRate || 0,
      lineTotal: newItem.quantityOrdered * newItem.unitPrice,
      sortOrder: editableItems.length,
      itemType: newItem.itemType || 'inventory',
      supplierId: null,
      supplierName: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: null,
      updatedBy: null,
    };
    setEditableItems((prev) => [...prev, item]);
    toast.success('Item added');
  };

  const handleUpdateItem = (itemId: string, updates: Partial<PurchaseOrderItem>, showToast = false) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updates,
              lineTotal: (updates.quantityOrdered || item.quantityOrdered) * (updates.unitPrice || item.unitPrice),
            }
          : item
      )
    );
    if (showToast) {
      toast.success('Item updated');
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setEditableItems((prev) => prev.filter((item) => item.id !== itemId));
    // Also remove from item suppliers if exists
    setItemSuppliers((prev) => {
      const updated = { ...prev };
      delete updated[itemId];
      return updated;
    });
    toast.success('Item removed');
  };

  const handleInlineQuantityChange = (itemId: string, quantity: string) => {
    const qty = parseInt(quantity, 10);
    if (!isNaN(qty) && qty > 0) {
      handleUpdateItem(itemId, { quantityOrdered: qty }, false); // Don't show toast for inline edits
    }
  };

  const handleInlinePriceChange = (itemId: string, price: string) => {
    const priceValue = parseFloat(price);
    if (!isNaN(priceValue) && priceValue >= 0) {
      handleUpdateItem(itemId, { unitPrice: Math.round(priceValue * 100) }, false); // Don't show toast for inline edits
    }
  };

  // Calculate totals from editable items
  const calculatedTotals = useMemo(() => {
    const subtotal = editableItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const tax = editableItems.reduce(
      (sum, item) => sum + (item.lineTotal * (item.taxRate / 100)),
      0
    );
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [editableItems]);

  const onSubmit = async (data: Record<string, unknown>) => {
    if (!poId || !po) {
      return;
    }

    // Get the selected supplier info for PO-level
    const selectedSupplierId = useSingleSupplier ? singleSupplierId : null;
    const supplierInfo = selectedSupplierId
      ? suppliers.find((s) => s.id === selectedSupplierId)
      : null;

    // Build items array with supplier info (use editableItems instead of po.items)
    const itemsWithSuppliers = editableItems.map((item) => {
      // Determine the supplier for this item
      let itemSupplierId: string | null = null;
      let itemSupplierName: string | null = null;

      if (useSingleSupplier) {
        // All items use the same supplier
        itemSupplierId = supplierInfo?.id || null;
        itemSupplierName = supplierInfo?.name || null;
      } else {
        // Each item has its own supplier
        const assignedSupplierId = itemSuppliers[item.id];
        if (assignedSupplierId) {
          const itemSupplier = suppliers.find((s) => s.id === assignedSupplierId);
          itemSupplierId = itemSupplier?.id || null;
          itemSupplierName = itemSupplier?.name || null;
        }
      }

      return {
        id: item.id,
        productId: item.productId,
        salesOrderItemId: item.salesOrderItemId,
        sku: item.sku,
        description: item.description,
        quantityOrdered: item.quantityOrdered,
        unitCode: item.unitCode,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        supplierId: itemSupplierId,
        supplierName: itemSupplierName,
      };
    });

    startTransition(async () => {
      try {
        const result = await updatePurchaseOrder(poId, {
          poDate: new Date(data.poDate as string),
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate as string)
            : null,
          warehouseId: (data.warehouseId as string) || null,
          currencyCode: (data.currencyCode as string) || 'USD',
          // Only include orderSeries if PO is unallocated (no linked SO)
          orderSeries: !po.salesOrderId ? ((data.orderSeries as string) || null) : undefined,
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
          vendorNotes: (data.vendorNotes as string) || null,
          internalNotes: (data.internalNotes as string) || null,
          // Include items with their supplier assignments (supplier info is on items)
          items: itemsWithSuppliers,
        });

        if (result.success) {
          toast.success(`Purchase Order ${po.poNumber} updated successfully`);
          await onSuccess?.();
          onClose();
        } else {
          toast.error(result.error || 'Failed to update Purchase Order');
        }
      } catch (error) {
        console.error('Error updating PO:', error);
        toast.error('Failed to update Purchase Order');
      }
    });
  };

  const handleCancel = () => {
    if (isPending) {
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-4xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${po?.poNumber || 'Purchase Order'}`}
          </DialogTitle>
          <DialogDescription>
            Update purchase order details and assign suppliers.
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Alert variant="destructive" className="max-w-md">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={loadPO} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : po ? (
              <Form {...form}>
                <form id="edit-po-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Order Details - PO Date, Expected Delivery, Order Series */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Order Details</h3>
                    {po.salesOrderId ? (
                      <p className="text-xs text-muted-foreground">
                        Order Series is inherited from the linked Sales Order
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        This is an unallocated PO (no linked Sales Order). Select Order Series for GDC tracking.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
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
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    {/* Order Series - only show for unallocated POs */}
                    {!po.salesOrderId && (
                      <FormField
                        control={form.control}
                        name="orderSeries"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Order Series *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Order Series" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {ORDER_SERIES.map((series) => (
                                  <SelectItem key={series.code} value={series.code}>
                                    {series.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Select which GDC cycle this order belongs to
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <Separator />

                  {/* Items with Supplier Assignment */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-sm font-medium">Items ({editableItems.length})</h3>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setShowAddItemDialog(true)}
                          disabled={isPending}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Item
                        </Button>
                      </div>

                      {/* Toggle and Single Supplier Dropdown */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="single-supplier"
                            checked={useSingleSupplier}
                            onCheckedChange={setUseSingleSupplier}
                          />
                          <Label htmlFor="single-supplier" className="text-sm cursor-pointer">
                            Same supplier for all
                          </Label>
                        </div>

                        {useSingleSupplier && (
                          <Select
                            value={singleSupplierId}
                            onValueChange={handleSingleSupplierChange}
                            disabled={isLoadingSuppliers}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder={isLoadingSuppliers ? 'Loading...' : 'Select supplier'} />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Items Table */}
                    {editableItems.length === 0 ? (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <p>No items added. Click "Add Item" to get started.</p>
                      </div>
                    ) : (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-3 font-medium">Product</th>
                              <th className="text-left p-3 font-medium">Qty</th>
                              <th className="text-right p-3 font-medium">Unit Price</th>
                              {!useSingleSupplier && (
                                <th className="text-left p-3 font-medium">Supplier</th>
                              )}
                              <th className="text-right p-3 font-medium">Total</th>
                              <th className="text-center p-3 font-medium w-[100px]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {editableItems.map((item) => {
                              const isServiceOrNonInventory = item.itemType === 'service' || item.itemType === 'non_inventory';
                              return (
                                <tr key={item.id} className="hover:bg-muted/30">
                                  <td className="p-3">
                                    <p className="font-medium">{item.sku}</p>
                                    {item.description && (
                                      <p className="text-xs text-muted-foreground">{item.description}</p>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {isServiceOrNonInventory ? (
                                      '-'
                                    ) : (
                                      <Input
                                        type="number"
                                        min={1}
                                        value={item.quantityOrdered}
                                        onChange={(e) => handleInlineQuantityChange(item.id, e.target.value)}
                                        className="w-20 h-8 text-sm"
                                      />
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={(item.unitPrice / 100).toFixed(2)}
                                      onChange={(e) => handleInlinePriceChange(item.id, e.target.value)}
                                      className="w-24 h-8 text-sm text-right"
                                    />
                                  </td>
                                  {!useSingleSupplier && (
                                    <td className="p-3">
                                      <Select
                                        value={itemSuppliers[item.id] || ''}
                                        onValueChange={(value) => handleItemSupplierChange(item.id, value)}
                                        disabled={isLoadingSuppliers}
                                      >
                                        <SelectTrigger className="w-[160px] h-8">
                                          <SelectValue placeholder="Select supplier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                              {supplier.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </td>
                                  )}
                                  <td className="p-3 text-right font-medium">
                                    ${(item.lineTotal / 100).toFixed(2)}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleRemoveItem(item.id)}
                                        disabled={isPending}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Totals Summary */}
                    {editableItems.length > 0 && (
                      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">${(calculatedTotals.subtotal / 100).toFixed(2)}</span>
                        </div>
                        {calculatedTotals.tax > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax:</span>
                            <span className="font-medium">${(calculatedTotals.tax / 100).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-base font-semibold pt-2 border-t">
                          <span>Total:</span>
                          <span>${(calculatedTotals.total / 100).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Ship To Address */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Ship To Address</h3>
                    <FormField
                      control={form.control}
                      name="shipToAddressStreet"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street</FormLabel>
                          <FormControl>
                            <Input placeholder="Street address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="shipToAddressCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City</FormLabel>
                            <FormControl>
                              <Input placeholder="City" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="shipToAddressState"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>State</FormLabel>
                            <FormControl>
                              <Input placeholder="State" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="shipToAddressPostalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input placeholder="Postal code" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="shipToAddressCountry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country</FormLabel>
                            <FormControl>
                              <Input placeholder="Country" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

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
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {po && !isLoading && !error && (
          <>
            <Separator />
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <div className="flex w-full items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="edit-po-form"
                  disabled={isPending}
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      {/* Add Item Dialog */}
      <AddPOItemDialog
        open={showAddItemDialog}
        onClose={() => setShowAddItemDialog(false)}
        onAdd={handleAddItem}
      />
    </Dialog>
  );
}
