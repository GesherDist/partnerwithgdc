/**
 * Pick Tickets Server Actions
 *
 * Next.js server actions for Pick Tickets feature.
 *
 * Every action authenticates the caller and checks the matching
 * `pick_tickets.*` permission before touching the service layer.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { PickTicketService } from '../services';
import { db } from '@/shared/lib/supabase/database';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import type {
  PickTicket,
  PickTicketWithItems,
  PickTicketListParams,
  CreatePickTicketDTO,
  UpdatePickTicketDTO,
  PickItemDTO,
  PickTicketStatus,
  PickTicketPdfSalesOrderFields,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// AUTHORIZATION HELPERS
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Resolve the current application user and verify a permission.
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

/**
 * Same as `authorize`, but any one of the permissions is enough.
 */
async function authorizeAny(permissions: string[]): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      result: { success: false, error: `Permission denied: requires one of [${permissions.join(', ')}]` },
    };
  }

  return { ok: true, user };
}

// ============================================
// LIST PICK TICKETS
// ============================================

export async function listPickTickets(params: PickTicketListParams = {}) {
  const auth = await authorize('pick_tickets.view');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTickets(params);
  return result;
}

// ============================================
// GET PICK TICKET
// ============================================

export async function getPickTicket(id: string) {
  const auth = await authorizeAny(['pick_tickets.view', 'pick_tickets.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTicketById(id);
  return result;
}

// ============================================
// GET PICK TICKETS BY SALES ORDER
// ============================================

/**
 * Everything the pick ticket PDF needs, in one authorized call.
 *
 * The pick ticket join does not carry the ship-to address, the required date
 * or the customer PO, so those are read from the sales order here rather than
 * in the API route — routes in this codebase never touch `db` directly.
 */
export async function getPickTicketPdfData(
  id: string
): Promise<ActionResult<{ pickTicket: PickTicketWithItems; salesOrder: PickTicketPdfSalesOrderFields | null }>> {
  const auth = await authorizeAny(['pick_tickets.view', 'pick_tickets.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTicketById(id);
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Pick ticket not found' };
  }

  const pickTicket = result.data;
  let salesOrder: PickTicketPdfSalesOrderFields | null = null;

  if (pickTicket.salesOrderId) {
    const { data, error } = await db
      .from('sales_orders')
      .select(
        `
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        requested_delivery_date,
        customer_po_number,
        shipping_method
      `
      )
      .eq('id', pickTicket.salesOrderId)
      .single();

    if (error) {
      // The PDF is still useful without these fields, so log and carry on.
      console.error('[getPickTicketPdfData] Sales order lookup failed:', error);
    } else {
      salesOrder = data as unknown as PickTicketPdfSalesOrderFields;
    }
  }

  return { success: true, data: { pickTicket, salesOrder } };
}

export async function getPickTicketsBySalesOrder(salesOrderId: string) {
  const auth = await authorize('pick_tickets.view');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.getPickTicketsBySalesOrderId(salesOrderId);
  return result;
}

// ============================================
// CREATE PICK TICKET
// ============================================

export async function createPickTicket(data: CreatePickTicketDTO) {
  const auth = await authorize('pick_tickets.create');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.createPickTicket(data, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath('/sales-orders');
  }

  return result;
}

// ============================================
// UPDATE PICK TICKET
// ============================================

/**
 * Update pick ticket with proper status transition handling.
 *
 * When status is changed via Edit dialog, we trigger the same
 * business logic that would run via normal workflow buttons:
 *
 * - To 'picked': Auto-set quantity_picked = quantity_to_pick for all items
 * - To 'shipped': Ship inventory + Create shipment (if not via packing list)
 * - To 'packed': Only allowed via Packing List flow (blocked here)
 */
export async function updatePickTicket(id: string, data: UpdatePickTicketDTO) {
  const auth = await authorize('pick_tickets.edit');
  if (!auth.ok) {
    return auth.result;
  }

  // Get current pick ticket to check status transition
  const currentPT = await PickTicketService.getPickTicketById(id);
  if (!currentPT.success || !currentPT.data) {
    return { success: false, error: 'Pick ticket not found' };
  }

  const oldStatus = currentPT.data.status;
  const newStatus = data.status;
  const pickTicket = currentPT.data;

  // Block transition to 'packed' - must use Packing List workflow
  if (newStatus === 'packed' && oldStatus !== 'packed') {
    // Provide context-specific error message
    if (pickTicket.packingList) {
      return {
        success: false,
        error: 'Cannot change status to "packed" here. Please go to Packing Lists and mark the packing list as "Packed" instead. This will automatically update the pick ticket status.',
      };
    }
    // Special case: status is 'packing' but no packing list exists (data inconsistency)
    if (oldStatus === 'packing') {
      return {
        success: false,
        error: 'Status is "packing" but no Packing List found. Please change status to "picked" first, then create a new Packing List.',
      };
    }
    return {
      success: false,
      error: 'Cannot change status to "packed" directly. Please create a Packing List first, then mark it as "Packed".',
    };
  }

  // Allow reverting from 'packing' to 'picked' if no packing list exists (data cleanup)
  if (newStatus === 'picked' && oldStatus === 'packing' && !pickTicket.packingList) {
    console.log('[updatePickTicket] Allowing revert from "packing" to "picked" - no packing list exists (data cleanup)');
    // Continue with normal update - no special handling needed
  }

  // Handle transition to 'picked' status - auto-set quantity_picked
  if (newStatus === 'picked' && oldStatus !== 'picked') {
    // If items are not provided with quantities, auto-set quantity_picked = quantity_to_pick
    if (!data.items || data.items.length === 0) {
      const autoItems = pickTicket.items.map((item) => ({
        id: item.id,
        quantityPicked: item.quantityToPick,
      }));
      data.items = autoItems;
      console.log('[updatePickTicket] Auto-setting quantity_picked for transition to "picked"');
    }
  }

  // Handle transition to 'shipped' status (direct ship without packing list)
  if (newStatus === 'shipped' && oldStatus !== 'shipped') {
    // Check if packing list exists - if yes, should use packing list flow
    if (pickTicket.packingList) {
      return {
        success: false,
        error: 'A packing list exists for this pick ticket. Please mark the packing list as "shipped" instead.',
      };
    }

    // Auto-set quantity_picked if transitioning from non-picked status
    if (oldStatus !== 'picked' && (!data.items || data.items.length === 0)) {
      const autoItems = pickTicket.items.map((item) => ({
        id: item.id,
        quantityPicked: item.quantityToPick,
      }));
      data.items = autoItems;
      console.log('[updatePickTicket] Auto-setting quantity_picked for transition to "shipped"');
    }
  }

  // Perform the update
  const result = await PickTicketService.updatePickTicket(id, data, auth.user.id);

  if (result.success) {
    // If transitioning to 'shipped', trigger inventory ship and shipment creation
    if (newStatus === 'shipped' && oldStatus !== 'shipped') {
      // Refresh pick ticket data after update to get updated quantities
      const updatedPT = await PickTicketService.getPickTicketById(id);
      if (updatedPT.success && updatedPT.data) {
        // Ship inventory for each picked item
        try {
          await shipInventoryForPickTicket(updatedPT.data, auth.user.id);
          console.log('[updatePickTicket] Inventory shipped for status transition to "shipped"');
        } catch (error) {
          console.error('[updatePickTicket] Failed to ship inventory:', error);
        }

        // NOTE: Warehouse orders no longer create shipments
        // Delivery tracking is handled in packing list (if created) or directly on pick ticket

        // Update sales order status to 'shipped'
        try {
          if (updatedPT.data.salesOrderId) {
            await db
              .from('sales_orders')
              .update({
                status: 'shipped',
                updated_at: new Date().toISOString(),
                updated_by: auth.user.id || null,
              })
              .eq('id', updatedPT.data.salesOrderId);
            console.log('[updatePickTicket] Sales order status updated to "shipped"');
          }
        } catch (error) {
          console.error('[updatePickTicket] Failed to update sales order status:', error);
        }
      }

      // Revalidate all related paths
      revalidatePath('/inventory');
      revalidatePath('/operations');
      revalidatePath('/shipments');
    }

    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// ASSIGN PICK TICKET
// ============================================

export async function assignPickTicket(id: string, warehouseId: string, contactId: string) {
  const auth = await authorize('pick_tickets.assign');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.assignPickTicketToContact(id, warehouseId, contactId, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// START PICKING
// ============================================

export async function startPicking(id: string) {
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.startPicking(id, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// PICK ITEM
// ============================================

export async function pickItem(pickTicketId: string, item: PickItemDTO) {
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.pickItem(pickTicketId, item, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${pickTicketId}`);
  }

  return result;
}

// ============================================
// PICK MULTIPLE ITEMS
// ============================================

export async function pickItems(pickTicketId: string, items: PickItemDTO[]) {
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.pickItems(pickTicketId, items, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${pickTicketId}`);
  }

  return result;
}

// ============================================
// COMPLETE PICKING
// ============================================

/**
 * Complete picking for a pick ticket
 * This reduces inventory (on_hand and allocated) for all picked items
 * Also auto-creates shipment with source='warehouse' for GDC1 Inventory
 *
 * Two fulfillment paths:
 * 1. Quick ship: picking/picked â†' shipped (via Complete Picking) - no packing list
 * 2. Full packing: picked â†' packing â†' packed â†' shipped (via Packing List flow)
 */
export async function completePicking(id: string) {
  const auth = await authorize('pick_tickets.pick');
  if (!auth.ok) {
    return auth.result;
  }

  // Get pick ticket with items before completing
  const ptResult = await PickTicketService.getPickTicketById(id);
  if (!ptResult.success || !ptResult.data) {
    return { success: false, error: 'Pick ticket not found' };
  }

  const pickTicket = ptResult.data;

  // Don't allow completion if a packing list already exists (user should use packing flow)
  if (pickTicket.packingList) {
    return {
      success: false,
      error: 'A packing list already exists. Please complete the packing flow instead.',
    };
  }

  // Complete the picking first (status change to 'shipped')
  const result = await PickTicketService.completePicking(id, auth.user.id);

  if (result.success) {
    // Ship inventory for each picked item
    await shipInventoryForPickTicket(pickTicket, auth.user.id);

    // NOTE: Warehouse orders no longer create shipments
    // Delivery tracking is handled in packing list (if created)
    // For quick ship (no packing list), pick ticket tracks the shipment

    // Update sales order status to 'shipped'
    try {
      if (pickTicket.salesOrderId) {
        await db
          .from('sales_orders')
          .update({
            status: 'shipped',
            updated_at: new Date().toISOString(),
            updated_by: auth.user.id || null,
          })
          .eq('id', pickTicket.salesOrderId);
        console.log('[completePicking] Sales order status updated to "shipped"');
      }
    } catch (error) {
      console.error('[completePicking] Failed to update sales order status:', error);
    }

    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
    revalidatePath('/inventory');
    revalidatePath('/operations');
    revalidatePath('/sales-orders');
  }

  return result;
}

/**
 * Helper: Ship inventory for completed pick ticket
 * Reduces on_hand and allocated for each picked item
 * Skips service and non-inventory items (they don't have physical inventory)
 */
async function shipInventoryForPickTicket(
  pickTicket: PickTicketWithItems,
  userId?: string
): Promise<void> {
  const { inventoryService } = await import('@/features/inventory/services/inventory.service');

  const reference = {
    type: 'pick_ticket',
    id: pickTicket.id,
    number: pickTicket.pickTicketNumber,
  };

  // Fetch product item_type for all products in the pick ticket
  const productIds = (pickTicket.items || [])
    .map((item) => item.productId)
    .filter((id): id is string => !!id);

  let productItemTypes: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: products } = await db
      .from('products')
      .select('id, item_type')
      .in('id', productIds);

    productItemTypes = (products || []).reduce((acc, p) => {
      acc[p.id] = p.item_type || 'inventory';
      return acc;
    }, {} as Record<string, string>);
  }

  for (const item of pickTicket.items || []) {
    if (!item.productId || !pickTicket.warehouseId) {
      continue;
    }

    // Skip service and non-inventory items - they don't have physical inventory
    const itemType = productItemTypes[item.productId] || 'inventory';
    if (itemType === 'service' || itemType === 'non_inventory') {
      console.log(`[shipInventoryForPickTicket] Skipping inventory ship for ${item.sku} (${itemType})`);
      continue;
    }

    // Ship the quantity that was picked
    const quantityToShip = item.quantityPicked || item.quantityToPick;

    if (quantityToShip <= 0) {
      continue;
    }

    try {
      await inventoryService.shipByProductLocation(
        item.productId,
        pickTicket.warehouseId,
        quantityToShip,
        userId,
        reference
      );
    } catch (error) {
      // Log but don't fail - items might not have been allocated
      console.error(`Failed to ship inventory for ${item.sku}:`, error);
    }
  }
}

// ============================================
// TRANSITION STATUS
// ============================================

export async function transitionPickTicketStatus(id: string, status: PickTicketStatus) {
  const auth = await authorize('pick_tickets.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.transitionStatus(id, status, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// CANCEL PICK TICKET
// ============================================

export async function cancelPickTicket(id: string) {
  const auth = await authorize('pick_tickets.edit');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.cancelPickTicket(id, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
    revalidatePath(`/pick-tickets/${id}`);
  }

  return result;
}

// ============================================
// DELETE PICK TICKET
// ============================================

export async function deletePickTicket(id: string) {
  const auth = await authorize('pick_tickets.delete');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await PickTicketService.deletePickTicket(id, auth.user.id);

  if (result.success) {
    revalidatePath('/pick-tickets');
  }

  return result;
}

// ============================================
// CREATE PICK TICKET FROM SALES ORDER
// ============================================

interface CreateFromSOResult {
  success: boolean;
  data?: PickTicket;
  error?: string;
}

export async function createPickTicketFromSalesOrder(
  salesOrderId: string,
  warehouseId: string,
  notifyContactIds?: string[],
  specialInstructions?: string,
  assignedToId?: string,
  skipStatusCheck?: boolean,
  useAllocatedQuantities?: boolean, // NEW: When true, use quantities from allocations table
  assignedContactId?: string, // NEW: Contact ID for warehouse contact assignment
  specificAllocationIds?: string[] // NEW: When provided, only include items from these specific allocations
): Promise<CreateFromSOResult> {
  const auth = await authorize('pick_tickets.create');
  if (!auth.ok) {
    return auth.result;
  }

  const userId = auth.user.id;

  try {
    // Fetch sales order with items and customer info (including product item_type)
    const { data: salesOrder, error: soError } = await db
      .from('sales_orders')
      .select(`
        id,
        order_number,
        warehouse_id,
        customer_id,
        customer_po_number,
        requested_delivery_date,
        shipping_method,
        internal_notes,
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        sales_order_items (
          id,
          product_id,
          sku,
          description,
          quantity,
          products (
            item_type
          )
        )
      `)
      .eq('id', salesOrderId)
      .is('deleted_at', null)
      .single();

    if (soError || !salesOrder) {
      console.error('[createPickTicketFromSalesOrder] Query error:', soError);
      console.error('[createPickTicketFromSalesOrder] salesOrderId:', salesOrderId);
      return {
        success: false,
        error: soError?.message || 'Sales order not found',
      };
    }

    // Check if sales order is confirmed or processing and has order_series
    const { data: soStatus } = await db
      .from('sales_orders')
      .select('status, order_series')
      .eq('id', salesOrderId)
      .single();

    // Skip status check if called from allocation modal (skipStatusCheck = true)
    if (!skipStatusCheck) {
      if (!soStatus || !['confirmed', 'processing'].includes(soStatus.status)) {
        return {
          success: false,
          error: 'Sales order must be confirmed or processing to create a pick ticket',
        };
      }
    }

    // Validate Order Series is selected (only if not skipping status check)
    if (!skipStatusCheck && !soStatus?.order_series) {
      return {
        success: false,
        error: 'Order Series is required. Please select an Order Series (GDC 1, GDC 2, or GDC 3) on the Sales Order before generating a Pick Ticket.',
      };
    }

    // Determine warehouse ID early
    const finalWarehouseId = warehouseId || salesOrder.warehouse_id;

    // Note: Duplicate check removed - allocation-based system allows multiple PTs
    // Each allocation can create its own PT, and the UI prevents duplicate creation
    // via allocation status tracking (buttons disabled after PT created)

    // Fetch allocated quantities if requested (for allocation-based pick tickets)
    let allocationQuantities: Map<string, number> = new Map();
    if (useAllocatedQuantities) {
      console.log('🎯 [createPickTicketFromSalesOrder] Using allocation-based quantities');
      console.log('📋 [createPickTicketFromSalesOrder] Allocation IDs provided:', specificAllocationIds);

      // Build query to fetch allocations
      // Frontend is responsible for passing the exact allocation IDs to include in Pick Ticket
      // This ensures Pick Ticket contains ONLY the items user selected in the UI
      let allocQuery = db
        .from('fulfillment_allocations')
        .select('sales_order_item_id, quantity')
        .eq('fulfillment_source', 'gdc_inventory')
        .eq('location_id', finalWarehouseId);

      if (specificAllocationIds && specificAllocationIds.length > 0) {
        // Use ONLY the allocation IDs provided by frontend (no auto-fetch)
        allocQuery = allocQuery.in('id', specificAllocationIds);
        console.log('🎯 [createPickTicketFromSalesOrder] Using specific allocation IDs:', specificAllocationIds);
      } else {
        // Fallback: fetch all pending allocations for this warehouse (when no specific IDs provided)
        allocQuery = allocQuery
          .in('sales_order_item_id', salesOrder.sales_order_items?.map((item: any) => item.id) || [])
          .eq('status', 'pending');
        console.log('📦 [createPickTicketFromSalesOrder] Fetching all pending allocations for warehouse');
      }

      const { data: allocations } = await allocQuery;

      if (allocations) {
        allocations.forEach((alloc: any) => {
          const existing = allocationQuantities.get(alloc.sales_order_item_id) || 0;
          allocationQuantities.set(alloc.sales_order_item_id, existing + alloc.quantity);
        });
      }
      console.log('📊 [createPickTicketFromSalesOrder] Allocation quantities:', Object.fromEntries(allocationQuantities));
    }

    // Prepare items for pick ticket - ONLY include physical inventory items
    // Service and non-inventory items don't need to be picked from warehouse
    // Note: Supabase returns products as array due to join, so we access first element
    const allItems = salesOrder.sales_order_items?.map((item: {
      id: string;
      product_id: string | null;
      sku: string;
      description: string | null;
      quantity: number;
      products: { item_type: string }[] | { item_type: string } | null;
    }) => {
      // Handle both array (Supabase default) and single object cases
      const productData = Array.isArray(item.products) ? item.products[0] : item.products;

      // Use allocated quantity if available
      // IMPORTANT: When using allocation-based quantities, items NOT in allocation should get quantity 0
      // This ensures pick ticket only includes items from the specific allocations
      const quantityToPick = useAllocatedQuantities
        ? (allocationQuantities.get(item.id) || 0)  // Use allocation qty or 0 if not allocated
        : item.quantity;  // Use customer quantity when not using allocations

      return {
        salesOrderItemId: item.id,
        productId: item.product_id || '',
        sku: item.sku,
        description: item.description,
        quantityToPick,
        itemType: productData?.item_type || 'inventory', // Default to inventory if not set
      };
    }) || [];

    // Filter to only include physical inventory items (exclude service and non_inventory)
    // Also exclude items with zero allocated quantity when using allocation-based quantities
    const items = allItems.filter((item) => {
      if (item.itemType === 'service' || item.itemType === 'non_inventory') {
        console.log(`[createPickTicketFromSalesOrder] Excluding ${item.sku} from pick ticket (${item.itemType} - not a physical item)`);
        return false;
      }
      if (useAllocatedQuantities && item.quantityToPick === 0) {
        console.log(`[createPickTicketFromSalesOrder] Excluding ${item.sku} from pick ticket (no allocated quantity for this warehouse)`);
        return false;
      }
      return true;
    });

    if (items.length === 0) {
      return {
        success: false,
        error: 'Sales order has no physical inventory items to pick',
      };
    }

    // Note: finalWarehouseId already determined above (before duplicate check)

    // Allocate inventory for each item before creating pick ticket
    // Skip if called from allocation modal (skipStatusCheck = true) as inventory is already allocated
    if (!skipStatusCheck) {
      const { inventoryService } = await import('@/features/inventory/services/inventory.service');
      const allocationErrors: string[] = [];

      for (const item of items) {
        if (!item.productId) {
          continue; // Skip items without product ID
        }

        const allocResult = await inventoryService.allocateByProductLocation(
          item.productId,
          finalWarehouseId,
          item.quantityToPick,
          userId,
          {
            type: 'sales_order',
            id: salesOrderId,
            number: salesOrder.order_number,
          }
        );

        if (!allocResult.success) {
          allocationErrors.push(`${item.sku}: ${allocResult.error}`);
        }
      }

      // If any allocation failed, return error
      if (allocationErrors.length > 0) {
        return {
          success: false,
          error: `Insufficient inventory: ${allocationErrors.join(', ')}`,
        };
      }
    } else {
      console.log('ℹ️ [createPickTicketFromSalesOrder] Skipping inventory allocation (called from modal)');
    }

    // Create pick ticket
    console.log('🎯 [createPickTicketFromSalesOrder] assignedToId parameter received:', assignedToId);
    console.log('🎯 [createPickTicketFromSalesOrder] assignedContactId parameter received:', assignedContactId);
    const createDTO: CreatePickTicketDTO = {
      salesOrderId,
      warehouseId: warehouseId || salesOrder.warehouse_id,
      assignedTo: assignedToId || null,
      assignedContactId: assignedContactId || null,
      priority: 'normal',
      specialInstructions: specialInstructions || null,
      notifiedContactIds: notifyContactIds || [],
      items,
    };
    console.log('🎯 [createPickTicketFromSalesOrder] createDTO.assignedTo:', createDTO.assignedTo);
    console.log('🎯 [createPickTicketFromSalesOrder] createDTO.assignedContactId:', createDTO.assignedContactId);

    const result = await PickTicketService.createPickTicket(createDTO, userId);

    if (result.success && result.data) {
      // Note: Shipment will be auto-created when Pick Ticket is COMPLETED (not here)
      // Pick Ticket CREATE = items need to be picked from warehouse
      // Pick Ticket COMPLETE = items picked, ready to ship -> create shipment

      // Send pick ticket email to selected contacts with PDF attachment
      if (notifyContactIds && notifyContactIds.length > 0) {
        try {
          // Get warehouse details
          const { data: warehouse } = await db
            .from('locations')
            .select('name, location_code')
            .eq('id', finalWarehouseId)
            .single();

          // Build ship to address
          const shipToAddress = [
            salesOrder.shipping_address_street,
            [salesOrder.shipping_address_city, salesOrder.shipping_address_state, salesOrder.shipping_address_postal_code]
              .filter(Boolean)
              .join(', '),
          ].filter(Boolean).join(', ');

          // Get customer name
          let customerName = 'Unknown Customer';
          if (salesOrder.customer_id) {
            const { data: customer } = await db
              .from('customers')
              .select('name')
              .eq('id', salesOrder.customer_id)
              .single();
            customerName = customer?.name || 'Unknown Customer';
          }

          const { sendPickTicketEmails } = await import('../services/email.service');
          const emailResult = await sendPickTicketEmails({
            pickTicketId: result.data.id,
            pickTicketNumber: result.data.pickTicketNumber,
            salesOrderNumber: salesOrder.order_number,
            warehouseName: warehouse?.name || 'Warehouse',
            warehouseCode: warehouse?.location_code || '',
            contactIds: notifyContactIds,
            customerName,
            shipToAddress: shipToAddress || 'N/A',
            requiredDate: salesOrder.requested_delivery_date,
            shippingMethod: salesOrder.shipping_method || null,
            customerPoNumber: salesOrder.customer_po_number,
            notes: specialInstructions || salesOrder.internal_notes,
            // Only include physical inventory items in email (same as pick ticket)
            items: items.map((item) => ({
              sku: item.sku,
              productName: item.description || item.sku,
              quantity: item.quantityToPick,
              uom: 'EA',
            })),
          });

          if (emailResult.sentTo.length > 0) {
            console.log(`[createPickTicketFromSalesOrder] Emails sent to: ${emailResult.sentTo.join(', ')}`);
          }
          if (emailResult.errors.length > 0) {
            console.error(`[createPickTicketFromSalesOrder] Email errors: ${emailResult.errors.join(', ')}`);
          }
        } catch (emailError) {
          // Don't fail pick ticket creation if email fails
          console.error('[createPickTicketFromSalesOrder] Failed to send emails:', emailError);
        }
      }

      // Send notification (async, non-blocking)
      try {
        const { data: warehouse } = await db
          .from('locations')
          .select('name')
          .eq('id', finalWarehouseId)
          .single();

        const { notificationService } = await import('@/features/notifications/services/notification.service');
        notificationService.notifyPickTicketCreated({
          pickTicketId: result.data.id,
          pickTicketNumber: result.data.pickTicketNumber,
          salesOrderNumber: salesOrder.order_number,
          warehouseName: warehouse?.name || 'Warehouse',
          createdBy: userId,
        }).catch((err) => {
          console.error('[createPickTicketFromSalesOrder] Failed to send notification:', err);
        });
      } catch (notifError) {
        console.error('[createPickTicketFromSalesOrder] Notification error:', notifError);
      }

      revalidatePath('/pick-tickets');
      revalidatePath('/sales-orders');
      revalidatePath(`/sales-orders/${salesOrderId}`);
      revalidatePath('/inventory');
      revalidatePath('/operations');
    }

    return result;
  } catch (error) {
    console.error('[createPickTicketFromSalesOrder] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create pick ticket',
    };
  }
}

// NOTE: Removed createShipmentFromCompletedPickTicket function
// Warehouse orders no longer create shipments - pick ticket/packing list tracks delivery directly


// ============================================
// PACKING LIST ACTIONS
// Note: Import packing list actions directly from './packing-list.actions'
// Re-exporting from a 'use server' file is not allowed in Next.js
// ============================================
