/**
 * Locations Repository
 *
 * Data access layer for Locations module.
 * Handles all database operations for locations using Supabase Client.
 */

import { db } from '@/shared/lib/supabase/database';
import type { Location, CreateLocationDTO, UpdateLocationDTO, LocationListParams, LocationType } from '../types';

// ============================================
// DATABASE ROW TYPE
// ============================================

interface DbLocation {
  id: string;
  location_code: string;
  name: string;
  location_type: LocationType;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

// ============================================
// TYPES
// ============================================

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// REPOSITORY
// ============================================

class LocationRepositoryImpl {
  /**
   * Find all locations with pagination and filtering
   */
  async findMany(params: LocationListParams = {}): Promise<PaginatedResult<Location>> {
    const {
      page = 1,
      limit = 10,
      search,
      locationType,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('locations')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Apply search filter
    if (search) {
      query = query.or(
        `location_code.ilike.%${search}%,name.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%,contact_name.ilike.%${search}%`
      );
    }

    // Apply type filter
    if (locationType) {
      query = query.eq('location_type', locationType);
    }

    // Apply active filter
    if (isActive !== undefined) {
      query = query.eq('is_active', isActive);
    }

    // Map camelCase sort fields to snake_case
    const sortFieldMap: Record<string, string> = {
      locationCode: 'location_code',
      locationType: 'location_type',
      contactName: 'contact_name',
      contactPhone: 'contact_phone',
      contactEmail: 'contact_email',
      isActive: 'is_active',
      isDefault: 'is_default',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    };

    const dbSortField = sortFieldMap[sortBy] || 'created_at';
    query = query.order(dbSortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch locations: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToLocation(row as DbLocation)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find a single location by ID
   */
  async findById(id: string): Promise<Location | null> {
    const { data, error } = await db
      .from('locations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch location: ${error.message}`);
    }

    return data ? this.mapToLocation(data as DbLocation) : null;
  }

  /**
   * Find a single location by code
   */
  async findByCode(locationCode: string): Promise<Location | null> {
    const { data, error } = await db
      .from('locations')
      .select('*')
      .eq('location_code', locationCode)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch location: ${error.message}`);
    }

    return data ? this.mapToLocation(data as DbLocation) : null;
  }

  /**
   * Check if location code exists (for validation)
   */
  async codeExists(locationCode: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('location_code', locationCode)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check location code: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }

  /**
   * Get the default location
   */
  async getDefault(): Promise<Location | null> {
    const { data, error } = await db
      .from('locations')
      .select('*')
      .eq('is_default', true)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;}
      throw new Error(`Failed to fetch default location: ${error.message}`);
    }

    return data ? this.mapToLocation(data as DbLocation) : null;
  }

  /**
   * Create a new location
   */
  async create(data: CreateLocationDTO, userId?: string): Promise<Location> {
    const { data: result, error } = await db
      .from('locations')
      .insert({
        location_code: data.locationCode,
        name: data.name,
        location_type: data.locationType || 'warehouse',
        address_1: data.address1 || null,
        address_2: data.address2 || null,
        city: data.city || null,
        state: data.state || null,
        zip: data.zip || null,
        country: data.country || 'US',
        contact_name: data.contactName || null,
        contact_phone: data.contactPhone || null,
        contact_email: data.contactEmail || null, // Empty string converts to null
        is_active: data.isActive ?? true,
        is_default: data.isDefault ?? false,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create location: ${error.message}`);
    }

    return this.mapToLocation(result as DbLocation);
  }

  /**
   * Update an existing location
   */
  async update(id: string, data: UpdateLocationDTO, userId?: string): Promise<Location> {
    const updateData: Record<string, unknown> = {
      updated_by: userId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (data.locationCode !== undefined) {updateData.location_code = data.locationCode;}
    if (data.name !== undefined) {updateData.name = data.name;}
    if (data.locationType !== undefined) {updateData.location_type = data.locationType;}
    if (data.address1 !== undefined) {updateData.address_1 = data.address1 || null;}
    if (data.address2 !== undefined) {updateData.address_2 = data.address2 || null;}
    if (data.city !== undefined) {updateData.city = data.city || null;}
    if (data.state !== undefined) {updateData.state = data.state || null;}
    if (data.zip !== undefined) {updateData.zip = data.zip || null;}
    if (data.country !== undefined) {updateData.country = data.country || null;}
    if (data.contactName !== undefined) {updateData.contact_name = data.contactName || null;}
    if (data.contactPhone !== undefined) {updateData.contact_phone = data.contactPhone || null;}
    if (data.contactEmail !== undefined) {updateData.contact_email = data.contactEmail || null;}
    if (data.isActive !== undefined) {updateData.is_active = data.isActive;}
    if (data.isDefault !== undefined) {updateData.is_default = data.isDefault;}

    const { data: result, error } = await db
      .from('locations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update location: ${error.message}`);
    }

    return this.mapToLocation(result as DbLocation);
  }

  /**
   * Soft delete a location
   */
  async softDelete(id: string, userId?: string): Promise<Location> {
    const { data, error } = await db
      .from('locations')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete location: ${error.message}`);
    }

    return this.mapToLocation(data as DbLocation);
  }

  /**
   * Restore a soft-deleted location
   */
  async restore(id: string, userId?: string): Promise<Location> {
    const { data, error } = await db
      .from('locations')
      .update({
        deleted_at: null,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to restore location: ${error.message}`);
    }

    return this.mapToLocation(data as DbLocation);
  }

  /**
   * Get location counts by type
   */
  async getCountsByType(): Promise<Record<LocationType, number>> {
    const { data, error } = await db
      .from('locations')
      .select('location_type')
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get location counts: ${error.message}`);
    }

    const counts: Record<LocationType, number> = {
      warehouse: 0,
      drop_ship: 0,
      virtual: 0,
    };

    (data || []).forEach((r) => {
      const locType = r.location_type as LocationType;
      counts[locType] = (counts[locType] || 0) + 1;
    });

    return counts;
  }

  /**
   * Generate next location code in format LOC-0001, LOC-0002, etc.
   */
  async getNextLocationCode(): Promise<string> {
    // Get the highest existing location code with LOC- prefix
    const { data, error } = await db
      .from('locations')
      .select('location_code')
      .like('location_code', 'LOC-%')
      .order('location_code', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to get next location code: ${error.message}`);
    }

    let nextNumber = 1;

    if (data && data.length > 0 && data[0]) {
      const lastCode = data[0].location_code;
      // Extract number from LOC-XXXX format
      const match = lastCode.match(/^LOC-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    // Format with leading zeros (4 digits)
    return `LOC-${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Get all active locations (for dropdowns)
   */
  async getActiveLocations(): Promise<Location[]> {
    const { data, error } = await db
      .from('locations')
      .select('*')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active locations: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToLocation(row as DbLocation));
  }

  /**
   * Map database row to Location type
   */
  private mapToLocation(data: DbLocation): Location {
    return {
      id: data.id,
      locationCode: data.location_code,
      name: data.name,
      locationType: data.location_type,
      address1: data.address_1,
      address2: data.address_2,
      city: data.city,
      state: data.state,
      zip: data.zip,
      country: data.country,
      contactName: data.contact_name,
      contactPhone: data.contact_phone,
      contactEmail: data.contact_email,
      isActive: data.is_active,
      isDefault: data.is_default,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }
}

export const locationRepository = new LocationRepositoryImpl();
export type LocationRepository = typeof locationRepository;
