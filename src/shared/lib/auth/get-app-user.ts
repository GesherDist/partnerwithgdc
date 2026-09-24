/**
 * Get Application User
 *
 * Fetches the full user profile from our database
 * using the Supabase auth user ID.
 *
 * Optimizations:
 * 1. Uses React's cache() for request-level memoization (Next.js pattern)
 * 2. Fetches user, role, and permissions in parallel where possible
 */

import { cache } from 'react';
import { db } from '@/shared/lib/supabase/database';
import type { AppUser } from '@/shared/stores/auth.store';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  role_id: string | null;
  supplier_id: string | null;
}

interface DbRole {
  id: string;
  name: string;
  is_system_role: boolean;
}

/**
 * Internal function to fetch app user (not memoized)
 *
 * This is the actual database query logic. The memoized version
 * is exported as `getAppUserByAuthId`.
 *
 * Performance: Fetches user first (required), then role and permissions
 * in PARALLEL to minimize total query time.
 */
async function fetchAppUserByAuthId(authUserId: string): Promise<AppUser | null> {
  try {
    // Step 1: Get user with role_id (minimal query)
    // Note: supplier_id is optional - column may not exist before migrations
    const { data: userData, error: userError } = await db
      .from('users')
      .select('id, auth_user_id, email, first_name, last_name, avatar_url, role_id')
      .eq('auth_user_id', authUserId)
      .is('deleted_at', null)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {return null;} // Not found
      console.error('[getAppUserByAuthId] Database error:', userError);
      return null;
    }

    if (!userData) {
      return null;
    }

    const user: DbUser = {
      ...(userData as Omit<DbUser, 'supplier_id'>),
      supplier_id: null, // Will try to fetch below
    };

    // Try to get supplier_id (column may not exist before migrations)
    const { data: supplierData, error: supplierError } = await db
      .from('users')
      .select('supplier_id')
      .eq('id', user.id)
      .single();

    // Only set supplier_id if query succeeded and column exists
    if (!supplierError && supplierData && 'supplier_id' in supplierData) {
      user.supplier_id = (supplierData as { supplier_id: string | null }).supplier_id;
    }
    // If there's an error (column doesn't exist), we just leave supplier_id as null

    // Step 2: Get role AND permissions in PARALLEL (if user has a role)
    let role: DbRole | null = null;
    let permissionNames: string[] = [];

    if (user.role_id) {
      const [roleResult, permsResult] = await Promise.all([
        // Get role data
        db
          .from('roles')
          .select('id, name, is_system_role')
          .eq('id', user.role_id)
          .single(),
        // Get permissions (only active ones)
        db
          .from('role_permissions')
          .select('permissions:permission_id (name)')
          .eq('role_id', user.role_id)
          .eq('is_active', true),
      ]);

      if (roleResult.error) {
        console.error('[getAppUserByAuthId] Role error:', roleResult.error);
      } else {
        role = roleResult.data as DbRole;
      }

      if (permsResult.error) {
        console.error('[getAppUserByAuthId] Permissions error:', permsResult.error);
      } else {
        permissionNames = (permsResult.data || [])
          .map((rp) => {
            const perm = rp.permissions as { name: string } | { name: string }[] | null;
            if (Array.isArray(perm)) {return perm[0]?.name;}
            return perm?.name;
          })
          .filter((name): name is string => Boolean(name));
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      role: role
        ? {
            id: role.id,
            name: role.name,
            isSystemRole: role.is_system_role,
          }
        : null,
      permissions: permissionNames,
      supplierId: user.supplier_id,
    };
  } catch (error) {
    // Log the error for debugging but don't crash the app
    console.error('[getAppUserByAuthId] Database error:', error);

    // Return null to allow the app to continue
    // The user will be treated as not having a profile yet
    return null;
  }
}

/**
 * Get application user by auth user ID
 *
 * This function is memoized using React's cache() function, which means:
 * - Within a single request, multiple calls with the same authUserId
 *   will only execute the database query once
 * - The cache is automatically cleared after each request completes
 * - This is the recommended Next.js pattern for avoiding duplicate DB calls
 *
 * @param authUserId - The Supabase Auth user ID
 * @returns The application user or null if not found
 */
export const getAppUserByAuthId = cache(fetchAppUserByAuthId);
