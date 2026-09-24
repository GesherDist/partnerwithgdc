'use client';

/**
 * LeadsTable Component
 *
 * Data table for displaying the list of leads.
 * Uses the shared DataTable component with custom columns.
 */

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  MoreHorizontal,
  Eye,
  Handshake,
  Trash2,
  ExternalLink,
} from 'lucide-react';

import { DataTable } from '@/shared/components/data-table';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

import { deleteLead } from '../actions';
import { getPipedriveCompanyDomain } from '@/features/pipedrive/actions';
import type { LeadListItem, LeadStatus, LeadsTableProps } from '../types';

// ============================================
// HELPERS
// ============================================

const statusConfig: Record<LeadStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  new: { label: 'New', variant: 'default' },
  contacted: { label: 'Contacted', variant: 'secondary' },
  qualified: { label: 'Qualified', variant: 'default' },
  proposal: { label: 'Proposal', variant: 'default' },
  negotiation: { label: 'Negotiation', variant: 'secondary' },
  deal: { label: 'Deal', variant: 'default' },
  converted: { label: 'Customer', variant: 'default' },
  lost: { label: 'Lost', variant: 'destructive' },
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================
// COMPONENT
// ============================================

export function LeadsTable({
  data,
  isLoading = false,
  onRowClick,
  onConvert,
  onDelete,
  toolbarContent,
  pagination,
}: LeadsTableProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [leadToDelete, setLeadToDelete] = useState<LeadListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pipedriveCompanyDomain, setPipedriveCompanyDomain] = useState<string | null>(null);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Fetch Pipedrive company domain on mount
  useEffect(() => {
    const fetchPipedriveDomain = async () => {
      const result = await getPipedriveCompanyDomain();
      if (result.success && result.data?.companyDomain) {
        setPipedriveCompanyDomain(result.data.companyDomain);
      }
    };
    fetchPipedriveDomain();
  }, []);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleView = (lead: LeadListItem) => {
    onRowClick?.(lead);
  };

  const handleConvert = (lead: LeadListItem) => {
    onConvert?.(lead);
  };

  const handleViewInPipedrive = (lead: LeadListItem) => {
    if (!pipedriveCompanyDomain) {
      toast.error('Unable to open Pipedrive');
      return;
    }

    // Build the Pipedrive URL based on which ID we have
    let pipedriveUrl: string;

    if (lead.pipedriveLeadId) {
      // Lead from Leads Inbox - use leads/inbox URL
      pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/leads/inbox/${lead.pipedriveLeadId}`;
    } else if (lead.pipedrivePersonId) {
      // Lead from Persons - use person URL
      pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/person/${lead.pipedrivePersonId}`;
    } else if (lead.pipedriveDealId) {
      // Lead from Deals - use deal URL
      pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/deal/${lead.pipedriveDealId}`;
    } else {
      toast.error('No Pipedrive link available');
      return;
    }

    // Open in new tab
    window.open(pipedriveUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteClick = (lead: LeadListItem) => {
    setLeadToDelete(lead);
  };

  const handleDeleteConfirm = async () => {
    if (!leadToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteLead(leadToDelete.id);

      if (result.success) {
        toast.success(`Lead "${leadToDelete.name}" deleted successfully`);
        onDelete?.(leadToDelete);
      } else {
        toast.error(result.error || 'Failed to delete lead');
      }
    } catch (error) {
      console.error('Delete lead error:', error);
      toast.error('Failed to delete lead');
    } finally {
      setIsDeleting(false);
      setLeadToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setLeadToDelete(null);
  };

  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo<ColumnDef<LeadListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.email && (
              <span className="text-sm text-muted-foreground">
                {row.original.email}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'pipedriveLabels',
        header: 'Labels',
        cell: ({ row }) => {
          const labels = row.original.pipedriveLabels;
          if (!labels || labels.length === 0) return '-';
          return (
            <div className="flex flex-wrap gap-1">
              {labels.map((label, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className={
                    label.toLowerCase() === 'hot'
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : label.toLowerCase() === 'warm'
                      ? 'bg-orange-100 text-orange-800 border-orange-200'
                      : label.toLowerCase() === 'cold'
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  }
                >
                  {label}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: 'company',
        header: 'Company',
        cell: ({ row }) => row.original.company || '-',
      },
      {
        accessorKey: 'dealValue',
        header: 'Deal Value',
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(row.original.dealValue)}
          </span>
        ),
      },
      {
        accessorKey: 'dealStage',
        header: 'Stage',
        cell: ({ row }) => row.original.dealStage || '-',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          const config = statusConfig[status] || { label: status, variant: 'outline' as const };
          return (
            <Badge variant={config.variant}>
              {config.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'expectedCloseDate',
        header: 'Expected Close',
        cell: ({ row }) => formatDate(row.original.expectedCloseDate),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const lead = row.original;
          const isConvertedOrDeal = lead.status === 'converted' || lead.status === 'deal';
          const hasPipedrive = !!(lead.pipedriveLeadId || lead.pipedrivePersonId || lead.pipedriveDealId);

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(lead); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {!isConvertedOrDeal && onConvert && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleConvert(lead); }}>
                    <Handshake className="mr-2 h-4 w-4" />
                    Convert to Deal
                  </DropdownMenuItem>
                )}
                {hasPipedrive && pipedriveCompanyDomain && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewInPipedrive(lead); }}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Pipedrive
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(lead); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onConvert, pipedriveCompanyDomain]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading || isDeleting}
        enableRowSelection
        enableColumnVisibility
        enableGlobalFilter
        filterPlaceholder="Search leads..."
        searchableColumns={['name', 'email', 'company', 'phone']}
        showPagination
        pageSizeOptions={[10, 20, 50, 100]}
        defaultPageSize={pagination?.pageSize || 10}
        // Server-side pagination props
        manualPagination={!!pagination}
        pageCount={pagination?.totalPages}
        pageIndex={pagination ? pagination.page - 1 : 0}
        pageSize={pagination?.pageSize || 10}
        onPaginationChange={
          pagination
            ? (updater: any) => {
                // Get current state from table
                const currentState = {
                  pageIndex: pagination.page - 1,
                  pageSize: pagination.pageSize,
                };

                // Calculate new state
                const newState = typeof updater === 'function'
                  ? updater(currentState)
                  : updater;

                // Only call callbacks if values actually changed
                if (newState.pageIndex !== currentState.pageIndex) {
                  pagination.onPageChange(newState.pageIndex + 1);
                }
                if (newState.pageSize !== currentState.pageSize) {
                  pagination.onPageSizeChange(newState.pageSize);
                }
              }
            : undefined
        }
        rowCount={pagination?.total}
        onRowClick={onRowClick}
        getRowId={(row) => row.id}
        toolbarContent={toolbarContent}
        emptyState={
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground">No leads found.</p>
            <p className="text-sm text-muted-foreground">
              Sync from Pipedrive or add leads manually.
            </p>
          </div>
        }
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!leadToDelete}
        onOpenChange={() => !isDeleting && handleDeleteCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete lead &quot;{leadToDelete?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
