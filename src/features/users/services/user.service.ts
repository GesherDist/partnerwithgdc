/**
 * Users Service
 *
 * Business logic layer for Users module.
 * Handles validation, business rules, and orchestration.
 *
 * This service spans two systems: the `users` table and the Supabase Auth
 * account behind it. Any operation that touches both is written so a failure
 * halfway through does not leave one side ahead of the other - see create().
 */

import { adminAuth } from '@/shared/lib/supabase/admin';
import { roleRepository } from '@/features/roles/repository/role-repository';

import { userRepository } from '../repositories/user.repository';
import {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  adminResetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ChangeUserRoleInput,
} from '../lib/schemas';
import type {
  User,
  UserWithRole,
  UserListParams,
  UserTableRow,
  UserStatusCounts,
} from '../types';
import { buildInitials } from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert user to table row format
 */
function toTableRow(user: UserWithRole): UserTableRow {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    initials: buildInitials(user.firstName, user.lastName),
    roleName: user.role?.name ?? null,
    roleScope: user.role?.scope ?? null,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    isDeleted: user.deletedAt !== null,
  };
}

/**
 * Where the invite / reset link should land the user.
 *
 * Goes via the callback route so the one-time code in the link is exchanged for
 * a session first - landing straight on /reset-password leaves the form with no
 * session and every submit fails with "Auth session missing".
 */
