/**
 * Auth Service
 *
 * Core authentication service for handling auth operations.
 * This service can be used on both client and server side.
 */

import { db } from '@/shared/lib/supabase/database';
import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  DEFAULT_LOGIN_REDIRECT,
} from '../lib/constants';
import type { AppUser, AuthError } from '../types';

// ============================================
// DATABASE ROW TYPES
// ============================================

interface DbUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  phone: string | null;
  status: string;
  role_id: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface DbRole {
  id: string;
  name: string;
  description: string | null;
  is_system_role: boolean;
}

// ============================================
// AUTH SERVICE CLASS
// ============================================

export class AuthService {
  /**
   * Get user by ID from database
   */
  static async getUserById(userId: string): Promise<AppUser | null> {
    try {
      // Get user with role
      const { data: userData, error: userError } = await db
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          avatar_url,
          phone,
          status,
          role_id,
          created_at,
          updated_at,
          last_login_at,
          roles:role_id (
            id,
            name,
            description,
            is_system_role
          )
        `)
        .eq('id', userId)
        .is('deleted_at', null)
        .single();

      if (userError || !userData) {
        return null;
      }

      // Supabase returns the joined role as a single object when using foreign key relation
      const rawUser = userData as unknown as DbUser & { roles: DbRole | DbRole[] | null };

      // Handle case where roles might be an array (get first) or single object
      const roleData = Array.isArray(rawUser.roles) ? rawUser.roles[0] ?? null : rawUser.roles;
      const user = { ...rawUser, roles: roleData } as DbUser & { roles: DbRole | null };

      // Get role permissions if role exists
      let permissionNames: string[] = [];
      if (user.roles) {
        const { data: rolePerms, error: permsError } = await db
          .from('role_permissions')
          .select('permissions:permission_id (name)')
          .eq('role_id', user.roles.id);

        if (!permsError && rolePerms) {
          permissionNames = rolePerms
            .map((rp) => {
              const perm = rp.permissions as { name: string } | { name: string }[] | null;
              if (Array.isArray(perm)) { return perm[0]?.name; }
              return perm?.name;
            })
            .filter((name): name is string => Boolean(name));
        }
      }

      return this.mapUserToAppUser(user, user.roles, permissionNames);
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  }

  /**
   * Get user by email from database
   */
  static async getUserByEmail(email: string): Promise<AppUser | null> {
    try {
      // Get user with role
      const { data: userData, error: userError } = await db
        .from('users')
        .select(`
          id,
          email,
          first_name,
          last_name,
          avatar_url,
          phone,
          status,
          role_id,
          created_at,
          updated_at,
          last_login_at,
          roles:role_id (
            id,
            name,
            description,
            is_system_role
          )
        `)
        .eq('email', email.toLowerCase())
        .is('deleted_at', null)
        .single();

      if (userError || !userData) {
        return null;
      }

      // Supabase returns the joined role as a single object when using foreign key relation
      const rawUser = userData as unknown as DbUser & { roles: DbRole | DbRole[] | null };

      // Handle case where roles might be an array (get first) or single object
      const roleData = Array.isArray(rawUser.roles) ? rawUser.roles[0] ?? null : rawUser.roles;
      const user = { ...rawUser, roles: roleData } as DbUser & { roles: DbRole | null };

      // Get role permissions if role exists
      let permissionNames: string[] = [];
      if (user.roles) {
        const { data: rolePerms, error: permsError } = await db
          .from('role_permissions')
          .select('permissions:permission_id (name)')
          .eq('role_id', user.roles.id);

        if (!permsError && rolePerms) {
          permissionNames = rolePerms
            .map((rp) => {
              const perm = rp.permissions as { name: string } | { name: string }[] | null;
              if (Array.isArray(perm)) { return perm[0]?.name; }
              return perm?.name;
            })
            .filter((name): name is string => Boolean(name));
        }
      }

      return this.mapUserToAppUser(user, user.roles, permissionNames);
    } catch (error) {
      console.error('Error fetching user by email:', error);
      return null;
    }
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId: string): Promise<void> {
    try {
      await db
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  /**
   * Check if user is active
   */
  static async isUserActive(userId: string): Promise<boolean> {
    try {
      const { data, error } = await db
        .from('users')
        .select('status')
        .eq('id', userId)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return false;
      }

      return data.status === 'active';
    } catch (error) {
      console.error('Error checking user status:', error);
      return false;
    }
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(userId: string): Promise<string[]> {
    try {
      // Get user's role
      const { data: userData, error: userError } = await db
        .from('users')
        .select('role_id')
        .eq('id', userId)
        .single();

      if (userError || !userData?.role_id) {
        return [];
      }

      // Get role permissions
      const { data: rolePerms, error: permsError } = await db
        .from('role_permissions')
        .select('permissions:permission_id (name)')
        .eq('role_id', userData.role_id);

      if (permsError || !rolePerms) {
        return [];
      }

      return rolePerms
        .map((rp) => {
          const perm = rp.permissions as { name: string } | { name: string }[] | null;
          if (Array.isArray(perm)) { return perm[0]?.name; }
          return perm?.name;
        })
        .filter((name): name is string => Boolean(name));
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return [];
    }
  }

  /**
   * Check if user has permission
   */
  static async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  /**
   * Check if user has any of the permissions
   */
  static async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some((p) => userPermissions.includes(p));
  }

  /**
   * Check if user has all permissions
   */
  static async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every((p) => userPermissions.includes(p));
  }

  /**
   * Log audit event
   */
  static async logAuditEvent(
    userId: string | null,
    action: string,
    module: string,
    entityType: string | null = null,
    entityId: string | null = null,
    options: {
      description?: string;
      oldData?: Record<string, unknown>;
      newData?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    try {
      await db.from('audit_logs').insert({
        user_id: userId,
        action,
        module,
        entity_type: entityType,
        entity_id: entityId,
        description: options.description ?? null,
        old_data: options.oldData ?? null,
        new_data: options.newData ?? null,
        ip_address: options.ipAddress ?? null,
        user_agent: options.userAgent ?? null,
        metadata: options.metadata ?? null,
      });
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }

  /**
   * Create auth error
   */
  static createError(code: keyof typeof AUTH_ERROR_CODES): AuthError {
    return {
      code: AUTH_ERROR_CODES[code],
      message: AUTH_ERROR_MESSAGES[AUTH_ERROR_CODES[code]] || 'An error occurred',
    };
  }

  /**
   * Map database user to AppUser
   */
  private static mapUserToAppUser(
    user: DbUser,
    role: DbRole | null,
    permissionNames: string[]
  ): AppUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      avatarUrl: user.avatar_url,
      phone: user.phone,
      status: user.status as AppUser['status'],
      role: role
        ? {
            id: role.id,
            name: role.name,
            description: role.description,
            isSystemRole: role.is_system_role,
          }
        : null,
      permissions: permissionNames,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : null,
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get default redirect URL after login
 */
export function getLoginRedirectUrl(requestedUrl?: string | null): string {
  if (requestedUrl && requestedUrl.startsWith('/') && !requestedUrl.startsWith('/login')) {
    return requestedUrl;
  }
  return DEFAULT_LOGIN_REDIRECT;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Mask email for display
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) {
    return email;
  }

  const maskedLocal =
    localPart.length <= 2
      ? '*'.repeat(localPart.length)
      : localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];

  return `${maskedLocal}@${domain}`;
}
