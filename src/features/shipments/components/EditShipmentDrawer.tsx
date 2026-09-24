'use client';

/**
 * EditShipmentDrawer Component
 *
 * Drawer for correcting shipment details after it has been created —
 * carrier and tracking, dates, ship-to address, weight and packages.
 *
 * Status is changed here too, but only along the transitions the service
 * allows (see SHIPMENT_STATUS_TRANSITIONS). Rolling a shipment back to an
 * earlier status is not supported yet.
 */

import { useState, useEffect } from 'react';
import { Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';

import {
  getShipment,
  updateShipment,
  markShipmentInTransit,
  markShipmentDelivered,
  markShipmentFailed,
} from '../actions';
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_COLORS,
  SHIPMENT_STATUS_TRANSITIONS,
  type ShipmentStatus,
  type ShipmentWithItems,
} from '../types';

// ============================================
// TYPES
// ============================================

interface EditShipmentDrawerProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string | null;
  onSuccess?: () => void;
}

const editShipmentSchema = z.object({
  shipmentDate: z.string().min(1, 'Shipment date is required'),
  estimatedArrival: z.string(),
  actualArrival: z.string(),
  lfdDate: z.string(),
  carrier: z.string(),
  trackingNumber: z.string(),
  serviceType: z.string(),
  shipToName: z.string(),
  shipToAddressStreet: z.string(),
  shipToAddressCity: z.string(),
  shipToAddressState: z.string(),
  shipToAddressPostalCode: z.string(),
  shipToAddressCountry: z.string(),
  totalWeight: z.string(),
  weightUnit: z.string(),
  totalPackages: z.string(),
  notes: z.string(),
  deliveryInstructions: z.string(),
});

type EditShipmentForm = z.infer<typeof editShipmentSchema>;

// ============================================
// HELPERS
// ============================================

