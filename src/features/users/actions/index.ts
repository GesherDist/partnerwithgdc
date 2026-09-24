/**
 * Users Server Actions
 *
 * Server actions for the Users module.
 * Can be called directly from Server Components or from client components.
 *
 * Every action authenticates the caller and checks the matching
 * `users.*` permission before touching the service layer.
 */

'use server';

import { revalidatePath } from 'next/cache';

import { userService } from '../services/user.service';
import { resolveActor } from '../lib/require-actor';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';
import {
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  adminResetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from '../lib/schemas';
import type {
  User,
  UserWithRole,
  UserListParams,
  UserStatusCounts,
} from '../types';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

const USERS_PATH = '/users';

// ============================================
// AUTHORIZATION HELPERS
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

/**
 * Resolve the current application user and verify a permission.
 * Returns the app user (users.id — NOT the Supabase auth id).
 */
async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

/**
 * Same as `authorize`, but any one of the permissions is enough.
 */
async function authorizeAny(permissions: string[]): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      result: { success: false, error: `Permission denied: requires one of [${permissions.join(', ')}]` },
    };
  }

  return { ok: true, user };
}

/**
 * Legacy helper - resolves the caller to their own `users` row.
 * Used for self-checks like "you cannot delete yourself".
 * Note: Currently unused, kept for potential future use.
 */
// @ts-expect-error - Legacy helper kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function requireActor(): Promise<
  { ok: true; actorId: string } | { ok: false; result: ActionResult<never> }
> {
  const { actor, reason } = await resolveActor();

  if (!actor) {
    return {
      ok: false,
      result: {
        success: false,
        error:
          reason === 'no-profile'
            ? 'Your account is no longer active'
            : 'Authentication required',
      },
    };
  }

  return { ok: true, actorId: actor.id };
}

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of users
 */
export async function getUsers(
  params: UserListParams = {}
): Promise<ActionResult> {
  const auth = await authorize('users.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  return userService.list(params);
}

/**
 * Get a single user by ID
 */
export async function getUser(id: string): Promise<ActionResult<UserWithRole>> {
  const auth = await authorizeAny(['users.view_module', 'users.edit']);
  if (!auth.ok) {
    return auth.result;
  }

  return userService.getById(id);
}

/**
 * Get user counts by status
 */
export async function getUserStatusCounts(): Promise<
  ActionResult<UserStatusCounts>
> {
  const auth = await authorize('users.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  return userService.getStatusCounts();
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Create a new user together with its Supabase Auth account
 */
export async function createUser(
  input: CreateUserInput
): Promise<ActionResult<User>> {
  const auth = await authorize('users.create');
  if (!auth.ok) {
    return auth.result;
  }

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

  const result = await userService.create(validation.data, auth.user.id);

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

/**
 * Update an existing user
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput
): Promise<ActionResult<User>> {
  const auth = await authorize('users.edit');
  if (!auth.ok) {
    return auth.result;
  }

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

  const result = await userService.update(id, validation.data, auth.user.id);

  if (result.success) {
    revalidatePath(USERS_PATH);
    revalidatePath(`${USERS_PATH}/${id}`);
  }

  return result;
}

/**
 * Change a user's role
 */
export async function changeUserRole(
  id: string,
  roleId: string
): Promise<ActionResult<User>> {
  const auth = await authorize('users.change_role');
  if (!auth.ok) {
    return auth.result;
  }

  if (auth.user.id === id) {
    return { success: false, error: 'You cannot change your own role' };
  }

  const validation = changeUserRoleSchema.safeParse({ roleId });
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

  const result = await userService.changeRole(
    id,
    validation.data,
    auth.user.id
  );

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

/**
 * Soft delete a user
 */
export async function deleteUser(id: string): Promise<ActionResult<User>> {
  const auth = await authorize('users.delete');
  if (!auth.ok) {
    return auth.result;
  }

  if (auth.user.id === id) {
    return { success: false, error: 'You cannot delete yourself' };
  }

  const result = await userService.delete(id, auth.user.id);

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

/**
 * Restore a soft-deleted user
 */
export async function restoreUser(id: string): Promise<ActionResult<User>> {
  const auth = await authorize('users.delete');
  if (!auth.ok) {
    return auth.result;
  }

  const result = await userService.restore(id, auth.user.id);

  if (result.success) {
    revalidatePath(USERS_PATH);
  }

  return result;
}

// ============================================
// PASSWORD ACTIONS
// ============================================

/**
 * Email a password reset link to a user
 */
export async function sendUserPasswordReset(
  id: string
): Promise<ActionResult<null>> {
  const auth = await authorize('users.reset_password');
  if (!auth.ok) {
    return auth.result;
  }

  return userService.sendPasswordReset(id);
}

/**
 * Set a user's password directly (admin-initiated)
 */
export async function setUserPassword(
  id: string,
  password: string
): Promise<ActionResult<null>> {
  const auth = await authorize('users.reset_password');
  if (!auth.ok) {
    return auth.result;
  }

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

  return userService.setPassword(id, validation.data.password);
}

// ============================================
// VALIDATION ACTIONS
// ============================================

/**
 * Check whether an email is still available
 */
export async function validateUserEmail(
  email: string,
  excludeId?: string
): Promise<ActionResult<boolean>> {
  const auth = await authorize('users.view_module');
  if (!auth.ok) {
    return auth.result;
  }

  return userService.validateEmail(email, excludeId);
}

/**
 * Find active user by email
 * Used to match warehouse contacts with system users
 */
export async function findUserByEmail(
  email: string
): Promise<ActionResult<{ id: string; name: string; email: string } | null>> {
  try {
    const { db } = await import('@/shared/lib/supabase/database');

    const { data: user, error } = await db
      .from('users')
      .select('id, name, email')
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (error) {
      // User not found is not an error, just return null
      if (error.code === 'PGRST116') {
        return {
          success: true,
          data: null,
        };
      }
      throw error;
    }

    return {
      success: true,
      data: user,
    };
  } catch (error) {
    console.error('Error finding user by email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find user',
    };
  }
}
