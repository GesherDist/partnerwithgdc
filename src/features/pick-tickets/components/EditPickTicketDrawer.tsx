'use client';

/**
 * EditPickTicketDrawer Component
 *
 * Drawer for editing pick ticket details (status, priority, assignment, warehouse, notes).
 */

import { useState, useEffect } from 'react';
import { Loader2, ClipboardList, CheckCircle2 } from 'lucide-react';
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
import { Separator } from '@/shared/components/ui/separator';
import { Label } from '@/shared/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import { getPickTicket, updatePickTicket, completePicking } from '../actions';
import { createPackingListFromPickTicket } from '../actions/packing-list.actions';
import { getLocations } from '@/features/locations/actions';
import { getActiveLocationContacts } from '@/features/locations/actions/location-contacts';
import {
  PICK_TICKET_STATUSES,
  PICK_TICKET_STATUS_LABELS,
  PICK_TICKET_STATUS_TRANSITIONS,
  PICK_TICKET_PRIORITIES,
  PICK_TICKET_PRIORITY_LABELS,
  type PickTicketStatus,
  type PickTicketPriority,
  type PickTicketWithItems,
  type PickTicketItem,
} from '../types';

// ============================================
// TYPES
// ============================================

interface EditPickTicketDrawerProps {
  open: boolean;
  onClose: () => void;
  pickTicketId: string | null;
  onSuccess?: () => void;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface LocationContactOption {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface EditableItem extends PickTicketItem {
  newQuantityToPick: number;
  newQuantityPicked: number;
}

// Form schema
const editPickTicketSchema = z.object({
  status: z.enum(['pending', 'assigned', 'picking', 'picked', 'packing', 'packed', 'shipped', 'cancelled']),
  assignedTo: z.string().nullable().optional(),
  assignedContactId: z.string().nullable().optional(),
  warehouseId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  notes: z.string().nullable().optional(),
  specialInstructions: z.string().nullable().optional(),
});

type EditPickTicketForm = z.infer<typeof editPickTicketSchema>;

// ============================================
// COMPONENT
// ============================================

export function EditPickTicketDrawer({
  open,
  onClose,
  pickTicketId,
  onSuccess,
}: EditPickTicketDrawerProps) {
  const [pickTicket, setPickTicket] = useState<PickTicketWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [locationContacts, setLocationContacts] = useState<LocationContactOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [isCreatingPackingList, setIsCreatingPackingList] = useState(false);
  const [isCompletingPicking, setIsCompletingPicking] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'create_packing_list' | 'complete_picking' | null>(null);

  const form = useForm<EditPickTicketForm>({
    resolver: zodResolver(editPickTicketSchema),
    defaultValues: {
      status: 'pending',
      assignedTo: null,
      assignedContactId: null,
      warehouseId: '',
      priority: 'normal',
      notes: '',
      specialInstructions: '',
    },
  });

  // Fetch pick ticket and options when drawer opens
  useEffect(() => {
    if (open && pickTicketId) {
      fetchPickTicket();
      fetchOptions();
    }
  }, [open, pickTicketId]);

  // Fetch location contacts when warehouse changes
  useEffect(() => {
    const warehouseId = form.watch('warehouseId');
    if (warehouseId) {
      fetchLocationContacts(warehouseId);
    } else {
      setLocationContacts([]);
    }
  }, [form.watch('warehouseId')]);

  const fetchOptions = async () => {
    setIsLoadingOptions(true);
    try {
      // Fetch warehouses
      const locationsResult = await getLocations({ locationType: 'warehouse', limit: 100 });

      if (locationsResult.success && locationsResult.data) {
        const locationsData = locationsResult.data as { data: Array<{ id: string; name: string; location_code: string }> };
        if (locationsData.data) {
          setWarehouses(
            locationsData.data.map((loc) => ({
              id: loc.id,
              name: loc.name,
              code: loc.location_code,
            }))
          );
        }
      }
    } catch (error) {
      console.error('Failed to load options:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const fetchLocationContacts = async (warehouseId: string) => {
    setIsLoadingContacts(true);
    try {
      const result = await getActiveLocationContacts(warehouseId);
      if (result.success && result.data) {
        setLocationContacts(
          result.data.map((contact) => ({
            id: contact.id,
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
          }))
        );
      } else {
        setLocationContacts([]);
      }
    } catch (error) {
      console.error('Failed to load location contacts:', error);
      setLocationContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchPickTicket = async () => {
    if (!pickTicketId) { return; }

    setIsLoading(true);
    try {
      const result = await getPickTicket(pickTicketId);
      if (result.success && result.data) {
        setPickTicket(result.data);
        // Set form values
        form.reset({
          status: result.data.status,
          assignedTo: result.data.assignedTo || null,
          assignedContactId: result.data.assignedContactId || null,
          warehouseId: result.data.warehouseId || '',
          priority: result.data.priority,
          notes: result.data.notes || '',
          specialInstructions: result.data.specialInstructions || '',
        });
        // Initialize editable items
        setEditableItems(
          (result.data.items || []).map((item) => ({
            ...item,
            newQuantityToPick: item.quantityToPick,
            newQuantityPicked: item.quantityPicked,
          }))
        );
        // Fetch location contacts if warehouse is set
        if (result.data.warehouseId) {
          fetchLocationContacts(result.data.warehouseId);
        }
      } else {
        toast.error('Failed to load pick ticket');
        onClose();
      }
    } catch {
      toast.error('Failed to load pick ticket');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: EditPickTicketForm) => {
    if (!pickTicketId) { return; }

    // Validate items: quantity_picked must be <= quantity_to_pick
    const invalidItems = editableItems.filter(
      (item) => item.newQuantityPicked > item.newQuantityToPick
    );
    if (invalidItems.length > 0) {
      toast.error(`Picked quantity cannot exceed quantity to pick for: ${invalidItems.map(i => i.sku).join(', ')}`);
      return;
    }

    // If status is "picked" and action selected, validate all items are picked
    if (data.status === 'picked' && selectedAction && !allItemsPicked) {
      toast.error('Please pick all items before completing');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get items that have changed quantities (use Number() to ensure consistent comparison)
      const changedItems = editableItems
        .filter((item) =>
          Number(item.newQuantityToPick) !== Number(item.quantityToPick) ||
          Number(item.newQuantityPicked) !== Number(item.quantityPicked)
        )
        .map((item) => ({
          id: item.id,
          quantityToPick: Number(item.newQuantityToPick),
          quantityPicked: Number(item.newQuantityPicked),
        }));

      console.log('[EditPickTicketDrawer] Submitting update:', {
        pickTicketId,
        changedItems,
        selectedAction,
        editableItems: editableItems.map(i => ({
          id: i.id,
          sku: i.sku,
          quantityToPick: i.quantityToPick,
          newQuantityToPick: i.newQuantityToPick,
          quantityPicked: i.quantityPicked,
          newQuantityPicked: i.newQuantityPicked,
        })),
      });

      // Step 1: Always update pick ticket first
      const result = await updatePickTicket(pickTicketId, {
        status: data.status as PickTicketStatus,
        assignedTo: data.assignedTo || null,
        assignedContactId: data.assignedContactId || null,
        warehouseId: data.warehouseId || undefined,
        priority: data.priority as PickTicketPriority,
        notes: data.notes || null,
        specialInstructions: data.specialInstructions || null,
        items: changedItems.length > 0 ? changedItems : undefined,
      });

      if (!result.success) {
        const errorMessage = 'error' in result ? result.error : 'Failed to update pick ticket';
        toast.error(errorMessage || 'Failed to update pick ticket');
        setIsSubmitting(false);
        return;
      }

      // Step 2: If status is "picked" and an action is selected, execute that action
      if (data.status === 'picked' && selectedAction && pickTicket) {
        if (selectedAction === 'create_packing_list') {
          await handleCreatePackingList();
          return;
        } else if (selectedAction === 'complete_picking') {
          await handleCompletePicking();
          return;
        }
      }

      // Step 3: No action selected, just show success
      toast.success('Pick ticket updated successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating pick ticket:', error);
      toast.error('Failed to update pick ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuantityToPickChange = (itemId: string, quantity: number) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, newQuantityToPick: Math.max(0, quantity) }
          : item
      )
    );
  };

  const handleQuantityPickedChange = (itemId: string, quantity: number) => {
    setEditableItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, newQuantityPicked: Math.max(0, quantity) }
          : item
      )
    );
  };

  const handleQuantityBlur = (itemId: string) => {
    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        // Ensure picked <= to_pick
        const maxPicked = item.newQuantityToPick;
        if (item.newQuantityPicked > maxPicked) {
          return { ...item, newQuantityPicked: maxPicked };
        }
        return item;
      })
    );
  };

  // Get valid next statuses based on current status
  const getValidNextStatuses = (currentStatus: PickTicketStatus): PickTicketStatus[] => {
    const validTransitions = PICK_TICKET_STATUS_TRANSITIONS[currentStatus] || [];

    // Hide only 'packing' from manual selection (auto-set when Create Packing List clicked)
    // Keep 'packed' visible - user can manually change from 'packing' to 'packed'
    return validTransitions.filter(s => s !== 'packing');
  };

  // Check if we can show action buttons based on FORM status (not original pick ticket status)
  const formStatus = form.watch('status');

  const canShowActionButtons = pickTicket &&
    formStatus === 'picked' &&
    !pickTicket.packingList;

  // Check if all items are picked
  const allItemsPicked = editableItems.every(
    (item) => item.newQuantityPicked >= item.newQuantityToPick
  );
  const hasIncompleteItems = formStatus === 'picked' && !allItemsPicked;

  // Check if shipped status should be disabled
  const isShippedDisabled = (status: PickTicketStatus): boolean => {
    if (status !== 'shipped') return false;

    // If packing list exists but not packed/shipped, disable "shipped" status
    if (pickTicket?.packingList) {
      const plStatus = pickTicket.packingList.status;
      return plStatus !== 'packed' && plStatus !== 'shipped';
    }

    return false;
  };

  // Handlers for action buttons (now just selects the action)
  const handleSelectCreatePackingList = () => {
    setSelectedAction('create_packing_list');
  };

  const handleSelectCompletePicking = () => {
    setSelectedAction('complete_picking');
  };

  // Actual execution handlers (called from handleSubmit after pick ticket is updated)
  const handleCreatePackingList = async () => {
    if (!pickTicket) return;

    setIsCreatingPackingList(true);
    try {
      const result = await createPackingListFromPickTicket(pickTicket.id);
      if (result.success) {
        toast.success('Pick ticket updated and packing list created successfully');
        onSuccess?.();
        handleClose();
      } else {
        toast.error(result.error || 'Failed to create packing list');
      }
    } catch (error) {
      console.error('Error creating packing list:', error);
      toast.error('Failed to create packing list');
    } finally {
      setIsCreatingPackingList(false);
    }
  };

  const handleCompletePicking = async () => {
    if (!pickTicket) return;

    setIsCompletingPicking(true);
    try {
      const result = await completePicking(pickTicket.id);
      if (result.success) {
        toast.success('Pick ticket completed and shipped successfully');
        onSuccess?.();
        handleClose();
      } else {
        toast.error(result.error || 'Failed to complete picking');
      }
    } catch (error) {
      console.error('Error completing picking:', error);
      toast.error('Failed to complete picking');
    } finally {
      setIsCompletingPicking(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPickTicket(null);
      setWarehouses([]);
      setEditableItems([]);
      setSelectedAction(null);
      form.reset();
      onClose();
    }
  };

  // Reset selected action when status changes from "picked"
  useEffect(() => {
    if (formStatus !== 'picked') {
      setSelectedAction(null);
    }
  }, [formStatus]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col p-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${pickTicket?.pickTicketNumber || 'Pick Ticket'}`}
          </DialogTitle>
          <DialogDescription>
            Update pick ticket details
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(90vh - 180px)' }}>
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : pickTicket ? (
          <Form {...form}>
            <form
              id="edit-pick-ticket-form"
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >

              {/* Status & Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => {
                    const validStatuses = pickTicket
                      ? getValidNextStatuses(pickTicket.status)
                      : [];

                    // Always include current status
                    const displayStatuses = pickTicket
                      ? [pickTicket.status, ...validStatuses.filter(s => s !== pickTicket.status)]
                      : PICK_TICKET_STATUSES;

                    return (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={isSubmitting || pickTicket?.status === 'shipped' || pickTicket?.status === 'cancelled'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {displayStatuses.map((status) => {
                              const isCurrent = status === pickTicket?.status;
                              const isDisabled = isCurrent || isShippedDisabled(status);

                              return (
                                <SelectItem
                                  key={status}
                                  value={status}
                                  disabled={isDisabled}
                                >
                                  {PICK_TICKET_STATUS_LABELS[status]}
                                  {isCurrent && ' (Current)'}
                                  {isShippedDisabled(status) && ' (Complete packing first)'}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Priority */}
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PICK_TICKET_PRIORITIES.map((priority) => (
                            <SelectItem key={priority} value={priority}>
                              {PICK_TICKET_PRIORITY_LABELS[priority]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Warehouse */}
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse</FormLabel>
                    <Select
                      value={field.value || ''}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || isLoadingOptions}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingOptions ? 'Loading...' : 'Select warehouse'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {warehouses.map((warehouse) => (
                          <SelectItem key={warehouse.id} value={warehouse.id}>
                            {warehouse.name} ({warehouse.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assigned To - Shows location contacts */}
              <FormField
                control={form.control}
                name="assignedContactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <Select
                      value={field.value || 'unassigned'}
                      onValueChange={(value) => field.onChange(value === 'unassigned' ? null : value)}
                      disabled={isSubmitting || isLoadingContacts || !form.watch('warehouseId')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            !form.watch('warehouseId')
                              ? 'Select warehouse first'
                              : isLoadingContacts
                                ? 'Loading contacts...'
                                : 'Select contact'
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {locationContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.name} - {contact.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              {/* Items Table */}
              {editableItems.length > 0 && (
                <div className="space-y-3">
                  <Label>Items</Label>
                  {hasIncompleteItems && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700 font-medium">
                        ⚠️ Not all items have been picked. Please pick all items before completing.
                      </p>
                    </div>
                  )}
                  <div className={`rounded-md border ${hasIncompleteItems ? 'border-red-500 border-2' : ''}`}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">SKU</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[100px] text-right">Qty to Pick</TableHead>
                          <TableHead className="w-[100px] text-right">Picked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editableItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.sku}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {item.description || '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                value={item.newQuantityToPick}
                                onChange={(e) =>
                                  handleQuantityToPickChange(item.id, parseInt(e.target.value) || 0)
                                }
                                onBlur={() => handleQuantityBlur(item.id)}
                                disabled={isSubmitting}
                                className="h-8 w-20 text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                max={item.newQuantityToPick}
                                value={item.newQuantityPicked}
                                onChange={(e) =>
                                  handleQuantityPickedChange(item.id, parseInt(e.target.value) || 0)
                                }
                                onBlur={() => handleQuantityBlur(item.id)}
                                disabled={isSubmitting}
                                className="h-8 w-20 text-right ml-auto"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <Separator />

              {/* Special Instructions */}
              <FormField
                control={form.control}
                name="specialInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any special handling instructions..."
                        className="min-h-[80px] resize-none"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
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
                      <Textarea
                        placeholder="Add internal notes..."
                        className="min-h-[80px] resize-none"
                        disabled={isSubmitting}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </form>
          </Form>
        ) : (
          <div className="text-center text-muted-foreground">
            Pick ticket not found
          </div>
        )}
        </div>

        {/* Quick Actions - Fixed position above footer */}
        {!isLoading && canShowActionButtons && (
          <div className="flex-shrink-0 border-t bg-red-50 px-6 py-4">
            <div className="space-y-3 rounded-lg border border-red-200 bg-white p-4">
              <Label className="text-red-900">Quick Actions Required</Label>
              <p className="text-sm text-red-700">
                {!allItemsPicked ? (
                  <>⚠️ Please pick all items first, then select an action below and click Save Changes.</>
                ) : (
                  <>Status is now "Picked". Please select an action below, then click Save Changes.</>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleSelectCreatePackingList}
                  disabled={isSubmitting || !allItemsPicked}
                  variant={selectedAction === 'create_packing_list' ? 'default' : 'outline'}
                  className={`flex-1 ${selectedAction === 'create_packing_list' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Create Packing List
                  {selectedAction === 'create_packing_list' && (
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={handleSelectCompletePicking}
                  disabled={isSubmitting || !allItemsPicked}
                  variant={selectedAction === 'complete_picking' ? 'default' : 'outline'}
                  className={`flex-1 ${selectedAction === 'complete_picking' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Complete Picking
                  {selectedAction === 'complete_picking' && (
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting || isCreatingPackingList || isCompletingPicking}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-pick-ticket-form"
            disabled={Boolean(
              isSubmitting ||
              isLoading ||
              !pickTicket ||
              (canShowActionButtons && !selectedAction) ||
              (canShowActionButtons && !!selectedAction && !allItemsPicked)
            )}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selectedAction === 'create_packing_list' && 'Create Packing List & Save'}
            {selectedAction === 'complete_picking' && 'Complete Picking & Save'}
            {!selectedAction && 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