/** Format a Date (or null) as the yyyy-MM-dd a date input expects. */
function toDateInput(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

/** Statuses the service will actually accept from where the shipment is now. */
function allowedNextStatuses(current: ShipmentStatus): ShipmentStatus[] {
  return SHIPMENT_STATUS_TRANSITIONS[current] ?? [];
}

/** Route a status change to the action that performs it. */
function applyStatus(shipmentId: string, status: ShipmentStatus) {
  if (status === 'in_transit') {
    return markShipmentInTransit(shipmentId);
  }
  if (status === 'delivered') {
    return markShipmentDelivered(shipmentId);
  }
  return markShipmentFailed(shipmentId);
}

// ============================================
// COMPONENT
// ============================================

export function EditShipmentDrawer({
  open,
  onClose,
  shipmentId,
  onSuccess,
}: EditShipmentDrawerProps) {
  const [shipment, setShipment] = useState<ShipmentWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ShipmentStatus | ''>('');

  const form = useForm<EditShipmentForm>({
    resolver: zodResolver(editShipmentSchema),
    defaultValues: {
      shipmentDate: '',
      estimatedArrival: '',
      actualArrival: '',
      lfdDate: '',
      carrier: '',
      trackingNumber: '',
      serviceType: '',
      shipToName: '',
      shipToAddressStreet: '',
      shipToAddressCity: '',
      shipToAddressState: '',
      shipToAddressPostalCode: '',
      shipToAddressCountry: '',
      totalWeight: '',
      weightUnit: 'lbs',
      totalPackages: '1',
      notes: '',
      deliveryInstructions: '',
    },
  });

  useEffect(() => {
    if (open && shipmentId) {
      fetchShipment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shipmentId]);

  const fetchShipment = async () => {
    if (!shipmentId) { return; }

    setIsLoading(true);
    setPendingStatus('');
    try {
      const result = await getShipment(shipmentId);
      if (result.success && result.data) {
        const data = result.data as ShipmentWithItems;
        setShipment(data);
        form.reset({
          shipmentDate: toDateInput(data.shipmentDate),
          estimatedArrival: toDateInput(data.estimatedArrival),
          actualArrival: toDateInput(data.actualArrival),
          lfdDate: toDateInput(data.lfdDate),
          carrier: data.carrier || '',
          trackingNumber: data.trackingNumber || '',
          serviceType: data.serviceType || '',
          shipToName: data.shipToName || '',
          shipToAddressStreet: data.shipToAddressStreet || '',
          shipToAddressCity: data.shipToAddressCity || '',
          shipToAddressState: data.shipToAddressState || '',
          shipToAddressPostalCode: data.shipToAddressPostalCode || '',
          shipToAddressCountry: data.shipToAddressCountry || '',
          totalWeight: data.totalWeight !== null ? String(data.totalWeight) : '',
          weightUnit: data.weightUnit || 'lbs',
          totalPackages: String(data.totalPackages ?? 1),
          notes: data.notes || '',
          deliveryInstructions: data.deliveryInstructions || '',
        });
      } else {
        toast.error(result.error || 'Failed to load shipment');
        onClose();
      }
    } catch {
      toast.error('Failed to load shipment');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: EditShipmentForm) => {
    if (!shipmentId) { return; }

    const parsedWeight = data.totalWeight.trim() === '' ? null : Number(data.totalWeight);
    if (parsedWeight !== null && Number.isNaN(parsedWeight)) {
      form.setError('totalWeight', { message: 'Enter a number, or leave it blank' });
      return;
    }

    const parsedPackages = Number(data.totalPackages);
    if (Number.isNaN(parsedPackages) || parsedPackages < 1) {
      form.setError('totalPackages', { message: 'Must be at least 1' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateShipment(shipmentId, {
        shipmentDate: new Date(data.shipmentDate),
        estimatedArrival: data.estimatedArrival ? new Date(data.estimatedArrival) : null,
        actualArrival: data.actualArrival ? new Date(data.actualArrival) : null,
        lfdDate: data.lfdDate ? new Date(data.lfdDate) : null,
        carrier: data.carrier || null,
        trackingNumber: data.trackingNumber || null,
        serviceType: data.serviceType || null,
        shipToName: data.shipToName || null,
        shipToAddress: {
          street: data.shipToAddressStreet || null,
          city: data.shipToAddressCity || null,
          state: data.shipToAddressState || null,
          postalCode: data.shipToAddressPostalCode || null,
          country: data.shipToAddressCountry || null,
        },
        totalWeight: parsedWeight,
        weightUnit: data.weightUnit || 'lbs',
        totalPackages: parsedPackages,
        notes: data.notes || null,
        deliveryInstructions: data.deliveryInstructions || null,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to update shipment');
        return;
      }

      // A status change is applied after the field edits, not before: the
      // service refuses to edit a shipment once it is delivered or failed.
      if (pendingStatus) {
        const statusResult = await applyStatus(shipmentId, pendingStatus);

        if (!statusResult.success) {
          toast.error(
            `Details saved, but the status could not be changed: ${statusResult.error || 'unknown error'}`
          );
          onSuccess?.();
          return;
        }

        toast.success(
          `Shipment updated and marked ${SHIPMENT_STATUS_LABELS[pendingStatus]}`
        );
      } else {
        toast.success('Shipment updated');
      }

      onSuccess?.();
      onClose();
    } catch {
      toast.error('Failed to update shipment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setShipment(null);
      setPendingStatus('');
      form.reset();
      onClose();
    }
  };

  const nextStatuses = shipment ? allowedNextStatuses(shipment.status) : [];
  const isLocked = shipment ? !['pending', 'in_transit'].includes(shipment.status) : false;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${shipment?.shipmentNumber || 'Shipment'}`}
          </DialogTitle>
          <DialogDescription>
            Correct carrier, tracking, dates and delivery details.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-0 min-h-0 flex-1">
          <div className="px-6 py-4">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : shipment ? (
          <div className="space-y-6">
            {/* Status */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge className={SHIPMENT_STATUS_COLORS[shipment.status]}>
                  {SHIPMENT_STATUS_LABELS[shipment.status]}
                </Badge>
              </div>

              {nextStatuses.length > 0 ? (
                <div className="space-y-2">
                  <Select
                    value={pendingStatus}
                    onValueChange={(value) => setPendingStatus(value as ShipmentStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Change status to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nextStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {SHIPMENT_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pendingStatus && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Truck className="h-3.5 w-3.5" />
                      Applied when you save.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {SHIPMENT_STATUS_LABELS[shipment.status]} is a final status — it cannot be
                  changed from here yet.
                </p>
              )}
            </div>

            {isLocked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This shipment is {SHIPMENT_STATUS_LABELS[shipment.status].toLowerCase()}, so its
                details are read-only. Only pending and in-transit shipments can be edited.
              </div>
            )}

            <Form {...form}>
              <form
                id="edit-shipment-form"
                onSubmit={form.handleSubmit(handleSubmit)}
                className="space-y-6"
              >
                {/* Dates */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField
                    control={form.control}
                    name="shipmentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shipment date</FormLabel>
                        <FormControl>
                          <Input type="date" disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedArrival"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated arrival</FormLabel>
                        <FormControl>
                          <Input type="date" disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="actualArrival"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual arrival</FormLabel>
                        <FormControl>
                          <Input type="date" disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lfdDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Free Day (LFD)</FormLabel>
                        <FormControl>
                          <Input type="date" disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Carrier */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="carrier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carrier</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. CMA CGM" disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="trackingNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking number</FormLabel>
                        <FormControl>
                          <Input disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Ocean FCL" disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Ship to */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Ship to</h3>
                  <FormField
                    control={form.control}
                    name="shipToName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient</FormLabel>
                        <FormControl>
                          <Input disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="shipToAddressStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Street</FormLabel>
                        <FormControl>
                          <Input disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <FormField
                      control={form.control}
                      name="shipToAddressCity"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input disabled={isLocked} {...field} />
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
                            <Input disabled={isLocked} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="shipToAddressPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP</FormLabel>
                          <FormControl>
                            <Input disabled={isLocked} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="shipToAddressCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Load details */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="totalWeight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total weight</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={isLocked}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="weightUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isLocked}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="lbs">lbs</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalPackages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Packages</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" step="1" disabled={isLocked} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} disabled={isLocked} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deliveryInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery instructions</FormLabel>
                      <FormControl>
                        <Textarea rows={3} disabled={isLocked} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </form>
            </Form>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">Shipment not found</div>
        )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-shipment-form"
            disabled={isSubmitting || isLoading || isLocked || !shipment}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
