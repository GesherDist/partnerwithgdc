'use client';

/**
 * EditSalesOrderModal Component
 *
 * Modal for editing an existing sales order.
 * Fetches order data and pre-fills the form.
 * Only draft and pending orders can be edited.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

import { SalesOrderForm } from './SalesOrderForm';
import { getSalesOrder, updateSalesOrderFromDTO } from '../actions';
import { orderToFormValues, formToCreateDTO } from '../lib/schemas';
import type { SalesOrderWithItems, SalesOrderMasterData } from '../types';

// ============================================
// TYPES
// ============================================

interface EditSalesOrderDrawerProps {
  orderId: string | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (order: SalesOrderWithItems) => void;
  masterData: SalesOrderMasterData;
}

// ============================================
// COMPONENT
// ============================================

export function EditSalesOrderDrawer({
  orderId,
  open,
  onClose,
  onSuccess,
  masterData,
}: EditSalesOrderDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [order, setOrder] = useState<SalesOrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_isFormValid, setIsFormValid] = useState(false);

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
        // Check if order can be edited - allow draft, pending, confirmed, and processing
        if (['cancelled', 'shipped', 'delivered'].includes(result.data.status)) {
          setError(`Cannot edit order in "${result.data.status}" status. Order has been ${result.data.status}.`);
          setOrder(null);
        } else {
          setOrder(result.data);
        }
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

  const handleCancel = () => {
    if (isSubmitting) {return;}
    onClose();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUpdate = async (formData: any) => {
    if (!orderId || !order) {return;}

    setIsSubmitting(true);

    try {
      console.log('[EditSalesOrderDrawer] Form data received:', {
        itemsCount: formData.items?.length || 0,
        items: formData.items,
      });

      // Convert form data to DTO
      const dto = formToCreateDTO(formData);

      console.log('[EditSalesOrderDrawer] Updating order with DTO:', {
        orderDate: dto.orderDate,
        requestedDeliveryDate: dto.requestedDeliveryDate,
        orderSeries: dto.orderSeries,
        itemsCount: dto.items.length,
        items: dto.items,
      });

      // Update order header AND items
      const result = await updateSalesOrderFromDTO(orderId, dto);

      if (result.success && result.data) {
        console.log('[EditSalesOrderDrawer] ✅ Update successful. Returned data:', {
          orderNumber: result.data.orderNumber,
          itemsCount: result.data.items?.length || 0,
          items: result.data.items,
        });

        // CRITICAL: Close drawer IMMEDIATELY (synchronous, no waiting)
        console.log('[EditSalesOrderDrawer] Closing drawer immediately...');
        onClose();

        // Run background tasks AFTER drawer close (async, non-blocking)
        // Use setTimeout to ensure drawer close animation starts first
        setTimeout(() => {
          console.log('[EditSalesOrderDrawer] Running background tasks...');
          if (result.data) {
            toast.success(`Order ${result.data.orderNumber} updated successfully`);
            onSuccess?.(result.data);
          }
          console.log('[EditSalesOrderDrawer] ✅ Background tasks complete');
        }, 0);
      } else {
        console.error('[EditSalesOrderDrawer] ❌ Update failed:', result.error);
        toast.error(result.error || 'Failed to update order');
      }
    } catch (error) {
      console.error('Update order error:', error);
      toast.error('Failed to update order');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------
  // COMPUTED VALUES
  // ----------------------------------------

  // Convert order to form values
  const initialFormData = order ? orderToFormValues({
    orderDate: new Date(order.orderDate),
    requestedDeliveryDate: order.requestedDeliveryDate ? new Date(order.requestedDeliveryDate) : null,
    customerId: order.customerId,
    salesRepId: order.salesRepId,
    warehouseId: order.warehouseId,
    currencyCode: order.currencyCode,
    customerPoNumber: order.customerPoNumber,
    status: order.status,
    billingAddressStreet: order.billingAddressStreet,
    billingAddressCity: order.billingAddressCity,
    billingAddressState: order.billingAddressState,
    billingAddressPostalCode: order.billingAddressPostalCode,
    billingAddressCountry: order.billingAddressCountry,
    shippingAddressStreet: order.shippingAddressStreet,
    shippingAddressCity: order.shippingAddressCity,
    shippingAddressState: order.shippingAddressState,
    shippingAddressPostalCode: order.shippingAddressPostalCode,
    shippingAddressCountry: order.shippingAddressCountry,
    shippingMethod: order.shippingMethod,
    customerNotes: order.customerNotes,
    internalNotes: order.internalNotes,
    orderSeries: order.orderSeries,
    orderNumber: order.orderNumber,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unitCode: item.unitCode,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      taxRate: item.taxRate,
      warehouseId: item.warehouseId,
      batchNumber: item.batchNumber,
      serialNumber: item.serialNumber,
    })),
  }) : undefined;

  // Debug: Log the order data and converted form data
  useEffect(() => {
    if (order) {
      console.log('[EditSalesOrderDrawer] Raw order data:', {
        id: order.id,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        requestedDeliveryDate: order.requestedDeliveryDate,
        orderSeries: order.orderSeries,
        status: order.status,
      });
    }
    if (initialFormData) {
      console.log('[EditSalesOrderDrawer] initialFormData:', {
        orderDate: initialFormData.orderDate,
        requestedDeliveryDate: initialFormData.requestedDeliveryDate,
        orderSeries: initialFormData.orderSeries,
        orderNumber: initialFormData.orderNumber,
      });
    }
  }, [order, initialFormData]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-[1400px] flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${order?.orderNumber || 'Order'}`}
          </DialogTitle>
          <DialogDescription>
            {order?.customer?.name || 'Update order information'}
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
                <Button variant="outline" onClick={fetchOrder} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : order && initialFormData ? (
              <SalesOrderForm
                key={order.id}
                masterData={masterData}
                initialData={initialFormData}
                onSubmit={handleUpdate}
                onCancel={handleCancel}
                mode="edit"
                onValidationChange={setIsFormValid}
              />
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {order && !isLoading && !error && (
          <>
            <Separator />
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <div className="flex w-full items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="sales-order-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
