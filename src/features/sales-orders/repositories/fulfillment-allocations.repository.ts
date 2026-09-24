/**
 * Fulfillment Allocations Repository
 *
 * Database layer for managing fulfillment allocations.
 * Handles CRUD operations, validation queries, and availability checks.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  FulfillmentAllocation,
  FulfillmentAllocationWithDetails,
  FulfillmentSource,
  AllocationStatus,
} from '../types';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface CreateAllocationParams {
  salesOrderItemId: string;
  fulfillmentSource: FulfillmentSource;
  quantity: number;
  status?: AllocationStatus;
  locationId?: string | null;
  assignedContactId?: string | null;
  assignedUserId?: string | null;
  platinumDealerId?: string | null;
  dealerLocationId?: string | null;
  purchaseOrderId?: string | null;
  containerId?: string | null;
  containerQty?: number;
  containerRemaining?: number;
  notes?: string | null;
  createdBy?: string | null;
}

interface UpdateAllocationParams {
  id: string;
  fulfillmentSource?: FulfillmentSource;
  quantity?: number;
  status?: AllocationStatus;
  locationId?: string | null;
  assignedContactId?: string | null;
  assignedUserId?: string | null;
  platinumDealerId?: string | null;
  dealerLocationId?: string | null;
  purchaseOrderId?: string | null;
  containerId?: string | null;
  containerQty?: number;
  containerRemaining?: number;
  notes?: string | null;
}

interface AllocationValidationResult {
  valid: boolean;
  error?: string;
  totalAllocated: number;
  remainingToAllocate: number;
  customerQty: number;
}

// ============================================
// BASIC CRUD OPERATIONS
// ============================================

/**
 * Create a single fulfillment allocation
 */
