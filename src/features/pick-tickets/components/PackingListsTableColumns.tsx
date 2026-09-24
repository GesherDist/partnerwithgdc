'use client';

/**
 * Packing Lists Table Columns
 *
 * Column definitions for the packing lists data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Eye, Trash2, Package, CheckCircle, FileText, Truck, Calendar, Barcode } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import type { PackingListListItem } from '../types';
import { PACKING_LIST_STATUS_LABELS, PACKING_LIST_STATUS_COLORS } from '../types';

interface PackingListsTableColumnsProps {
  onView?: (packingList: PackingListListItem) => void;
  onDelete?: (packingList: PackingListListItem) => void;
  onMarkAsPacked?: (packingList: PackingListListItem) => void;
}

export function getPackingListsTableColumns({
  onView,
  onDelete,
  onMarkAsPacked,
}: PackingListsTableColumnsProps = {}): ColumnDef<PackingListListItem>[] {
  return [
    {
      accessorKey: 'packingListNumber',
      header: 'Packing List #',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.packingListNumber}
        </span>
      ),
    },
    {
      accessorKey: 'pickTicketNumber',
      header: 'Pick Ticket #',
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {row.original.pickTicketNumber}
        </span>
      ),
    },
    {
      accessorKey: 'salesOrderNumber',
      header: 'Sales Order',
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.salesOrderNumber}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.customerName}</span>
      ),
    },
    {
      accessorKey: 'totalPackages',
      header: 'Packages',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{row.original.totalPackages}</span>
        </div>
      ),
    },
    {
      accessorKey: 'totalWeight',
      header: 'Weight',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.totalWeight ? `${row.original.totalWeight} lbs` : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'trackingNumber',
      header: 'Tracking #',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.trackingNumber ? (
            <>
              <Barcode className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">
                {row.original.trackingNumber}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'carrier',
      header: 'Carrier',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.carrier ? (
            <>
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{row.original.carrier}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge className={PACKING_LIST_STATUS_COLORS[status]}>
            {PACKING_LIST_STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'shippedDate',
      header: 'Shipped',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.shippedDate ? (
            <>
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {new Date(row.original.shippedDate).toLocaleDateString()}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'deliveredDate',
      header: 'Delivered',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.deliveredDate ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                {new Date(row.original.deliveredDate).toLocaleDateString()}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const packingList = row.original;
        const canDelete = packingList.status === 'draft';
        const canMarkAsPacked = packingList.status === 'draft';

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onView && (
                <DropdownMenuItem onClick={() => onView(packingList)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() =>
                  window.open(`/api/packing-lists/${packingList.id}/pdf`, '_blank')
                }
              >
                <FileText className="mr-2 h-4 w-4" />
                View PDF
              </DropdownMenuItem>
              {onMarkAsPacked && canMarkAsPacked && (
                <DropdownMenuItem onClick={() => onMarkAsPacked(packingList)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark as Packed
                </DropdownMenuItem>
              )}
              {onDelete && canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(packingList)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
