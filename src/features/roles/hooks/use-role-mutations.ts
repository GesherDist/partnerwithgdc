'use client';

/**
 * useRoleMutations Hook
 *
 * Hook for role CRUD operations.
 */

import { useState, useCallback } from 'react';
import type { CreateRoleData, UpdateRoleData, RoleWithPermissions } from '../types';

interface MutationState {
  loading: boolean;
  error: string | null;
}

interface UseCreateRoleResult extends MutationState {
  createRole: (data: CreateRoleData) => Promise<RoleWithPermissions>;
}

interface UseUpdateRoleResult extends MutationState {
  updateRole: (id: string, data: UpdateRoleData) => Promise<RoleWithPermissions>;
}

interface UseDeleteRoleResult extends MutationState {
  deleteRole: (id: string) => Promise<void>;
}

/**
 * Hook to create a role
 */
export function useCreateRole(): UseCreateRoleResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRole = useCallback(async (data: CreateRoleData): Promise<RoleWithPermissions> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create role');
      }

      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create role';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createRole, loading, error };
}

/**
 * Hook to update a role
 */
export function useUpdateRole(): UseUpdateRoleResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRole = useCallback(
    async (id: string, data: UpdateRoleData): Promise<RoleWithPermissions> => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/roles/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update role');
        }

        return result.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update role';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateRole, loading, error };
}

/**
 * Hook to delete a role
 */
export function useDeleteRole(): UseDeleteRoleResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteRole = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/roles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete role');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete role';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteRole, loading, error };
}
