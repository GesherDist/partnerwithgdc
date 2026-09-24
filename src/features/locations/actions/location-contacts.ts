/**
 * Location Contacts Server Actions
 *
 * Server actions for managing location contacts (warehouse workers who receive pick ticket emails).
 * These are NOT system users - they don't login, just receive email notifications.
 */

'use server';

import { revalidatePath } from 'next/cache';
import {
  locationContactsRepository,
  type LocationContact,
  type CreateLocationContactDTO,
  type UpdateLocationContactDTO,
} from '../repositories/location-contacts.repository';
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
 * Get all contacts for a specific location
 */
export async function getLocationContacts(locationId: string): Promise<ActionResult<LocationContact[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const contacts = await locationContactsRepository.findByLocationId(locationId);
    return { success: true, data: contacts };
  } catch (error) {
    console.error('Failed to get location contacts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contacts',
    };
  }
}

/**
 * Get a single contact by ID
 */
export async function getLocationContact(id: string): Promise<ActionResult<LocationContact>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const contact = await locationContactsRepository.findById(id);
    if (!contact) {
      return { success: false, error: 'Contact not found' };
    }
    return { success: true, data: contact };
  } catch (error) {
    console.error('Failed to get contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contact',
    };
  }
}

/**
 * Get active contacts for a location (for sending emails)
 */
export async function getActiveLocationContacts(locationId: string): Promise<ActionResult<LocationContact[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    const contacts = await locationContactsRepository.findActiveByLocationId(locationId);
    return { success: true, data: contacts };
  } catch (error) {
    console.error('Failed to get active contacts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch contacts',
    };
  }
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Create a new contact for a location
 */
export async function createLocationContact(
  data: CreateLocationContactDTO
): Promise<ActionResult<LocationContact>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    // Check if email already exists for this location
    const emailExists = await locationContactsRepository.emailExistsForLocation(
      data.locationId,
      data.email
    );
    if (emailExists) {
      return { success: false, error: 'A contact with this email already exists for this location' };
    }

    const contact = await locationContactsRepository.create(data, appUser.id);

    revalidatePath('/locations');

    return { success: true, data: contact };
  } catch (error) {
    console.error('Failed to create contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create contact',
    };
  }
}

/**
 * Update an existing contact
 */
export async function updateLocationContact(
  id: string,
  data: UpdateLocationContactDTO
): Promise<ActionResult<LocationContact>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  try {
    // If email is being changed, check for duplicates
    if (data.email) {
      const existingContact = await locationContactsRepository.findById(id);
      if (existingContact) {
        const emailExists = await locationContactsRepository.emailExistsForLocation(
          existingContact.locationId,
          data.email,
          id
        );
        if (emailExists) {
          return { success: false, error: 'A contact with this email already exists for this location' };
        }
      }
    }

    const contact = await locationContactsRepository.update(id, data, appUser.id);

    revalidatePath('/locations');

    return { success: true, data: contact };
  } catch (error) {
    console.error('Failed to update contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update contact',
    };
  }
}

/**
 * Delete a contact
 */
export async function deleteLocationContact(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  try {
    await locationContactsRepository.delete(id);

    revalidatePath('/locations');

    return { success: true };
  } catch (error) {
    console.error('Failed to delete contact:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete contact',
    };
  }
}
