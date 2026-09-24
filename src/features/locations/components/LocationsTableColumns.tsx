'use client';

/**
 * Locations Table Columns
 *
 * Column definitions for the locations data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions } from '@/shared/components/data-table/DataTableRowActions';
import type { LocationTableRow } from '../types';

interface ColumnOptions {
  onEdit?: (location: LocationTableRow) => void;
  onDelete?: (location: LocationTableRow) => void;
  onView?: (location: LocationTableRow) => void;
}

export function getLocationsTableColumns(options: ColumnOptions = {}): ColumnDef<LocationTableRow>[] {
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
      accessorKey: 'locationCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">{row.getValue('locationCode')}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        const isDefault = row.original.isDefault;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.getValue('name')}</span>
            {isDefault && (
              <Badge variant="outline" className="text-xs">
                Default
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'locationType',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => {
        const type = row.getValue('locationType') as string;
        const typeLabels: Record<string, string> = {
          warehouse: 'Warehouse',
          drop_ship: 'Direct',
          virtual: 'Virtual',
        };
        const typeColors: Record<string, string> = {
          warehouse: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
          drop_ship: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
          virtual: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
        };
        return (
          <Badge variant="outline" className={`border-0 ${typeColors[type] || 'bg-gray-100 text-gray-700'}`}>
            {typeLabels[type] || type}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: 'city',
      header: ({ column }) => <DataTableColumnHeader column={column} title="City" />,
      cell: ({ row }) => {
        const city = row.getValue('city') as string | null;
        const state = row.original.state;
        if (!city && !state) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <span>
            {city}
            {city && state && ', '}
            {state}
          </span>
        );
      },
    },
    {
      accessorKey: 'contactName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
      cell: ({ row }) => {
        const name = row.getValue('contactName') as string | null;
        const phone = row.original.contactPhone;
        if (!name) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div>
            <div>{name}</div>
            {phone && <div className="text-xs text-muted-foreground">{phone}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: 'isActive',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const isActive = row.getValue('isActive') as boolean;
        return (
          <Badge
            variant="outline"
            className={`border-0 ${isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}`}
          >
            {isActive ? 'Active' : 'Inactive'}
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
