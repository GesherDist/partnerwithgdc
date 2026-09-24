'use client';

/**
 * Roles Query Hooks
 *
 * React Query hooks for fetching and managing roles and permissions.
 * Provides automatic caching, request deduplication, and background refetching.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { queryKeys } from '@/shared/lib/query';
import type { RoleListItem, RoleDetail, PermissionGroup, HierarchicalPermissionGroup, RoleScope } from '../types';

// ============================================
// API FETCHERS
// ============================================

/**
 * Fetch all roles from the API
 */
async function fetchRoles(filters?: {
  search?: string;
  isSystemRole?: boolean;
}): Promise<RoleListItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) {params.set('search', filters.search);}
  if (filters?.isSystemRole !== undefined) {params.set('isSystemRole', String(filters.isSystemRole));}

  const response = await fetch(`/api/roles?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch roles');
  }

  return data.data;
}

/**
 * Fetch a single role by ID from the API
 */
async function fetchRole(id: string): Promise<RoleDetail> {
  const response = await fetch(`/api/roles/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch role');
  }

  return data.data;
}

/**
 * Fetch permissions grouped by module from the API
 */
async function fetchPermissionsGrouped(): Promise<PermissionGroup[]> {
  const response = await fetch('/api/permissions?grouped=true');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch permissions');
  }

  return data.data;
}

/**
 * Fetch permissions grouped by module with hierarchy from the API
 */
async function fetchPermissionsHierarchical(permissionType?: RoleScope): Promise<HierarchicalPermissionGroup[]> {
  const params = new URLSearchParams();
  params.set('hierarchical', 'true');
  if (permissionType) {
    params.set('permissionType', permissionType);
  }

  const response = await fetch(`/api/permissions?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch permissions');
  }

  return data.data;
}

// ============================================
// HOOK OPTIONS & RESULTS
// ============================================

interface UseRolesOptions {
  /** Filter roles by name/displayName/description */
  search?: string;
  /** Filter by system role status */
  isSystemRole?: boolean;
  /**
   * Whether to enable automatic fetching.
   * When false, the hook will not fetch data until enabled becomes true.
   * Defaults to true.
   */
  enabled?: boolean;
}

interface UseRolesResult {
  roles: RoleListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseRoleResult {
  role: RoleDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UsePermissionsOptions {
  /**
   * Filter by permission type (user or customer)
   */
  permissionType?: RoleScope;
  /**
   * Whether to enable automatic fetching.
   * When false, the hook will not fetch data until enabled becomes true.
   * Defaults to true.
   */
  enabled?: boolean;
}

interface UsePermissionsResult {
  permissions: PermissionGroup[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseHierarchicalPermissionsResult {
  permissions: HierarchicalPermissionGroup[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook to fetch all roles
 *
 * Uses React Query for automatic caching and request deduplication.
 * Multiple components using this hook with the same filters will share
 * a single request.
 *
 * @param options - Query options including filters and enabled flag
 * @param options.search - Filter roles by name/displayName/description
 * @param options.isSystemRole - Filter by system role status
 * @param options.enabled - When false, prevents automatic fetching (default: true)
 */
export function useRoles(options?: UseRolesOptions): UseRolesResult {
  const { search, isSystemRole, enabled = true } = options ?? {};
  const filters = { search, isSystemRole };

  const query = useQuery({
    queryKey: queryKeys.roles.list(filters),
    queryFn: () => fetchRoles(filters),
    enabled,
    // Roles change infrequently - cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    roles: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}

/**
 * Hook to fetch a single role by ID
 *
 * Uses React Query for caching. The same role ID requested by multiple
 * components will only trigger one API call.
 *
 * @param id - The role ID to fetch, or null to skip fetching
 */
export function useRole(id: string | null): UseRoleResult {
  const query = useQuery({
    queryKey: queryKeys.roles.detail(id ?? ''),
    queryFn: () => fetchRole(id!),
    enabled: !!id,
    // Role details cache for 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    role: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}

/**
 * Hook to fetch permissions grouped by module
 *
 * Uses React Query with extended caching since permissions
 * rarely change during a session.
 *
 * @param options - Query options
 * @param options.enabled - When false, prevents automatic fetching (default: true)
 */
export function usePermissions(options?: UsePermissionsOptions): UsePermissionsResult {
  const { enabled = true } = options ?? {};

  const query = useQuery({
    queryKey: queryKeys.permissions.grouped(),
    queryFn: fetchPermissionsGrouped,
    enabled,
    // Permissions almost never change - cache for 10 minutes
    staleTime: 10 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    permissions: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}

/**
 * Hook to fetch hierarchical permissions grouped by module
 *
 * Returns permissions with parent-child relationships for nested display.
 *
 * @param options - Query options
 * @param options.permissionType - Filter by permission type (user or customer)
 * @param options.enabled - When false, prevents automatic fetching (default: true)
 */
export function useHierarchicalPermissions(options?: UsePermissionsOptions): UseHierarchicalPermissionsResult {
  const { permissionType, enabled = true } = options ?? {};

  const query = useQuery({
    queryKey: [...queryKeys.permissions.hierarchical(), permissionType],
    queryFn: () => fetchPermissionsHierarchical(permissionType),
    enabled,
    // Permissions almost never change - cache for 10 minutes
    staleTime: 10 * 60 * 1000,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    permissions: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}

/**
 * Hook to seed permissions
 *
 * This is a mutation hook that doesn't use caching.
 */
export function useSeedPermissions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seedPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/permissions/seed', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to seed permissions');
      }

      return data.data.count;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to seed permissions';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { seedPermissions, loading, error };
}
