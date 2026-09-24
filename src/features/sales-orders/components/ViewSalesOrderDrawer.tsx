'use client';

/**
 * ViewSalesOrderDrawer Component
 *
 * Read-only drawer to view sales order details.
 * Fetches full order data with items when opened.
 */

import { useEffect, useState, useTransition } from 'react';
import { Loader2, MapPin, Package, FileText, Calendar, User, Building2, Truck, AlertTriangle, ShieldCheck, CheckCircle, XCircle, ClipboardList, Receipt, Pencil, Layers } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
import { PdfViewerModal } from '@/shared/components/pdf-viewer';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { getSalesOrder, releaseSalesOrderHold, confirmSalesOrder, cancelSalesOrder, updateSalesOrderSeries } from '../actions';
import { ORDER_SERIES } from '@/shared/lib/global-data';
import { createInvoiceFromSalesOrder } from '@/features/invoices/actions';
import type { SalesOrderWithItems } from '../types';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_CREDIT_STATUS_LABELS,
  ORDER_CREDIT_STATUS_COLORS,
} from '../types';
import { ConfirmAllocationsModal } from './ConfirmAllocationsModal';
import { toast } from 'sonner';
import { AllocationManager } from './AllocationManager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

// ============================================
// TYPES
// ============================================

interface ViewSalesOrderDrawerProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (order: SalesOrderWithItems) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(date: Date | string | null): string {
  if (!date) {return '-';}
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value || value === '-') {return null;}
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function AddressDisplay({ label, address }: {
  label: string;
  address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }
}) {
  const hasAddress = address.street || address.city || address.state;
  if (!hasAddress) {return null;}

  const lines = [
    address.street,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3">
      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {lines.map((line, i) => (
          <p key={i} className="text-sm font-medium text-foreground">{line}</p>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ViewSalesOrderDrawer({
  orderId,
  open,
  onClose,
  onEdit,
}: ViewSalesOrderDrawerProps) {
  const { hasPermission } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canEditPermission = hasMounted && hasPermission('orders.edit');
  const canReleaseHold = hasMounted && hasPermission('sales_orders.release_hold');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [order, setOrder] = useState<SalesOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
const [isReleasingHold, setIsReleasingHold] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showConfirmAllocationsModal, setShowConfirmAllocationsModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Order Series inline edit
  const [isEditingOrderSeries, setIsEditingOrderSeries] = useState(false);
  const [isUpdatingOrderSeries, setIsUpdatingOrderSeries] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  useEffect(() => {
    if (open && orderId) {
      fetchOrder();
    } else {
      setOrder(null);
      setError(null);
    }
  }, [open, orderId]);


  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const fetchOrder = async () => {
    if (!orderId) {return;}

    setIsLoading(true);
    setError(null);

    try {
      const result = await getSalesOrder(orderId);
      if (result.success && result.data) {
        setOrder(result.data);
      } else {
        setError(result.error || 'Failed to load order');
      }
    } catch {
      setError('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleEdit = () => {
    if (order) {
      onEdit?.(order);
    }
  };

  const handleUpdateOrderSeries = async (newOrderSeries: string) => {
    if (!order) { return; }

    setIsUpdatingOrderSeries(true);
    try {
      // Use dedicated action that allows update in any status
      const result = await updateSalesOrderSeries(order.id, newOrderSeries || null);
      if (result.success) {
        toast.success('Order series updated');
        setIsEditingOrderSeries(false);
        // Refresh order data
        await fetchOrder();
      } else {
        toast.error(result.error || 'Failed to update order series');
      }
    } catch {
      toast.error('Failed to update order series');
    } finally {
      setIsUpdatingOrderSeries(false);
    }
  };

  const handleViewPdf = () => {
    if (!order) { return; }
    setShowPdfModal(true);
  };

const handleReleaseHold = async () => {
    if (!order) { return; }

    setIsReleasingHold(true);
    try {
      const result = await releaseSalesOrderHold(order.id);
      if (result.success) {
        toast.success('Credit hold released successfully');
        // Refresh order data
        await fetchOrder();
      } else {
        toast.error(result.error || 'Failed to release hold');
      }
    } catch {
      toast.error('Failed to release hold');
    } finally {
      setIsReleasingHold(false);
    }
  };

  // Check Order Series before opening confirm dialog
  const handleConfirmClick = async () => {
    if (!order) {
      return;
    }

    setIsValidating(true);

    try {
      // Validation 1: Check Order Series is set
      if (!order.orderSeries || order.orderSeries.trim() === '') {
        toast.error('Order Series is required. Please set the Order Series before confirming.');
        return;
      }

      // Validation 2: Check all items are fully allocated
      const { validateOrderFullyAllocatedAction } = await import('@/features/sales-orders/actions/fulfillment-allocation.actions');
      const validationResult = await validateOrderFullyAllocatedAction(order.id);

      if (!validationResult.success) {
        toast.error(validationResult.error || 'Failed to validate allocations');
        return;
      }

      if (!validationResult.data?.fullyAllocated) {
        const unallocatedItems = validationResult.data?.unallocatedItems || [];

        // Simple error message
        toast.error(
          `Cannot confirm order. ${unallocatedItems.length} item(s) need allocation. Please allocate fulfillment sources before confirming.`,
          { duration: 5000 }
        );
        return;
      }

      // All validations passed - open confirm allocations modal
      setShowConfirmAllocationsModal(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirm = () => {
    if (!order) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await confirmSalesOrder(order.id);
        if (result.success) {
          toast.success(`Order ${order.orderNumber} confirmed`);
          setShowConfirmDialog(false);
          fetchOrder(); // Refresh order data
        } else {
          toast.error(result.error || 'Failed to confirm order');
        }
      } catch (error) {
        console.error('Error confirming order:', error);
        toast.error('Failed to confirm order');
      }
    });
  };

  const handleCancel = () => {
    if (!order) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await cancelSalesOrder(order.id, cancelReason || undefined);
        if (result.success) {
          toast.success(`Order ${order.orderNumber} cancelled`);
          setShowCancelDialog(false);
          setCancelReason('');
          fetchOrder(); // Refresh order data
        } else {
          toast.error(result.error || 'Failed to cancel order');
        }
      } catch (error) {
        console.error('Error cancelling order:', error);
        toast.error('Failed to cancel order');
      }
    });
  };

  const handleCreateInvoice = () => {
    if (!order) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await createInvoiceFromSalesOrder(order.id);
        if (result.success) {
          toast.success(`Invoice created for ${order.orderNumber}`);
          setShowInvoiceDialog(false);
        } else {
          toast.error(result.error || 'Failed to create invoice');
        }
      } catch (error) {
        console.error('Error creating invoice:', error);
        toast.error('Failed to create invoice');
      }
    });
  };

  // Can only edit draft or pending orders (and must have permission)
  const canEdit = order && ['draft', 'pending'].includes(order.status) && canEditPermission;
  // Can confirm draft or pending orders
  const canConfirm = order && ['draft', 'pending'].includes(order.status) && canEditPermission;
  // Can cancel any order except delivered/cancelled
  const canCancel = order && !['delivered', 'cancelled'].includes(order.status) && canEditPermission;
  // Can create invoice for confirmed, processing, shipped, or delivered orders
  const canCreateInvoice = order &&
    ['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status) &&
    canEditPermission;

  // Check if order is on credit hold
  const isOnHold = order?.creditStatus === 'hold';

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1000px]"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : order?.orderNumber || 'Order Details'}
          </SheetTitle>
          <SheetDescription>
            {order?.customer?.name || 'View order information'}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={fetchOrder} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : order ? (
              <div className="space-y-4">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={ORDER_STATUS_COLORS[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                  {isOnHold && (
                    <Badge className={ORDER_CREDIT_STATUS_COLORS['hold']}>
                      {ORDER_CREDIT_STATUS_LABELS['hold']}
                    </Badge>
                  )}
                </div>

                {/* Credit Hold Banner */}
                {isOnHold && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                          Credit Hold
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          This order is on credit hold and cannot be processed until released by Finance.
                        </p>
                        {canReleaseHold && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
                            onClick={handleReleaseHold}
                            disabled={isReleasingHold}
                          >
                            {isReleasingHold ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Releasing...
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                Release Hold
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Info */}
                <Section title="Order Information">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem
                      label="Order Number"
                      value={order.orderNumber}
                      icon={<FileText className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Order Date"
                      value={formatDate(order.orderDate)}
                      icon={<Calendar className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Requested Delivery"
                      value={formatDate(order.requestedDeliveryDate)}
                      icon={<Truck className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Customer PO"
                      value={order.customerPoNumber || '-'}
                      icon={<FileText className="h-4 w-4" />}
                    />

                    {/* Order Series - Inline Edit */}
                    <div className="flex items-start gap-3">
                      <Layers className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">
                          Order Series <span className="text-destructive">*</span>
                        </p>
                        {isEditingOrderSeries ? (
                          <div className="flex items-center gap-2">
                            <Select
                              defaultValue={order.orderSeries || ''}
                              onValueChange={handleUpdateOrderSeries}
                              disabled={isUpdatingOrderSeries}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="Select order series" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Select order series</SelectItem>
                                {ORDER_SERIES.map((series) => (
                                  <SelectItem key={series.id} value={series.code}>
                                    {series.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setIsEditingOrderSeries(false)}
                              disabled={isUpdatingOrderSeries}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {order.orderSeries || '-'}
                            </span>
                            {canEditPermission && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => setIsEditingOrderSeries(true)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {order.pickTickets && order.pickTickets.length > 0 && (
                      <InfoItem
                        label="Pick Ticket"
                        value={order.pickTickets.map(pt => pt.ticketNumber).join(', ')}
                        icon={<ClipboardList className="h-4 w-4" />}
                      />
                    )}
                  </div>
                </Section>

                {/* Customer & Sales Rep */}
                <Section title="Customer & Sales">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <InfoItem
                      label="Customer"
                      value={order.customer?.name}
                      icon={<Building2 className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Sales Representative"
                      value={order.salesRep ? `${order.salesRep.firstName} ${order.salesRep.lastName}` : null}
                      icon={<User className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Warehouse"
                      value={order.warehouse?.name}
                      icon={<Package className="h-4 w-4" />}
                    />
                  </div>
                </Section>

                {/* Addresses */}
                <Section title="Addresses">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AddressDisplay
                      label="Billing Address"
                      address={{
                        street: order.billingAddressStreet,
                        city: order.billingAddressCity,
                        state: order.billingAddressState,
                        postalCode: order.billingAddressPostalCode,
                        country: order.billingAddressCountry,
                      }}
                    />
                    <AddressDisplay
                      label="Shipping Address"
                      address={{
                        street: order.shippingAddressStreet,
                        city: order.shippingAddressCity,
                        state: order.shippingAddressState,
                        postalCode: order.shippingAddressPostalCode,
                        country: order.shippingAddressCountry,
                      }}
                    />
                  </div>
                  {order.shippingMethod && (
                    <div className="mt-4">
                      <InfoItem label="Shipping Method" value={order.shippingMethod} icon={<Truck className="h-4 w-4" />} />
                    </div>
                  )}
                </Section>

                {/* Order Items */}
                <Section title="Order Items">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="text-right font-semibold">Qty</TableHead>
                          <TableHead className="text-right font-semibold">Unit Price</TableHead>
                          <TableHead className="text-right font-semibold">Disc %</TableHead>
                          <TableHead className="text-right font-semibold">Tax</TableHead>
                          <TableHead className="text-right font-semibold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map((item) => {
                          const isServiceOrNonInventory = item.itemType === 'service' || item.itemType === 'non_inventory';
                          // Calculate line total with tax included
                          const taxAmount = item.lineTotal * (item.taxRate / 100);
                          const lineTotalWithTax = item.lineTotal + taxAmount;
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-foreground">{item.sku}</p>
                                  <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {isServiceOrNonInventory ? '-' : item.quantity}
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                              <TableCell className="text-right">
                                {isServiceOrNonInventory ? '-' : `${item.discountPercent}%`}
                              </TableCell>
                              <TableCell className="text-right">{item.taxRate}%</TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(lineTotalWithTax)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Section>

                {/* Fulfillment Allocations */}
                {order.status !== 'cancelled' && order.items.length > 0 && (
                  <Section title="Fulfillment Allocations">
                    <Tabs defaultValue={order.items[0]?.id || 'none'} className="w-full">
                      <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${order.items.filter(item => item.itemType !== 'service' && item.itemType !== 'non_inventory').length}, 1fr)` }}>
                        {order.items
                          .filter(item => item.itemType !== 'service' && item.itemType !== 'non_inventory')
                          .map((item) => (
                            <TabsTrigger key={item.id} value={item.id}>
                              {item.sku}
                            </TabsTrigger>
                          ))}
                      </TabsList>
                      {order.items
                        .filter(item => item.itemType !== 'service' && item.itemType !== 'non_inventory')
                        .map((item) => (
                          <TabsContent key={item.id} value={item.id} className="mt-4">
                            <AllocationManager
                              salesOrderItemId={item.id}
                              productId={item.productId}
                              productName={`${item.sku} - ${item.description}`}
                              customerQty={item.quantity}
                              onAllocationsChange={fetchOrder}
                            />
                          </TabsContent>
                        ))}
                    </Tabs>
                  </Section>
                )}

                {/* Order Totals */}
                <Section title="Order Summary">
                  <div className="space-y-3 max-w-xs ml-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                    </div>
                    {order.discountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-destructive">-{formatCurrency(order.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">{formatCurrency(order.taxTotal)}</span>
                    </div>
                    {order.shippingCost > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Shipping</span>
                        <span className="font-medium">{formatCurrency(order.shippingCost)}</span>
                      </div>
                    )}
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-base font-semibold">
                        <span>Grand Total</span>
                        <span className="text-primary">{formatCurrency(order.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Notes */}
                {(order.customerNotes || order.internalNotes) && (
                  <Section title="Notes">
                    <div className="space-y-4">
                      {order.customerNotes && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Notes</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{order.customerNotes}</p>
                        </div>
                      )}
                      {order.internalNotes && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Internal Notes</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{order.internalNotes}</p>
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Cancellation Info */}
                {order.status === 'cancelled' && order.cancellationReason && (
                  <Section title="Cancellation" className="border-destructive/50">
                    <div className="bg-destructive/10 rounded-md p-3">
                      <p className="text-sm text-destructive font-medium">{order.cancellationReason}</p>
                      {order.cancelledAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Cancelled on {formatDate(order.cancelledAt)}
                        </p>
                      )}
                    </div>
                  </Section>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {order && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {canCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Order
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewPdf}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View PDF
                </Button>
                {canEdit && onEdit && (
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    Edit Order
                  </Button>
                )}
                {canCreateInvoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowInvoiceDialog(true)}
                    disabled={isPending}
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Button>
                )}
                {canConfirm && (
                  <Button size="sm" onClick={handleConfirmClick} disabled={isPending || isValidating}>
                    {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {!isValidating && <CheckCircle className="mr-2 h-4 w-4" />}
                    {isValidating ? 'Validating...' : 'Confirm Order'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirm Allocations Modal */}
        {order && (
          <ConfirmAllocationsModal
            open={showConfirmAllocationsModal}
            onOpenChange={setShowConfirmAllocationsModal}
            salesOrderId={order.id}
            salesOrderNumber={order.orderNumber}
            onConfirmComplete={() => {
              // Close modal and refresh sales order data
              setShowConfirmAllocationsModal(false);
              fetchOrder(); // Refresh sales order data without full page reload
            }}
          />
        )}

        {/* Confirm Order Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will confirm order <span className="font-semibold">{order?.orderNumber}</span>.
                <br /><br />
                Once confirmed, the order will be ready for processing and you can create a Purchase Order.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Order Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel order <span className="font-semibold">{order?.orderNumber}</span>.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="cancelReason">Cancellation Reason (optional)</Label>
              <Textarea
                id="cancelReason"
                placeholder="Enter reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Back</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel Order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Pick Ticket Dialog */}
        {/* Create Invoice Dialog */}
        <AlertDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create Invoice</AlertDialogTitle>
              <AlertDialogDescription>
                Create an invoice for order <span className="font-semibold">{order?.orderNumber}</span>.
                <br /><br />
                This will create a draft invoice with all items from this sales order.
                You can edit the invoice details before sending it to the customer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCreateInvoice} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Receipt className="mr-2 h-4 w-4" />
                Create Invoice
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* PDF Viewer Modal */}
        {order && (
          <PdfViewerModal
            open={showPdfModal}
            onClose={() => setShowPdfModal(false)}
            pdfUrl={`/api/sales-orders/${order.id}/pdf`}
            title={`Sales Order - ${order.orderNumber}`}
            fileName={`SalesOrder-${order.orderNumber}.pdf`}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
