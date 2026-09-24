'use client';

/**
 * Sales Orders Table Columns
 *
 * Column definitions for the sales orders data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions, createCommonRowActions } from '@/shared/components/data-table/DataTableRowActions';

import type { SalesOrderListItem } from '../types';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  canEditOrder,
} from '../types';
import { formatDate } from '../lib/mock-data';

// ============================================
// TYPES
// ============================================

interface ColumnOptions {
  onView?: (order: SalesOrderListItem) => void;
  onEdit?: (order: SalesOrderListItem) => void;
  onDelete?: (order: SalesOrderListItem) => void;
  onConfirm?: (order: SalesOrderListItem) => void;
  onCancel?: (order: SalesOrderListItem) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format amount from cents to currency display
 */
function formatAmount(cents: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(cents / 100);
}

// ============================================
// COLUMN DEFINITIONS
// ============================================

export function getSalesOrdersTableColumns(
  options: ColumnOptions = {}
): ColumnDef<SalesOrderListItem>[] {
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

    // Sales Order Number
    {
      accessorKey: 'orderNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Sales Order No" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">
          {row.getValue('orderNumber')}
        </div>
      ),
    },

    // Customer
    {
      accessorKey: 'customerName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[250px] truncate font-medium">
          {row.getValue('customerName')}
        </div>
      ),
    },

    // Customer PO Number
    {
      accessorKey: 'customerPoNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer PO" />
      ),
      cell: ({ row }) => {
        const customerPo = row.getValue('customerPoNumber') as string | null;
        return (
          <div className="max-w-[150px] truncate text-sm font-medium">
            {customerPo || '-'}
          </div>
        );
      },
    },

    // Order Date
    {
      accessorKey: 'orderDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order Date" />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDate(row.getValue('orderDate'))}
        </div>
      ),
    },

    // Delivery Date
    {
      accessorKey: 'requestedDeliveryDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Delivery Date" />
      ),
      cell: ({ row }) => {
        const deliveryDate = row.getValue('requestedDeliveryDate') as string | null;
        return (
          <div className="text-sm">
            {deliveryDate ? formatDate(deliveryDate) : '-'}
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
        const status = row.getValue('status') as keyof typeof ORDER_STATUS_LABELS;
        return (
          <Badge className={ORDER_STATUS_COLORS[status]}>
            {ORDER_STATUS_LABELS[status]}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    // Order Series
    {
      accessorKey: 'orderSeries',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Order Series" />
      ),
      cell: ({ row }) => {
        const orderSeries = row.getValue('orderSeries') as string | null;
        if (!orderSeries) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <Badge variant="secondary" className="font-medium">
            {orderSeries}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    // Item Count
    {
      accessorKey: 'itemCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Items" />
      ),
      cell: ({ row }) => {
        const itemCount = row.getValue('itemCount') as number;
        return (
          <div className="text-center text-sm">
            {itemCount}
          </div>
        );
      },
    },

    // Total
    {
      accessorKey: 'grandTotal',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total" />
      ),
      cell: ({ row }) => {
        const total = row.getValue('grandTotal') as number;
        const currencyCode = row.original.currencyCode || 'USD';
        return (
          <div className="text-right font-mono text-sm font-medium">
            {formatAmount(total, currencyCode)}
          </div>
        );
      },
    },

    // Actions
    {
      id: 'actions',
      cell: ({ row }) => {
        const status = row.original.status;
        const isEditable = canEditOrder(status);
        const canConfirm = ['draft', 'pending'].includes(status);
        const canCancel = !['delivered', 'cancelled'].includes(status);

        const { actions, separatorAfter } = createCommonRowActions({
          onView: options.onView ? () => options.onView?.(row.original) : undefined,
          // Only show edit button for editable statuses (draft, pending)
          onEdit: options.onEdit && isEditable ? () => options.onEdit?.(row.original) : undefined,
          onDelete: options.onDelete ? () => options.onDelete?.(row.original) : undefined,
        });

        // Add status change actions
        const statusActions = [];

        if (options.onConfirm && canConfirm) {
          statusActions.push({
            label: 'Confirm Order',
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: () => options.onConfirm?.(row.original),
          });
        }

        if (options.onCancel && canCancel) {
          statusActions.push({
            label: 'Cancel Order',
            icon: <XCircle className="h-4 w-4" />,
            onClick: () => options.onCancel?.(row.original),
            destructive: true,
          });
        }

        // Combine actions: common actions first, then separator, then status actions
        const allActions = [...actions, ...statusActions];
        const newSeparatorAfter = statusActions.length > 0
          ? [...separatorAfter, actions.length - 1] // Add separator before status actions
          : separatorAfter;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={allActions} separatorAfter={newSeparatorAfter} />
          </div>
        );
      },
    },
  ];
}
