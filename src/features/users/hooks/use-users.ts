'use client';

/**
 * Users Query Hooks
 *
 * React Query hooks for fetching users and their status counts.
 * Provides automatic caching, request deduplication, and background refetching.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from '@/shared/lib/query';

import type { UserTableRow, UserWithRole, UserListParams, UserStatusCounts } from '../types';

// ============================================
// TYPES
// ============================================

interface ListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UsersData {
  users: UserTableRow[];
  meta: ListMeta | null;
}

interface UseUsersResult {
  users: UserTableRow[];
  meta: ListMeta | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseUserResult {
  user: UserWithRole | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseUserStatusCountsResult {
  counts: UserStatusCounts | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================
// API FETCHERS
// ============================================

/**
 * Fetch a page of users from the API
 */
async function fetchUsers(params: UserListParams): Promise<UsersData> {
  const query = new URLSearchParams();

  if (params.page) {query.set('page', String(params.page));}
  if (params.limit) {query.set('limit', String(params.limit));}
  if (params.search) {query.set('search', params.search);}
  if (params.status) {query.set('status', params.status);}
  if (params.roleId) {query.set('roleId', params.roleId);}
  if (params.sortBy) {query.set('sortBy', params.sortBy);}
  if (params.sortOrder) {query.set('sortOrder', params.sortOrder);}
  if (params.includeDeleted) {query.set('includeDeleted', 'true');}

  const response = await fetch(`/api/users?${query.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch users');
  }

  // Dates survive JSON as strings - rebuild them so the table can format
  const rows: UserTableRow[] = (data.data?.data ?? []).map(
    (row: UserTableRow & { lastLoginAt: string | null; createdAt: string }) => ({
      ...row,
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
      createdAt: new Date(row.createdAt),
    })
  );

  return {
    users: rows,
    meta: data.data?.meta ?? null,
  };
}

/**
 * Fetch a single user by ID from the API
 */
async function fetchUser(id: string): Promise<UserWithRole> {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch user');
  }

  return data.data;
}

/**
 * Fetch user status counts from the API
 */
async function fetchUserStatusCounts(): Promise<UserStatusCounts> {
  const response = await fetch('/api/users/counts');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch user counts');
  }

  return data.data;
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook to fetch a page of users
 *
 * Uses React Query for caching and request deduplication.
 * Paging, searching and sorting all happen on the server - the table only ever
 * holds the current page, so the list stays fast as the user count grows.
 *
 * @param params - Pagination, filtering, and sorting parameters
 * @param initialData - Server-side fetched data for hydration (improves FCP/LCP)
 */
export function useUsers(params: UserListParams = {}, initialData?: unknown): UseUsersResult {
  // Transform server-side data to match client format if provided
  const serverData = initialData as { data?: UserTableRow[]; meta?: ListMeta } | undefined;
  const transformedInitialData: UsersData | undefined = serverData?.data
    ? {
        users: serverData.data.map((row) => ({
          ...row,
          lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
          createdAt: new Date(row.createdAt),
        })),
        meta: serverData.meta ?? null,
      }
    : undefined;

  const query = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => fetchUsers(params),
    // Users list changes frequently - shorter cache time
    staleTime: 30 * 1000,
    // Use server-fetched data as initial data (no loading state on first render)
    initialData: transformedInitialData,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    users: query.data?.users ?? [],
    meta: query.data?.meta ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}

/**
 * Hook to fetch a single user by ID
 *
 * Uses React Query for caching. The same user ID requested by multiple
 * components will only trigger one API call.
 *
 * @param id - The user ID to fetch, or null to skip fetching
 */
export function useUser(id: string | null): UseUserResult {
  const query = useQuery({
    queryKey: queryKeys.users.detail(id ?? ''),
    queryFn: () => fetchUser(id!),
    enabled: !!id,
    // User details cache for 1 minute
    staleTime: 60 * 1000,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    user: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}

/**
 * Hook to fetch user counts by status (for the stat cards)
 *
 * Uses React Query for caching. Dashboard stats are cached briefly
 * to avoid excessive refreshes while still staying relatively current.
 *
 * @param initialData - Server-side fetched counts for hydration (improves FCP/LCP)
 */
export function useUserStatusCounts(initialData?: UserStatusCounts | null): UseUserStatusCountsResult {
  const query = useQuery({
    queryKey: queryKeys.users.counts(),
    queryFn: fetchUserStatusCounts,
    // Counts change with user operations - cache for 30 seconds
    staleTime: 30 * 1000,
    // Use server-fetched data as initial data (no loading state on first render)
    initialData: initialData ?? undefined,
  });

  const refetch = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    counts: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
  };
}
