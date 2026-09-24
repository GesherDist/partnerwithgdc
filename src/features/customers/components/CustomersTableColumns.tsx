'use client';

/**
 * Customers Table Columns
 *
 * Column definitions for the customers data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions } from '@/shared/components/data-table/DataTableRowActions';

import type { CustomerTableRow } from '../types';
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_CHANNEL_LABELS,
  CUSTOMER_CHANNEL_COLORS,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ColumnOptions {
  onView?: (customer: CustomerTableRow) => void;
  onEdit?: (customer: CustomerTableRow) => void;
  onDelete?: (customer: CustomerTableRow) => void;
}

// ============================================
// COLUMN DEFINITIONS
// ============================================

export function getCustomersTableColumns(
  options: ColumnOptions = {}
): ColumnDef<CustomerTableRow>[] {
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

    // Customer Code
    {
      accessorKey: 'customerCode',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Code" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">
          {row.getValue('customerCode')}
        </div>
      ),
    },

    // Name
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[250px] truncate font-medium">
          {row.getValue('name')}
        </div>
      ),
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
          <div className="max-w-[200px] truncate text-sm text-muted-foreground">
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

    // Location (City, State)
    {
      id: 'location',
      accessorFn: (row) => `${row.city || ''} ${row.state || ''}`.trim(),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Location" />
      ),
      cell: ({ row }) => {
        const city = row.original.city;
        const state = row.original.state;
        const location = [city, state].filter(Boolean).join(', ');
        return (
          <div className="text-sm">
            {location || '-'}
          </div>
        );
      },
    },

    // Channel
    {
      accessorKey: 'channel',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Channel" />
      ),
      cell: ({ row }) => {
        const channel = row.getValue('channel') as keyof typeof CUSTOMER_CHANNEL_LABELS;
        return (
          <Badge variant="outline" className={CUSTOMER_CHANNEL_COLORS[channel]}>
            {CUSTOMER_CHANNEL_LABELS[channel]}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    // Status
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as keyof typeof CUSTOMER_STATUS_LABELS;
        return (
          <Badge className={CUSTOMER_STATUS_COLORS[status]}>
            {CUSTOMER_STATUS_LABELS[status]}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    // Open Balance
    {
      accessorKey: 'formattedOpenBalance',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Open Balance" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {row.getValue('formattedOpenBalance')}
        </div>
      ),
    },

    // Actions
    {
      id: 'actions',
      cell: ({ row }) => {
        const actions = [
          ...(options.onView ? [{
            label: 'View',
            onClick: () => options.onView?.(row.original),
          }] : []),
          ...(options.onEdit ? [{
            label: 'Edit',
            onClick: () => options.onEdit?.(row.original),
          }] : []),
          ...(options.onDelete ? [{
            label: 'Delete',
            onClick: () => options.onDelete?.(row.original),
            destructive: true,
          }] : []),
        ];

        // Stop propagation to prevent row click from triggering
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={actions} />
          </div>
        );
      },
    },
  ];
}
