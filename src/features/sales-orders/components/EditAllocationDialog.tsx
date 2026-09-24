/**
 * EditAllocationDialog Component
 *
 * Dialog for editing an existing fulfillment allocation.
 * Allows updating fulfillment source (when pending), quantity, status, and notes.
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
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
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  updateFulfillmentAllocationSchema,
  type UpdateFulfillmentAllocationInput,
} from '@/features/sales-orders/validations/fulfillment-allocation.schema';
import { updateAllocationAction } from '@/features/sales-orders/actions/fulfillment-allocation.actions';
import type { FulfillmentAllocationWithDetails, FulfillmentSource, AllocationStatus } from '@/features/sales-orders/types';
import { getActiveLocationContacts } from '@/features/locations/actions/location-contacts';

// ============================================
// TYPES
// ============================================

interface EditAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: FulfillmentAllocationWithDetails;
  productId: string;
  remainingToAllocate: number;
  onSuccess: () => void;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
}

interface ContactOption {
  id: string;
  name: string;
  email: string;
}

interface DealerOption {
  id: string;
  name: string;
  code: string;
}

interface DealerLocationOption {
  id: string;
  name: string;
  address: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSourceLabel(source: FulfillmentSource): string {
  const labels: Record<FulfillmentSource, string> = {
    direct: 'Manufacturer (Direct)',
    gdc_inventory: 'GDC Inventory',
    platinum_dealer_inventory: 'Dealer Inventory',
    platinum_dealer_fulfillment: 'Dealer Fulfillment',
  };
  return labels[source];
}

// ============================================
// COMPONENT
// ============================================

export function EditAllocationDialog({
  open,
  onOpenChange,
  allocation,
  productId,
  remainingToAllocate,
  onSuccess,
}: EditAllocationDialogProps) {

  // State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data loading states
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [dealerLocations, setDealerLocations] = useState<DealerLocationOption[]>([]);

  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [loadingDealerLocations, setLoadingDealerLocations] = useState(false);

  const [inventoryInfo, setInventoryInfo] = useState<{
    onHand: number;
    allocated: number;
    available: number;
    loading: boolean;
  } | null>(null);

  // Calculate max quantity (current + remaining)
  const maxQuantity = allocation.quantity + remainingToAllocate;

  // Determine if source is editable (only when status is pending)
  const isSourceEditable = allocation.status === 'pending';

  // Form
  const form = useForm<UpdateFulfillmentAllocationInput>({
    resolver: zodResolver(updateFulfillmentAllocationSchema),
    defaultValues: {
      fulfillmentSource: allocation.fulfillmentSource as any,
      quantity: allocation.quantity,
      status: allocation.status as AllocationStatus,
      notes: allocation.notes || '',
      // GDC Inventory fields
      locationId: allocation.locationId || undefined,
      assignedContactId: allocation.assignedContactId || undefined,
      assignedUserId: allocation.assignedUserId || undefined,
      // Direct fields
      containerQty: allocation.containerQty || undefined,
      containerId: allocation.containerId || undefined,
      purchaseOrderId: allocation.purchaseOrderId || undefined,
      // Dealer fields
      platinumDealerId: allocation.platinumDealerId || undefined,
      dealerLocationId: allocation.dealerLocationId || undefined,
    },
  });

  // Watch fields
  const watchedSource = form.watch('fulfillmentSource' as any) || allocation.fulfillmentSource;
  const watchedQuantity = form.watch('quantity');
  const watchedContainerQty = form.watch('containerQty');
  const watchedLocationId = form.watch('locationId' as any);
  const watchedDealerId = form.watch('platinumDealerId' as any);

  // Calculate remaining container qty for direct source
  const remainingContainerQty =
    watchedSource === 'direct' && watchedContainerQty && watchedQuantity
      ? watchedContainerQty - watchedQuantity
      : 0;

  // Reset form when allocation changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        fulfillmentSource: allocation.fulfillmentSource as any,
        quantity: allocation.quantity,
        status: allocation.status as AllocationStatus,
        notes: allocation.notes || '',
        locationId: allocation.locationId || undefined,
        assignedContactId: allocation.assignedContactId || undefined,
        assignedUserId: allocation.assignedUserId || undefined,
        containerQty: allocation.containerQty || undefined,
        containerId: allocation.containerId || undefined,
        purchaseOrderId: allocation.purchaseOrderId || undefined,
        platinumDealerId: allocation.platinumDealerId || undefined,
        dealerLocationId: allocation.dealerLocationId || undefined,
      });
    }
  }, [open, allocation, form]);

  // Load data when source changes or dialog opens
  useEffect(() => {
    if (open) {
      if (watchedSource === 'gdc_inventory') {
        loadLocations();
        // Load contacts when location is selected
        if (watchedLocationId) {
          loadContacts(watchedLocationId);
        }
      } else if (watchedSource === 'platinum_dealer_inventory' || watchedSource === 'platinum_dealer_fulfillment') {
        loadDealers();
      } else if (watchedSource === 'direct' && remainingContainerQty > 0) {
        loadLocations();
      }
    }
  }, [open, watchedSource, remainingContainerQty, watchedLocationId]);

  // Load dealer locations when dealer selected
  useEffect(() => {
    if (open && watchedDealerId && (watchedSource === 'platinum_dealer_inventory' || watchedSource === 'platinum_dealer_fulfillment')) {
      loadDealerLocations(watchedDealerId);
    }
  }, [open, watchedDealerId, watchedSource]);

  // Load inventory when location selected (for GDC inventory or direct remaining)
  useEffect(() => {
    if (watchedLocationId && (watchedSource === 'gdc_inventory' || (watchedSource === 'direct' && remainingContainerQty > 0))) {
      loadInventory(watchedLocationId);
    } else {
      setInventoryInfo(null);
    }
  }, [watchedLocationId, watchedSource, remainingContainerQty]);

  // ============================================
  // DATA FETCHING
  // ============================================

  async function loadLocations() {
    try {
      setLoadingLocations(true);
      const { getAllLocationsAction } = await import('@/features/locations/actions');
      const result = await getAllLocationsAction({ type: 'warehouse' });

      if (result.success && result.data) {
        setLocations(
          result.data.map((loc) => ({
            id: loc.id,
            name: loc.name,
            code: loc.locationCode,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoadingLocations(false);
    }
  }

  async function loadContacts(locationId?: string) {
    try {
      setLoadingContacts(true);

      // If location ID is provided, load contacts for that location
      // Otherwise, load all active contacts
      if (locationId) {
        const result = await getActiveLocationContacts(locationId);

        if (result.success && result.data) {
          setContacts(
            result.data.map((contact) => ({
              id: contact.id,
              name: contact.name,
              email: contact.email || '',
            }))
          );
        }
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  }

  async function loadDealers() {
    try {
      setLoadingDealers(true);
      const { getAllDealersAction } = await import('@/features/platinum-dealers/actions');
      const result = await getAllDealersAction({ status: 'active' });

      if (result.success && result.data) {
        setDealers(
          result.data.map((dealer) => ({
            id: dealer.id,
            name: dealer.dealerName,
            code: dealer.code ?? '',
          }))
        );
      }
    } catch (error) {
      console.error('Error loading dealers:', error);
    } finally {
      setLoadingDealers(false);
    }
  }

  async function loadDealerLocations(dealerId: string) {
    try {
      setLoadingDealerLocations(true);
      const { getLocationsByDealerIdAction } = await import('@/features/platinum-dealers/actions');
      const result = await getLocationsByDealerIdAction(dealerId);

      if (result.success && result.data) {
        setDealerLocations(
          result.data.map((loc) => ({
            id: loc.id,
            name: loc.locationName,
            address: [
              loc.addressStreet,
              loc.addressCity,
              loc.addressState,
              loc.addressPostalCode,
            ]
              .filter(Boolean)
              .join(', '),
          }))
        );
      }
    } catch (error) {
      console.error('Error loading dealer locations:', error);
    } finally {
      setLoadingDealerLocations(false);
    }
  }

  async function loadInventory(locationId: string) {
    try {
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: true });

      const { getInventoryByProductAndLocation } = await import('@/features/inventory/actions');
      const result = await getInventoryByProductAndLocation(productId, locationId);

      if (result.success && result.data) {
        setInventoryInfo({
          onHand: result.data.onHand,
          allocated: result.data.allocated,
          available: result.data.onHand - result.data.allocated,
          loading: false,
        });
      } else {
        setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      setInventoryInfo({ onHand: 0, allocated: 0, available: 0, loading: false });
    }
  }

  // ============================================
  // HANDLERS
  // ============================================

  async function onSubmit(data: UpdateFulfillmentAllocationInput) {
    try {
      setIsSubmitting(true);

      const result = await updateAllocationAction(allocation.id, data, productId);

      if (result.success) {
        form.reset();
        onSuccess();
      } else {
        toast.error(result.error || 'Failed to update allocation');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    form.reset();
    onOpenChange(false);
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Allocation</DialogTitle>
          <DialogDescription>
            Update the allocation quantity, status, or notes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Fulfillment Source */}
            <FormField
              control={form.control}
              name={'fulfillmentSource' as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fulfillment Source</FormLabel>
                  {isSourceEditable ? (
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select fulfillment source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="direct">Manufacturer (Direct)</SelectItem>
                        <SelectItem value="gdc_inventory">GDC Inventory</SelectItem>
                        <SelectItem value="platinum_dealer_inventory">Dealer Inventory</SelectItem>
                        <SelectItem value="platinum_dealer_fulfillment">Dealer Fulfillment</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="bg-muted p-3 rounded-md text-sm font-medium">
                      {getSourceLabel(field.value as FulfillmentSource)}
                    </div>
                  )}
                  <FormDescription>
                    {isSourceEditable
                      ? 'Change fulfillment source (only available when status is Pending)'
                      : 'Cannot change source after allocation is confirmed'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Remaining Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{remainingToAllocate}</strong> units remaining to allocate (excluding
                this allocation)
              </AlertDescription>
            </Alert>

            {/* Customer Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === '' ? undefined : parseInt(value, 10));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Current: {allocation.quantity} | Maximum: {maxQuantity} units
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ====== GDC INVENTORY FIELDS ====== */}
            {watchedSource === 'gdc_inventory' && (
              <>
                {/* Location */}
                <FormField
                  control={form.control}
                  name={'locationId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse Location *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loadingLocations}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select warehouse location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.code} - {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Warehouse location to fulfill from
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contact */}
                <FormField
                  control={form.control}
                  name={'assignedContactId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Warehouse Contact *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loadingContacts}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select warehouse contact" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.name} ({contact.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Contact to receive pick ticket notification
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Inventory Info */}
                {inventoryInfo && watchedLocationId && (
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription>
                      {inventoryInfo.loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Loading inventory...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-medium text-sm text-blue-900">
                            Current Warehouse Inventory
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">On Hand:</span>
                              <span className="ml-2 font-semibold">{inventoryInfo.onHand}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Allocated:</span>
                              <span className="ml-2 font-semibold">{inventoryInfo.allocated}</span>
                            </div>
                            <div>
                              <span className="text-green-700">Available:</span>
                              <span className="ml-2 font-bold text-green-700">
                                {inventoryInfo.available}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* ====== DIRECT (MANUFACTURER) FIELDS ====== */}
            {watchedSource === 'direct' && (
              <>
                <FormField
                  control={form.control}
                  name="containerQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === '' ? undefined : parseInt(value, 10));
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Total units in the container
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., CONT-12345" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Show remaining calculation and location selector */}
                {remainingContainerQty > 0 && (
                  <>
                    <Alert className="bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <div className="font-medium text-sm text-amber-900">
                            Remaining Container Units
                          </div>
                          <div className="text-sm">
                            Container has{' '}
                            <span className="font-bold text-amber-700">
                              {remainingContainerQty} units
                            </span>{' '}
                            remaining after customer allocation. These units will be stored at
                            the selected warehouse location.
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>

                    <FormField
                      control={form.control}
                      name={'locationId' as any}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Warehouse Location (for remaining {remainingContainerQty} units) *
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={loadingLocations}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select warehouse to receive remaining units" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.code} - {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Where should the remaining {remainingContainerQty} units be stored?
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Warehouse Inventory Info */}
                    {inventoryInfo && watchedLocationId && (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertDescription>
                          {inventoryInfo.loading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Loading inventory...</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="font-medium text-sm text-blue-900">
                                Current Warehouse Inventory
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">On Hand:</span>
                                  <span className="ml-2 font-semibold">{inventoryInfo.onHand}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Allocated:</span>
                                  <span className="ml-2 font-semibold">{inventoryInfo.allocated}</span>
                                </div>
                                <div>
                                  <span className="text-green-700">Available:</span>
                                  <span className="ml-2 font-bold text-green-700">
                                    {inventoryInfo.available}
                                  </span>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                After receiving {remainingContainerQty} units, on-hand will be{' '}
                                <span className="font-semibold">
                                  {inventoryInfo.onHand + remainingContainerQty}
                                </span>
                              </div>
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </>
            )}

            {/* ====== DEALER INVENTORY FIELDS ====== */}
            {watchedSource === 'platinum_dealer_inventory' && (
              <>
                {/* Dealer */}
                <FormField
                  control={form.control}
                  name={'platinumDealerId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platinum Dealer *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loadingDealers}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platinum dealer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealers.map((dealer) => (
                            <SelectItem key={dealer.id} value={dealer.id}>
                              {dealer.code ? `${dealer.code} - ` : ''}
                              {dealer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Dealer who has inventory
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dealer Location */}
                <FormField
                  control={form.control}
                  name={'dealerLocationId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealer Location *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loadingDealerLocations || !watchedDealerId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={watchedDealerId ? "Select dealer location" : "Select dealer first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealerLocations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Specific dealer location with inventory
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* ====== DEALER FULFILLMENT FIELDS ====== */}
            {watchedSource === 'platinum_dealer_fulfillment' && (
              <>
                {/* Dealer */}
                <FormField
                  control={form.control}
                  name={'platinumDealerId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platinum Dealer *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loadingDealers}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select platinum dealer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dealers.map((dealer) => (
                            <SelectItem key={dealer.id} value={dealer.id}>
                              {dealer.code ? `${dealer.code} - ` : ''}
                              {dealer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Dealer who will fulfill the order
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Dealer Location (Optional) */}
                <FormField
                  control={form.control}
                  name={'dealerLocationId' as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dealer Location (Optional)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={loadingDealerLocations || !watchedDealerId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={watchedDealerId ? "Select dealer location (optional)" : "Select dealer first"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None (Dealer decides)</SelectItem>
                          {dealerLocations.map((loc) => (
                            <SelectItem key={loc.id} value={loc.id}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Specific dealer location (optional, dealer can choose)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* Status - Read Only */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <div className="bg-muted p-3 rounded-md text-sm font-medium capitalize">
                    {field.value?.replace(/_/g, ' ')}
                  </div>
                  <FormDescription>
                    Status is automatically managed by the system
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Additional notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Allocation
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
