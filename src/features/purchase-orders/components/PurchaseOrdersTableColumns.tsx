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
import type { POListItem } from '../types';

interface ColumnsOptions {
  onView?: (po: POListItem) => void;
  onEdit?: (po: POListItem) => void;
  onDelete?: (po: POListItem) => void;
}

export function PurchaseOrdersTableColumns(options: ColumnsOptions = {}): ColumnDef<POListItem>[] {
  const { onView, onEdit, onDelete } = options;

  return [
    {
      accessorKey: 'poNumber',
      header: 'PO Number',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.poNumber}
        </span>
      ),
    },
    {
      accessorKey: 'salesOrderNumber',
      header: 'Sales Order',
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.salesOrderNumber || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer/Warehouse',
      cell: ({ row }) => {
        const displayValue = row.original.customerName || row.original.warehouseLocationName || '-';
        return (
          <span className="text-sm font-medium">
            {displayValue}
          </span>
        );
      },
    },
    {
      accessorKey: 'suppliers',
      header: 'Suppliers',
      cell: ({ row }) => {
        const suppliers = row.original.suppliers;
        if (!suppliers || suppliers.length === 0) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <div>
            <p className="font-medium">{suppliers[0]}</p>
            {suppliers.length > 1 && (
              <p className="text-xs text-muted-foreground">
                +{suppliers.length - 1} more
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'latestShipmentStatus',
      header: 'Shipment Status',
      cell: ({ row }) => {
        const shipmentStatus = row.original.latestShipmentStatus;
        const shipmentNumber = row.original.latestShipmentNumber;
        const totalShipments = row.original.totalShipments || 0;

        if (!shipmentStatus || totalShipments === 0) {
          return <span className="text-xs text-muted-foreground">No shipment</span>;
        }

        const SHIPMENT_STATUS_COLORS = {
          pending: 'bg-gray-100 text-gray-700 border-gray-200',
          in_transit: 'bg-blue-100 text-blue-800 border-blue-200',
          delivered: 'bg-green-100 text-green-800 border-green-200',
          failed: 'bg-red-100 text-red-800 border-red-200',
        };

        const SHIPMENT_STATUS_LABELS = {
          pending: 'Pending',
          in_transit: 'In Transit',
          delivered: 'Delivered',
          failed: 'Failed',
        };

        return (
          <div className="flex flex-col gap-1">
            <Badge
              variant="outline"
              className={cn('text-xs w-fit', SHIPMENT_STATUS_COLORS[shipmentStatus])}
            >
              {SHIPMENT_STATUS_LABELS[shipmentStatus]}
            </Badge>
            {shipmentNumber && (
              <span className="text-xs text-muted-foreground font-mono">
                {shipmentNumber}
                {totalShipments > 1 && ` (+${totalShipments - 1} more)`}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'orderSeries',
      header: 'Order Series',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.orderSeries || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'poDate',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.poDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: 'expectedDeliveryDate',
      header: 'Expected Delivery',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.expectedDeliveryDate
            ? new Date(row.original.expectedDeliveryDate).toLocaleDateString()
            : '-'}
        </span>
      ),
    },
    {
      accessorKey: 'grandTotal',
      header: 'Total',
      cell: ({ row }) => (
        <span className="font-medium">
          ${(row.original.grandTotal / 100).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const po = row.original;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {onView && (
                  <DropdownMenuItem onClick={() => onView(po)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                {onEdit && ['draft', 'sent'].includes(po.status) && (
                  <DropdownMenuItem onClick={() => onEdit(po)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && po.status === 'draft' && (
                  <DropdownMenuItem
                    onClick={() => onDelete(po)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
