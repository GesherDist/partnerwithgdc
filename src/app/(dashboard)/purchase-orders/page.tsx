'use client';

/**
 * Purchase Orders Page
 *
 * Main page for managing purchase orders.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
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

// Imported from their own paths rather than the feature barrel: the barrel
// re-exports the service/repository layer, which reaches `next/headers` and so
// cannot be pulled into a client component's bundle.
import {
  PurchaseOrdersTable,
  ViewPurchaseOrderDrawer,
  CreatePurchaseOrderDrawer,
  EditPurchaseOrderDrawer,
} from '@/features/purchase-orders/components';
import { usePurchaseOrders } from '@/features/purchase-orders/hooks';
import { deletePurchaseOrder } from '@/features/purchase-orders/actions';
import type { POListItem, POStatus, PurchaseOrderWithItems } from '@/features/purchase-orders/types';
import { PO_STATUS_LABELS } from '@/features/purchase-orders/types';

export default function PurchaseOrdersPage() {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poToDelete, setPOToDelete] = useState<POListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');

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

  // Memoized params to prevent unnecessary re-fetches
  const poParams = useMemo(() => ({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    page,
    limit: pageSize,
  }), [statusFilter, page, pageSize]);

  const {
    data: purchaseOrders,
    meta,
    isLoading: isPOsLoading,
    refetch: refetchPOs,
  } = usePurchaseOrders(poParams);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleCreateClick = () => {
    setIsCreateDrawerOpen(true);
  };
  const handleCreateDrawerClose = () => {
    setIsCreateDrawerOpen(false);
  };
  const handleCreateSuccess = async () => {
    await refetchPOs();
  };

  const handleView = useCallback((po: POListItem) => {
    setSelectedPOId(po.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedPOId(null);
  }, []);

  const handleEdit = useCallback((po: POListItem | PurchaseOrderWithItems) => {
    setSelectedPOId(po.id);
    setIsViewDrawerOpen(false);
    setIsEditDrawerOpen(true);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedPOId(null);
  }, []);

  const handleEditSuccess = useCallback(async () => {
    await refetchPOs();
  }, [refetchPOs]);

  const handleDeleteClick = useCallback((po: POListItem) => {
    setPOToDelete(po);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!poToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deletePurchaseOrder(poToDelete.id);
      if (result.success) {
        toast.success(`Purchase Order ${poToDelete.poNumber} deleted`);
        refetchPOs();
      } else {
        toast.error(result.error || 'Failed to delete purchase order');
      }
    } catch {
      toast.error('Failed to delete purchase order');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setPOToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPOToDelete(null);
  };

  const handleRowClick = useCallback((po: POListItem) => {
    handleView(po);
  }, [handleView]);

  const handleRefresh = () => {
    refetchPOs();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as POStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6 self-start w-full">
      {/* Page Header */}
      <PageHeader
        title="Purchase Orders"
        description="Manage purchase orders to vendors."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isPOsLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isPOsLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create PO
            </Button>
          </div>
        }
      />

      {/* Purchase Orders Table */}
      <PurchaseOrdersTable
        data={purchaseOrders}
        isLoading={isPOsLoading}
        onRowClick={handleRowClick}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(PO_STATUS_LABELS).map(([value, label]) => (
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

      {/* View Purchase Order Drawer */}
      <ViewPurchaseOrderDrawer
        poId={selectedPOId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={handleEdit}
      />

      {/* Create Purchase Order Drawer */}
      <CreatePurchaseOrderDrawer
        open={isCreateDrawerOpen}
        onClose={handleCreateDrawerClose}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Purchase Order Modal */}
      <EditPurchaseOrderDrawer
        poId={selectedPOId || ''}
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete purchase order{' '}
              <span className="font-semibold">{poToDelete?.poNumber}</span>?
              This action cannot be undone. Only draft POs can be deleted.
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
