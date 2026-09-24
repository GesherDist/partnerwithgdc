'use client';

/**
 * DealsTable Component
 *
 * Data table for displaying the list of deals.
 * Uses the shared DataTable component with custom columns.
 */

import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ColumnDef } from '@tanstack/react-table';
import {
  MoreHorizontal,
  Eye,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  RotateCcw,
  UserPlus,
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

import { deleteDeal, markDealAsWon, markDealAsLost, reopenDeal, getDeal } from '../actions';
import { getPipedriveCompanyDomain } from '@/features/pipedrive/actions';
import type { DealListItem, DealStatus, Deal, DealsTableProps } from '../types';
import { ConvertDealToCustomerDialog } from './ConvertDealToCustomerDialog';

// ============================================
// HELPERS
// ============================================

const statusConfig: Record<DealStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Open', variant: 'default' },
  won: { label: 'Won', variant: 'default' },
  lost: { label: 'Lost', variant: 'destructive' },
};

const statusColors: Record<DealStatus, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  won: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  lost: 'bg-red-100 text-red-800 border-red-200',
};

function formatCurrency(value: number | null | undefined, currency?: string): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
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

export function DealsTable({
  data,
  isLoading = false,
  onRowClick,
  onDelete,
  onRefresh,
  toolbarContent,
  pagination,
}: DealsTableProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [dealToDelete, setDealToDelete] = useState<DealListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pipedriveCompanyDomain, setPipedriveCompanyDomain] = useState<string | null>(null);
  const [dealToConvert, setDealToConvert] = useState<Deal | null>(null);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

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

  const handleView = (deal: DealListItem) => {
    onRowClick?.(deal);
  };

  const handleViewInPipedrive = (deal: DealListItem) => {
    if (!pipedriveCompanyDomain || !deal.pipedriveDealId) {
      toast.error('Unable to open Pipedrive');
      return;
    }

    const pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/deal/${deal.pipedriveDealId}`;
    window.open(pipedriveUrl, '_blank', 'noopener,noreferrer');
  };

  const handleMarkAsWon = async (deal: DealListItem) => {
    setIsUpdating(true);
    try {
      const result = await markDealAsWon(deal.id);
      if (result.success) {
        toast.success(`Deal "${deal.title}" marked as won!`);
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to update deal');
      }
    } catch (error) {
      console.error('Mark as won error:', error);
      toast.error('Failed to update deal');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsLost = async (deal: DealListItem) => {
    setIsUpdating(true);
    try {
      const result = await markDealAsLost(deal.id);
      if (result.success) {
        toast.success(`Deal "${deal.title}" marked as lost`);
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to update deal');
      }
    } catch (error) {
      console.error('Mark as lost error:', error);
      toast.error('Failed to update deal');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReopen = async (deal: DealListItem) => {
    setIsUpdating(true);
    try {
      const result = await reopenDeal(deal.id);
      if (result.success) {
        toast.success(`Deal "${deal.title}" reopened`);
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to reopen deal');
      }
    } catch (error) {
      console.error('Reopen deal error:', error);
      toast.error('Failed to reopen deal');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = (deal: DealListItem) => {
    setDealToDelete(deal);
  };

  const handleDeleteConfirm = async () => {
    if (!dealToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteDeal(dealToDelete.id);

      if (result.success) {
        toast.success(`Deal "${dealToDelete.title}" deleted successfully`);
        onDelete?.(dealToDelete);
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to delete deal');
      }
    } catch (error) {
      console.error('Delete deal error:', error);
      toast.error('Failed to delete deal');
    } finally {
      setIsDeleting(false);
      setDealToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDealToDelete(null);
  };

  const handleConvertToCustomer = async (deal: DealListItem) => {
    // Fetch full deal to get all required fields
    const result = await getDeal(deal.id);

    if (!result.success) {
      toast.error('Failed to load deal details');
      return;
    }

    setDealToConvert(result.data);
    setIsConvertDialogOpen(true);
  };

  const handleConvertSuccess = (_customerId: string, _quoteId: string) => {
    setIsConvertDialogOpen(false);
    setDealToConvert(null);
    onRefresh?.();
  };

  const handleConvertCancel = () => {
    setIsConvertDialogOpen(false);
    setDealToConvert(null);
  };

  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo<ColumnDef<DealListItem>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Deal',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.title}</span>
            {row.original.organizationName && (
              <span className="text-sm text-muted-foreground">
                {row.original.organizationName}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'contactName',
        header: 'Contact',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span>{row.original.contactName || '-'}</span>
            {row.original.contactEmail && (
              <span className="text-sm text-muted-foreground">
                {row.original.contactEmail}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'value',
        header: 'Value',
        cell: ({ row }) => (
          <span className="font-medium">
            {formatCurrency(row.original.value, row.original.currency)}
          </span>
        ),
      },
      {
        accessorKey: 'pipelineName',
        header: 'Pipeline',
        cell: ({ row }) => row.original.pipelineName || '-',
      },
      {
        accessorKey: 'stageName',
        header: 'Stage',
        cell: ({ row }) => row.original.stageName || '-',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge className={statusColors[status]}>
              {statusConfig[status]?.label || status}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'probability',
        header: 'Probability',
        cell: ({ row }) => {
          const prob = row.original.probability;
          if (prob == null) return '-';
          return `${prob}%`;
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
          const deal = row.original;
          const hasPipedrive = !!deal.pipedriveDealId;
          const isOpen = deal.status === 'open';
          const isClosed = deal.status === 'won' || deal.status === 'lost';

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(deal); }}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                {hasPipedrive && pipedriveCompanyDomain && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewInPipedrive(deal); }}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Pipedrive
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {isOpen && (
                  <>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); handleMarkAsWon(deal); }}
                      disabled={isUpdating}
                    >
                      <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                      Mark as Won
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); handleMarkAsLost(deal); }}
                      disabled={isUpdating}
                    >
                      <XCircle className="mr-2 h-4 w-4 text-red-600" />
                      Mark as Lost
                    </DropdownMenuItem>
                  </>
                )}
                {isClosed && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleReopen(deal); }}
                    disabled={isUpdating}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reopen Deal
                  </DropdownMenuItem>
                )}
                {deal.status === 'won' && !deal.customerId && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); handleConvertToCustomer(deal); }}
                    disabled={isUpdating}
                  >
                    <UserPlus className="mr-2 h-4 w-4 text-emerald-600" />
                    Convert to Customer
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleDeleteClick(deal); }}
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
    [pipedriveCompanyDomain, isUpdating]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading || isDeleting || isUpdating}
        enableRowSelection
        enableColumnVisibility
        enableGlobalFilter
        filterPlaceholder="Search deals..."
        searchableColumns={['title', 'contactName', 'contactEmail', 'organizationName']}
        showPagination
        pageSizeOptions={[10, 25, 50, 100]}
        defaultPageSize={pagination?.pageSize || 25}
        // Server-side pagination props
        manualPagination={!!pagination}
        pageCount={pagination?.totalPages}
        pageIndex={pagination ? pagination.page - 1 : 0}
        pageSize={pagination?.pageSize || 25}
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
            <p className="text-muted-foreground">No deals found.</p>
            <p className="text-sm text-muted-foreground">
              Sync from Pipedrive to import deals.
            </p>
          </div>
        }
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!dealToDelete}
        onOpenChange={() => !isDeleting && handleDeleteCancel()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete deal &quot;{dealToDelete?.title}&quot;?
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

      {/* Convert to Customer Dialog */}
      <ConvertDealToCustomerDialog
        open={isConvertDialogOpen}
        onClose={handleConvertCancel}
        deal={dealToConvert}
        onSuccess={handleConvertSuccess}
      />
    </>
  );
}
