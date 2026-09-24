/**
 * Customer Contact Server Actions
 *
 * Server actions for customer contact operations.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { getCustomerContactRepository } from '../repositories/customer-contact.repository';
import type {
  CustomerContact,
  CustomerContactListItem,
  CreateCustomerContactDTO,
  UpdateCustomerContactDTO,
} from '../types';
import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// READ ACTIONS
// ============================================

/**
 * Get all contacts for a customer
 */
export async function getCustomerContacts(
  customerId: string
): Promise<ActionResult<CustomerContactListItem[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const repository = getCustomerContactRepository();
    const contacts = await repository.getByCustomerId(customerId);

    return { success: true, data: contacts };
  } catch (error) {
    console.error('Error fetching customer contacts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contacts',
    };
  }
}

/**
 * Get a single contact by ID
 */
export async function getCustomerContact(
  id: string
): Promise<ActionResult<CustomerContact>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const repository = getCustomerContactRepository();
    const contact = await repository.getById(id);

    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }

    return { success: true, data: contact };
  } catch (error) {
    console.error('Error fetching contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contact',
    };
  }
}

// ============================================
// WRITE ACTIONS
// ============================================

/**
 * Create a new customer contact
 */
export async function createCustomerContact(
  data: CreateCustomerContactDTO
): Promise<ActionResult<CustomerContact>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get app user ID (public.users.id) from auth user ID
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User profile not found' };
    }

    // Validate required fields
    if (!data.firstName?.trim()) {
      return { success: false, error: 'First name is required' };
    }
    if (!data.lastName?.trim()) {
      return { success: false, error: 'Last name is required' };
    }
    if (!data.customerId) {
      return { success: false, error: 'Customer ID is required' };
    }

    const repository = getCustomerContactRepository();
    const contact = await repository.create(data, appUser.id);

    revalidatePath('/customers');
    revalidatePath(`/customers/${data.customerId}`);

    return { success: true, data: contact };
  } catch (error) {
    console.error('Error creating contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create contact',
    };
  }
}

/**
 * Update a customer contact
 */
export async function updateCustomerContact(
  id: string,
  data: UpdateCustomerContactDTO
): Promise<ActionResult<CustomerContact>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get app user ID (public.users.id) from auth user ID
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User profile not found' };
    }

    const repository = getCustomerContactRepository();

    // Check if contact exists
    const existing = await repository.getById(id);
    if (!existing) {
      return { success: false, error: 'Contact not found' };
    }

    const contact = await repository.update(id, data, appUser.id);

    revalidatePath('/customers');
    revalidatePath(`/customers/${contact.customerId}`);

    return { success: true, data: contact };
  } catch (error) {
    console.error('Error updating contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update contact',
    };
  }
}

/**
 * Delete a customer contact
 */
export async function deleteCustomerContact(
  id: string
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get app user ID (public.users.id) from auth user ID
    const appUser = await getAppUserByAuthId(user.id);
    if (!appUser) {
      return { success: false, error: 'User profile not found' };
    }

    const repository = getCustomerContactRepository();

    // Check if contact exists
    const existing = await repository.getById(id);
    if (!existing) {
      return { success: false, error: 'Contact not found' };
    }

    await repository.delete(id, appUser.id);

    revalidatePath('/customers');
    revalidatePath(`/customers/${existing.customerId}`);

    return { success: true };
  } catch (error) {
    console.error('Error deleting contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete contact',
    };
  }
}
