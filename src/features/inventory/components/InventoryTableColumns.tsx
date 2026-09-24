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
import { MoreHorizontal, Eye, Pencil, ArrowUpDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { InventoryListItem } from '../types';

interface ColumnsOptions {
  onView?: (item: InventoryListItem) => void;
  onEdit?: (item: InventoryListItem) => void;
  onAdjust?: (item: InventoryListItem) => void;
}

export function InventoryTableColumns(options: ColumnsOptions = {}): ColumnDef<InventoryListItem>[] {
  const { onView, onEdit, onAdjust } = options;

  return [
    {
      accessorKey: 'productSku',
      header: 'SKU',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.productSku}
        </span>
      ),
    },
    {
      accessorKey: 'productName',
      header: 'Product',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.productName}</span>
      ),
    },
    {
      accessorKey: 'locationName',
      header: 'Location',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.locationName}</p>
          <p className="text-xs text-muted-foreground">{row.original.locationCode}</p>
        </div>
      ),
    },
    {
      accessorKey: 'onHand',
      header: 'On Hand',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.onHand}</span>
      ),
    },
    {
      accessorKey: 'allocated',
      header: 'Allocated',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.allocated}</span>
      ),
    },
    {
      accessorKey: 'available',
      header: 'Available',
      cell: ({ row }) => {
        const available = row.original.available;
        const isLowStock = row.original.isLowStock;
        return (
          <span className={cn(
            'text-sm font-medium',
            isLowStock ? 'text-amber-600' : 'text-emerald-600'
          )}>
            {available}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const isLowStock = row.original.isLowStock;
        return (
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-medium',
              isLowStock
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-emerald-100 text-emerald-800 border-emerald-200'
            )}
          >
            {isLowStock ? 'Low Stock' : 'In Stock'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const item = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {onView && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(item); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onAdjust && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAdjust(item); }}>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Adjust
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}
