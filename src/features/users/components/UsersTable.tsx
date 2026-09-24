'use client';

/**
 * Users Table
 *
 * Server-paginated users table with create / edit / role / delete actions.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 * - Memoized columns with useMemo
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { DataTable } from '@/shared/components/data-table/DataTable';
import { useAuthStore } from '@/shared/stores';

import { useUsers } from '../hooks/use-users';
import { useDeleteUser, useRestoreUser, useSendPasswordReset } from '../hooks/use-user-mutations';
import { getUsersTableColumns } from './UsersTableColumns';
import { UserFormDialog } from './UserFormDialog';
import { ChangeRoleDialog } from './ChangeRoleDialog';
import { USER_STATUS_OPTIONS, type UserStatus, type UserTableRow } from '../types';

// ============================================
// CONSTANTS
// ============================================

const ALL_STATUSES = 'all';

// ============================================
// PROPS
// ============================================

interface UsersTableProps {
  /** Called after any mutation, so the page can refresh its stat cards */
  onDataChange?: () => void;
  /** Initial data from server for React Query hydration */
  initialData?: unknown;
}

// ============================================
// COMPONENT
// ============================================

function UsersTableComponent({ onDataChange, initialData }: UsersTableProps) {
  const currentUserId = useAuthStore((state) => state.appUser?.id);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canCreate = hasMounted && hasPermission('users.create');
  const canEdit = hasMounted && hasPermission('users.edit');
  const canChangeRole = hasMounted && hasPermission('users.change_role');
  const canResetPassword = hasMounted && hasPermission('users.reset_password');
  const canDelete = hasMounted && hasPermission('users.delete');

  // Query state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Only use initialData for the first page with default filters
  const isInitialQuery = page === 1 && !search && status === ALL_STATUSES && !includeDeleted;

  const { users, meta, loading, refetch } = useUsers(
    {
      page,
      limit,
      search: search || undefined,
      status: status === ALL_STATUSES ? undefined : (status as UserStatus),
      includeDeleted,
    },
    isInitialQuery ? initialData : undefined
  );

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserTableRow | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<UserTableRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserTableRow | null>(null);

  const { deleteUser, loading: deleting } = useDeleteUser();
  const { restoreUser, loading: restoring } = useRestoreUser();
  const { sendPasswordReset } = useSendPasswordReset();

  const refresh = useCallback(() => {
    refetch();
    onDataChange?.();
  }, [refetch, onDataChange]);

  // --- Row actions ---

  const handleCreate = useCallback(() => {
    setEditingUser(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((user: UserTableRow) => {
    setEditingUser(user);
    setFormOpen(true);
  }, []);

  const handleChangeRole = useCallback((user: UserTableRow) => {
    setRoleUser(user);
    setRoleDialogOpen(true);
  }, []);

  const handleResetPassword = useCallback(
    async (user: UserTableRow) => {
      try {
        await sendPasswordReset(user.id);
        toast.success(`Password reset email sent to ${user.email}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to send the reset email'
        );
      }
    },
    [sendPasswordReset]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteUser(deleteTarget.id);
      toast.success(`${deleteTarget.fullName} deleted`);
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    }
  }, [deleteTarget, deleteUser, refresh]);

  const handleRestore = useCallback(
    async (user: UserTableRow) => {
      try {
        await restoreUser(user.id);
        toast.success(`${user.fullName} restored`);
        refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to restore user');
      }
    },
    [restoreUser, refresh]
  );

  const columns = useMemo(
    () =>
      getUsersTableColumns({
        onEdit: canEdit ? handleEdit : undefined,
        onChangeRole: canChangeRole ? handleChangeRole : undefined,
        onResetPassword: canResetPassword ? handleResetPassword : undefined,
        onDelete: canDelete ? setDeleteTarget : undefined,
        onRestore: canDelete ? handleRestore : undefined, // Restore requires delete permission
        currentUserId,
        isRestoring: restoring,
      }),
    [handleEdit, handleChangeRole, handleResetPassword, handleRestore, currentUserId, restoring, canEdit, canChangeRole, canResetPassword, canDelete]
  );

  // The table reports 0-based pages; the API is 1-based
  const handlePaginationChange = useCallback((pagination: PaginationState) => {
    setPage(pagination.pageIndex + 1);
    setLimit(pagination.pageSize);
  }, []);

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        getRowId={(row) => row.id}
        // Searching and filtering are done by the API, so the built-in
        // client-side filter would only ever search the current page.
        enableGlobalFilter={false}
        manualPagination
        rowCount={meta?.total ?? 0}
        defaultPageSize={limit}
        onPaginationChange={handlePaginationChange}
        emptyState={
          search || status !== ALL_STATUSES
            ? 'No users match these filters.'
            : 'No users yet. Create the first one.'
        }
        toolbarContent={
          <div className="flex flex-1 items-center gap-2">
            <Input
              placeholder="Search name, email or phone…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-8 w-[240px]"
            />

            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                {USER_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Checkbox
                id="show-deleted"
                checked={includeDeleted}
                onCheckedChange={(checked) => {
                  setIncludeDeleted(checked === true);
                  setPage(1);
                }}
              />
              <Label
                htmlFor="show-deleted"
                className="text-sm font-normal text-muted-foreground cursor-pointer"
              >
                Show deleted
              </Label>
            </div>

            {canCreate && (
              <div className="ml-auto">
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            )}
          </div>
        }
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editingUser}
        onSuccess={refresh}
      />

      <ChangeRoleDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        user={roleUser}
        onSuccess={refresh}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.fullName} will lose access immediately. Their login account is
              kept, so the user can be restored later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog up until the request settles
                event.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Export memoized component
export const UsersTable = memo(UsersTableComponent);
