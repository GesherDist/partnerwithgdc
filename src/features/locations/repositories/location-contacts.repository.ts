/**
 * Location Contacts Repository
 *
 * Data access layer for location contacts (warehouse workers who receive pick ticket emails).
 * These are NOT system users - they don't login, just receive email notifications.
 */

import { db } from '@/shared/lib/supabase/database';

// ============================================
// TYPES
// ============================================

export interface LocationContact {
  id: string;
  locationId: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface CreateLocationContactDTO {
  locationId: string;
  name: string;
  email: string;
  phone?: string | null;
  isActive?: boolean;
}

export interface UpdateLocationContactDTO {
  name?: string;
  email?: string;
  phone?: string | null;
  isActive?: boolean;
}

interface DbLocationContact {
  id: string;
  location_id: string;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ============================================
// REPOSITORY
// ============================================

export const locationContactsRepository = {
  /**
   * Find all contacts for a specific location
   */
  async findByLocationId(locationId: string): Promise<LocationContact[]> {
    const { data, error } = await db
      .from('location_contacts')
      .select('*')
      .eq('location_id', locationId)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch location contacts: ${error.message}`);
    }

    return (data || []).map(this.mapToContact);
  },

  /**
   * Find active contacts for a location (for sending emails)
   */
  async findActiveByLocationId(locationId: string): Promise<LocationContact[]> {
    const { data, error } = await db
      .from('location_contacts')
      .select('*')
      .eq('location_id', locationId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active location contacts: ${error.message}`);
    }

    return (data || []).map(this.mapToContact);
  },

  /**
   * Find a single contact by ID
   */
  async findById(id: string): Promise<LocationContact | null> {
    const { data, error } = await db
      .from('location_contacts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }

    return data ? this.mapToContact(data as DbLocationContact) : null;
  },

  /**
   * Create a new contact
   */
  async create(data: CreateLocationContactDTO, userId?: string): Promise<LocationContact> {
    const { data: result, error } = await db
      .from('location_contacts')
      .insert({
        location_id: data.locationId,
        name: data.name,
        email: data.email.toLowerCase(),
        phone: data.phone ?? null,
        is_active: data.isActive ?? true,
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return this.mapToContact(result as DbLocationContact);
  },

  /**
   * Update an existing contact
   */
  async update(id: string, data: UpdateLocationContactDTO, userId?: string): Promise<LocationContact> {
    const updateData: Record<string, unknown> = {
      updated_by: userId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.email !== undefined) {
      updateData.email = data.email.toLowerCase();
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }

    const { data: result, error } = await db
      .from('location_contacts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return this.mapToContact(result as DbLocationContact);
  },

  /**
   * Delete a contact
   */
  async delete(id: string): Promise<void> {
    const { error } = await db
      .from('location_contacts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
  },

  /**
   * Check if email exists for a location (to prevent duplicates)
   */
  async emailExistsForLocation(locationId: string, email: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('location_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('email', email.toLowerCase());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check email: ${error.message}`);
    }

    return (count ?? 0) > 0;
  },

  /**
   * Map database row to LocationContact type
   */
  mapToContact(data: DbLocationContact): LocationContact {
    return {
      id: data.id,
      locationId: data.location_id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
    };
  },
};

export type LocationContactsRepository = typeof locationContactsRepository;
