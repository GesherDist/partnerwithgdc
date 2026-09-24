/**
 * Auth Server Actions
 *
 * Server actions for authentication-related operations.
 * These can modify cookies because they run in a Server Action context.
 */

'use server';

import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from './get-app-user';
import { setCachedProfile, clearCachedProfile } from './profile-cache';

/**
 * Refresh the user's profile cache
 *
 * This fetches fresh user data from the database and updates the cookie cache.
 * Call this after updating permissions or role assignments.
 *
 * @returns The refreshed AppUser or null if not authenticated
 */
export async function refreshProfileCache() {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return { success: false, error: 'Not authenticated' };
    }

    // Clear old cache
    await clearCachedProfile();

    // Fetch fresh data from database
    const appUser = await getAppUserByAuthId(authUser.id);

    if (!appUser) {
      return { success: false, error: 'User profile not found' };
    }

    // Update cache with fresh data
    await setCachedProfile(appUser);

    return { success: true, user: appUser };
  } catch (error) {
    console.error('[refreshProfileCache] Error:', error);
    return { success: false, error: 'Failed to refresh profile' };
  }
}
