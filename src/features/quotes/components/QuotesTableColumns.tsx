'use client';

/**
 * Quotes Table Columns
 *
 * Column definitions for the quotes data table.
 */

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { DataTableColumnHeader } from '@/shared/components/data-table/DataTableColumnHeader';
import { DataTableRowActions, createCommonRowActions } from '@/shared/components/data-table/DataTableRowActions';

import type { QuoteListItem } from '../types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../types';

// ============================================
// TYPES
// ============================================

interface ColumnOptions {
  onView?: (quote: QuoteListItem) => void;
  onEdit?: (quote: QuoteListItem) => void;
  onDelete?: (quote: QuoteListItem) => void;
  onConvert?: (quote: QuoteListItem) => void;
  onSubmitForApproval?: (quote: QuoteListItem) => void;
  onApprove?: (quote: QuoteListItem) => void;
  onReject?: (quote: QuoteListItem) => void;
  isSuperAdmin?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format date string for display
 */
function formatDate(dateString: string | Date | null): string {
  if (!dateString) {return '-';}
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format amount from cents to currency display
 */
function formatAmount(cents: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(cents / 100);
}

// ============================================
// COLUMN DEFINITIONS
// ============================================

export function getQuotesTableColumns(
  options: ColumnOptions = {}
): ColumnDef<QuoteListItem>[] {
  return [
    // Select Checkbox
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
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },

    // Quote Number
    {
      accessorKey: 'quoteNumber',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Quote No" />
      ),
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">
          {row.getValue('quoteNumber')}
        </div>
      ),
    },

    // Customer
    {
      accessorKey: 'customerName',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Customer" />
      ),
      cell: ({ row }) => (
        <div className="max-w-[250px] truncate font-medium">
          {row.getValue('customerName')}
        </div>
      ),
    },

    // Quote Date
    {
      accessorKey: 'quoteDate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Quote Date" />
      ),
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDate(row.getValue('quoteDate'))}
        </div>
      ),
    },

    // Valid Until
    {
      accessorKey: 'validUntil',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Valid Until" />
      ),
      cell: ({ row }) => {
        const validUntil = row.getValue('validUntil') as string | null;
        return (
          <div className="text-sm">
            {validUntil ? formatDate(validUntil) : '-'}
          </div>
        );
      },
    },

    // Status
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status') as keyof typeof QUOTE_STATUS_LABELS;
        return (
          <Badge className={QUOTE_STATUS_COLORS[status]}>
            {QUOTE_STATUS_LABELS[status]}
          </Badge>
        );
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id));
      },
    },

    // Item Count
    {
      accessorKey: 'itemCount',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Items" />
      ),
      cell: ({ row }) => {
        const itemCount = row.getValue('itemCount') as number;
        return (
          <div className="text-center text-sm">
            {itemCount}
          </div>
        );
      },
    },

    // Total
    {
      accessorKey: 'grandTotal',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Total" />
      ),
      cell: ({ row }) => {
        const total = row.getValue('grandTotal') as number;
        const currencyCode = row.original.currencyCode || 'USD';
        return (
          <div className="text-right font-mono text-sm font-medium">
            {formatAmount(total, currencyCode)}
          </div>
        );
      },
    },

    // Actions
    {
      id: 'actions',
      cell: ({ row }) => {
        const quote = row.original;
        // ONLY Super Admin can convert (from any status)
        const canConvert = options.isSuperAdmin === true;
        const canEdit = quote.status === 'draft';
        const canDelete = quote.status === 'draft';
        const canSubmitForApproval = quote.status === 'draft';
        const canApproveReject = quote.status === 'pending_approval';

        const { actions, separatorAfter } = createCommonRowActions({
          onView: options.onView ? () => options.onView?.(quote) : undefined,
          onEdit: canEdit && options.onEdit ? () => options.onEdit?.(quote) : undefined,
          onDelete: canDelete && options.onDelete ? () => options.onDelete?.(quote) : undefined,
        });

        // Add workflow actions before delete (if present)
        const deleteIndex = actions.findIndex(a => a.label === 'Delete');
        let insertIndex = deleteIndex >= 0 ? deleteIndex : actions.length;

        // Add submit for approval action
        if (canSubmitForApproval && options.onSubmitForApproval) {
          actions.splice(insertIndex, 0, {
            label: 'Submit for Approval',
            onClick: () => options.onSubmitForApproval?.(quote),
          });
          insertIndex++;
        }

        // Add approve/reject actions
        if (canApproveReject && options.onApprove) {
          actions.splice(insertIndex, 0, {
            label: 'Approve',
            onClick: () => options.onApprove?.(quote),
          });
          insertIndex++;
        }

        if (canApproveReject && options.onReject) {
          actions.splice(insertIndex, 0, {
            label: 'Reject',
            onClick: () => options.onReject?.(quote),
          });
          insertIndex++;
        }

        // Add convert action
        if (canConvert && options.onConvert) {
          const isBypassingApproval = options.isSuperAdmin && quote.status !== 'approved';
          actions.splice(insertIndex, 0, {
            label: isBypassingApproval ? 'Convert to Order ⚡' : 'Convert to Order',
            onClick: () => options.onConvert?.(quote),
          });
        }

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={actions} separatorAfter={separatorAfter} />
          </div>
        );
      },
    },
  ];
}
