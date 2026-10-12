'use client';

/**
 * Sales Orders Table Columns
 *
 * Column definitions for the sales orders data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { CheckCircle, XCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableRowActions, createCommonRowActions } from '@/shared/components/data-table/DataTableRowActions';

import type { SalesOrderListItem, SOSortColumn, SOSortDirection } from '../types';
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
  // Sorting options
  sortColumn?: SOSortColumn | null;
  sortDirection?: SOSortDirection;
  onSortChange?: (column: SOSortColumn) => void;
}

// Sortable header component
function SortableHeader({
  label,
  column,
  currentColumn,
  currentDirection,
  onSort,
}: {
  label: string;
  column: SOSortColumn;
  currentColumn: SOSortColumn | null | undefined;
  currentDirection: SOSortDirection | undefined;
  onSort?: (column: SOSortColumn) => void;
}) {
  if (!onSort) {
    return <span>{label}</span>;
  }

  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 hover:text-primary font-medium"
    >
      {label}
      {currentColumn === column ? (
        currentDirection === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
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
  const { onView, onEdit, onDelete, onConfirm, onCancel, sortColumn, sortDirection, onSortChange } = options;

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
      header: () => (
        <SortableHeader
          label="Sales Order No"
          column="orderNumber"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
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
      header: () => (
        <SortableHeader
          label="Customer"
          column="customerName"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
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
      header: () => (
        <SortableHeader
          label="Customer PO"
          column="customerPoNumber"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
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
      header: () => (
        <SortableHeader
          label="Order Date"
          column="orderDate"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
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
      header: () => (
        <SortableHeader
          label="Delivery Date"
          column="requestedDeliveryDate"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
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
      header: () => (
        <SortableHeader
          label="Status"
          column="status"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
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

    // Item Count
    {
      accessorKey: 'itemCount',
      header: 'Items',
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
      header: () => (
        <SortableHeader
          label="Total"
          column="grandTotal"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
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
        const canConfirmOrder = ['draft', 'pending'].includes(status);
        const canCancelOrder = !['delivered', 'cancelled'].includes(status);

        const { actions, separatorAfter } = createCommonRowActions({
          onView: onView ? () => onView(row.original) : undefined,
          // Only show edit button for editable statuses (draft, pending)
          onEdit: onEdit && isEditable ? () => onEdit(row.original) : undefined,
          onDelete: onDelete ? () => onDelete(row.original) : undefined,
        });

        // Add status change actions
        const statusActions = [];

        if (onConfirm && canConfirmOrder) {
          statusActions.push({
            label: 'Confirm Order',
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: () => onConfirm(row.original),
          });
        }

        if (onCancel && canCancelOrder) {
          statusActions.push({
            label: 'Cancel Order',
            icon: <XCircle className="h-4 w-4" />,
            onClick: () => onCancel(row.original),
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
