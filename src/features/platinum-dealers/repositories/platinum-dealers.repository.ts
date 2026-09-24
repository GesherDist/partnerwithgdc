/**
 * Platinum Dealers Repository
 *
 * Database layer for managing platinum dealers, locations, and inventory.
 * Handles CRUD operations, inventory checks, and allocation/deallocation.
 */

import { createClient } from '@/lib/supabase/server';
import type {
  PlatinumDealer,
  PlatinumDealerLocation,
  PlatinumDealerInventory,
  PlatinumDealerWithStats,
  PlatinumDealerInventoryWithDetails,
  DealerStatus,
  CreatePlatinumDealerDTO,
  UpdatePlatinumDealerDTO,
  CreatePlatinumDealerLocationDTO,
  UpdatePlatinumDealerLocationDTO,
  AdjustPlatinumDealerInventoryDTO,
  PlatinumDealerInventoryFilters,
} from '../types';

// ============================================
// PLATINUM DEALERS CRUD
// ============================================

/**
 * Create a platinum dealer
 */
export async function createDealer(
  params: CreatePlatinumDealerDTO & { createdBy?: string }
): Promise<{ data: PlatinumDealer | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('platinum_dealers')
      .insert({
        dealer_name: params.dealerName,
        code: params.code && params.code.trim() !== '' ? params.code.trim() : null,
        contact_name: params.contactName || null,
        phone: params.phone || null,
        email: params.email || null,
        address_street: params.addressStreet || null,
        address_city: params.addressCity || null,
        address_state: params.addressState || null,
        address_postal_code: params.addressPostalCode || null,
        address_country: params.addressCountry || 'US',
        notes: params.notes || null,
        created_by: params.createdBy || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating dealer:', error);

      // Provide better error messages
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        return {
          data: null,
          error: new Error('A dealer with this code already exists. Please use a different code.')
        };
      }

      if (error.code === 'PGRST116') {
        return {
          data: null,
          error: new Error('You do not have permission to create dealers. Please contact your administrator.')
        };
      }

      return { data: null, error: new Error(error.message) };
    }

    return { data: mapDealerFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error creating dealer:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get dealer by ID
 */
export async function getDealerById(
  id: string
): Promise<{ data: PlatinumDealer | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error} = await supabase
      .from('platinum_dealers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('Error fetching dealer:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapDealerFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error fetching dealer:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get all dealers (excluding soft-deleted)
 */
export async function getAllDealers(filters?: {
  status?: DealerStatus;
  search?: string;
}): Promise<{ data: PlatinumDealer[]; error: Error | null }> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('platinum_dealers')
      .select('*')
      .is('deleted_at', null)
      .order('dealer_name', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(
        `dealer_name.ilike.%${filters.search}%,code.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching dealers:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapDealerFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching dealers:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get dealer with stats (locations count, inventory value)
 */
export async function getDealerWithStats(
  id: string
): Promise<{ data: PlatinumDealerWithStats | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    // Get dealer
    const { data: dealer, error: dealerError } = await supabase
      .from('platinum_dealers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (dealerError || !dealer) {
      return { data: null, error: new Error('Dealer not found') };
    }

    // Get locations count
    const { count: locationsCount } = await supabase
      .from('platinum_dealer_locations')
      .select('id', { count: 'exact', head: true })
      .eq('dealer_id', id)
      .is('deleted_at', null);

    // For now, set inventory value to 0 (can calculate later if needed)
    const totalInventoryValue = 0;

    return {
      data: {
        ...mapDealerFromDb(dealer),
        locationsCount: locationsCount || 0,
        totalInventoryValue,
      },
      error: null,
    };
  } catch (error) {
    console.error('Unexpected error fetching dealer with stats:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Update dealer
 */
export async function updateDealer(
  id: string,
  params: UpdatePlatinumDealerDTO
): Promise<{ data: PlatinumDealer | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const updateData: Record<string, any> = {};

    if (params.dealerName !== undefined)
      updateData.dealer_name = params.dealerName;

    // Handle empty code: convert empty string to null to avoid UNIQUE constraint issues
    if (params.code !== undefined) {
      updateData.code = params.code && params.code.trim() !== '' ? params.code.trim() : null;
    }

    if (params.contactName !== undefined)
      updateData.contact_name = params.contactName;
    if (params.phone !== undefined) updateData.phone = params.phone;
    if (params.email !== undefined) updateData.email = params.email;
    if (params.addressStreet !== undefined)
      updateData.address_street = params.addressStreet;
    if (params.addressCity !== undefined)
      updateData.address_city = params.addressCity;
    if (params.addressState !== undefined)
      updateData.address_state = params.addressState;
    if (params.addressPostalCode !== undefined)
      updateData.address_postal_code = params.addressPostalCode;
    if (params.addressCountry !== undefined)
      updateData.address_country = params.addressCountry;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.notes !== undefined) updateData.notes = params.notes;

    const { data, error } = await supabase
      .from('platinum_dealers')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null) // Ensure we're only updating non-deleted dealers
      .select()
      .single();

    if (error) {
      console.error('Error updating dealer:', error);

      // Provide better error messages
      if (error.code === 'PGRST116') {
        return {
          data: null,
          error: new Error('Dealer not found or you do not have permission to update it. Please contact your administrator.')
        };
      }

      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        return {
          data: null,
          error: new Error('A dealer with this code already exists. Please use a different code.')
        };
      }

      return { data: null, error: new Error(error.message) };
    }

    return { data: mapDealerFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error updating dealer:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Delete dealer (soft delete)
 */
export async function deleteDealer(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('platinum_dealers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting dealer:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error deleting dealer:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

// ============================================
// DEALER LOCATIONS CRUD
// ============================================

/**
 * Create dealer location
 */
export async function createDealerLocation(
  params: CreatePlatinumDealerLocationDTO
): Promise<{ data: PlatinumDealerLocation | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('platinum_dealer_locations')
      .insert({
        dealer_id: params.dealerId,
        location_name: params.locationName,
        location_code: params.locationCode || null,
        address_street: params.addressStreet || null,
        address_city: params.addressCity || null,
        address_state: params.addressState || null,
        address_postal_code: params.addressPostalCode || null,
        address_country: params.addressCountry || 'US',
        contact_name: params.contactName || null,
        phone: params.phone || null,
        email: params.email || null,
        notes: params.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating dealer location:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapDealerLocationFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error creating dealer location:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get dealer location by ID
 */
export async function getDealerLocationById(
  id: string
): Promise<{ data: PlatinumDealerLocation | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('platinum_dealer_locations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('Error fetching dealer location:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapDealerLocationFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error fetching dealer location:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get all locations for a dealer
 */
export async function getLocationsByDealerId(
  dealerId: string
): Promise<{ data: PlatinumDealerLocation[]; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('platinum_dealer_locations')
      .select('*')
      .eq('dealer_id', dealerId)
      .is('deleted_at', null)
      .order('location_name', { ascending: true });

    if (error) {
      console.error('Error fetching dealer locations:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapDealerLocationFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching dealer locations:', error);
    return {
      data: [],
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Update dealer location
 */
export async function updateDealerLocation(
  id: string,
  params: UpdatePlatinumDealerLocationDTO
): Promise<{ data: PlatinumDealerLocation | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const updateData: Record<string, any> = {};

    if (params.locationName !== undefined)
      updateData.location_name = params.locationName;
    if (params.locationCode !== undefined)
      updateData.location_code = params.locationCode;
    if (params.addressStreet !== undefined)
      updateData.address_street = params.addressStreet;
    if (params.addressCity !== undefined)
      updateData.address_city = params.addressCity;
    if (params.addressState !== undefined)
      updateData.address_state = params.addressState;
    if (params.addressPostalCode !== undefined)
      updateData.address_postal_code = params.addressPostalCode;
    if (params.addressCountry !== undefined)
      updateData.address_country = params.addressCountry;
    if (params.contactName !== undefined)
      updateData.contact_name = params.contactName;
    if (params.phone !== undefined) updateData.phone = params.phone;
    if (params.email !== undefined) updateData.email = params.email;
    if (params.status !== undefined) updateData.status = params.status;
    if (params.notes !== undefined) updateData.notes = params.notes;

    const { data, error } = await supabase
      .from('platinum_dealer_locations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating dealer location:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapDealerLocationFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error updating dealer location:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Delete dealer location (soft delete)
 */
export async function deleteDealerLocation(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('platinum_dealer_locations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error deleting dealer location:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error deleting dealer location:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

// ============================================
// DEALER INVENTORY
// ============================================

/**
 * Get dealer inventory for a specific location and product
 */
export async function getDealerInventory(params: {
  dealerLocationId: string;
  productId: string;
}): Promise<{ data: PlatinumDealerInventory | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('platinum_dealer_inventory')
      .select('*')
      .eq('dealer_location_id', params.dealerLocationId)
      .eq('product_id', params.productId)
      .single();

    if (error) {
      // If not found, return null (not an error - inventory might not exist yet)
      if (error.code === 'PGRST116') {
        return { data: null, error: null };
      }
      console.error('Error fetching dealer inventory:', error);
      return { data: null, error: new Error(error.message) };
    }

    return { data: mapDealerInventoryFromDb(data), error: null };
  } catch (error) {
    console.error('Unexpected error fetching dealer inventory:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get available inventory (on_hand - allocated)
 */
export async function getAvailableInventory(params: {
  dealerLocationId: string;
  productId: string;
}): Promise<{
  available: number;
  onHand: number;
  allocated: number;
  error: Error | null;
}> {
  try {
    const { data, error } = await getDealerInventory(params);

    if (error) {
      return { available: 0, onHand: 0, allocated: 0, error };
    }

    if (!data) {
      return { available: 0, onHand: 0, allocated: 0, error: null };
    }

    return {
      available: data.available,
      onHand: data.onHand,
      allocated: data.allocated,
      error: null,
    };
  } catch (error) {
    console.error('Unexpected error getting available inventory:', error);
    return {
      available: 0,
      onHand: 0,
      allocated: 0,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Update inventory on-hand quantity
 */
export async function updateInventory(
  params: AdjustPlatinumDealerInventoryDTO & { dealerId: string }
): Promise<{ data: PlatinumDealerInventory | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    // Check if inventory record exists
    const { data: existing } = await getDealerInventory({
      dealerLocationId: params.dealerLocationId,
      productId: params.productId,
    });

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('platinum_dealer_inventory')
        .update({
          on_hand: params.onHand,
          notes: params.notes || null,
        })
        .eq('dealer_location_id', params.dealerLocationId)
        .eq('product_id', params.productId)
        .select()
        .single();

      if (error) {
        console.error('Error updating inventory:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data: mapDealerInventoryFromDb(data), error: null };
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('platinum_dealer_inventory')
        .insert({
          dealer_id: params.dealerId,
          dealer_location_id: params.dealerLocationId,
          product_id: params.productId,
          on_hand: params.onHand,
          allocated: 0,
          notes: params.notes || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating inventory:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data: mapDealerInventoryFromDb(data), error: null };
    }
  } catch (error) {
    console.error('Unexpected error updating inventory:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Allocate inventory (increase allocated quantity)
 */
export async function allocateInventory(params: {
  dealerLocationId: string;
  productId: string;
  quantity: number;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabase = await createClient();

    // Get current inventory
    const { data: inventory, error: fetchError } = await getDealerInventory({
      dealerLocationId: params.dealerLocationId,
      productId: params.productId,
    });

    if (fetchError) {
      return { success: false, error: fetchError };
    }

    if (!inventory) {
      return {
        success: false,
        error: new Error('Inventory record not found'),
      };
    }

    // Check if enough available
    if (inventory.available < params.quantity) {
      return {
        success: false,
        error: new Error(
          `Insufficient inventory. Available: ${inventory.available}, Requested: ${params.quantity}`
        ),
      };
    }

    // Update allocated quantity
    const { error: updateError } = await supabase
      .from('platinum_dealer_inventory')
      .update({
        allocated: inventory.allocated + params.quantity,
      })
      .eq('dealer_location_id', params.dealerLocationId)
      .eq('product_id', params.productId);

    if (updateError) {
      console.error('Error allocating inventory:', updateError);
      return { success: false, error: new Error(updateError.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error allocating inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Deallocate inventory (decrease allocated quantity)
 */
export async function deallocateInventory(params: {
  dealerLocationId: string;
  productId: string;
  quantity: number;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabase = await createClient();

    // Get current inventory
    const { data: inventory, error: fetchError } = await getDealerInventory({
      dealerLocationId: params.dealerLocationId,
      productId: params.productId,
    });

    if (fetchError) {
      return { success: false, error: fetchError };
    }

    if (!inventory) {
      return {
        success: false,
        error: new Error('Inventory record not found'),
      };
    }

    // Check if enough allocated to deallocate
    if (inventory.allocated < params.quantity) {
      return {
        success: false,
        error: new Error(
          `Cannot deallocate ${params.quantity} units. Only ${inventory.allocated} allocated.`
        ),
      };
    }

    // Update allocated quantity
    const { error: updateError } = await supabase
      .from('platinum_dealer_inventory')
      .update({
        allocated: inventory.allocated - params.quantity,
      })
      .eq('dealer_location_id', params.dealerLocationId)
      .eq('product_id', params.productId);

    if (updateError) {
      console.error('Error deallocating inventory:', updateError);
      return { success: false, error: new Error(updateError.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error deallocating inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Delete dealer inventory record
 */
export async function deleteDealerInventory(params: {
  dealerLocationId: string;
  productId: string;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('platinum_dealer_inventory')
      .delete()
      .eq('dealer_location_id', params.dealerLocationId)
      .eq('product_id', params.productId);

    if (error) {
      console.error('Error deleting dealer inventory:', error);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error deleting dealer inventory:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

// ============================================
// AVAILABILITY CHECKS
// ============================================

/**
 * Check if dealer can fulfill requested quantity
 */
export async function checkDealerInventoryAvailable(params: {
  dealerLocationId: string;
  productId: string;
  quantity: number;
}): Promise<{
  available: boolean;
  onHand: number;
  allocated: number;
  availableQty: number;
  error: Error | null;
}> {
  try {
    const { available, onHand, allocated, error } =
      await getAvailableInventory({
        dealerLocationId: params.dealerLocationId,
        productId: params.productId,
      });

    if (error) {
      return {
        available: false,
        onHand: 0,
        allocated: 0,
        availableQty: 0,
        error,
      };
    }

    return {
      available: available >= params.quantity,
      onHand,
      allocated,
      availableQty: available,
      error: null,
    };
  } catch (error) {
    console.error('Unexpected error checking inventory availability:', error);
    return {
      available: false,
      onHand: 0,
      allocated: 0,
      availableQty: 0,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Get all dealers that have a specific product in stock
 */
export async function getDealersByProduct(
  productId: string
): Promise<{
  data: PlatinumDealerInventoryWithDetails[];
  error: Error | null;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('platinum_dealer_inventory')
      .select(
        `
        *,
        product:products(id, sku, description),
        dealer_location:platinum_dealer_locations(id, location_name, address_city, address_state),
        dealer:platinum_dealers(id, dealer_name)
      `
      )
      .eq('product_id', productId)
      .gt('available', 0)
      .order('available', { ascending: false });

    if (error) {
      console.error('Error fetching dealers by product:', error);
      return { data: [], error: new Error(error.message) };
    }

    return { data: data.map(mapDealerInventoryWithDetailsFromDb), error: null };
  } catch (error) {
    console.error('Unexpected error fetching dealers by product:', error);
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
 * Map database row to PlatinumDealer type
 */
function mapDealerFromDb(data: any): PlatinumDealer {
  return {
    id: data.id,
    dealerName: data.dealer_name,
    code: data.code,
    contactName: data.contact_name,
    phone: data.phone,
    email: data.email,
    addressStreet: data.address_street,
    addressCity: data.address_city,
    addressState: data.address_state,
    addressPostalCode: data.address_postal_code,
    addressCountry: data.address_country,
    status: data.status,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    createdBy: data.created_by,
    deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
  };
}

/**
 * Map database row to PlatinumDealerLocation type
 */
function mapDealerLocationFromDb(data: any): PlatinumDealerLocation {
  return {
    id: data.id,
    dealerId: data.dealer_id,
    locationName: data.location_name,
    locationCode: data.location_code,
    addressStreet: data.address_street,
    addressCity: data.address_city,
    addressState: data.address_state,
    addressPostalCode: data.address_postal_code,
    addressCountry: data.address_country,
    contactName: data.contact_name,
    phone: data.phone,
    email: data.email,
    status: data.status,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
    deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
  };
}

/**
 * Map database row to PlatinumDealerInventory type
 */
function mapDealerInventoryFromDb(data: any): PlatinumDealerInventory {
  return {
    id: data.id,
    dealerId: data.dealer_id,
    dealerLocationId: data.dealer_location_id,
    productId: data.product_id,
    onHand: data.on_hand,
    allocated: data.allocated,
    available: data.available,
    lastCountedAt: data.last_counted_at
      ? new Date(data.last_counted_at)
      : null,
    notes: data.notes,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

/**
 * Map database row with joins to PlatinumDealerInventoryWithDetails type
 */
function mapDealerInventoryWithDetailsFromDb(
  data: any
): PlatinumDealerInventoryWithDetails {
  const inventory = mapDealerInventoryFromDb(data);

  return {
    ...inventory,
    product: {
      id: data.product.id,
      sku: data.product.sku,
      description: data.product.description,
    },
    dealerLocation: {
      id: data.dealer_location.id,
      locationName: data.dealer_location.location_name,
      addressCity: data.dealer_location.address_city,
      addressState: data.dealer_location.address_state,
    },
    dealer: {
      id: data.dealer.id,
      dealerName: data.dealer.dealer_name,
    },
  };
}

// ============================================
// ADDITIONAL INVENTORY FUNCTIONS
// ============================================

/**
 * Get all inventory for a dealer across all locations
 */
export async function getAllInventoryForDealer(
  dealerId: string,
  filters?: PlatinumDealerInventoryFilters
): Promise<{ data: PlatinumDealerInventoryWithDetails[] | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from('platinum_dealer_inventory')
      .select(
        `
        *,
        product:products!inner(id, sku, description),
        dealerLocation:platinum_dealer_locations!inner(id, location_name, address_city, address_state),
        dealer:platinum_dealers!inner(id, dealer_name)
      `
      )
      .eq('dealer_id', dealerId);

    // Apply filters
    if (filters?.productId) {
      query = query.eq('product_id', filters.productId);
    }

    if (filters?.dealerLocationId) {
      query = query.eq('dealer_location_id', filters.dealerLocationId);
    }

    if (filters?.lowStock !== undefined && filters.lowStock) {
      // Low stock: available < reorder_point (if we add that field later)
      // For now, just show items with low availability
      query = query.lt('available', 10);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) {
      return { data: null, error };
    }

    const inventory = (data || []).map((item: any) => {
      const base = mapDealerInventoryFromDb(item);
      return {
        ...base,
        product: {
          id: item.product.id,
          sku: item.product.sku,
          description: item.product.description,
        },
        dealerLocation: {
          id: item.dealerLocation.id,
          locationName: item.dealerLocation.location_name,
          addressCity: item.dealerLocation.address_city,
          addressState: item.dealerLocation.address_state,
        },
        dealer: {
          id: item.dealer.id,
          dealerName: item.dealer.dealer_name,
        },
      } as PlatinumDealerInventoryWithDetails;
    });

    return { data: inventory, error: null };
  } catch (error) {
    console.error('Error getting all inventory for dealer:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Update dealer inventory on_hand quantity
 */
export async function updateDealerInventory(params: {
  dealerLocationId: string;
  productId: string;
  onHand: number;
}): Promise<{ data: PlatinumDealerInventory | null; error: Error | null }> {
  try {
    const supabase = await createClient();

    // Get current inventory
    const { data: current, error: fetchError } = await supabase
      .from('platinum_dealer_inventory')
      .select('*')
      .eq('dealer_location_id', params.dealerLocationId)
      .eq('product_id', params.productId)
      .single();

    if (fetchError || !current) {
      return {
        data: null,
        error: fetchError || new Error('Inventory not found'),
      };
    }

    // Update on_hand quantity
    const { data, error } = await supabase
      .from('platinum_dealer_inventory')
      .update({
        on_hand: params.onHand,
        updated_at: new Date().toISOString(),
      })
      .eq('dealer_location_id', params.dealerLocationId)
      .eq('product_id', params.productId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: mapDealerInventoryFromDb(data), error: null };
  } catch (error) {
    console.error('Error updating dealer inventory:', error);
    return {
      data: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}
