/**
 * Auth Store
 *
 * Global state management for authentication.
 * Manages user session, permissions, and auth state.
 *
 * IMPORTANT: This store is for client-side state only.
 * Server-side auth should use Supabase server client.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { User, Session } from '@/shared/lib/supabase/types';

// ============================================
// TYPES
// ============================================

/**
 * Application user with role and permissions
 */
export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: {
    id: string;
    name: string;
    isSystemRole: boolean;
  } | null;
  permissions: string[];
  supplierId: string | null; // For supplier portal users
}

/**
 * Auth store state
 */
interface AuthState {
  // Supabase auth
  user: User | null;
  session: Session | null;

  // Application user (from our database)
  appUser: AppUser | null;

  // State flags
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;

  // Error
  error: string | null;
}

/**
 * Auth store actions
 */
interface AuthActions {
  // Setters
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setAppUser: (appUser: AppUser | null) => void;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setError: (error: string | null) => void;

  // Auth actions
  login: (user: User, session: Session, appUser: AppUser) => void;
  logout: () => void;
  updateAppUser: (updates: Partial<AppUser>) => void;

  // Permission checks
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  isSuperAdmin: () => boolean;

  // Reset
  reset: () => void;
}

type AuthStore = AuthState & AuthActions;

// ============================================
// INITIAL STATE
// ============================================

const initialState: AuthState = {
  user: null,
  session: null,
  appUser: null,
  isLoading: true,
  isInitialized: false,
  isAuthenticated: false,
  error: null,
};

// ============================================
// STORE
// ============================================

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      ...initialState,

      // Setters
      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      setSession: (session) =>
        set({ session }),

      setAppUser: (appUser) =>
        set({ appUser }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setInitialized: (isInitialized) =>
        set({ isInitialized }),

      setError: (error) =>
        set({ error }),

      // Auth actions
      login: (user, session, appUser) =>
        set({
          user,
          session,
          appUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        }),

      logout: () =>
        set({
          ...initialState,
          isLoading: false,
          isInitialized: true,
        }),

      updateAppUser: (updates) =>
        set((state) => ({
          appUser: state.appUser
            ? { ...state.appUser, ...updates }
            : null,
        })),

      // Permission checks
      hasPermission: (permission) => {
        const { appUser } = get();
        if (!appUser) {
          return false;
        }
        // Super Admin bypass - ONLY by role name pattern (not isSystemRole alone)
        // This ensures only actual super admin role bypasses permissions
        const roleName = appUser.role?.name?.toLowerCase().replace(/[_\s]/g, '');
        if (roleName === 'superadmin') {
          return true;
        }
        return appUser.permissions.includes(permission);
      },

      hasAnyPermission: (permissions) => {
        const { appUser } = get();
        if (!appUser) {
          return false;
        }
        // Super Admin bypass - ONLY by role name
        const roleName = appUser.role?.name?.toLowerCase().replace(/[_\s]/g, '');
        if (roleName === 'superadmin') {
          return true;
        }
        return permissions.some((p) => appUser.permissions.includes(p));
      },

      hasAllPermissions: (permissions) => {
        const { appUser } = get();
        if (!appUser) {
          return false;
        }
        // Super Admin bypass - ONLY by role name
        const roleName = appUser.role?.name?.toLowerCase().replace(/[_\s]/g, '');
        if (roleName === 'superadmin') {
          return true;
        }
        return permissions.every((p) => appUser.permissions.includes(p));
      },

      isSuperAdmin: () => {
        const { appUser } = get();
        const roleName = appUser?.role?.name?.toLowerCase().replace(/[_\s]/g, '');
        return roleName === 'superadmin';
      },

      // Reset
      reset: () => set(initialState),
    }),
    {
      name: 'auth-storage',
      version: 3, // Increment when schema changes - clears old cached data
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // Only persist essential data
        appUser: state.appUser,
        isAuthenticated: state.isAuthenticated,
      }),
      migrate: (persistedState, version) => {
        // If version is old, return fresh state (clears old data)
        if (version < 3) {
          return { appUser: null, isAuthenticated: false };
        }
        return persistedState as { appUser: AppUser | null; isAuthenticated: boolean };
      },
    }
  )
);

// ============================================
// SELECTORS
// ============================================

/**
 * Select user's full name
 */
export const selectFullName = (state: AuthStore): string => {
  if (!state.appUser) {
    return '';
  }
  return `${state.appUser.firstName} ${state.appUser.lastName}`.trim();
};

/**
 * Select user's initials
 */
export const selectInitials = (state: AuthStore): string => {
  if (!state.appUser) {
    return '';
  }
  const first = state.appUser.firstName.charAt(0).toUpperCase();
  const last = state.appUser.lastName.charAt(0).toUpperCase();
  return `${first}${last}`;
};

/**
 * Select user's role name
 */
export const selectRoleName = (state: AuthStore): string => {
  return state.appUser?.role?.name ?? '';
};

/**
 * Select if user is admin (Super Admin or system role)
 */
export const selectIsAdmin = (state: AuthStore): boolean => {
  const roleName = state.appUser?.role?.name?.toLowerCase().replace(/[_\s]/g, '');
  return state.appUser?.role?.isSystemRole === true || roleName === 'superadmin';
};

/**
 * Select if user is super admin
 */
export const selectIsSuperAdmin = (state: AuthStore): boolean => {
  const roleName = state.appUser?.role?.name?.toLowerCase().replace(/[_\s]/g, '');
  return state.appUser?.role?.isSystemRole === true || roleName === 'superadmin';
};

/**
 * Select if user is a supplier portal user
 */
export const selectIsSupplier = (state: AuthStore): boolean => {
  return state.appUser?.supplierId !== null && state.appUser?.supplierId !== undefined;
};

/**
 * Select user's supplier ID
 */
export const selectSupplierId = (state: AuthStore): string | null => {
  return state.appUser?.supplierId ?? null;
};
