'use client';

/**
 * Users Table Columns
 *
 * Column definitions for the users data table.
 */

import type { ColumnDef } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { KeyRound, Pencil, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions } from '@/shared/components/data-table/DataTableRowActions';

import type { UserTableRow, UserStatus } from '../types';

// ============================================
// TYPES
// ============================================

export interface UsersTableColumnsOptions {
  onEdit?: (user: UserTableRow) => void;
  onChangeRole?: (user: UserTableRow) => void;
  onResetPassword?: (user: UserTableRow) => void;
  onDelete?: (user: UserTableRow) => void;
  onRestore?: (user: UserTableRow) => void;
  /** The signed-in user - some actions are refused against yourself */
  currentUserId?: string;
  /** Whether a restore operation is in progress */
  isRestoring?: boolean;
}

// ============================================
// HELPERS
// ============================================

const STATUS_VARIANTS: Record<UserStatus | 'deleted', string> = {
  active: 'border-transparent bg-emerald-100 text-emerald-800',
  inactive: 'border-transparent bg-slate-100 text-slate-700',
  suspended: 'border-transparent bg-red-100 text-red-800',
  pending: 'border-transparent bg-amber-100 text-amber-800',
  deleted: 'border-transparent bg-gray-200 text-gray-600',
};

// ============================================
// COLUMNS
// ============================================

export function getUsersTableColumns({
  onEdit,
  onChangeRole,
  onResetPassword,
  onDelete,
  onRestore,
  currentUserId,
  isRestoring,
}: UsersTableColumnsOptions): ColumnDef<UserTableRow>[] {
  return [
    {
      accessorKey: 'fullName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
      cell: ({ row }) => {
        const user = row.original;
        return (
          <div className={`flex items-center gap-3 ${user.isDeleted ? 'opacity-60' : ''}`}>
            <Avatar className="h-9 w-9">
              <AvatarFallback>{user.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{user.fullName}</div>
              <div className="truncate text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'roleName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      cell: ({ row }) => {
        const roleName = row.original.roleName;
        return roleName ? (
          <Badge variant="outline">{roleName}</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">No role</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const user = row.original;
        if (user.isDeleted) {
          return <Badge className={STATUS_VARIANTS.deleted}>Deleted</Badge>;
        }
        return <Badge className={STATUS_VARIANTS[user.status]}>{user.status}</Badge>;
      },
    },
    {
      accessorKey: 'lastLoginAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Login" />,
      cell: ({ row }) => {
        const lastLoginAt = row.original.lastLoginAt;

        if (!lastLoginAt) {
          return <span className="text-sm text-muted-foreground">Never</span>;
        }

        return (
          <span className="text-sm text-muted-foreground" title={format(lastLoginAt, 'PPpp')}>
            {formatDistanceToNow(lastLoginAt, { addSuffix: true })}
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(row.original.createdAt, 'dd MMM yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const user = row.original;
        const isSelf = currentUserId === user.id;

        // Deleted users only get the restore action
        if (user.isDeleted) {
          if (!onRestore) { return null; }
          return (
            <div className="text-right">
              <DataTableRowActions
                actions={[
                  {
                    label: 'Restore',
                    onClick: () => onRestore(user),
                    icon: <RotateCcw className="h-4 w-4" />,
                    disabled: isRestoring,
                  },
                ]}
              />
            </div>
          );
        }

        // Build actions array based on available handlers
        const actions = [];

        if (onEdit) {
          actions.push({
            label: 'Edit',
            onClick: () => onEdit(user),
            icon: <Pencil className="h-4 w-4" />,
          });
        }

        if (onChangeRole) {
          actions.push({
            label: 'Change Role',
            onClick: () => onChangeRole(user),
            icon: <ShieldCheck className="h-4 w-4" />,
            // Demoting yourself locks you out of this very screen
            disabled: isSelf,
          });
        }

        if (onResetPassword) {
          actions.push({
            label: 'Reset Password',
            onClick: () => onResetPassword(user),
            icon: <KeyRound className="h-4 w-4" />,
          });
        }

        if (onDelete) {
          actions.push({
            label: 'Delete',
            onClick: () => onDelete(user),
            icon: <Trash2 className="h-4 w-4" />,
            destructive: true,
            disabled: isSelf,
          });
        }

        // Don't render if no actions available
        if (actions.length === 0) { return null; }

        // Calculate separator position (after non-destructive actions)
        const nonDestructiveCount = actions.filter(a => !a.destructive).length;
        const separatorAfter = nonDestructiveCount > 0 && onDelete ? [nonDestructiveCount - 1] : [];

        return (
          <div className="text-right">
            <DataTableRowActions
              separatorAfter={separatorAfter}
              actions={actions}
            />
          </div>
        );
      },
    },
  ];
}
