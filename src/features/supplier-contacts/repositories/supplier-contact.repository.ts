/**
 * Supplier Contact Repository
 *
 * Database operations for supplier contacts.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  SupplierContact,
  SupplierContactListItem,
  CreateSupplierContactDTO,
  UpdateSupplierContactDTO,
} from '../types';

// ============================================
// DATABASE TYPES
// ============================================

interface DbSupplierContact {
  id: string;
  supplier_id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  contact_type: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

// ============================================
// REPOSITORY CLASS
// ============================================

export class SupplierContactRepository {
  // ----------------------------------------
  // READ OPERATIONS
  // ----------------------------------------

  /**
   * Get all contacts for a supplier
   */
  async getBySupplierId(supplierId: string): Promise<SupplierContactListItem[]> {
    const { data, error } = await db
      .from('supplier_contacts')
      .select(
        'id, supplier_id, first_name, last_name, title, contact_type, email, phone, mobile, is_primary'
      )
      .eq('supplier_id', supplierId)
      .is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching supplier contacts:', error);
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    return (data || []).map(this.mapToListItem);
  }

  /**
   * Get a single contact by ID
   */
  async getById(id: string): Promise<SupplierContact | null> {
    const { data, error } = await db
      .from('supplier_contacts')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching supplier contact:', error);
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  /**
   * Get primary contact for a supplier
   */
  async getPrimaryContact(supplierId: string): Promise<SupplierContact | null> {
    const { data, error } = await db
      .from('supplier_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .eq('is_primary', true)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching primary contact:', error);
      throw new Error(`Failed to fetch primary contact: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  // ----------------------------------------
  // CREATE OPERATION
  // ----------------------------------------

  /**
   * Create a new supplier contact
   */
  async create(dto: CreateSupplierContactDTO, userId?: string): Promise<SupplierContact> {
    const { data, error } = await db
      .from('supplier_contacts')
      .insert({
        supplier_id: dto.supplierId,
        first_name: dto.firstName,
        last_name: dto.lastName,
        title: dto.title || null,
        contact_type: dto.contactType,
        email: dto.email || null,
        phone: dto.phone || null,
        mobile: dto.mobile || null,
        fax: dto.fax || null,
        is_primary: dto.isPrimary || false,
        notes: dto.notes || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier contact:', error);
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  // ----------------------------------------
  // UPDATE OPERATION
  // ----------------------------------------

  /**
   * Update a supplier contact
   */
  async update(
    id: string,
    dto: UpdateSupplierContactDTO,
    userId?: string
  ): Promise<SupplierContact> {
    const updateData: Partial<DbSupplierContact> = {
      updated_by: userId || null,
    };

    if (dto.firstName !== undefined) updateData.first_name = dto.firstName;
    if (dto.lastName !== undefined) updateData.last_name = dto.lastName;
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.contactType !== undefined) updateData.contact_type = dto.contactType;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.mobile !== undefined) updateData.mobile = dto.mobile;
    if (dto.fax !== undefined) updateData.fax = dto.fax;
    if (dto.isPrimary !== undefined) updateData.is_primary = dto.isPrimary;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    const { data, error } = await db
      .from('supplier_contacts')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier contact:', error);
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return this.mapToEntity(data);
  }

  // ----------------------------------------
  // DELETE OPERATION
  // ----------------------------------------

  /**
   * Soft delete a supplier contact
   */
  async delete(id: string, userId?: string): Promise<void> {
    const { error } = await db
      .from('supplier_contacts')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      console.error('Error deleting supplier contact:', error);
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
  }

  // ----------------------------------------
  // MAPPERS
  // ----------------------------------------

  private mapToEntity(row: DbSupplierContact): SupplierContact {
    return {
      id: row.id,
      supplierId: row.supplier_id,
      firstName: row.first_name,
      lastName: row.last_name,
      title: row.title,
      contactType: row.contact_type as any,
      email: row.email,
      phone: row.phone,
      mobile: row.mobile,
      fax: row.fax,
      isPrimary: row.is_primary,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      deletedAt: row.deleted_at,
    };
  }

  private mapToListItem(row: any): SupplierContactListItem {
    return {
      id: row.id,
      supplierId: row.supplier_id,
      firstName: row.first_name,
      lastName: row.last_name,
      fullName: `${row.first_name} ${row.last_name}`,
      title: row.title,
      contactType: row.contact_type,
      email: row.email,
      phone: row.phone,
      mobile: row.mobile,
      isPrimary: row.is_primary,
    };
  }
}

// Export singleton instance
export const supplierContactRepository = new SupplierContactRepository();
