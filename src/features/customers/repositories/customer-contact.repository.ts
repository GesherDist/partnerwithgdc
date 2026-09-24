/**
 * Customer Contact Repository
 *
 * Database operations for customer contacts.
 * Per client doc: contacts have role (purchasing, AP, receiving)
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  CustomerContact,
  CustomerContactListItem,
  CreateCustomerContactDTO,
  UpdateCustomerContactDTO,
} from '../types';

// ============================================
// DATABASE TYPES
// ============================================

interface DbCustomerContact {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  contact_type: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

// ============================================
// REPOSITORY CLASS
// ============================================

export class CustomerContactRepository {

  // ----------------------------------------
  // READ OPERATIONS
  // ----------------------------------------

  /**
   * Get all contacts for a customer
   */
  async getByCustomerId(customerId: string): Promise<CustomerContactListItem[]> {
    const { data, error } = await db
      .from('customer_contacts')
      .select('id, customer_id, first_name, last_name, contact_type, email, phone, mobile')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('first_name', { ascending: true });

    if (error) {
      console.error('Error fetching customer contacts:', error);
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    return (data || []).map(this.mapToListItem);
  }

  /**
   * Get primary contact for a customer
   */
  async getPrimaryContact(customerId: string): Promise<CustomerContact | null> {
    const { data, error } = await db
      .from('customer_contacts')
      .select('id, customer_id, first_name, last_name, contact_type, email, phone, mobile, created_at, updated_at, created_by, updated_by, deleted_at')
      .eq('customer_id', customerId)
      .eq('contact_type', 'primary')
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

    return this.mapToContact(data);
  }

  /**
   * Get a single contact by ID
   */
  async getById(id: string): Promise<CustomerContact | null> {
    const { data, error } = await db
      .from('customer_contacts')
      .select('id, customer_id, first_name, last_name, contact_type, email, phone, mobile, created_at, updated_at, created_by, updated_by, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching contact:', error);
      throw new Error(`Failed to fetch contact: ${error.message}`);
    }

    return this.mapToContact(data);
  }

  // ----------------------------------------
  // WRITE OPERATIONS
  // ----------------------------------------

  /**
   * Create a new customer contact
   */
  async create(
    data: CreateCustomerContactDTO,
    userId?: string
  ): Promise<CustomerContact> {
    const { data: result, error } = await db
      .from('customer_contacts')
      .insert({
        customer_id: data.customerId,
        first_name: data.firstName,
        last_name: data.lastName,
        contact_type: data.contactType,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        created_by: userId || null,
        updated_by: userId || null,
      })
      .select('id, customer_id, first_name, last_name, contact_type, email, phone, mobile, created_at, updated_at, created_by, updated_by, deleted_at')
      .single();

    if (error) {
      console.error('Error creating contact:', error);
      throw new Error(`Failed to create contact: ${error.message}`);
    }

    return this.mapToContact(result);
  }

  /**
   * Update a customer contact
   */
  async update(
    id: string,
    data: UpdateCustomerContactDTO,
    userId?: string
  ): Promise<CustomerContact> {
    const updateData: Record<string, unknown> = {
      updated_by: userId || null,
    };

    if (data.firstName !== undefined) {updateData.first_name = data.firstName;}
    if (data.lastName !== undefined) {updateData.last_name = data.lastName;}
    if (data.contactType !== undefined) {updateData.contact_type = data.contactType;}
    if (data.email !== undefined) {updateData.email = data.email;}
    if (data.phone !== undefined) {updateData.phone = data.phone;}
    if (data.mobile !== undefined) {updateData.mobile = data.mobile;}

    const { data: result, error } = await db
      .from('customer_contacts')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select('id, customer_id, first_name, last_name, contact_type, email, phone, mobile, created_at, updated_at, created_by, updated_by, deleted_at')
      .single();

    if (error) {
      console.error('Error updating contact:', error);
      throw new Error(`Failed to update contact: ${error.message}`);
    }

    return this.mapToContact(result);
  }

  /**
   * Soft delete a customer contact
   */
  async delete(id: string, userId?: string): Promise<void> {
    const { error } = await db
      .from('customer_contacts')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting contact:', error);
      throw new Error(`Failed to delete contact: ${error.message}`);
    }
  }

  // ----------------------------------------
  // MAPPING FUNCTIONS
  // ----------------------------------------

  private mapToContact(data: DbCustomerContact): CustomerContact {
    return {
      id: data.id,
      customerId: data.customer_id,
      firstName: data.first_name,
      lastName: data.last_name,
      contactType: data.contact_type as CustomerContact['contactType'],
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  }

  private mapToListItem(data: Partial<DbCustomerContact>): CustomerContactListItem {
    return {
      id: data.id!,
      customerId: data.customer_id!,
      firstName: data.first_name!,
      lastName: data.last_name!,
      fullName: `${data.first_name} ${data.last_name}`,
      contactType: data.contact_type as CustomerContactListItem['contactType'],
      email: data.email ?? null,
      phone: data.phone ?? null,
      mobile: data.mobile ?? null,
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let repositoryInstance: CustomerContactRepository | null = null;

export function getCustomerContactRepository(): CustomerContactRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CustomerContactRepository();
  }
  return repositoryInstance;
}

// Export singleton instance
export const customerContactRepository = new CustomerContactRepository();