function resetRedirectUrl(): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${origin}/api/auth/callback?next=/reset-password`;
}

// ============================================
// SERVICE
// ============================================

export const userService = {
  /**
   * Get paginated list of users
   */
  async list(params: UserListParams = {}): Promise<
    ServiceResult<{
      data: UserTableRow[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    }>
  > {
    try {
      const result = await userRepository.findMany(params);

      return {
        success: true,
        data: {
          data: result.data.map(toTableRow),
          meta: result.meta,
        },
      };
    } catch (error) {
      console.error('UserService.list error:', error);
      return {
        success: false,
        error: 'Failed to fetch users',
      };
    }
  },

  /**
   * Get a single user by ID
   */
  async getById(id: string): Promise<ServiceResult<UserWithRole>> {
    try {
      const user = await userRepository.findById(id);

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('UserService.getById error:', error);
      return {
        success: false,
        error: 'Failed to fetch user',
      };
    }
  },

  /**
   * Create a new user, together with its Supabase Auth account.
   *
   * Order matters: the auth account is created first because it is the step
   * most likely to be rejected (duplicate email, weak password, SMTP down).
   * If the database insert then fails, the auth account is deleted again so
   * no account is left behind that has no matching user row.
   */
  async create(
    input: CreateUserInput,
    actorId?: string
  ): Promise<ServiceResult<User>> {
    try {
      // Validate input
      const validation = createUserSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<
            string,
            string[]
          >,
        };
      }

      const data = validation.data;

      // Check if email already exists
      const emailExists = await userRepository.emailExists(data.email);
      if (emailExists) {
        return {
          success: false,
          error: 'Email already exists',
          errors: { email: ['A user with this email already exists'] },
        };
      }

      // The role has to exist, otherwise the user lands with no permissions
      const role = await roleRepository.findById(data.roleId);
      if (!role) {
        return {
          success: false,
          error: 'Role not found',
          errors: { roleId: ['Select an existing role'] },
        };
      }

      // --- Step 1: provision the Supabase Auth account ---
      const metadata = {
        first_name: data.firstName,
        last_name: data.lastName,
        role_name: role.name,
      };

      const authResult = data.password
        ? await adminAuth.createUser(data.email, data.password, metadata)
        : await adminAuth.inviteUser(data.email, resetRedirectUrl(), metadata);

      if (authResult.error || !authResult.data?.user) {
        console.error('UserService.create auth error:', authResult.error);
        return {
          success: false,
          error:
            authResult.error?.message || 'Failed to create the login account',
          errors: {
            email: [
              authResult.error?.message || 'Failed to create the login account',
            ],
          },
        };
      }

      const authUserId = authResult.data.user.id;

      // --- Step 2: insert the user row, rolling back the account on failure ---
      let user: User;
      try {
        user = await userRepository.create({ ...data, authUserId }, actorId);
      } catch (dbError) {
        console.error(
          'UserService.create db error, rolling back auth account:',
          dbError
        );

        const { error: rollbackError } = await adminAuth.deleteUser(authUserId);
        if (rollbackError) {
          // The rollback itself failed - say so loudly, this one needs a human
          console.error(
            `UserService.create rollback FAILED - orphaned auth account ${authUserId} (${data.email}) must be removed manually:`,
            rollbackError
          );
        }

        return {
          success: false,
          error: 'Failed to create user',
        };
      }

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('UserService.create error:', error);
      return {
        success: false,
        error: 'Failed to create user',
      };
    }
  },

  /**
   * Update an existing user
   */
  async update(
    id: string,
    input: UpdateUserInput,
    actorId?: string
  ): Promise<ServiceResult<User>> {
    try {
      // Check if user exists
      const existing = await userRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Validate input
      const validation = updateUserSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<
            string,
            string[]
          >,
        };
      }

      const data = validation.data;

      // Check the new role exists (if changing)
      if (data.roleId && data.roleId !== existing.roleId) {
        const role = await roleRepository.findById(data.roleId);
        if (!role) {
          return {
            success: false,
            error: 'Role not found',
            errors: { roleId: ['Select an existing role'] },
          };
        }
      }

      // Handle password update if provided
      if (data.password && data.password.length > 0) {
        const passwordResult = await this.setPassword(id, data.password);
        if (!passwordResult.success) {
          return {
            success: false,
            error: passwordResult.error || 'Failed to update password',
            errors: passwordResult.errors,
          };
        }
      }

      // Remove password from data before updating user table (it's handled by Auth)
      const { password: _password, ...userData } = data;

      const user = await userRepository.update(id, userData, actorId);

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('UserService.update error:', error);
      return {
        success: false,
        error: 'Failed to update user',
      };
    }
  },

  /**
   * Change a user's role
   */
  async changeRole(
    id: string,
    input: ChangeUserRoleInput,
    actorId?: string
  ): Promise<ServiceResult<User>> {
    try {
      const validation = changeUserRoleSchema.safeParse(input);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<
            string,
            string[]
          >,
        };
      }

      return this.update(id, { roleId: validation.data.roleId }, actorId);
    } catch (error) {
      console.error('UserService.changeRole error:', error);
      return {
        success: false,
        error: 'Failed to change role',
      };
    }
  },

  /**
   * Soft delete a user.
   *
   * The Supabase Auth account is deliberately kept so the row can be restored
   * with its login intact. Sign-in is blocked at the application layer, which
   * refuses to resolve a profile for a soft-deleted row.
   */
  async delete(id: string, actorId?: string): Promise<ServiceResult<User>> {
    try {
      const existing = await userRepository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Deleting yourself would lock you out of the session you are using
      if (actorId && actorId === id) {
        return {
          success: false,
          error: 'You cannot delete your own account',
        };
      }

      const user = await userRepository.softDelete(id, actorId);

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('UserService.delete error:', error);
      return {
        success: false,
        error: 'Failed to delete user',
      };
    }
  },

  /**
   * Restore a soft-deleted user
   */
  async restore(id: string, actorId?: string): Promise<ServiceResult<User>> {
    try {
      const user = await userRepository.restore(id, actorId);

      return {
        success: true,
        data: user,
      };
    } catch (error) {
      console.error('UserService.restore error:', error);
      return {
        success: false,
        error: 'Failed to restore user',
      };
    }
  },

  /**
   * Set a user's password directly (admin-initiated).
   *
   * Prefer sendPasswordReset() - this one hands the admin a password the user
   * did not choose, so it is only for accounts that cannot receive email.
   */
  async setPassword(
    id: string,
    password: string
  ): Promise<ServiceResult<null>> {
    try {
      const validation = adminResetPasswordSchema.safeParse({ password });
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<
            string,
            string[]
          >,
        };
      }

      const user = await userRepository.findById(id);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      if (!user.authUserId) {
        return {
          success: false,
          error: 'This user has no login account yet',
        };
      }

      const { error } = await adminAuth.updateUser(user.authUserId, {
        password: validation.data.password,
      });

      if (error) {
        console.error('UserService.setPassword auth error:', error);
        return {
          success: false,
          error: error.message || 'Failed to set the password',
        };
      }

      return {
        success: true,
        data: null,
      };
    } catch (error) {
      console.error('UserService.setPassword error:', error);
      return {
        success: false,
        error: 'Failed to set the password',
      };
    }
  },

  /**
   * Email a password reset link to a user
   */
  async sendPasswordReset(id: string): Promise<ServiceResult<null>> {
    try {
      const user = await userRepository.findById(id);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      const { error } = await adminAuth.sendPasswordReset(
        user.email,
        resetRedirectUrl()
      );

      if (error) {
        console.error('UserService.sendPasswordReset auth error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send the reset email',
        };
      }

      return {
        success: true,
        data: null,
      };
    } catch (error) {
      console.error('UserService.sendPasswordReset error:', error);
      return {
        success: false,
        error: 'Failed to send the reset email',
      };
    }
  },

  /**
   * Get user counts by status
   */
  async getStatusCounts(): Promise<ServiceResult<UserStatusCounts>> {
    try {
      const counts = await userRepository.getCountsByStatus();
      return {
        success: true,
        data: counts,
      };
    } catch (error) {
      console.error('UserService.getStatusCounts error:', error);
      return {
        success: false,
        error: 'Failed to fetch status counts',
      };
    }
  },

  /**
   * Validate email uniqueness
   */
  async validateEmail(
    email: string,
    excludeId?: string
  ): Promise<ServiceResult<boolean>> {
    try {
      const exists = await userRepository.emailExists(email, excludeId);
      return {
        success: true,
        data: !exists,
      };
    } catch (error) {
      console.error('UserService.validateEmail error:', error);
      return {
        success: false,
        error: 'Failed to validate email',
      };
    }
  },
};

export type UserService = typeof userService;
