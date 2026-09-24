'use server';

/**
 * Refresh Profile Server Action
 *
 * Refreshes the cached user profile from the database.
 * Call this after user profile or role changes.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { setCachedProfile, clearCachedProfile } from '@/shared/lib/auth/profile-cache';
import type { AppUser } from '@/shared/stores/auth.store';

// ============================================
// ACTION
// ============================================

export async function refreshProfileAction(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    await clearCachedProfile();
    return null;
  }

  const appUser = await getAppUserByAuthId(user.id);

  if (appUser) {
    await setCachedProfile(appUser);
  } else {
    await clearCachedProfile();
  }

  return appUser;
}
