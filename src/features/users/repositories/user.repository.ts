/**
 * Users Repository
 *
 * Data access layer for Users module.
 * Handles all database operations for users using Supabase Client.
 *
 * Note: this layer owns the `users` table only. The matching Supabase Auth
 * account is provisioned by the service layer - see user.service.ts.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  User,
  UserWithRole,
  UserRoleSummary,
  CreateUserDTO,
  UpdateUserDTO,
  UserListParams,
  UserSortField,
  UserStatusCounts,
  UserStatus,
} from '../types';
import { buildFullName } from '../types';

// ============================================
// TYPES
// ============================================

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Database row types (what Supabase returns)
 */
interface DbUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  role_id: string | null;
  status: UserStatus;
  last_login_at: string | null;
  login_count: number;
  failed_login_count: number;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
}

interface DbRole {
  id: string;
  name: string;
  scope: 'user' | 'customer';
  is_system_role: boolean;
  description: string | null;
}

/**
 * Sortable columns mapping (camelCase to snake_case)
 */
const SORT_COLUMNS: Record<UserSortField, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  status: 'status',
  lastLoginAt: 'last_login_at',
  createdAt: 'created_at',
};

// ============================================
// REPOSITORY
// ============================================

export const userRepository = {
  /**
   * Find all users with pagination, search and filtering.
   * Roles are joined in so the table does not need a query per row.
   *
   * @param params.includeDeleted - When true, includes soft-deleted users in results
   */
  async findMany(
    params: UserListParams = {}
  ): Promise<PaginatedResult<UserWithRole>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      roleId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeDeleted = false,
    } = params;

    const offset = (page - 1) * limit;

    // Build query with role join
    let query = db
      .from('users')
      .select(`
        *,
        roles:role_id (
          id,
          name,
          scope,
          is_system_role,
          description
        )
      `, { count: 'exact' });

    // Filter out deleted users unless explicitly requested
    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    // Apply search filter
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply role filter
    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    // Apply sorting
    const sortColumn = SORT_COLUMNS[sortBy] || 'created_at';
    query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToUserWithRole(row as DbUser & { roles: DbRole | null })),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  },

  /**
   * Find a single user by ID
   */
  async findById(id: string): Promise<UserWithRole | null> {
    const { data, error } = await db
      .from('users')
      .select(`
        *,
        roles:role_id (
          id,
          name,
          scope,
          is_system_role,
          description
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;} // Not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data ? this.mapToUserWithRole(data as DbUser & { roles: DbRole | null }) : null;
  },

  /**
   * Find a single user by email
   */
  async findByEmail(email: string): Promise<UserWithRole | null> {
    const { data, error } = await db
      .from('users')
      .select(`
        *,
        roles:role_id (
          id,
          name,
          scope,
          is_system_role,
          description
        )
      `)
      .eq('email', email.toLowerCase())
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;} // Not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data ? this.mapToUserWithRole(data as DbUser & { roles: DbRole | null }) : null;
  },

  /**
   * Find a single user by their Supabase Auth id
   */
  async findByAuthUserId(authUserId: string): Promise<UserWithRole | null> {
    const { data, error } = await db
      .from('users')
      .select(`
        *,
        roles:role_id (
          id,
          name,
          scope,
          is_system_role,
          description
        )
      `)
      .eq('auth_user_id', authUserId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;} // Not found
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data ? this.mapToUserWithRole(data as DbUser & { roles: DbRole | null }) : null;
  },

  /**
   * Check if an email is already taken.
   *
   * Soft-deleted rows are included on purpose: the column carries a plain
   * unique index, so a deleted row still blocks the insert.
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('email', email.toLowerCase());

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to check email: ${error.message}`);
    }

    return (count ?? 0) > 0;
  },

  /**
   * Create a new user row.
   *
   * `authUserId` links the row to the Supabase Auth account the service layer
   * created; it is null when the account could not be provisioned.
   */
  async create(
    data: CreateUserDTO & { authUserId?: string | null },
    userId?: string
  ): Promise<User> {
    const { data: result, error } = await db
      .from('users')
      .insert({
        auth_user_id: data.authUserId ?? null,
        email: data.email.toLowerCase(),
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone ?? null,
        role_id: data.roleId,
        status: data.status || 'active',
        created_by: userId ?? null,
        updated_by: userId ?? null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return this.mapToUser(result as DbUser);
  },

  /**
   * Update an existing user
   */
  async update(
    id: string,
    data: UpdateUserDTO,
    userId?: string
  ): Promise<User> {
    const updateData: Record<string, unknown> = {
      updated_by: userId ?? null,
      updated_at: new Date().toISOString(),
    };

    if (data.firstName !== undefined) {updateData.first_name = data.firstName;}
    if (data.lastName !== undefined) {updateData.last_name = data.lastName;}
    if (data.phone !== undefined) {updateData.phone = data.phone;}
    if (data.avatarUrl !== undefined) {updateData.avatar_url = data.avatarUrl;}
    if (data.roleId !== undefined) {updateData.role_id = data.roleId;}
    if (data.status !== undefined) {updateData.status = data.status;}

    const { data: result, error } = await db
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return this.mapToUser(result as DbUser);
  },

  /**
   * Link a user row to a Supabase Auth account
   */
  async setAuthUserId(id: string, authUserId: string | null): Promise<User> {
    const { data: result, error } = await db
      .from('users')
      .update({
        auth_user_id: authUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to link auth user: ${error.message}`);
    }

    return this.mapToUser(result as DbUser);
  },

  /**
   * Soft delete a user.
   *
   * The Supabase Auth account is left in place - the service layer suspends it
   * instead, so the row can be restored later with its login intact.
   */
  async softDelete(id: string, userId?: string): Promise<User> {
    const { data: result, error } = await db
      .from('users')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }

    return this.mapToUser(result as DbUser);
  },

  /**
   * Restore a soft-deleted user
   */
  async restore(id: string, userId?: string): Promise<User> {
    const { data: result, error } = await db
      .from('users')
      .update({
        deleted_at: null,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to restore user: ${error.message}`);
    }

    return this.mapToUser(result as DbUser);
  },

  /**
   * Record a successful login.
   *
   * Uses RPC to increment counter atomically.
   */
  async recordLogin(id: string): Promise<void> {
    const { error } = await db
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to record login: ${error.message}`);
    }

    // Increment login_count atomically using RPC function
    try {
      await db.rpc('increment_login_count', { user_id: id });
    } catch {
      // RPC function may not exist, ignore error
    }
  },

  /**
   * Count how many users are attached to a role.
   * Used to block deleting a role that is still in use.
   */
  async countByRole(roleId: string): Promise<number> {
    const { count, error } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', roleId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to count users: ${error.message}`);
    }

    return count ?? 0;
  },

  /**
   * Get user counts by status (for the stat cards)
   *
   * Performance: Uses parallel count queries instead of fetching all rows.
   * Each status count runs simultaneously for minimal total query time.
   */
  async getCountsByStatus(): Promise<UserStatusCounts> {
    // Run all count queries in PARALLEL
    const [activeResult, inactiveResult, suspendedResult, pendingResult] = await Promise.all([
      db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null),
      db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'inactive')
        .is('deleted_at', null),
      db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'suspended')
        .is('deleted_at', null),
      db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .is('deleted_at', null),
    ]);

    // Check for errors
    const errors = [activeResult, inactiveResult, suspendedResult, pendingResult]
      .filter((r) => r.error)
      .map((r) => r.error?.message);

    if (errors.length > 0) {
      throw new Error(`Failed to get counts: ${errors.join(', ')}`);
    }

    const counts: UserStatusCounts = {
      active: activeResult.count ?? 0,
      inactive: inactiveResult.count ?? 0,
      suspended: suspendedResult.count ?? 0,
      pending: pendingResult.count ?? 0,
      total: 0,
    };

    counts.total = counts.active + counts.inactive + counts.suspended + counts.pending;

    return counts;
  },

  /**
   * Map database row to User type
   */
  mapToUser(data: DbUser): User {
    return {
      id: data.id,
      authUserId: data.auth_user_id,
      email: data.email,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      avatarUrl: data.avatar_url,
      roleId: data.role_id,
      status: data.status,
      lastLoginAt: data.last_login_at ? new Date(data.last_login_at) : null,
      loginCount: data.login_count,
      emailVerifiedAt: data.email_verified_at ? new Date(data.email_verified_at) : null,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      createdBy: data.created_by,
      updatedBy: data.updated_by,
      deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
    };
  },

  /**
   * Map database row with joined role to UserWithRole
   */
  mapToUserWithRole(data: DbUser & { roles: DbRole | null }): UserWithRole {
    return {
      ...this.mapToUser(data),
      role: data.roles ? this.mapToRoleSummary(data.roles) : null,
      fullName: buildFullName(data.first_name, data.last_name),
    };
  },

  /**
   * Map role data to UserRoleSummary
   */
  mapToRoleSummary(role: DbRole): UserRoleSummary {
    return {
      id: role.id,
      name: role.name,
      scope: role.scope,
      isSystemRole: role.is_system_role,
      description: role.description,
    };
  },
};

export type UserRepository = typeof userRepository;
