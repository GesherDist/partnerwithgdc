'use client';

/**
 * Products Table Columns
 *
 * Column definitions for the products data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions } from '@/shared/components/data-table/DataTableRowActions';
import type { ProductTableRow } from '../types';

interface ColumnOptions {
  onEdit?: (product: ProductTableRow) => void;
  onDelete?: (product: ProductTableRow) => void;
  onView?: (product: ProductTableRow) => void;
}

export function getProductsTableColumns(options: ColumnOptions = {}): ColumnDef<ProductTableRow>[] {
  return [
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
        // Stop propagation so ticking the checkbox does not open the row drawer
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
            className="translate-y-[2px]"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'sku',
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">{row.getValue('sku')}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate font-medium">{row.getValue('name')}</div>
      ),
    },
    {
      accessorKey: 'itemType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const itemType = row.getValue('itemType') as string;
        const typeLabels: Record<string, string> = {
          inventory: 'Inventory',
          non_inventory: 'Non-Inventory',
          service: 'Service',
        };
        const typeColors: Record<string, 'default' | 'secondary' | 'outline'> = {
          inventory: 'outline',
          non_inventory: 'secondary',
          service: 'secondary',
        };
        return (
          <Badge variant={typeColors[itemType] || 'outline'}>
            {typeLabels[itemType] || itemType}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'category',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => {
        const category = row.getValue('category') as string | null;
        return category ? (
          <Badge variant="outline">{category}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'formattedBaseCost',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cost" />,
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {row.getValue('formattedBaseCost')}
        </div>
      ),
    },
    {
      accessorKey: 'formattedBasePrice',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Price" />,
      cell: ({ row }) => (
        <div className="text-right font-mono text-sm">
          {row.getValue('formattedBasePrice')}
        </div>
      ),
    },
    {
      accessorKey: 'marginPercent',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Margin" />,
      cell: ({ row }) => {
        const marginPercent = row.getValue('marginPercent') as number;
        const colorClass = marginPercent >= 20
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
          : marginPercent >= 10
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
            : 'bg-red-100 text-red-700 hover:bg-red-100';
        return (
          <div className="text-right">
            <Badge
              variant="outline"
              className={`font-mono border-0 ${colorClass}`}
            >
              {marginPercent.toFixed(1)}%
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.getValue('status') as string;
        const statusColors: Record<string, string> = {
          active: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
          inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
          discontinued: 'bg-red-100 text-red-700 hover:bg-red-100',
        };
        return (
          <Badge variant="outline" className={`border-0 ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'isSellable',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sellable" />,
      cell: ({ row }) => {
        const isSellable = row.getValue('isSellable') as boolean;
        return (
          <Badge
            variant="outline"
            className={`border-0 ${isSellable ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}`}
          >
            {isSellable ? 'Yes' : 'No'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const actions = [];

        if (options.onView) {
          actions.push({
            label: 'View',
            onClick: () => options.onView?.(row.original),
          });
        }

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

        // Stop propagation so the menu does not also open the row drawer
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions
              actions={actions}
              separatorAfter={options.onDelete && actions.length > 1 ? [actions.length - 2] : undefined}
            />
          </div>
        );
      },
    },
  ];
}
