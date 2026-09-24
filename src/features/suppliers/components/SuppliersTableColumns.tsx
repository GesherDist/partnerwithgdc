'use client';

/**
 * Suppliers Table Columns
 *
 * Column definitions for the suppliers data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Badge } from '@/shared/components/ui/badge';
import { cn, formatDate } from '@/shared/lib/utils';
import type { Supplier, SupplierStatus } from '../types';

// ============================================
// HELPERS
// ============================================

function getStatusBadge(status: SupplierStatus) {
  const configs: Record<SupplierStatus, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  const config = configs[status];

  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

// ============================================
// COLUMNS
// ============================================

interface GetColumnsOptions {
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

export function getSuppliersTableColumns({
  onEdit,
  onDelete,
}: GetColumnsOptions): ColumnDef<Supplier>[] {
  return [
    {
      accessorKey: 'supplierCode',
      header: 'Supplier Code',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.supplierCode}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.name}</p>
          {row.original.legalName && (
            <p className="text-sm text-muted-foreground">{row.original.legalName}</p>
          )}
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.primaryContactName && <p>{row.original.primaryContactName}</p>}
          {row.original.primaryContactEmail && (
            <p className="text-muted-foreground">{row.original.primaryContactEmail}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => getStatusBadge(row.original.status),
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const supplier = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(supplier)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <>
                  {onEdit && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    className="text-red-600"
                    onClick={() => onDelete(supplier)}
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
