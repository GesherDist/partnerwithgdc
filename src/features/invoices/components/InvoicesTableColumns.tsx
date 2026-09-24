'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Pencil, Trash2, CreditCard } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { InvoiceListItem } from '../types';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS } from '../types';

interface ColumnsOptions {
  onView?: (invoice: InvoiceListItem) => void;
  onEdit?: (invoice: InvoiceListItem) => void;
  onDelete?: (invoice: InvoiceListItem) => void;
  onRecordPayment?: (invoice: InvoiceListItem) => void;
}

export function InvoicesTableColumns(options: ColumnsOptions = {}): ColumnDef<InvoiceListItem>[] {
  const { onView, onEdit, onDelete, onRecordPayment } = options;

  return [
    {
      accessorKey: 'invoiceNumber',
      header: 'Invoice #',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.invoiceNumber}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.customerName}</span>
      ),
    },
    {
      accessorKey: 'invoiceDate',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.invoiceDate).toLocaleDateString()}
        </span>
      ),
    },
    {
      accessorKey: 'dueDate',
      header: 'Due',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.dueDate
            ? new Date(row.original.dueDate).toLocaleDateString()
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
      accessorKey: 'balanceDue',
      header: 'Balance',
      cell: ({ row }) => {
        const balance = row.original.balanceDue;
        return (
          <span className={cn('font-medium', balance > 0 ? 'text-amber-600' : 'text-emerald-600')}>
            ${(balance / 100).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <Badge
            variant="outline"
            className={cn('text-xs font-medium', INVOICE_STATUS_COLORS[status])}
          >
            {INVOICE_STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const invoice = row.original;
        const canRecordPayment = ['sent', 'partial', 'overdue'].includes(invoice.status);

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
                <DropdownMenuItem onClick={() => onView(invoice)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
              )}
              {onEdit && ['draft', 'sent'].includes(invoice.status) && (
                <DropdownMenuItem onClick={() => onEdit(invoice)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              {onRecordPayment && canRecordPayment && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onRecordPayment(invoice)}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Record Payment
                  </DropdownMenuItem>
                </>
              )}
              {onDelete && invoice.status === 'draft' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(invoice)}
                    className="text-red-600"
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
