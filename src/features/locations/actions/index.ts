/**
 * Locations Server Actions
 *
 * Server actions for the Locations module.
 * Can be called directly from Server Components or via useFormState.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { locationService } from '../services/location.service';
import { createLocationSchema, updateLocationSchema, locationFormSchema, formToCreateDTO } from '../lib/schemas';
import type { LocationListParams, Location } from '../types';
import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of locations
 */
export async function getLocations(params: LocationListParams = {}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.list(params);
}

/**
 * Get a single location by ID
 */
export async function getLocation(id: string): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.getById(id);
}

/**
 * Get a single location by code
 */
export async function getLocationByCode(locationCode: string): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.getByCode(locationCode);
}

/**
 * Get all active locations (for dropdowns)
 */
export async function getActiveLocations(): Promise<ActionResult<Location[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.getActiveLocations();
}

/**
 * Get all locations with optional type filter (for allocation dialogs)
 */
export async function getAllLocationsAction(params?: { type?: 'warehouse' | 'drop_ship' | 'virtual' }): Promise<ActionResult<Location[]>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get all active locations
  const result = await locationService.getActiveLocations();

  if (result.success && result.data) {
    // Filter by type if specified
    let locations = result.data;
    if (params?.type) {
      locations = locations.filter(loc => loc.locationType === params.type);
    }

    return {
      success: true,
      data: locations,
    };
  }

  return result;
}

/**
 * Get the default location
 */
export async function getDefaultLocation(): Promise<ActionResult<Location | null>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.getDefault();
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Create a new location
 */
export async function createLocation(formData: FormData): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get the internal user ID from public.users table
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Parse form data
  const rawData = {
    locationCode: formData.get('locationCode') as string,
    name: formData.get('name') as string,
    locationType: (formData.get('locationType') as 'warehouse' | 'drop_ship' | 'virtual') || 'warehouse',
    address1: formData.get('address1') as string,
    address2: formData.get('address2') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    zip: formData.get('zip') as string,
    country: (formData.get('country') as string) || 'US',
    contactName: formData.get('contactName') as string,
    contactPhone: formData.get('contactPhone') as string,
    contactEmail: formData.get('contactEmail') as string,
    isActive: formData.get('isActive') === 'true',
    isDefault: formData.get('isDefault') === 'true',
  };

  // Validate form data
  const formValidation = locationFormSchema.safeParse(rawData);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Convert to DTO and validate
  const dto = formToCreateDTO(formValidation.data);
  const validation = createLocationSchema.safeParse(dto);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await locationService.create(validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/locations');
    revalidatePath('/api/locations');
  }

  return result;
}

/**
 * Create location from JSON data (for programmatic use)
 */
export async function createLocationFromData(data: unknown): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get the internal user ID from public.users table
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Validate
  const validation = createLocationSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await locationService.create(validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/locations');
    revalidatePath('/api/locations');
  }

  return result;
}

/**
 * Update an existing location
 */
export async function updateLocation(id: string, formData: FormData): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get the internal user ID from public.users table
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Parse form data (only include fields that were submitted)
  const rawData: Record<string, unknown> = {};

  const fields = ['locationCode', 'name', 'locationType', 'address1', 'address2',
                  'city', 'state', 'zip', 'country', 'contactName', 'contactPhone',
                  'contactEmail', 'isActive', 'isDefault'];

  for (const field of fields) {
    const value = formData.get(field);
    if (value !== null) {
      if (field === 'isActive' || field === 'isDefault') {
        rawData[field] = value === 'true';
      } else {
        rawData[field] = value;
      }
    }
  }

  // Validate
  const validation = updateLocationSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await locationService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/locations');
    revalidatePath(`/locations/${id}`);
    revalidatePath('/api/locations');
  }

  return result;
}

/**
 * Update location from JSON data (for programmatic use)
 */
export async function updateLocationFromData(id: string, data: unknown): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get the internal user ID from public.users table
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Validate
  const validation = updateLocationSchema.safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const result = await locationService.update(id, validation.data, appUser.id);

  if (result.success) {
    revalidatePath('/locations');
    revalidatePath(`/locations/${id}`);
    revalidatePath('/api/locations');
  }

  return result;
}

/**
 * Soft delete a location
 */
export async function deleteLocation(id: string): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get the internal user ID from public.users table
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  const result = await locationService.delete(id, appUser.id);

  if (result.success) {
    revalidatePath('/locations');
    revalidatePath('/api/locations');
  }

  return result;
}

/**
 * Restore a soft-deleted location
 */
export async function restoreLocation(id: string): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get the internal user ID from public.users table
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  const result = await locationService.restore(id, appUser.id);

  if (result.success) {
    revalidatePath('/locations');
    revalidatePath('/api/locations');
  }

  return result;
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get location counts by type
 */
export async function getLocationTypeCounts(): Promise<ActionResult<Record<string, number>>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.getTypeCounts();
}

/**
 * Validate location code uniqueness
 */
export async function validateLocationCode(locationCode: string, excludeId?: string): Promise<ActionResult<boolean>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.validateCode(locationCode, excludeId);
}

/**
 * Get next auto-generated location code
 */
export async function getNextLocationCode(): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  return locationService.getNextCode();
}

/**
 * Create a new location with auto-generated code
 */
export async function createLocationWithAutoCode(data: unknown): Promise<ActionResult<Location>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Authentication required' };
  }

  // Get the internal user ID from public.users table
  const appUser = await getAppUserByAuthId(user.id);
  if (!appUser) {
    return { success: false, error: 'User profile not found' };
  }

  // Validate (without locationCode requirement)
  const validation = createLocationSchema.omit({ locationCode: true }).safeParse(data);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const result = await locationService.createWithAutoCode(validation.data, appUser.id);

    if (result.success) {
      revalidatePath('/locations');
      revalidatePath('/api/locations');
    }

    return result;
  } catch (error) {
    console.error('createLocationWithAutoCode error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create location',
    };
  }
}
