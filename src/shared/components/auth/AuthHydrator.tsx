'use client';

/**
 * AuthHydrator Component
 *
 * Hydrates the client-side auth store with server-side user data.
 * This component should be rendered in authenticated layouts.
 *
 * IMPORTANT: Always updates appUser from server on EVERY render to ensure
 * permissions are always fresh, even if changed in database without re-login.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore, type AppUser } from '@/shared/stores';

interface AuthHydratorProps {
  appUser: AppUser | null;
  children: React.ReactNode;
}

export function AuthHydrator({ appUser, children }: AuthHydratorProps) {
  const { setAppUser, setInitialized, setLoading, appUser: currentAppUser } = useAuthStore();
  const hasHydrated = useRef(false);

  useEffect(() => {
    // CRITICAL: Always update appUser from server (ensures fresh data)
    // Even if user is already logged in, we force-update from database
    if (appUser) {
      const serverPermissions = appUser.permissions.length;
      const cachedPermissions = currentAppUser?.permissions?.length || 0;

      console.log('[AuthHydrator] Updating appUser from server:', {
        email: appUser.email,
        role: appUser.role?.name,
        serverPermissions,
        cachedPermissions,
        mismatch: serverPermissions !== cachedPermissions,
      });

      // Detect permission mismatch - clear session storage and force update
      if (cachedPermissions > 0 && serverPermissions !== cachedPermissions) {
        console.warn('[AuthHydrator] 🔄 Permission count mismatch detected! Clearing cache and forcing update.');
        console.warn(`   Server has ${serverPermissions} permissions, cache has ${cachedPermissions}`);

        // Clear the persisted state to force fresh data
        try {
          sessionStorage.removeItem('auth-storage');
          console.log('[AuthHydrator] ✅ Cleared stale auth cache');
        } catch (e) {
          console.error('[AuthHydrator] Failed to clear session storage:', e);
        }
      }

      // Force update even if data looks the same
      // This ensures database changes are always reflected
      setAppUser(appUser);
    } else {
      console.log('[AuthHydrator] No appUser from server - user might not have profile');
    }

    // Only set initialized once
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      setLoading(false);
      setInitialized(true);
      console.log('[AuthHydrator] Initial hydration complete');
    }
  }, [appUser, setAppUser, setInitialized, setLoading, currentAppUser]);

  return <>{children}</>;
}
