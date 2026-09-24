/**
 * Query Keys Factory
 *
 * Centralized query key definitions for TanStack Query.
 * Uses the factory pattern for type-safe, hierarchical cache management.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/community/lukemorales-query-key-factory
 *
 * Usage:
 * ```ts
 * // In a hook
 * useQuery({
 *   queryKey: queryKeys.roles.list(),
 *   queryFn: () => fetchRoles(),
 * });
 *
 * // Invalidate all roles
 * queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
 *
 * // Invalidate a specific role
 * queryClient.invalidateQueries({ queryKey: queryKeys.roles.detail(roleId) });
 * ```
 */

/**
 * Roles query keys
 */
export const roleKeys = {
  /** Base key for all role-related queries */
  all: ['roles'] as const,

  /** List of roles with optional filters */
  lists: () => [...roleKeys.all, 'list'] as const,
  list: (filters?: { search?: string; isSystemRole?: boolean }) =>
    [...roleKeys.lists(), filters] as const,

  /** Single role details */
  details: () => [...roleKeys.all, 'detail'] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
};

/**
 * Permissions query keys
 */
export const permissionKeys = {
  /** Base key for all permission-related queries */
  all: ['permissions'] as const,

  /** List of permissions */
  lists: () => [...permissionKeys.all, 'list'] as const,
  list: (filters?: { search?: string; module?: string }) =>
    [...permissionKeys.lists(), filters] as const,

  /** Permissions grouped by module (flat) */
  grouped: () => [...permissionKeys.all, 'grouped'] as const,

  /** Permissions grouped by module with hierarchy */
  hierarchical: () => [...permissionKeys.all, 'hierarchical'] as const,
};

/**
 * Users query keys
 */
export const userKeys = {
  /** Base key for all user-related queries */
  all: ['users'] as const,

  /** List of users with pagination and filters */
  lists: () => [...userKeys.all, 'list'] as const,
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    roleId?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => [...userKeys.lists(), params] as const,

  /** Single user details */
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,

  /** User status counts */
  counts: () => [...userKeys.all, 'counts'] as const,
};

/**
 * Products query keys
 */
export const productKeys = {
  /** Base key for all product-related queries */
  all: ['products'] as const,

  /** List of products with pagination and filters */
  lists: () => [...productKeys.all, 'list'] as const,
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    isSellable?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }) => [...productKeys.lists(), params] as const,

  /** Single product details */
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,

  /** Distinct product categories (for the filter dropdown) */
  categories: () => [...productKeys.all, 'categories'] as const,
};

/**
 * Combined query keys export
 *
 * Usage:
 * ```ts
 * import { queryKeys } from '@/shared/lib/query';
 *
 * queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
 * ```
 */
export const queryKeys = {
  roles: roleKeys,
  permissions: permissionKeys,
  users: userKeys,
  products: productKeys,
} as const;
