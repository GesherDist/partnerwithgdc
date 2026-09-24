/**
 * Server-Side Permission Check
 *
 * Utilities for checking user permissions in API routes and server actions.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from './get-app-user';
import type { AppUser } from '@/shared/stores/auth.store';

// ============================================
// TYPES
// ============================================

export interface PermissionCheckResult {
  /** Whether the user has the required permission(s) */
  hasAccess: boolean;
  /** The authenticated user (if any) */
  user: AppUser | null;
  /** Error message (if any) */
  error?: string;
}

// ============================================
// SUPER ADMIN CHECK
// ============================================

/**
 * Check if user is Super Admin
 * Checks ONLY by role name pattern (not isSystemRole flag)
 * This ensures only actual super admin role bypasses permissions
 */
export function isSuperAdmin(user: AppUser | null): boolean {
  if (!user?.role) { return false; }
  const roleName = user.role.name?.toLowerCase().replace(/[_\s]/g, '');
  return roleName === 'superadmin';
}

// ============================================
// PERMISSION CHECK FUNCTIONS
// ============================================

/**
 * Check if user has a specific permission
 * Super Admin bypasses all permission checks
 */
export function hasPermission(user: AppUser | null, permission: string): boolean {
  if (!user) {
    return false;
  }

  // Super Admin bypass
  if (isSuperAdmin(user)) {
    return true;
  }

  return user.permissions.includes(permission);
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(user: AppUser | null, permissions: string[]): boolean {
  if (!user) {
    return false;
  }

  // Super Admin bypass
  if (isSuperAdmin(user)) {
    return true;
  }

  return permissions.some((p) => user.permissions.includes(p));
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(user: AppUser | null, permissions: string[]): boolean {
  if (!user) {
    return false;
  }

  // Super Admin bypass
  if (isSuperAdmin(user)) {
    return true;
  }

  return permissions.every((p) => user.permissions.includes(p));
}

// ============================================
// SERVER-SIDE CHECK WITH AUTH
// ============================================

/**
 * Get current authenticated user from Supabase session
 *
 * Always fetches fresh from database for reliable permission checks.
 * Uses React's cache() via getAppUserByAuthId for request-level memoization,
 * so multiple calls within the same request only hit DB once.
 *
 * Note: Cookie caching was removed because it caused stale permission issues
 * where layout.tsx (using getAppUserByAuthId directly) had fresh data but
 * pages (using getCurrentUser with cache) had stale data.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return null;
    }

    // Always fetch fresh from database (same as layout.tsx does)
    // getAppUserByAuthId uses React's cache() for request-level memoization
    const appUser = await getAppUserByAuthId(authUser.id);

    return appUser;
  } catch (error) {
    console.error('[getCurrentUser] Error:', error);
    return null;
  }
}

/**
 * Check permission for current authenticated user
 *
 * Usage in API routes:
 * ```typescript
 * export async function DELETE(req: Request) {
 *   const { hasAccess, user, error } = await checkPermission('users.delete');
 *
 *   if (!hasAccess) {
 *     return Response.json({ error: error || 'Forbidden' }, { status: 403 });
 *   }
 *
 *   // Continue with delete logic...
 * }
 * ```
 */
export async function checkPermission(permission: string): Promise<PermissionCheckResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      hasAccess: false,
      user: null,
      error: 'Authentication required',
    };
  }

  const hasAccess = hasPermission(user, permission);

  return {
    hasAccess,
    user,
    error: hasAccess ? undefined : `Permission denied: ${permission}`,
  };
}

/**
 * Check if user has ANY of the specified permissions
 */
export async function checkAnyPermission(permissions: string[]): Promise<PermissionCheckResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      hasAccess: false,
      user: null,
      error: 'Authentication required',
    };
  }

  const hasAccess = hasAnyPermission(user, permissions);

  return {
    hasAccess,
    user,
    error: hasAccess ? undefined : `Permission denied: requires any of [${permissions.join(', ')}]`,
  };
}

/**
 * Check if user has ALL of the specified permissions
 */
export async function checkAllPermissions(permissions: string[]): Promise<PermissionCheckResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      hasAccess: false,
      user: null,
      error: 'Authentication required',
    };
  }

  const hasAccess = hasAllPermissions(user, permissions);

  return {
    hasAccess,
    user,
    error: hasAccess ? undefined : `Permission denied: requires all of [${permissions.join(', ')}]`,
  };
}

// ============================================
// HELPER FOR API ROUTES
// ============================================

/**
 * Create a forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden'): Response {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message: string = 'Authentication required'): Response {
  return Response.json({ error: message }, { status: 401 });
}

/**
 * Guard function for API routes
 *
 * Usage:
 * ```typescript
 * export async function DELETE(req: Request) {
 *   const guard = await requirePermission('users.delete');
 *   if (guard.response) return guard.response;
 *
 *   const user = guard.user;
 *   // Continue with delete logic...
 * }
 * ```
 */
export async function requirePermission(
  permission: string
): Promise<{ user: AppUser; response?: never } | { user?: never; response: Response }> {
  const { hasAccess, user, error } = await checkPermission(permission);

  if (!user) {
    return { response: unauthorizedResponse() };
  }

  if (!hasAccess) {
    return { response: forbiddenResponse(error) };
  }

  return { user };
}

/**
 * Guard function requiring ANY of the specified permissions
 */
export async function requireAnyPermission(
  permissions: string[]
): Promise<{ user: AppUser; response?: never } | { user?: never; response: Response }> {
  const { hasAccess, user, error } = await checkAnyPermission(permissions);

  if (!user) {
    return { response: unauthorizedResponse() };
  }

  if (!hasAccess) {
    return { response: forbiddenResponse(error) };
  }

  return { user };
}

/**
 * Guard function requiring ALL of the specified permissions
 */
export async function requireAllPermissions(
  permissions: string[]
): Promise<{ user: AppUser; response?: never } | { user?: never; response: Response }> {
  const { hasAccess, user, error } = await checkAllPermissions(permissions);

  if (!user) {
    return { response: unauthorizedResponse() };
  }

  if (!hasAccess) {
    return { response: forbiddenResponse(error) };
  }

  return { user };
}
