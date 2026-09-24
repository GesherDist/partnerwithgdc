'use client';

/**
 * Packing Lists Page
 *
 * Main page for managing packing lists.
 * Part of the Pick -> Pack -> Ship fulfillment workflow.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
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

import {
  PackingListsTable,
  ViewPackingListDrawer,
  usePackingLists,
} from '@/features/pick-tickets';
import { deletePackingList, markPackingListAsPacked } from '@/features/pick-tickets/actions/packing-list.actions';
import type { PackingListListItem, PackingListStatus } from '@/features/pick-tickets/types';
import { PACKING_LIST_STATUS_LABELS } from '@/features/pick-tickets/types';

export default function PackingListsPage() {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [selectedPackingListId, setSelectedPackingListId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [packingListToDelete, setPackingListToDelete] = useState<PackingListListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PackingListStatus | 'all'>('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Memoize params to prevent unnecessary re-renders
  const packingListsParams = useMemo(() => ({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    page,
    limit: pageSize,
  }), [statusFilter, page, pageSize]);

  const {
    data: packingLists,
    meta,
    isLoading: isPackingListsLoading,
    refetch: refetchPackingLists,
  } = usePackingLists(packingListsParams);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleView = useCallback((packingList: PackingListListItem) => {
    setSelectedPackingListId(packingList.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedPackingListId(null);
  }, []);

  const handleMarkAsPacked = useCallback(async (packingList: PackingListListItem) => {
    try {
      const result = await markPackingListAsPacked(packingList.id);
      if (result.success) {
        toast.success(`Packing list ${packingList.packingListNumber} marked as packed`);
        refetchPackingLists();
      } else {
        toast.error(result.error || 'Failed to mark as packed');
      }
    } catch {
      toast.error('Failed to mark as packed');
    }
  }, [refetchPackingLists]);

  const handleDeleteClick = useCallback((packingList: PackingListListItem) => {
    setPackingListToDelete(packingList);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!packingListToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deletePackingList(packingListToDelete.id);
      if (result.success) {
        toast.success(`Packing list ${packingListToDelete.packingListNumber} deleted`);
        refetchPackingLists();
      } else {
        toast.error(result.error || 'Failed to delete packing list');
      }
    } catch {
      toast.error('Failed to delete packing list');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setPackingListToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPackingListToDelete(null);
  };

  const handleRowClick = useCallback((packingList: PackingListListItem) => {
    handleView(packingList);
  }, [handleView]);

  const handleRefresh = () => {
    refetchPackingLists();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as PackingListStatus | 'all');
  };

  const handleStatusChange = useCallback(() => {
    refetchPackingLists();
  }, [refetchPackingLists]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Packing Lists"
        description="Manage packing lists for warehouse fulfillment orders."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isPackingListsLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isPackingListsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* Packing Lists Table */}
      <PackingListsTable
        data={packingLists}
        isLoading={isPackingListsLoading}
        onRowClick={handleRowClick}
        onView={handleView}
        onDelete={handleDeleteClick}
        onMarkAsPacked={handleMarkAsPacked}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(PACKING_LIST_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(1);
          },
        }}
      />

      {/* View Packing List Drawer */}
      <ViewPackingListDrawer
        packingListId={selectedPackingListId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onStatusChange={handleStatusChange}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Packing List</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete packing list{' '}
              <span className="font-semibold">{packingListToDelete?.packingListNumber}</span>?
              This action cannot be undone. Only draft packing lists can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
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
    </div>
  );
}
