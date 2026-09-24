'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { AlertTriangle, Eye } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { MasterInventoryItem } from '../types';
import { INVENTORY_SOURCE_LABELS, INVENTORY_SOURCE_COLORS } from '../types';

interface MasterInventoryTableColumnsProps {
  onView?: (item: MasterInventoryItem) => void;
}

export function getMasterInventoryTableColumns(
  props?: MasterInventoryTableColumnsProps
): ColumnDef<MasterInventoryItem>[] {
  const { onView } = props || {};

  return [
    {
      accessorKey: 'sourceType',
      header: 'Source',
      cell: ({ row }) => {
        const source = row.original.sourceType;
        return (
          <Badge variant="outline" className={INVENTORY_SOURCE_COLORS[source]}>
            {INVENTORY_SOURCE_LABELS[source]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'productSku',
      header: 'SKU',
      cell: ({ row }) => (
        <div className="font-medium">{row.original.productSku}</div>
      ),
    },
    {
      accessorKey: 'productName',
      header: 'Product',
      cell: ({ row }) => (
        <div className="max-w-xs truncate" title={row.original.productName}>
          {row.original.productName}
        </div>
      ),
    },
    {
      accessorKey: 'locationName',
      header: 'Location',
      cell: ({ row }) => {
        const item = row.original;
        const locationLabel = item.sourceType === 'platinum_dealer' && item.dealerName
          ? `${item.dealerName} - ${item.locationName}`
          : item.locationName;

        const locationDetails = [item.locationCity, item.locationState]
          .filter(Boolean)
          .join(', ');

        return (
          <div>
            <div className="font-medium">{locationLabel}</div>
            {locationDetails && (
              <div className="text-xs text-muted-foreground">{locationDetails}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'onHand',
      header: 'On Hand',
      cell: ({ row }) => (
        <div className="text-right font-medium text-emerald-600">
          {row.original.onHand.toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: 'allocated',
      header: 'Allocated',
      cell: ({ row }) => (
        <div className="text-right font-medium text-amber-600">
          {row.original.allocated.toLocaleString()}
        </div>
      ),
    },
    {
      accessorKey: 'available',
      header: 'Available',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-2">
            <span className="text-right font-medium text-sky-600">
              {item.available.toLocaleString()}
            </span>
            {item.isLowStock && (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView?.(row.original)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      ),
    },
  ];
}
