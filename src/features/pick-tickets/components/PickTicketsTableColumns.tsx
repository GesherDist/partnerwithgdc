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
import { MoreHorizontal, Eye, Pencil, Trash2, UserPlus, Play, FileText } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { PickTicketListItem } from '../types';
import {
  PICK_TICKET_STATUS_COLORS,
  PICK_TICKET_STATUS_LABELS,
  PICK_TICKET_PRIORITY_COLORS,
  PICK_TICKET_PRIORITY_LABELS,
} from '../types';

interface ColumnsOptions {
  onView?: (pickTicket: PickTicketListItem) => void;
  onEdit?: (pickTicket: PickTicketListItem) => void;
  onDelete?: (pickTicket: PickTicketListItem) => void;
  onAssign?: (pickTicket: PickTicketListItem) => void;
  onStartPicking?: (pickTicket: PickTicketListItem) => void;
}

export function PickTicketsTableColumns(options: ColumnsOptions = {}): ColumnDef<PickTicketListItem>[] {
  const { onView, onEdit, onDelete, onAssign, onStartPicking } = options;

  return [
    {
      accessorKey: 'pickTicketNumber',
      header: 'Pick Ticket #',
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">
          {row.original.pickTicketNumber}
        </span>
      ),
    },
    {
      accessorKey: 'salesOrderNumber',
      header: 'Sales Order',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.salesOrderNumber}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <span className="text-sm truncate max-w-[180px]" title={row.original.customerName}>
          {row.original.customerName}
        </span>
      ),
    },
    {
      accessorKey: 'warehouseName',
      header: 'Warehouse',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.warehouseName}</span>
      ),
    },
    {
      accessorKey: 'assignedUserName',
      header: 'Assigned To',
      cell: ({ row }) => {
        const displayName = row.original.assignedContactName || row.original.assignedUserName;
        return (
          <span className="text-sm">
            {displayName || (
              <span className="text-muted-foreground italic">Unassigned</span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const priority = row.original.priority;
        return (
          <Badge
            variant="outline"
            className={cn('text-xs font-medium', PICK_TICKET_PRIORITY_COLORS[priority])}
          >
            {PICK_TICKET_PRIORITY_LABELS[priority]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'progress',
      header: 'Progress',
      cell: ({ row }) => {
        const total = row.original.totalQuantity;
        const picked = row.original.pickedQuantity;
        const percentage = total > 0 ? Math.round((picked / total) * 100) : 0;

        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {picked}/{total}
            </span>
          </div>
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
            className={cn('text-xs font-medium', PICK_TICKET_STATUS_COLORS[status])}
          >
            {PICK_TICKET_STATUS_LABELS[status]}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const pickTicket = row.original;
        // Allow editing for all statuses except cancelled (per Ankur/Jenny feedback Aug 26)
        const canEdit = pickTicket.status !== 'cancelled';
        // Allow assign/reassign for pending and assigned statuses
        const canAssign = ['pending', 'assigned'].includes(pickTicket.status);
        const isReassign = pickTicket.status === 'assigned';
        const canStartPicking = pickTicket.status === 'assigned';
        const canDelete = ['pending', 'cancelled'].includes(pickTicket.status);

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
                <DropdownMenuItem onClick={() => onView(pickTicket)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
              )}
              {onEdit && canEdit && (
                <DropdownMenuItem onClick={() => onEdit(pickTicket)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => window.open(`/api/pick-tickets/${pickTicket.id}/pdf`, '_blank')}
              >
                <FileText className="mr-2 h-4 w-4" />
                View PDF
              </DropdownMenuItem>
              {onAssign && canAssign && (
                <DropdownMenuItem onClick={() => onAssign(pickTicket)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isReassign ? 'Reassign' : 'Assign'}
                </DropdownMenuItem>
              )}
              {onStartPicking && canStartPicking && (
                <DropdownMenuItem onClick={() => onStartPicking(pickTicket)}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Picking
                </DropdownMenuItem>
              )}
              {onDelete && canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(pickTicket)}
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
