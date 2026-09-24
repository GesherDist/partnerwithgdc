'use client';

/**
 * Permission Hooks
 *
 * React hooks for checking user permissions in components.
 */

import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/shared/stores';

// ============================================
// TYPES
// ============================================

export interface PermissionCheck {
  /** Whether the user has the permission(s) */
  hasAccess: boolean;
  /** Whether the auth state is still loading */
  isLoading: boolean;
  /** The current user's role */
  role: string | null;
  /** All permissions the user has */
  permissions: string[];
}

// ============================================
// HOOKS
// ============================================

/**
 * Check if user has a specific permission
 */
export function usePermission(permission: string): PermissionCheck {
  const { user, appUser, isLoading, hasPermission } = useAuthStore();

  const role = appUser?.role?.name ?? null;
  const permissions = appUser?.permissions ?? [];

  const hasAccess = useMemo(() => {
    if (!user) {
      return false;
    }
    return hasPermission(permission);
  }, [user, permission, hasPermission]);

  return {
    hasAccess,
    isLoading,
    role,
    permissions,
  };
}

/**
 * Check if user has ALL of the specified permissions
 */
export function usePermissions(requiredPermissions: string[]): PermissionCheck {
  const { user, appUser, isLoading, hasPermission } = useAuthStore();

  const role = appUser?.role?.name ?? null;
  const permissions = appUser?.permissions ?? [];

  const hasAccess = useMemo(() => {
    if (!user) {
      return false;
    }
    return requiredPermissions.every((p) => hasPermission(p));
  }, [user, requiredPermissions, hasPermission]);

  return {
    hasAccess,
    isLoading,
    role,
    permissions,
  };
}

/**
 * Check if user has ANY of the specified permissions
 */
export function useAnyPermission(requiredPermissions: string[]): PermissionCheck {
  const { user, appUser, isLoading, hasAnyPermission } = useAuthStore();

  const role = appUser?.role?.name ?? null;
  const permissions = appUser?.permissions ?? [];

  const hasAccess = useMemo(() => {
    if (!user) {
      return false;
    }
    return hasAnyPermission(requiredPermissions);
  }, [user, requiredPermissions, hasAnyPermission]);

  return {
    hasAccess,
    isLoading,
    role,
    permissions,
  };
}

/**
 * Check if user has a specific role
 */
export function useRole(requiredRole: string): PermissionCheck {
  const { user, appUser, isLoading } = useAuthStore();

  const role = appUser?.role?.name ?? null;
  const permissions = appUser?.permissions ?? [];

  const hasAccess = useMemo(() => {
    if (!user || !role) {
      return false;
    }
    return role.toLowerCase() === requiredRole.toLowerCase();
  }, [user, role, requiredRole]);

  return {
    hasAccess,
    isLoading,
    role,
    permissions,
  };
}

/**
 * Check if user has any of the specified roles
 */
export function useAnyRole(requiredRoles: string[]): PermissionCheck {
  const { user, appUser, isLoading } = useAuthStore();

  const role = appUser?.role?.name ?? null;
  const permissions = appUser?.permissions ?? [];

  const hasAccess = useMemo(() => {
    if (!user || !role) {
      return false;
    }
    return requiredRoles.some(
      (r) => r.toLowerCase() === role.toLowerCase()
    );
  }, [user, role, requiredRoles]);

  return {
    hasAccess,
    isLoading,
    role,
    permissions,
  };
}

/**
 * Check if user is an admin (Super Admin or Admin role)
 */
export function useIsAdmin(): PermissionCheck {
  return useAnyRole(['Super Admin', 'Admin']);
}

/**
 * Check if user is a super admin
 */
export function useIsSuperAdmin(): PermissionCheck {
  return useRole('Super Admin');
}

/**
 * Get a permission checker function
 */
export function usePermissionChecker() {
  const { hasPermission, hasAnyPermission } = useAuthStore();

  const checkPermission = useCallback(
    (permission: string) => hasPermission(permission),
    [hasPermission]
  );

  const checkAnyPermission = useCallback(
    (permissions: string[]) => hasAnyPermission(permissions),
    [hasAnyPermission]
  );

  const checkAllPermissions = useCallback(
    (permissions: string[]) => permissions.every((p) => hasPermission(p)),
    [hasPermission]
  );

  return {
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
  };
}
