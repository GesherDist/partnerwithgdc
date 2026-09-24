/**
 * User Profile Cache
 *
 * Caches user profile data in HTTP cookies to avoid database
 * queries on every page navigation.
 *
 * The profile is cached after login and refreshed when:
 * - User logs out
 * - User's role changes
 * - Admin updates user profile
 */

import { cookies } from 'next/headers';
import type { AppUser } from '@/shared/stores/auth.store';

const PROFILE_COOKIE_NAME = 'app_user_profile';
const PROFILE_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Get cached user profile from cookie
 */
export async function getCachedProfile(): Promise<AppUser | null> {
  try {
    const cookieStore = await cookies();
    const profileCookie = cookieStore.get(PROFILE_COOKIE_NAME);

    if (!profileCookie?.value) {
      return null;
    }

    const profile = JSON.parse(profileCookie.value) as AppUser;
    return profile;
  } catch {
    return null;
  }
}

/**
 * Cache user profile in cookie
 */
export async function setCachedProfile(profile: AppUser): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(PROFILE_COOKIE_NAME, JSON.stringify(profile), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: PROFILE_COOKIE_MAX_AGE,
      path: '/',
    });
  } catch (error) {
    console.error('[setCachedProfile] Failed to cache profile:', error);
  }
}

/**
 * Clear cached user profile
 * NOTE: Can only be called from Route Handlers or Server Actions
 */
export async function clearCachedProfile(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(PROFILE_COOKIE_NAME);
  } catch (error) {
    // Silently fail - this may be called from a context where cookies cannot be modified
    console.error('[clearCachedProfile] Failed to clear profile:', error);
  }
}
