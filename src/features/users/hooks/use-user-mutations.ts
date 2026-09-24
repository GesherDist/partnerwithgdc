'use client';

/**
 * useUserMutations Hook
 *
 * Hooks for user CRUD operations.
 */

import { useState, useCallback } from 'react';

import type { User, CreateUserDTO, UpdateUserDTO } from '../types';

interface MutationState {
  loading: boolean;
  error: string | null;
}

interface UseCreateUserResult extends MutationState {
  createUser: (data: CreateUserDTO) => Promise<User>;
}

interface UseUpdateUserResult extends MutationState {
  updateUser: (id: string, data: UpdateUserDTO) => Promise<User>;
}

interface UseDeleteUserResult extends MutationState {
  deleteUser: (id: string) => Promise<void>;
}

interface UseRestoreUserResult extends MutationState {
  restoreUser: (id: string) => Promise<User>;
}

interface UseChangeUserRoleResult extends MutationState {
  changeUserRole: (id: string, roleId: string) => Promise<User>;
}

interface UseSendPasswordResetResult extends MutationState {
  sendPasswordReset: (id: string) => Promise<void>;
}

/**
 * Pull the most useful message out of an API error body.
 *
 * Routes return field errors for validation failures; surfacing only the
 * generic `error` would hide "A user with this email already exists".
 */
function extractError(result: { error?: string; errors?: Record<string, string[]> }, fallback: string): string {
  if (result.errors) {
    const firstField = Object.values(result.errors)[0];
    if (firstField?.[0]) {
      return firstField[0];
    }
  }
  return result.error || fallback;
}

/**
 * Hook to create a user
 */
export function useCreateUser(): UseCreateUserResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = useCallback(async (data: CreateUserDTO): Promise<User> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractError(result, 'Failed to create user'));
      }

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createUser, loading, error };
}

/**
 * Hook to update a user
 */
export function useUpdateUser(): UseUpdateUserResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUser = useCallback(async (id: string, data: UpdateUserDTO): Promise<User> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractError(result, 'Failed to update user'));
      }

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateUser, loading, error };
}

/**
 * Hook to soft delete a user
 */
export function useDeleteUser(): UseDeleteUserResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteUser = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractError(result, 'Failed to delete user'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteUser, loading, error };
}

/**
 * Hook to restore a soft-deleted user
 */
export function useRestoreUser(): UseRestoreUserResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restoreUser = useCallback(async (id: string): Promise<User> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/${id}/restore`, { method: 'POST' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractError(result, 'Failed to restore user'));
      }

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore user';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { restoreUser, loading, error };
}

/**
 * Hook to change a user's role
 */
export function useChangeUserRole(): UseChangeUserRoleResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeUserRole = useCallback(async (id: string, roleId: string): Promise<User> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/${id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractError(result, 'Failed to change role'));
      }

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change role';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { changeUserRole, loading, error };
}

/**
 * Hook to email a user a password reset link
 */
export function useSendPasswordReset(): UseSendPasswordResetResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendPasswordReset = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/users/${id}/password`, { method: 'POST' });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(extractError(result, 'Failed to send the reset email'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send the reset email';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendPasswordReset, loading, error };
}
