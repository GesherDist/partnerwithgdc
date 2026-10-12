'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ShipmentListItem, ShipmentSortColumn, ShipmentSortDirection } from '../types';
import { LOAD_STATUS_COLORS, LOAD_STATUS_LABELS } from '../types';

interface ColumnsOptions {
  onView?: (shipment: ShipmentListItem) => void;
  onEdit?: (shipment: ShipmentListItem) => void;
  onDelete?: (shipment: ShipmentListItem) => void;
  onEditStatus?: (shipment: ShipmentListItem) => void;
  // Sorting options
  sortColumn?: ShipmentSortColumn | null;
  sortDirection?: ShipmentSortDirection;
  onSortChange?: (column: ShipmentSortColumn) => void;
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
  column: ShipmentSortColumn;
  currentColumn: ShipmentSortColumn | null | undefined;
  currentDirection: ShipmentSortDirection | undefined;
  onSort?: (column: ShipmentSortColumn) => void;
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

export function ShipmentsTableColumns(options: ColumnsOptions = {}): ColumnDef<ShipmentListItem>[] {
  const { onView, onEdit, onDelete, onEditStatus, sortColumn, sortDirection, onSortChange } = options;

  return [
    {
      accessorKey: 'shipmentNumber',
      header: () => (
        <SortableHeader
          label="Shipment #"
          column="shipmentNumber"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
      ),
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.shipmentNumber}
        </span>
      ),
    },
    {
      accessorKey: 'shipmentDate',
      header: () => (
        <SortableHeader
          label="Date"
          column="shipmentDate"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
      ),
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.shipmentDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: 'carrier',
      header: () => (
        <SortableHeader
          label="Carrier"
          column="carrier"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
      ),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.carrier || '-'}</span>
      ),
    },
    {
      accessorKey: 'trackingNumber',
      header: 'Tracking',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.trackingNumber || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'salesOrderNumber',
      header: 'PO#',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.salesOrderNumber || row.original.purchaseOrderNumber || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <span className="text-sm font-medium">
          {row.original.customerName || row.original.warehouseName || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'loadStatus',
      header: () => (
        <SortableHeader
          label="Status"
          column="loadStatus"
          currentColumn={sortColumn}
          currentDirection={sortDirection}
          onSort={onSortChange}
        />
      ),
      cell: ({ row }) => {
        const loadStatus = row.original.loadStatus;
        return (
          <Badge
            variant="outline"
            className={cn('text-xs font-medium', LOAD_STATUS_COLORS[loadStatus])}
          >
            {LOAD_STATUS_LABELS[loadStatus]}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const shipment = row.original;

        return (
          <DropdownMenu>
            {/* Stop the click here: the row itself opens the view drawer, so
                without this a menu action fires alongside it. */}
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {onView && (
                <DropdownMenuItem onClick={() => onView(shipment)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(shipment)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onEditStatus && (
                <DropdownMenuItem onClick={() => onEditStatus(shipment)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Edit Status
                </DropdownMenuItem>
              )}
              {onDelete && shipment.status === 'pending' && (
                <DropdownMenuItem
                  onClick={() => onDelete(shipment)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
