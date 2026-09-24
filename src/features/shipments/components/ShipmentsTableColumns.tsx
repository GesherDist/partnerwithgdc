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
import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ShipmentListItem } from '../types';
import { SHIPMENT_STATUS_COLORS, SHIPMENT_STATUS_LABELS } from '../types';

interface ColumnsOptions {
  onView?: (shipment: ShipmentListItem) => void;
  onEdit?: (shipment: ShipmentListItem) => void;
  onDelete?: (shipment: ShipmentListItem) => void;
}

export function ShipmentsTableColumns(options: ColumnsOptions = {}): ColumnDef<ShipmentListItem>[] {
  const { onView, onEdit, onDelete } = options;

  return [
    {
      accessorKey: 'shipmentNumber',
      header: 'Shipment #',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.shipmentNumber}
        </span>
      ),
    },
    {
      accessorKey: 'shipmentDate',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.shipmentDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: 'carrier',
      header: 'Carrier',
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
      header: 'Order',
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
          {row.original.customerName || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant="outline"
            className={cn('text-xs font-medium', SHIPMENT_STATUS_COLORS[status])}
          >
            {SHIPMENT_STATUS_LABELS[status]}
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
