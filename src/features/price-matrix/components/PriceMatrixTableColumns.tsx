'use client';

/**
 * Price Matrix Table Columns
 *
 * Column definitions for the price matrix data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions } from '@/shared/components/data-table/DataTableRowActions';
import type { PriceMatrixTableRow } from '../types';
import { CUSTOMER_CHANNEL_LABELS, CUSTOMER_CHANNEL_COLORS } from '@/features/customers/types';
import { PRICE_STATUS_LABELS, PRICE_STATUS_COLORS } from '../types';

interface ColumnOptions {
  onEdit?: (entry: PriceMatrixTableRow) => void;
  onDelete?: (entry: PriceMatrixTableRow) => void;
  showProduct?: boolean;
}

export function getPriceMatrixTableColumns(
  options: ColumnOptions = {}
): ColumnDef<PriceMatrixTableRow>[] {
  const columns: ColumnDef<PriceMatrixTableRow>[] = [];

  // Product column (optional - hide when viewing within product detail)
  if (options.showProduct) {
    columns.push({
      accessorKey: 'productSku',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-sm font-medium">{row.original.productSku}</div>
          <div className="text-xs text-muted-foreground">{row.original.productName}</div>
        </div>
      ),
    });
  }

  // Channel column
  columns.push({
    accessorKey: 'channel',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Channel" />,
    cell: ({ row }) => {
      const channel = row.getValue('channel') as 'oem' | 'dealer';
      return (
        <Badge className={CUSTOMER_CHANNEL_COLORS[channel]}>
          {CUSTOMER_CHANNEL_LABELS[channel]}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  });

  // Quantity Range column
  columns.push({
    accessorKey: 'quantityRange',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Qty Range" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.quantityRange}</span>
    ),
  });

  // Cost column
  columns.push({
    accessorKey: 'cost',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.formattedCost}</span>
    ),
  });

  // Price column
  columns.push({
    accessorKey: 'price',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">{row.original.formattedPrice}</span>
    ),
  });

  // Margin column
  columns.push({
    accessorKey: 'marginPercent',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Margin" />,
    cell: ({ row }) => {
      const marginPercent = row.original.marginPercent;
      const colorClass = marginPercent >= 20
        ? 'text-emerald-600'
        : marginPercent >= 10
        ? 'text-amber-600'
        : 'text-red-600';
      return (
        <span className={`font-mono text-sm ${colorClass}`}>
          {marginPercent.toFixed(1)}%
        </span>
      );
    },
  });

  // Status column
  columns.push({
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const status = row.getValue('status') as 'active' | 'inactive';
      return (
        <Badge className={PRICE_STATUS_COLORS[status]}>
          {PRICE_STATUS_LABELS[status]}
        </Badge>
      );
    },
  });

  // Actions column
  columns.push({
    id: 'actions',
    cell: ({ row }) => {
      const actions = [];

      if (options.onEdit) {
        actions.push({
          label: 'Edit',
          onClick: () => options.onEdit?.(row.original),
        });
      }

      if (options.onDelete) {
        actions.push({
          label: 'Delete',
          onClick: () => options.onDelete?.(row.original),
          destructive: true,
        });
      }

      if (actions.length === 0) {
        return null;
      }

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DataTableRowActions
            actions={actions}
            separatorAfter={options.onDelete && actions.length > 1 ? [actions.length - 2] : undefined}
          />
        </div>
      );
    },
  });

  return columns;
}
