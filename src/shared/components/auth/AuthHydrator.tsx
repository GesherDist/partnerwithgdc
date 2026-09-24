'use client';

/**
 * AuthHydrator Component
 *
 * Hydrates the client-side auth store with server-side user data.
 * This component should be rendered in authenticated layouts.
 */

import { useEffect, useRef } from 'react';
import { useAuthStore, type AppUser } from '@/shared/stores';

interface AuthHydratorProps {
  appUser: AppUser | null;
  children: React.ReactNode;
}

export function AuthHydrator({ appUser, children }: AuthHydratorProps) {
  const { setAppUser, setInitialized, setLoading } = useAuthStore();
  const hasHydrated = useRef(false);

  useEffect(() => {
    // Always update appUser from server (ensures fresh data)
    if (appUser) {
      setAppUser(appUser);
    }

    // Only set initialized once
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      setLoading(false);
      setInitialized(true);
    }
  }, [appUser, setAppUser, setInitialized, setLoading]);

  return <>{children}</>;
}
