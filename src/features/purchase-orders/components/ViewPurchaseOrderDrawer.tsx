'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Pencil, Building2, MapPin, Send, Loader2, Calendar, X, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { usePurchaseOrder } from '../hooks/usePurchaseOrder';
import { sendPurchaseOrder, getSuppliersForDropdown, updatePOSupplier } from '../actions';
import { PO_STATUS_COLORS, PO_STATUS_LABELS } from '../types';
import type { ViewPurchaseOrderDrawerProps, SupplierSummary } from '../types';
import { ORDER_SERIES } from '@/shared/lib/global-data';
import { updateSalesOrderSeries } from '@/features/sales-orders/actions';

export function ViewPurchaseOrderDrawer({
  open,
  onClose,
  poId,
  onEdit,
}: ViewPurchaseOrderDrawerProps) {
  const { data: po, isLoading, refetch } = usePurchaseOrder(open ? poId : null);
  const [isPending, startTransition] = useTransition();
  const [showSendDialog, setShowSendDialog] = useState(false);

  // Inline editing state
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);
  // Order Series edit - updates the linked Sales Order
  const [isEditingOrderSeries, setIsEditingOrderSeries] = useState(false);
  const [isUpdatingOrderSeries, setIsUpdatingOrderSeries] = useState(false);

  // Load suppliers when editing
  useEffect(() => {
    if (isEditingSupplier && suppliers.length === 0) {
      loadSuppliers();
    }
  }, [isEditingSupplier, suppliers.length]);

  const loadSuppliers = async () => {
    const data = await getSuppliersForDropdown();
    setSuppliers(data);
  };

  // Get current supplier from items (assuming all items have same supplier)
  const currentSupplier = po?.items.find((item) => item.supplierId)?.supplierName || null;
  const currentSupplierId = po?.items.find((item) => item.supplierId)?.supplierId || null;

  const handleEditClick = () => {
    if (po && onEdit) {
      // Call onEdit which will handle closing drawer and opening edit modal
      onEdit(po);
    }
  };

  const handleUpdateSupplier = async (supplierId: string) => {
    if (!po) return;

    const supplierIdValue = supplierId === 'none' ? null : supplierId;
    const supplier = suppliers.find((s) => s.id === supplierIdValue);
    const supplierName = supplier?.name || null;

    setIsUpdatingSupplier(true);
    try {
      const result = await updatePOSupplier(po.id, supplierIdValue, supplierName);
      if (result.success) {
        toast.success('Supplier updated');
        setIsEditingSupplier(false);
        refetch();
      } else {
        toast.error(result.error || 'Failed to update supplier');
      }
    } catch {
      toast.error('Failed to update supplier');
    } finally {
      setIsUpdatingSupplier(false);
    }
  };

  // Order Series edit - updates the linked Sales Order
  const handleUpdateOrderSeries = async (orderSeries: string) => {
    if (!po || !po.salesOrderId) {
      toast.error('No linked Sales Order to update');
      return;
    }

    const orderSeriesValue = orderSeries === 'none' ? null : orderSeries;

    setIsUpdatingOrderSeries(true);
    try {
      const result = await updateSalesOrderSeries(po.salesOrderId, orderSeriesValue);
      if (result.success) {
        toast.success('Order Series updated on Sales Order');
        setIsEditingOrderSeries(false);
        refetch();
      } else {
        toast.error(result.error || 'Failed to update Order Series');
      }
    } catch {
      toast.error('Failed to update Order Series');
    } finally {
      setIsUpdatingOrderSeries(false);
    }
  };

  // Can edit only for draft and sent POs
  const canInlineEdit = po && ['draft', 'sent'].includes(po.status);

  const handleSendToSupplier = () => {
    if (!po) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await sendPurchaseOrder(po.id);
        if (result.success) {
          toast.success(`PO ${po.poNumber} sent to supplier`);
          setShowSendDialog(false);
          refetch();
        } else {
          toast.error(result.error || 'Failed to send PO');
        }
      } catch (error) {
        console.error('Error sending PO:', error);
        toast.error('Failed to send PO');
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      // Prevent closing while sending
      if (!isOpen && isPending) {
        return;
      }
      if (!isOpen) {
        onClose();
      }
    }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="space-y-1">
            {isLoading ? (
              <>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
              </>
            ) : po ? (
              <>
                <SheetTitle className="text-xl">{po.poNumber}</SheetTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(po.poDate).toLocaleDateString()}</span>
                  </div>
                  {po.orderSeries && (
                    <Badge variant="secondary" className="text-xs font-medium">
                      {po.orderSeries}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-medium',
                      PO_STATUS_COLORS[po.status]
                    )}
                  >
                    {PO_STATUS_LABELS[po.status]}
                  </Badge>
                </div>
              </>
            ) : null}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : po ? (
          <div className="mt-6 space-y-6">
            {/* Ship To Address */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Ship To
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  {po.shipToAddressStreet && <p>{po.shipToAddressStreet}</p>}
                  <p>
                    {[
                      po.shipToAddressCity,
                      po.shipToAddressState,
                      po.shipToAddressPostalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  {po.shipToAddressCountry && <p>{po.shipToAddressCountry}</p>}
                </div>
              </div>
            </div>

            <Separator />

            {/* Supplier & Order Series - Editable */}
            <div className="grid grid-cols-2 gap-4">
              {/* Supplier */}
              <div className="flex items-start gap-3">
                <div className="text-muted-foreground mt-0.5 flex-shrink-0">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Supplier</p>
                  {isEditingSupplier ? (
                    <div className="flex items-center gap-2">
                      <Select
                        defaultValue={currentSupplierId || 'none'}
                        onValueChange={handleUpdateSupplier}
                        disabled={isUpdatingSupplier}
                      >
                        <SelectTrigger className="h-8 w-[180px]">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select supplier</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isUpdatingSupplier ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setIsEditingSupplier(false)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {currentSupplier || '-'}
                      </p>
                      {canInlineEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => setIsEditingSupplier(true)}
                          title="Edit supplier"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Order Series - Editable (updates linked Sales Order) */}
              <div className="flex items-start gap-3">
                <div className="text-muted-foreground mt-0.5 flex-shrink-0">
                  <Layers className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Order Series</p>
                  {isEditingOrderSeries ? (
                    <div className="flex items-center gap-2">
                      <Select
                        defaultValue={po.orderSeries || 'none'}
                        onValueChange={handleUpdateOrderSeries}
                        disabled={isUpdatingOrderSeries}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {ORDER_SERIES.map((series) => (
                            <SelectItem key={series.id} value={series.code}>
                              {series.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isUpdatingOrderSeries ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setIsEditingOrderSeries(false)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {po.orderSeries || '-'}
                      </p>
                      {po.salesOrderId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => setIsEditingOrderSeries(true)}
                          title="Edit Order Series (updates Sales Order)"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                  {po.salesOrderId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      From linked Sales Order
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items ({po.items.length})
              </h3>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Product</TableHead>
                      <TableHead className="text-right font-semibold">Qty</TableHead>
                      <TableHead className="text-right font-semibold">Unit Price</TableHead>
                      <TableHead className="text-right font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.items.map((item) => {
                      const isServiceOrNonInventory = item.itemType === 'service' || item.itemType === 'non_inventory';
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-foreground">{item.sku}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">{item.description}</p>
                              )}
                              {item.supplierId && (
                                <Link
                                  href={`/suppliers/${item.supplierId}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors mt-1"
                                >
                                  <Building2 className="h-3 w-3" />
                                  <span>{item.supplierName}</span>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isServiceOrNonInventory ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <>
                                <span className="font-medium">{item.quantityOrdered}</span>
                                {item.quantityReceived > 0 && (
                                  <p className="text-xs text-emerald-600">
                                    {item.quantityReceived} received
                                  </p>
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell className="text-right">${(item.unitPrice / 100).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-semibold">${(item.lineTotal / 100).toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${(po.subtotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>${(po.taxTotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>${(po.shippingCost / 100).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Grand Total</span>
                <span>${(po.grandTotal / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Notes */}
            {(po.vendorNotes || po.internalNotes) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {po.vendorNotes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Vendor Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{po.vendorNotes}</p>
                    </div>
                  )}
                  {po.internalNotes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Internal Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{po.internalNotes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex gap-2">
              {onEdit && ['draft', 'sent'].includes(po.status) && (
                <Button
                  variant="outline"
                  onClick={handleEditClick}
                  className="flex-1"
                  disabled={isPending}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit PO
                </Button>
              )}
              {po.status === 'draft' && po.items.some((item) => item.supplierId) && (
                <Button
                  onClick={() => setShowSendDialog(true)}
                  className="flex-1"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send to Supplier
                    </>
                  )}
                </Button>
              )}
              {po.status === 'draft' && !po.items.some((item) => item.supplierId) && (
                <Button disabled className="flex-1" title="Assign suppliers to items first">
                  <Send className="mr-2 h-4 w-4" />
                  Send to Supplier
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Purchase order not found
          </div>
        )}

        {/* Send Confirmation Dialog */}
        <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send PO to Suppliers?</AlertDialogTitle>
              <AlertDialogDescription>
                This will send <span className="font-semibold">{po?.poNumber}</span> to suppliers:{' '}
                <span className="font-semibold">
                  {[...new Set(po?.items.filter((i) => i.supplierName).map((i) => i.supplierName))].join(', ') || 'N/A'}
                </span>.
                <br /><br />
                Suppliers will be able to view and respond to this PO in their portal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSendToSupplier} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send PO'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
