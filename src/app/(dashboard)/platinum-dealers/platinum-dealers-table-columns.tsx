'use client';

/**
 * Platinum Dealers Table Columns
 *
 * Column definitions for the platinum dealers data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions, createCommonRowActions } from '@/shared/components/data-table/DataTableRowActions';

import type { PlatinumDealer } from '@/features/platinum-dealers/types';

// ============================================
// TYPES
// ============================================

interface ColumnOptions {
  onView?: (dealer: PlatinumDealer) => void;
  onEdit?: (dealer: PlatinumDealer) => void;
  onDelete?: (dealer: PlatinumDealer) => void;
}

// ============================================
// COLUMN DEFINITIONS
// ============================================

export function getPlatinumDealersTableColumns(
  options: ColumnOptions = {}
): ColumnDef<PlatinumDealer>[] {
  return [
    // Select Checkbox
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },

    // Dealer Name
    {
      accessorKey: 'dealerName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Dealer Name" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">
          {row.getValue('dealerName')}
        </div>
      ),
    },

    // Code
    {
      accessorKey: 'code',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => {
        const code = row.getValue('code') as string | null;
        return (
          <div className="text-sm">
            {code || '-'}
          </div>
        );
      },
    },

    // Contact Name
    {
      accessorKey: 'contactName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Contact" />
      ),
      cell: ({ row }) => {
        const contactName = row.getValue('contactName') as string | null;
        return (
          <div className="text-sm">
            {contactName || '-'}
          </div>
        );
      },
    },

    // Email
    {
      accessorKey: 'email',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
      cell: ({ row }) => {
        const email = row.getValue('email') as string | null;
        return (
          <div className="text-sm">
            {email || '-'}
          </div>
        );
      },
    },

    // Phone
    {
      accessorKey: 'phone',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Phone" />
      ),
      cell: ({ row }) => {
        const phone = row.getValue('phone') as string | null;
        return (
          <div className="text-sm">
            {phone || '-'}
          </div>
        );
      },
    },

    // City
    {
      accessorKey: 'addressCity',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="City" />
      ),
      cell: ({ row }) => {
        const city = row.getValue('addressCity') as string | null;
        return (
          <div className="text-sm">
            {city || '-'}
          </div>
        );
      },
    },

    // State
    {
      accessorKey: 'addressState',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="State" />
      ),
      cell: ({ row }) => {
        const state = row.getValue('addressState') as string | null;
        return (
          <div className="text-sm">
            {state || '-'}
          </div>
        );
      },
    },

    // Status
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as 'active' | 'inactive';
        return (
          <Badge
            className={
              status === 'active'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }
          >
            {status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    // Actions
    {
      id: 'actions',
      cell: ({ row }) => {
        const dealer = row.original;
        const canEdit = dealer.status === 'active';
        const canDelete = true; // Allow delete for all statuses (soft delete)

        const { actions, separatorAfter } = createCommonRowActions({
          onView: options.onView ? () => options.onView?.(dealer) : undefined,
          onEdit: canEdit && options.onEdit ? () => options.onEdit?.(dealer) : undefined,
          onDelete: canDelete && options.onDelete ? () => options.onDelete?.(dealer) : undefined,
        });

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={actions} separatorAfter={separatorAfter} />
          </div>
        );
      },
    },
  ];
}