export async function createAllocation(
  params: CreateAllocationParams
): Promise<{ data: FulfillmentAllocation | null; error: Error | null }> {
  try {
    const supabase = db;

    // 🐛 DEBUG: Log what we're inserting
    const insertData = {
      sales_order_item_id: params.salesOrderItemId,
      fulfillment_source: params.fulfillmentSource,
      quantity: params.quantity,
      status: params.status || 'pending',
      location_id: params.locationId,
      assigned_contact_id: params.assignedContactId,
      assigned_user_id: params.assignedUserId,
      platinum_dealer_id: params.platinumDealerId,
      dealer_location_id: params.dealerLocationId,
      purchase_order_id: params.purchaseOrderId,
      container_id: params.containerId,
      container_qty: params.containerQty || 0,
      container_remaining: params.containerRemaining || 0,
      notes: params.notes,
      created_by: params.createdBy,
    };

    console.log('🔍 [createAllocation] Inserting allocation:', {
      fulfillmentSource: insertData.fulfillment_source,
      platinumDealerId: insertData.platinum_dealer_id,
      dealerLocationId: insertData.dealer_location_id,
      isNull_platinumDealerId: insertData.platinum_dealer_id === null || insertData.platinum_dealer_id === undefined,
      fullData: insertData,
    });

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating allocation:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapAllocationFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error creating allocation:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Create multiple allocations in a batch
 */
export async function createBatchAllocations(
  allocations: CreateAllocationParams[]
): Promise<{
  data: FulfillmentAllocation[] | null;
  error: Error | null;
}> {
  try {
    const supabase = db;

    const insertData = allocations.map((params) => ({
      sales_order_item_id: params.salesOrderItemId,
      fulfillment_source: params.fulfillmentSource,
      quantity: params.quantity,
      status: params.status || 'pending',
      location_id: params.locationId,
      assigned_contact_id: params.assignedContactId,
      assigned_user_id: params.assignedUserId,
      platinum_dealer_id: params.platinumDealerId,
      dealer_location_id: params.dealerLocationId,
      purchase_order_id: params.purchaseOrderId,
      container_id: params.containerId,
      container_qty: params.containerQty || 0,
      container_remaining: params.containerRemaining || 0,
      notes: params.notes,
      created_by: params.createdBy,
    }));

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Error creating batch allocations:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: data.map(mapAllocationFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error creating batch allocations:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get allocation by ID
 */
export async function getAllocationById(
  id: string
): Promise<{
  data: FulfillmentAllocation | null;
  error: Error | null;
}> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching allocation:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapAllocationFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error fetching allocation:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get allocation by ID with related data (location, dealer, PO)
 */
export async function getAllocationByIdWithDetails(
  id: string
): Promise<{
  data: FulfillmentAllocationWithDetails | null;
  error: Error | null;
}> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select(
        `
        *,
        location:locations(id, location_code, name),
        assigned_contact:location_contacts(id, name, email, phone),
        platinum_dealer:platinum_dealers(id, dealer_name, code, email, contact_name),
        dealer_location:platinum_dealer_locations(id, location_name, location_code, address_street, address_city, address_state, address_postal_code),
        purchase_order:purchase_orders(id, po_number, status)
      `
      )
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching allocation with details:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapAllocationWithDetailsFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error fetching allocation with details:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get all allocations for a sales order item
 */
export async function getAllocationsByItemId(
  salesOrderItemId: string
): Promise<{
  data: FulfillmentAllocationWithDetails[];
  error: Error | null;
}> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select(
        `
        *,
        location:locations(id, location_code, name),
        assigned_contact:location_contacts(id, name, email, phone),
        platinum_dealer:platinum_dealers(id, dealer_name, code, email, contact_name),
        dealer_location:platinum_dealer_locations(id, location_name, location_code, address_street, address_city, address_state, address_postal_code),
        purchase_order:purchase_orders(id, po_number, status)
      `
      )
      .eq('sales_order_item_id', salesOrderItemId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching allocations by item:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapAllocationWithDetailsFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching allocations by item:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Update allocation
 */
export async function updateAllocation(
  params: UpdateAllocationParams
): Promise<{ data: FulfillmentAllocation | null; error: Error | null }> {
  try {
    const supabase = db;

    const updateData: Record<string, any> = {};

    if (params.fulfillmentSource !== undefined)
      updateData.fulfillment_source = params.fulfillmentSource;
    if (params.quantity !== undefined) updateData.quantity = params.quantity;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.locationId !== undefined)
      updateData.location_id = params.locationId;
    if (params.assignedContactId !== undefined)
      updateData.assigned_contact_id = params.assignedContactId;
    if (params.assignedUserId !== undefined)
      updateData.assigned_user_id = params.assignedUserId;
    if (params.platinumDealerId !== undefined)
      updateData.platinum_dealer_id = params.platinumDealerId;
    if (params.dealerLocationId !== undefined)
      updateData.dealer_location_id = params.dealerLocationId;
    if (params.purchaseOrderId !== undefined)
      updateData.purchase_order_id = params.purchaseOrderId;
    if (params.containerId !== undefined)
      updateData.container_id = params.containerId;
    if (params.containerQty !== undefined)
      updateData.container_qty = params.containerQty;
    if (params.containerRemaining !== undefined)
      updateData.container_remaining = params.containerRemaining;
    if (params.notes !== undefined) updateData.notes = params.notes;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating allocation:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapAllocationFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error updating allocation:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Delete allocation
 */
export async function deleteAllocation(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabase = db;

    const { error } = await supabase
      .from('fulfillment_allocations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting allocation:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error deleting allocation:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

// ============================================
// VALIDATION QUERIES
// ============================================

/**
 * Get total allocated quantity for a sales order item
 */
export async function getTotalAllocatedForItem(
  salesOrderItemId: string
): Promise<{ total: number; error: Error | null }> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select('quantity')
      .eq('sales_order_item_id', salesOrderItemId);

    if (error) {
      console.error('Error getting total allocated:', error);
      return { total: 0, error: new Error(error.message) };
    }

    const total = data.reduce((sum, item) => sum + item.quantity, 0);
    return { total, error: null };
  } catch (error) {
    console.error('Unexpected error getting total allocated:', error);
    return {
      total: 0,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Check if adding new quantity would over-allocate
 */
export async function checkOverAllocation(params: {
  salesOrderItemId: string;
  newQuantity: number;
  excludeAllocationId?: string; // For updates - exclude this allocation from check
}): Promise<AllocationValidationResult> {
  try {
    const supabase = db;

    // Get customer quantity from sales order item
    const { data: itemData, error: itemError } = await supabase
      .from('sales_order_items')
      .select('customer_qty')
      .eq('id', params.salesOrderItemId)
      .single();

    if (itemError || !itemData) {
      return {
        valid: false,
        error: 'Sales order item not found',
        totalAllocated: 0,
        remainingToAllocate: 0,
        customerQty: 0,
      };
    }

    const customerQty = itemData.customer_qty;

    // Get existing allocations (excluding the one being updated if specified)
    let query = supabase
      .from('fulfillment_allocations')
      .select('quantity')
      .eq('sales_order_item_id', params.salesOrderItemId);

    if (params.excludeAllocationId) {
      query = query.neq('id', params.excludeAllocationId);
    }

    const { data: allocations, error: allocError } = await query;

    if (allocError) {
      return {
        valid: false,
        error: allocError.message,
        totalAllocated: 0,
        remainingToAllocate: 0,
        customerQty,
      };
    }

    const totalExisting = allocations.reduce(
      (sum, a) => sum + a.quantity,
      0
    );
    const totalAfterNew = totalExisting + params.newQuantity;

    if (totalAfterNew > customerQty) {
      return {
        valid: false,
        error: `Cannot allocate ${params.newQuantity} units. Total allocation (${totalAfterNew}) would exceed customer quantity (${customerQty}). ${customerQty - totalExisting} units remaining.`,
        totalAllocated: totalExisting,
        remainingToAllocate: customerQty - totalExisting,
        customerQty,
      };
    }

    return {
      valid: true,
      totalAllocated: totalAfterNew,
      remainingToAllocate: customerQty - totalAfterNew,
      customerQty,
    };
  } catch (error) {
    console.error('Unexpected error checking over-allocation:', error);
    return {
      valid: false,
      error:
        error instanceof Error ? error.message : 'Unknown error occurred',
      totalAllocated: 0,
      remainingToAllocate: 0,
      customerQty: 0,
    };
  }
}

/**
 * Get available quantity to allocate for a sales order item
 */
export async function getAvailableToAllocate(
  salesOrderItemId: string
): Promise<{ available: number; error: Error | null }> {
  try {
    const supabase = db;

    // Get customer quantity
    const { data: itemData, error: itemError } = await supabase
      .from('sales_order_items')
      .select('customer_qty')
      .eq('id', salesOrderItemId)
      .single();

    if (itemError || !itemData) {
      return { available: 0, error: new Error('Sales order item not found') };
    }

    // Get total allocated
    const { total: totalAllocated, error: allocError } =
      await getTotalAllocatedForItem(salesOrderItemId);

    if (allocError) {
      return { available: 0, error: allocError };
    }

    const available = itemData.customer_qty - totalAllocated;
    return { available: Math.max(0, available), error: null };
  } catch (error) {
    console.error('Unexpected error getting available to allocate:', error);
    return {
      available: 0,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

// ============================================
// ADVANCED QUERIES
// ============================================

/**
 * Get allocations by fulfillment source
 */
export async function getAllocationsBySource(
  fulfillmentSource: FulfillmentSource
): Promise<{
  data: FulfillmentAllocationWithDetails[];
  error: Error | null;
}> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select(
        `
        *,
        location:locations(id, location_code, name),
        platinum_dealer:platinum_dealers(id, dealer_name, code, email, contact_name),
        dealer_location:platinum_dealer_locations(id, location_name, location_code, address_street, address_city, address_state, address_postal_code),
        purchase_order:purchase_orders(id, po_number, status)
      `
      )
      .eq('fulfillment_source', fulfillmentSource)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching allocations by source:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapAllocationWithDetailsFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching allocations by source:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get allocations by platinum dealer
 */
export async function getAllocationsByDealer(
  dealerId: string
): Promise<{
  data: FulfillmentAllocationWithDetails[];
  error: Error | null;
}> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select(
        `
        *,
        location:locations(id, location_code, name),
        platinum_dealer:platinum_dealers(id, dealer_name, code, email, contact_name),
        dealer_location:platinum_dealer_locations(id, location_name, location_code, address_street, address_city, address_state, address_postal_code),
        purchase_order:purchase_orders(id, po_number, status),
        sales_order_item:sales_order_items(
          id,
          sku,
          description,
          sales_order:sales_orders(
            id,
            order_number,
            customer:customers(
              id,
              name
            )
          )
        )
      `
      )
      .eq('platinum_dealer_id', dealerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching allocations by dealer:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapAllocationWithDetailsFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching allocations by dealer:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get allocations by location (GDC warehouse)
 */
export async function getAllocationsByLocation(
  locationId: string
): Promise<{
  data: FulfillmentAllocationWithDetails[];
  error: Error | null;
}> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select(
        `
        *,
        location:locations(id, location_code, name),
        platinum_dealer:platinum_dealers(id, dealer_name, code, email, contact_name),
        dealer_location:platinum_dealer_locations(id, location_name, location_code, address_street, address_city, address_state, address_postal_code),
        purchase_order:purchase_orders(id, po_number, status)
      `
      )
      .eq('location_id', locationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching allocations by location:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapAllocationWithDetailsFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching allocations by location:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get pending allocations (status = 'pending')
 */
export async function getPendingAllocations(): Promise<{
  data: FulfillmentAllocationWithDetails[];
  error: Error | null;
}> {
  try {
    const supabase = db;

    const { data, error } = await supabase
      .from('fulfillment_allocations')
      .select(
        `
        *,
        location:locations(id, location_code, name),
        platinum_dealer:platinum_dealers(id, dealer_name, code, email, contact_name),
        dealer_location:platinum_dealer_locations(id, location_name, location_code, address_street, address_city, address_state, address_postal_code),
        purchase_order:purchase_orders(id, po_number, status)
      `
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending allocations:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapAllocationWithDetailsFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching pending allocations:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map database row to FulfillmentAllocation type
 */
function mapAllocationFromDb(data: any): FulfillmentAllocation {
  return {
    id: data.id,
    salesOrderItemId: data.sales_order_item_id,
    fulfillmentSource: data.fulfillment_source,
    quantity: data.quantity,
    status: data.status,
    locationId: data.location_id,
    assignedContactId: data.assigned_contact_id,
    assignedUserId: data.assigned_user_id,
    platinumDealerId: data.platinum_dealer_id,
    dealerLocationId: data.dealer_location_id,
    purchaseOrderId: data.purchase_order_id,
    containerId: data.container_id,
    containerQty: data.container_qty,
    containerRemaining: data.container_remaining,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.created_by,
  };
}

/**
 * Map database row with joins to FulfillmentAllocationWithDetails type
 */
function mapAllocationWithDetailsFromDb(
  data: any
): FulfillmentAllocationWithDetails {
  const allocation = mapAllocationFromDb(data);

  return {
    ...allocation,
    location: data.location
      ? {
          id: data.location.id,
          locationCode: data.location.location_code,
          name: data.location.name,
        }
      : undefined,
    assignedContact: data.assigned_contact
      ? {
          id: data.assigned_contact.id,
          name: data.assigned_contact.name,
          email: data.assigned_contact.email,
          phone: data.assigned_contact.phone,
        }
      : undefined,
    platinumDealer: data.platinum_dealer
      ? {
          id: data.platinum_dealer.id,
          dealerName: data.platinum_dealer.dealer_name,
          code: data.platinum_dealer.code,
          email: data.platinum_dealer.email,
          contactName: data.platinum_dealer.contact_name,
        }
      : undefined,
    dealerLocation: data.dealer_location
      ? {
          id: data.dealer_location.id,
          dealerId: allocation.platinumDealerId!,
          locationName: data.dealer_location.location_name,
          locationCode: data.dealer_location.location_code,
          addressStreet: data.dealer_location.address_street,
          addressCity: data.dealer_location.address_city,
          addressState: data.dealer_location.address_state,
          addressPostalCode: data.dealer_location.address_postal_code,
        }
      : undefined,
    purchaseOrder: data.purchase_order
      ? {
          id: data.purchase_order.id,
          poNumber: data.purchase_order.po_number,
          status: data.purchase_order.status,
        }
      : undefined,
    salesOrderItem: data.sales_order_item
      ? {
          id: data.sales_order_item.id,
          sku: data.sales_order_item.sku,
          description: data.sales_order_item.description,
          salesOrder: data.sales_order_item.sales_order
            ? {
                id: data.sales_order_item.sales_order.id,
                orderNumber: data.sales_order_item.sales_order.order_number,
                customer: data.sales_order_item.sales_order.customer
                  ? {
                      id: data.sales_order_item.sales_order.customer.id,
                      companyName: data.sales_order_item.sales_order.customer.name,
                    }
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}
