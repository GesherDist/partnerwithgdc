/**
 * Confirm Allocations Modal Component
 *
 * Shows all allocations for a sales order and allows executing actions:
 * - Manufacturer (Direct) → Create Purchase Order
 * - GDC Inventory → Create Pick Ticket
 * - Platinum Dealer Inventory → Send Email
 * - Platinum Dealer Fulfillment → Send Email
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Loader2, CheckCircle, Package, Mail, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { FulfillmentAllocationWithDetails } from '../types';

// ============================================
// TYPES
// ============================================

interface ConfirmAllocationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesOrderId: string;
  salesOrderNumber: string;
  onConfirmComplete: () => void;
}

interface AllocationAction {
  id: string;
  type: 'create_po' | 'create_pick_ticket' | 'send_email';
  label: string;
  icon: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// Extended allocation type with item details for display
type AllocationWithItemDetails = FulfillmentAllocationWithDetails;

// ============================================
// COMPONENT
// ============================================

export function ConfirmAllocationsModal({
  open,
  onOpenChange,
  salesOrderId,
  salesOrderNumber,
  onConfirmComplete,
}: ConfirmAllocationsModalProps) {
  const [allocations, setAllocations] = useState<AllocationWithItemDetails[]>([]);
  const [actions, setActions] = useState<Map<string, AllocationAction>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Load allocations when modal opens
  useEffect(() => {
    if (open && salesOrderId) {
      loadAllocations();
    }
  }, [open, salesOrderId]);

  async function loadAllocations() {
    try {
      setIsLoading(true);
      // Import and call the action to get allocations for all items
      const { getSalesOrder } = await import('../actions');
      const result = await getSalesOrder(salesOrderId);

      if (result.success && result.data) {
        // Collect all allocations from all items
        const allAllocations: AllocationWithItemDetails[] = [];
        for (const item of result.data.items) {
          // Items may have allocations populated by the service
          const itemWithAllocations = item as any;
          if (itemWithAllocations.allocations && itemWithAllocations.allocations.length > 0) {
            // Add sales order item data to each allocation for display
            const allocationsWithItem = itemWithAllocations.allocations.map((alloc: any) => ({
              ...alloc,
              salesOrderItem: {
                sku: item.sku,
                description: item.description,
              },
            }));
            allAllocations.push(...allocationsWithItem);
          }
        }

        setAllocations(allAllocations);

        // Initialize actions map
        const actionsMap = new Map<string, AllocationAction>();
        allAllocations.forEach((allocation) => {
          // Map database allocation status to modal action status
          // Database: 'allocated' → Modal: 'completed'
          // Database: 'pending' → Modal: 'pending'
          const actionStatus = allocation.status === 'allocated' ? 'completed' : 'pending';

          actionsMap.set(allocation.id, {
            id: allocation.id,
            type: getActionType(allocation.fulfillmentSource),
            label: getActionLabel(allocation.fulfillmentSource),
            icon: getActionIcon(allocation.fulfillmentSource),
            status: actionStatus,
          });
        });
        setActions(actionsMap);
      } else {
        toast.error('Failed to load allocations');
      }
    } catch (error) {
      console.error('Error loading allocations:', error);
      toast.error('An error occurred while loading allocations');
    } finally {
      setIsLoading(false);
    }
  }

  function getActionType(source: string): AllocationAction['type'] {
    switch (source) {
      case 'direct':
        return 'create_po';
      case 'gdc_inventory':
        return 'create_pick_ticket';
      case 'platinum_dealer_inventory':
      case 'platinum_dealer_fulfillment':
        return 'send_email';
      default:
        return 'send_email';
    }
  }

  function getActionLabel(source: string): string {
    switch (source) {
      case 'direct':
        return 'Create PO';
      case 'gdc_inventory':
        return 'Create Pick Ticket';
      case 'platinum_dealer_inventory':
      case 'platinum_dealer_fulfillment':
        return 'Send Email';
      default:
        return 'Process';
    }
  }

  function getActionIcon(source: string) {
    switch (source) {
      case 'direct':
        return FileText;
      case 'gdc_inventory':
        return Package;
      case 'platinum_dealer_inventory':
      case 'platinum_dealer_fulfillment':
        return Mail;
      default:
        return CheckCircle;
    }
  }

  function getSourceLabel(source: string): string {
    switch (source) {
      case 'direct':
        return 'Manufacturer (Direct)';
      case 'gdc_inventory':
        return 'GDC Inventory';
      case 'platinum_dealer_inventory':
        return 'Platinum Dealer Inventory';
      case 'platinum_dealer_fulfillment':
        return 'Platinum Dealer Fulfillment';
      default:
        return source;
    }
  }

  async function handleAction(allocationId: string, groupAllocationIds?: string[]) {
    const action = actions.get(allocationId);
    if (!action) return;

    // Find the allocation details
    const allocation = allocations.find((a) => a.id === allocationId);
    if (!allocation) {
      toast.error('Allocation not found');
      return;
    }

    // Update action status to processing for ALL allocations in group
    const processingActions = new Map(actions);
    const idsToUpdate = groupAllocationIds || [allocationId];
    idsToUpdate.forEach((id) => {
      const groupAction = actions.get(id);
      if (groupAction) {
        processingActions.set(id, { ...groupAction, status: 'processing' });
      }
    });
    setActions(processingActions);

    try {
      let result: { success: boolean; error?: string; data?: any } = { success: false };

      // Execute action based on type
      switch (action.type) {
        case 'create_po':
          // Pass all allocation IDs in the group for PO creation
          result = await handleCreatePO(allocation, groupAllocationIds);
          break;

        case 'create_pick_ticket':
          // Pass all allocation IDs in the group for Pick Ticket creation
          result = await handleCreatePickTicket(allocation, groupAllocationIds);
          break;

        case 'send_email':
          result = await handleSendEmail(allocation);
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      if (result.success) {
        // Update status to completed for ALL allocations in group
        const completedActions = new Map(actions);
        idsToUpdate.forEach((id) => {
          const groupAction = actions.get(id);
          if (groupAction) {
            completedActions.set(id, { ...groupAction, status: 'completed' });
          }
        });
        setActions(completedActions);

        // Show success message with details from result
        const message = result.data?.message || `${action.label} created successfully`;
        toast.success(message);
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error) {
      console.error(`Error executing ${action.type}:`, error);
      const failedActions = new Map(actions);
      idsToUpdate.forEach((id) => {
        const groupAction = actions.get(id);
        if (groupAction) {
          failedActions.set(id, {
            ...groupAction,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });
      setActions(failedActions);
      toast.error(`Failed to ${action.label}`);
    }
  }

  /**
   * Validate Purchase Order data for Manufacturer (Direct) allocation
   */
  async function handleCreatePO(
    allocation: FulfillmentAllocationWithDetails,
    groupAllocationIds?: string[]
  ) {
    try {
      console.log('🔄 [handleCreatePO] Creating PO for allocation:', allocation.id);
      console.log('🔄 [handleCreatePO] Group allocation IDs:', groupAllocationIds);

      // Import required actions
      const { updateAllocationStatus } = await import('../actions/fulfillment-allocation.actions');
      const {
        createPurchaseOrderFromAllocation,
        createPurchaseOrderFromMultipleAllocations
      } = await import('../actions');

      // Get all allocations in group (or just this one)
      const allocationIdsToProcess = groupAllocationIds || [allocation.id];

      let poResult;

      // If multiple allocations (manufacturer/direct), create ONE combined PO
      if (allocationIdsToProcess.length > 1) {
        console.log('🏭 [handleCreatePO] Creating combined PO from', allocationIdsToProcess.length, 'allocations');

        poResult = await createPurchaseOrderFromMultipleAllocations(
          salesOrderId,
          allocationIdsToProcess
        );

        if (!poResult.success) {
          throw new Error(poResult.error || 'Failed to create Purchase Order');
        }

        console.log('✅ [handleCreatePO] Combined PO created:', poResult.data);

        // Update all allocation statuses to 'allocated'
        for (const allocId of allocationIdsToProcess) {
          await updateAllocationStatus(allocId, 'allocated');
        }

        return {
          success: true,
          data: {
            message: `Purchase Order ${poResult.data?.poNumber || ''} created with ${allocationIdsToProcess.length} items`,
            poNumber: poResult.data?.poNumber,
            poNumbers: [poResult.data?.poNumber],
          },
        };
      }
      // Single allocation - use existing function
      else {
        const allocationId = allocationIdsToProcess[0];
        if (!allocationId) {
          throw new Error('No allocation ID found');
        }

        console.log('🏭 [handleCreatePO] Creating PO from single allocation:', allocationId);

        poResult = await createPurchaseOrderFromAllocation(
          salesOrderId,
          allocationId
        );

        if (!poResult.success) {
          throw new Error(poResult.error || 'Failed to create Purchase Order');
        }

        console.log('✅ [handleCreatePO] PO created:', poResult.data);

        // Update allocation status to 'allocated'
        await updateAllocationStatus(allocationId, 'allocated');

        return {
          success: true,
          data: {
            message: `Purchase Order ${poResult.data?.poNumber || ''} created successfully`,
            poNumber: poResult.data?.poNumber,
            poNumbers: [poResult.data?.poNumber],
          },
        };
      }
    } catch (error) {
      console.error('❌ [handleCreatePO] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create PO',
      };
    }
  }

  /**
   * Create Pick Ticket for GDC Inventory allocation
   */
  async function handleCreatePickTicket(
    allocation: FulfillmentAllocationWithDetails,
    groupAllocationIds?: string[]
  ) {
    try {
      console.log('🔄 [handleCreatePickTicket] Creating Pick Ticket for allocation:', allocation.id);
      console.log('🔄 [handleCreatePickTicket] Group allocation IDs:', groupAllocationIds);

      // Validate required fields
      if (!allocation.location?.id) {
        throw new Error('Warehouse location not found for allocation');
      }

      if (!allocation.assignedContact?.id) {
        throw new Error('Assigned contact not found for allocation');
      }

      console.log('📦 [handleCreatePickTicket] Location:', allocation.location.name);
      console.log('👤 [handleCreatePickTicket] Contact:', allocation.assignedContact.name);
      console.log('📧 [handleCreatePickTicket] Contact ID:', allocation.assignedContact.id);

      // Import required actions
      const { updateAllocationStatus } = await import('../actions/fulfillment-allocation.actions');
      const { createPickTicketFromSalesOrder } = await import('@/features/pick-tickets/actions');

      // Create the Pick Ticket immediately
      console.log('📋 [handleCreatePickTicket] Creating Pick Ticket with params:', {
        salesOrderId,
        warehouseId: allocation.location.id,
        contactIds: [allocation.assignedContact.id],
        assignedContactId: allocation.assignedContact.id,
        allocationId: allocation.id,
      });

      const ptResult = await createPickTicketFromSalesOrder(
        salesOrderId,
        allocation.location.id,
        [allocation.assignedContact.id],
        allocation.notes || undefined,
        undefined, // assignedToId - not needed for warehouse contacts (they're in location_contacts, not users)
        true, // skipStatusCheck - allow PT creation for draft orders
        true, // useAllocatedQuantities - use quantities from allocations, not customer qty
        allocation.assignedContact.id, // assignedContactId - warehouse contact from location_contacts table
        groupAllocationIds || [allocation.id] // specificAllocationIds - include items from these allocations
      );

      if (!ptResult.success) {
        throw new Error(ptResult.error || 'Failed to create Pick Ticket');
      }

      console.log('✅ [handleCreatePickTicket] Pick Ticket created:', ptResult.data);

      // Update allocation status to 'allocated'
      await updateAllocationStatus(allocation.id, 'allocated');

      return {
        success: true,
        data: {
          message: `Pick Ticket ${ptResult.data?.pickTicketNumber || ''} created successfully`,
          pickTicketNumber: ptResult.data?.pickTicketNumber,
          pickTicketId: ptResult.data?.id,
          location: allocation.location.name,
          contact: allocation.assignedContact.name,
        },
      };
    } catch (error) {
      console.error('❌ [handleCreatePickTicket] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Pick Ticket',
      };
    }
  }

  /**
   * Send Email for Platinum Dealer allocation
   * Groups all allocations by dealer and sends one email per dealer
   */
  async function handleSendEmail(allocation: FulfillmentAllocationWithDetails) {
    try {
      console.log('🔄 [handleSendEmail] Starting email send for allocation:', allocation.id);

      if (!allocation.platinumDealer) {
        throw new Error('Dealer information not found for allocation');
      }

      // Check if dealer has email
      if (!allocation.platinumDealer.email) {
        throw new Error(`Dealer "${allocation.platinumDealer.dealerName}" does not have an email address configured`);
      }

      const dealerId = allocation.platinumDealerId;

      // Find ONLY PENDING allocations for this dealer in this sales order
      // Don't include already allocated items in the email (avoid duplicate emails)
      const dealerAllocations = allocations.filter(
        (alloc) =>
          alloc.platinumDealerId === dealerId &&
          (alloc.fulfillmentSource === 'platinum_dealer_inventory' ||
           alloc.fulfillmentSource === 'platinum_dealer_fulfillment') &&
          alloc.status === 'pending'  // ONLY pending allocations
      );

      console.log(`📋 [handleSendEmail] Found ${dealerAllocations.length} pending allocations for dealer ${allocation.platinumDealer.dealerName}`);

      // Check if there are any pending allocations to send
      if (dealerAllocations.length === 0) {
        return {
          success: false,
          error: 'No pending allocations found for this dealer. All items have already been allocated.',
        };
      }

      // Get sales order details
      const { getSalesOrder } = await import('../actions');
      const soResult = await getSalesOrder(salesOrderId);

      if (!soResult.success || !soResult.data) {
        throw new Error('Failed to fetch sales order details');
      }

      const salesOrder = soResult.data;

      // Build items array from all dealer allocations
      const items = dealerAllocations.map((alloc) => {
        // Find the sales order item for this allocation
        const salesOrderItem = salesOrder.items.find(
          (item) => item.id === alloc.salesOrderItemId
        );

        if (!salesOrderItem) {
          throw new Error(`Sales order item not found for allocation ${alloc.id}`);
        }

        // Build location address if available
        let locationAddress = '';
        if (alloc.dealerLocation) {
          const parts = [
            alloc.dealerLocation.addressStreet,
            alloc.dealerLocation.addressCity,
            alloc.dealerLocation.addressState,
            alloc.dealerLocation.addressPostalCode,
          ].filter(Boolean);
          locationAddress = parts.join(', ');
        }

        return {
          productSku: salesOrderItem.sku,
          productDescription: salesOrderItem.description || '',
          quantity: alloc.quantity,
          fulfillmentSource: alloc.fulfillmentSource as 'platinum_dealer_inventory' | 'platinum_dealer_fulfillment',
          locationName: alloc.dealerLocation?.locationName,
          locationAddress: locationAddress || undefined,
          notes: alloc.notes || undefined,
        };
      });

      // Send email using the platinum dealer email action (server-side)
      const { sendDealerAllocationEmailAction } = await import(
        '@/features/platinum-dealers/actions/email.actions'
      );

      console.log(`📧 [handleSendEmail] Sending email to: ${allocation.platinumDealer.email} with ${items.length} items`);

      const emailResult = await sendDealerAllocationEmailAction({
        // Dealer Info
        dealerEmail: allocation.platinumDealer.email,
        dealerName: allocation.platinumDealer.dealerName,
        dealerContactName: allocation.platinumDealer.contactName || undefined,

        // Sales Order Info
        salesOrderId: salesOrder.id,
        salesOrderNumber: salesOrder.orderNumber,
        customerName: salesOrder.customer?.name || 'Unknown Customer',

        // Items
        items,

        // Additional Info
        requestedDeliveryDate: salesOrder.requestedDeliveryDate
          ? new Date(salesOrder.requestedDeliveryDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : undefined,
      });

      if (!emailResult.success) {
        throw new Error(emailResult.error || 'Failed to send email to dealer');
      }

      console.log('✅ [handleSendEmail] Email sent successfully');

      // Update ALL allocations for this dealer to 'allocated'
      const { updateAllocationStatus } = await import('../actions/fulfillment-allocation.actions');

      for (const alloc of dealerAllocations) {
        await updateAllocationStatus(alloc.id, 'allocated');
      }

      console.log(`✅ [handleSendEmail] Updated ${dealerAllocations.length} allocations to 'allocated' status`);

      return {
        success: true,
        data: { emailSent: true, allocationsUpdated: dealerAllocations.length },
      };
    } catch (error) {
      console.error('❌ [handleSendEmail] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  async function handleConfirmAll() {
    setIsProcessing(true);

    try {
      // Check if ALL actions are already completed
      const allActionsCompleted = Array.from(actions.values()).every((a) => a.status === 'completed');

      if (!allActionsCompleted) {
        toast.error('Please assign all actions before confirming the order.');
        setIsProcessing(false);
        return;
      }

      // Check if any actions failed
      const hasFailures = Array.from(actions.values()).some((a) => a.status === 'failed');

      if (hasFailures) {
        toast.error('Some actions failed. Please retry failed actions before confirming.');
        setIsProcessing(false);
        return;
      }

      console.log('🚀 [Modal] Starting order confirmation for SO:', salesOrderId);
      console.log('📊 [Modal] Allocations:', allocations.map(a => ({
        source: a.fulfillmentSource,
        qty: a.quantity,
        status: a.status
      })));

      // Step 1: Check current SO status and confirm if needed
      const { getSalesOrder, confirmSalesOrder } = await import('../actions');
      const soResult = await getSalesOrder(salesOrderId);

      if (!soResult.success || !soResult.data) {
        toast.error('Failed to fetch sales order status');
        setIsProcessing(false);
        return;
      }

      const currentStatus = soResult.data.status;
      console.log('📊 [Modal] Current SO status:', currentStatus);

      let wasAutoConfirmed = false;

      // Only confirm if not already confirmed
      if (currentStatus === 'draft' || currentStatus === 'pending') {
        console.log('📞 [Modal] Calling confirmSalesOrder...');
        const confirmResult = await confirmSalesOrder(salesOrderId);

        console.log('📊 [Modal] confirmSalesOrder result:', confirmResult);

        if (!confirmResult.success) {
          console.error('❌ [Modal] Confirm failed:', confirmResult.error);
          toast.error(confirmResult.error || 'Failed to confirm order');
          setIsProcessing(false);
          return;
        }

        console.log('✅ [Modal] Order confirmed. PO should be created for manufacturer allocations.');
      } else if (currentStatus === 'confirmed' || currentStatus === 'processing') {
        console.log('ℹ️ [Modal] Order already confirmed (auto-confirmed when all allocations assigned)');
        wasAutoConfirmed = true;
      } else {
        toast.error(`Cannot confirm order with status: ${currentStatus}`);
        setIsProcessing(false);
        return;
      }

      // Step 2: Create Pick Tickets for GDC Inventory allocations
      const gdcAllocations = allocations.filter((a) => a.fulfillmentSource === 'gdc_inventory');
      if (gdcAllocations.length > 0) {
        try {
          const { createPickTicketFromSalesOrder } = await import('@/features/pick-tickets/actions');

          // Group by location
          const locationGroups = new Map<string, typeof gdcAllocations>();
          for (const allocation of gdcAllocations) {
            if (allocation.location?.id) {
              if (!locationGroups.has(allocation.location.id)) {
                locationGroups.set(allocation.location.id, []);
              }
              locationGroups.get(allocation.location.id)!.push(allocation);
            }
          }

          // Create pick ticket for each location
          for (const [locationId, allocationsForLocation] of locationGroups) {
            const contactIds = [...new Set(
              allocationsForLocation
                .filter(a => a.assignedContact?.id)
                .map(a => a.assignedContact!.id)
            )];

            const combinedNotes = allocationsForLocation
              .filter(a => a.notes)
              .map(a => a.notes)
              .join('\n---\n');

            // Get assigned contact ID from first allocation (if any)
            const assignedContactId = allocationsForLocation.find(a => a.assignedContactId)?.assignedContactId || undefined;

            if (contactIds.length > 0) {
              const ptResult = await createPickTicketFromSalesOrder(
                salesOrderId,
                locationId,
                contactIds,
                combinedNotes || undefined,
                undefined, // assignedToId - not needed for warehouse contacts (they're in location_contacts, not users)
                true, // skipStatusCheck
                true, // useAllocatedQuantities
                assignedContactId // Use assigned contact from allocation (location_contacts table)
              );

              if (ptResult.success) {
                console.log('✅ Pick Ticket Created:', ptResult.data);
              }
            }
          }
        } catch (error) {
          console.error('❌ Failed to create Pick Tickets:', error);
        }
      }

      // Show success message
      const manufacturerAllocations = allocations.filter((a) => a.fulfillmentSource === 'direct');
      // Note: gdcAllocations already declared above for Pick Ticket creation (line 393)

      const resourcesCreated = [];
      if (manufacturerAllocations.length > 0) resourcesCreated.push('Purchase Order');
      if (gdcAllocations.length > 0) resourcesCreated.push('Pick Ticket(s)');

      const resourcesText = resourcesCreated.length > 0
        ? ` ${resourcesCreated.join(' and ')} created.`
        : '';

      const confirmText = wasAutoConfirmed
        ? 'Order was already confirmed.'
        : `Order ${salesOrderNumber} confirmed successfully!`;

      toast.success(`${confirmText}${resourcesText}`);
      onConfirmComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error executing actions:', error);
      toast.error('An error occurred while executing actions');
    } finally {
      setIsProcessing(false);
    }
  }

  const allCompleted = Array.from(actions.values()).every((a) => a.status === 'completed');

  // Toggle group expansion
  function toggleGroupExpansion(groupKey: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  // Get unique group key
  function getGroupKey(allocation: FulfillmentAllocationWithDetails): string {
    // Warehouse allocations: Group by warehouse location
    if (allocation.fulfillmentSource === 'gdc_inventory') {
      return `warehouse-${allocation.locationId}`; // Group by warehouse
    }
    // Dealer allocations: Group by dealer
    else if (
      allocation.fulfillmentSource === 'platinum_dealer_inventory' ||
      allocation.fulfillmentSource === 'platinum_dealer_fulfillment'
    ) {
      return `dealer-${allocation.platinumDealerId}`;
    }
    // Manufacturer allocations: Group all together
    else if (allocation.fulfillmentSource === 'direct') {
      return 'manufacturer-all'; // Group all manufacturer allocations together
    }
    return `other-${allocation.id}`;
  }

  // Group allocations to avoid duplicate buttons:
  // - GDC Inventory: Group by warehouse (location_id)
  // - Dealer allocations: Group by dealer (platinum_dealer_id)
  // - Manufacturer (Direct): Group all together (same supplier)
  const groupedAllocations = React.useMemo(() => {
    const warehouseGroups = new Map<string, FulfillmentAllocationWithDetails[]>();
    const dealerGroups = new Map<string, FulfillmentAllocationWithDetails[]>();
    const manufacturerAllocations: FulfillmentAllocationWithDetails[] = [];

    allocations.forEach((allocation) => {
      // Group GDC Inventory by warehouse
      if (allocation.fulfillmentSource === 'gdc_inventory') {
        const locationId = allocation.locationId || 'unknown';
        if (!warehouseGroups.has(locationId)) {
          warehouseGroups.set(locationId, []);
        }
        warehouseGroups.get(locationId)!.push(allocation);
      }
      // Group Dealer allocations by dealer
      else if (
        allocation.fulfillmentSource === 'platinum_dealer_inventory' ||
        allocation.fulfillmentSource === 'platinum_dealer_fulfillment'
      ) {
        const dealerId = allocation.platinumDealerId || 'unknown';
        if (!dealerGroups.has(dealerId)) {
          dealerGroups.set(dealerId, []);
        }
        dealerGroups.get(dealerId)!.push(allocation);
      }
      // Group Manufacturer (Direct) allocations together
      else if (allocation.fulfillmentSource === 'direct') {
        manufacturerAllocations.push(allocation);
      }
    });

    const result: FulfillmentAllocationWithDetails[] = [];

    // Add manufacturer allocations (grouped as one)
    if (manufacturerAllocations.length > 0 && manufacturerAllocations[0]) {
      result.push(manufacturerAllocations[0]); // Show first allocation as representative
    }

    // Add one allocation per warehouse group
    warehouseGroups.forEach((groupAllocations) => {
      if (groupAllocations[0]) {
        result.push(groupAllocations[0]); // Show first allocation as representative
      }
    });

    // Add one allocation per dealer group
    dealerGroups.forEach((groupAllocations) => {
      if (groupAllocations[0]) {
        result.push(groupAllocations[0]); // Show first allocation as representative
      }
    });

    return result;
  }, [allocations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Order - {salesOrderNumber}</DialogTitle>
          <DialogDescription>
            Review and execute actions for all allocations before confirming the order.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading allocations...</span>
          </div>
        ) : allocations.length === 0 ? (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>No allocations found.</strong> Please create allocations before confirming the order.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Allocation Source</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedAllocations.map((allocation) => {
                    const action = actions.get(allocation.id);
                    if (!action) return null;

                    const Icon = action.icon;

                    // Group logic: Get all allocations in this group
                    const isWarehouseAllocation = allocation.fulfillmentSource === 'gdc_inventory';
                    const isDealerAllocation =
                      allocation.fulfillmentSource === 'platinum_dealer_inventory' ||
                      allocation.fulfillmentSource === 'platinum_dealer_fulfillment';
                    const isManufacturerAllocation = allocation.fulfillmentSource === 'direct';

                    // Get all allocations in the group
                    const groupAllocations = isWarehouseAllocation
                      ? allocations.filter(
                          (a) =>
                            a.fulfillmentSource === 'gdc_inventory' &&
                            a.locationId === allocation.locationId
                        )
                      : isDealerAllocation
                      ? allocations.filter(
                          (a) =>
                            a.platinumDealerId === allocation.platinumDealerId &&
                            (a.fulfillmentSource === 'platinum_dealer_inventory' ||
                             a.fulfillmentSource === 'platinum_dealer_fulfillment')
                        )
                      : isManufacturerAllocation
                      ? allocations.filter((a) => a.fulfillmentSource === 'direct')
                      : [allocation];

                    const totalQuantity = groupAllocations.reduce((sum, a) => sum + a.quantity, 0);
                    const itemCount = groupAllocations.length;

                    // Count only pending allocations (not already processed)
                    const pendingItemCount = groupAllocations.filter(a => {
                      const groupAction = actions.get(a.id);
                      return groupAction?.status === 'pending';
                    }).length;

                    const groupKey = getGroupKey(allocation);
                    const isExpanded = expandedGroups.has(groupKey);

                    // If expanded, show all items in separate rows
                    if (isExpanded && itemCount > 1) {
                      return (
                        <React.Fragment key={allocation.id}>
                          {groupAllocations.map((item, index) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {index === 0 && getSourceLabel(allocation.fulfillmentSource)}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div className="font-medium">{item.salesOrderItem?.sku || '-'}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {item.salesOrderItem?.description || ''}
                                  </div>
                                  {index === groupAllocations.length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleGroupExpansion(groupKey)}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1 cursor-pointer"
                                    >
                                      Show less
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{item.quantity} units</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {index === 0 &&
                                  (allocation.location?.name ||
                                    allocation.platinumDealer?.dealerName ||
                                    allocation.containerId ||
                                    '-')}
                              </TableCell>
                              <TableCell>
                                {index === 0 && (
                                  <>
                                    {action.status === 'pending' && (
                                      <Badge variant="secondary">Pending</Badge>
                                    )}
                                    {action.status === 'processing' && (
                                      <Badge variant="default" className="bg-blue-500">
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        Processing
                                      </Badge>
                                    )}
                                    {action.status === 'completed' && (
                                      <Badge variant="default" className="bg-green-500">
                                        <CheckCircle className="mr-1 h-3 w-3" />
                                        Assigned
                                      </Badge>
                                    )}
                                    {action.status === 'failed' && (
                                      <Badge variant="destructive">Failed</Badge>
                                    )}
                                  </>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {index === 0 && (
                                  <Button
                                    size="sm"
                                    variant={action.status === 'completed' ? 'outline' : 'default'}
                                    onClick={() => {
                                      // For warehouse allocations: Pass ONLY this allocation ID
                                      // Server will automatically fetch all pending allocations for same warehouse
                                      if (isWarehouseAllocation) {
                                        handleAction(allocation.id, [allocation.id]); // Single ID only
                                      }
                                      // For dealer/manufacturer: Pass all group IDs (grouped behavior)
                                      else {
                                        const pendingGroupAllocations = groupAllocations.filter(a => {
                                          const groupAction = actions.get(a.id);
                                          return groupAction?.status === 'pending';
                                        });
                                        handleAction(allocation.id, pendingGroupAllocations.map(a => a.id));
                                      }
                                    }}
                                    disabled={
                                      action.status === 'processing' || action.status === 'completed'
                                    }
                                  >
                                    {action.status === 'processing' ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Icon className="mr-2 h-4 w-4" />
                                    )}
                                    {action.label}
                                    {pendingItemCount > 1 && ` (${pendingItemCount} items)`}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    }

                    // Collapsed view (single row)
                    return (
                      <TableRow key={allocation.id}>
                        <TableCell className="font-medium">
                          {getSourceLabel(allocation.fulfillmentSource)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{allocation.salesOrderItem?.sku || '-'}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {allocation.salesOrderItem?.description || ''}
                            </div>
                            {(isWarehouseAllocation || isDealerAllocation || isManufacturerAllocation) && itemCount > 1 && (
                              <button
                                type="button"
                                onClick={() => toggleGroupExpansion(groupKey)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1 cursor-pointer"
                              >
                                +{itemCount - 1} more item{itemCount > 2 ? 's' : ''}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{totalQuantity} units</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {allocation.location?.name ||
                            allocation.platinumDealer?.dealerName ||
                            allocation.containerId ||
                            '-'}
                        </TableCell>
                        <TableCell>
                          {action.status === 'pending' && (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                          {action.status === 'processing' && (
                            <Badge variant="default" className="bg-blue-500">
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              Processing
                            </Badge>
                          )}
                          {action.status === 'completed' && (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Assigned
                            </Badge>
                          )}
                          {action.status === 'failed' && (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={action.status === 'completed' ? 'outline' : 'default'}
                            onClick={() => {
                              // For ALL grouped allocations (warehouse, dealer, manufacturer):
                              // Pass ALL pending allocation IDs from the same group
                              // This ensures the action includes exactly what user sees in the UI
                              const pendingGroupAllocations = groupAllocations.filter(a => {
                                const groupAction = actions.get(a.id);
                                return groupAction?.status === 'pending';
                              });
                              handleAction(allocation.id, pendingGroupAllocations.map(a => a.id));
                            }}
                            disabled={
                              action.status === 'processing' || action.status === 'completed'
                            }
                          >
                            {action.status === 'processing' ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className="mr-2 h-4 w-4" />
                            )}
                            {action.label}
                            {(isWarehouseAllocation || isDealerAllocation || isManufacturerAllocation) && pendingItemCount > 1 && ` (${pendingItemCount} items)`}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          {!allCompleted && (
            <Alert className="flex-1 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Assign all actions above by clicking each button before confirming the order.
              </AlertDescription>
            </Alert>
          )}
          <Button
            onClick={handleConfirmAll}
            disabled={isLoading || allocations.length === 0 || isProcessing || !allCompleted}
          >
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
