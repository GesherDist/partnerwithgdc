'use client';

/**
 * Sales Orders Page Content
 *
 * Client component for managing sales orders.
 * Uses server actions to fetch real data.
 *
 * State Management:
 * - Page component owns drawer state
 * - Master data is fetched once via hook and shared
 * - Sales orders are fetched via useSalesOrders hook
 * - Data flows down via props
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
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

import { Loader2 } from 'lucide-react';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';

import {
  SalesOrdersTable,
  CreateSalesOrderDrawer,
  ViewSalesOrderDrawer,
  EditSalesOrderDrawer,
  useSalesOrderMasterData,
  useSalesOrders,
} from '@/features/sales-orders';
import { deleteSalesOrder, confirmSalesOrder, cancelSalesOrder } from '@/features/sales-orders/actions';
import type { SalesOrderListItem, OrderStatus, SalesOrderWithItems } from '@/features/sales-orders/types';
import { ORDER_STATUS_LABELS } from '@/features/sales-orders/types';
import { ORDER_SERIES } from '@/shared/lib/global-data';

// ============================================
// COMPONENT
// ============================================

export function SalesOrdersPageContent() {
  const { hasPermission } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canCreate = hasMounted && hasPermission('orders.create');
  const canViewDetail = hasMounted && hasPermission('orders.view_detail');
  const canEdit = hasMounted && hasPermission('orders.edit');
  const canDelete = hasMounted && hasPermission('orders.delete');
  // const canApprove = hasMounted && hasPermission('orders.approve'); // TODO: Use when approve feature is implemented

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrderListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Confirm order
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<SalesOrderListItem | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Cancel order
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<SalesOrderListItem | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [orderSeriesFilter, setOrderSeriesFilter] = useState<string>('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, orderSeriesFilter]);

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Master data hook - fetches once, caches, shares across components
  const { data: masterData } = useSalesOrderMasterData();

  // Sales orders list with status and order series filters and pagination
  const salesOrdersParams = useMemo(() => ({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(orderSeriesFilter !== 'all' && { orderSeries: orderSeriesFilter }),
    page,
    limit: pageSize,
  }), [statusFilter, orderSeriesFilter, page, pageSize]);

  const {
    data: salesOrders,
    meta,
    isLoading: isOrdersLoading,
    refetch: refetchOrders,
  } = useSalesOrders(salesOrdersParams);


  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  // Create
  const handleCreateClick = () => {
    setIsCreateDrawerOpen(true);
  };

  const handleCreateDrawerClose = useCallback(() => {
    setIsCreateDrawerOpen(false);
    refetchOrders();
  }, [refetchOrders]);

  // View
  const handleView = useCallback((order: SalesOrderListItem) => {
    setSelectedOrderId(order.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedOrderId(null);
  }, []);

  // Edit (can be triggered from view drawer or table actions)
  const handleEdit = useCallback((order: SalesOrderListItem | SalesOrderWithItems) => {
    setSelectedOrderId(order.id);
    setIsViewDrawerOpen(false);
    setIsEditDrawerOpen(true);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedOrderId(null);
    refetchOrders();
  }, [refetchOrders]);

  const handleEditSuccess = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedOrderId(null);
    refetchOrders();
    // Note: Toast is shown by EditSalesOrderDrawer, not here (avoid duplicate)
  }, [refetchOrders]);

  // Delete
  const handleDeleteClick = useCallback((order: SalesOrderListItem) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) {return;}

    setIsDeleting(true);
    try {
      const result = await deleteSalesOrder(orderToDelete.id);
      if (result.success) {
        toast.success(`Order ${orderToDelete.orderNumber} deleted`);
        refetchOrders();
      } else {
        toast.error(result.error || 'Failed to delete order');
      }
    } catch {
      toast.error('Failed to delete order');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  // Confirm Order
  const handleConfirmClick = useCallback((order: SalesOrderListItem) => {
    setOrderToConfirm(order);
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmOrder = async () => {
    if (!orderToConfirm) {
      return;
    }

    setIsConfirming(true);
    try {
      const result = await confirmSalesOrder(orderToConfirm.id);
      if (result.success) {
        toast.success(`Order ${orderToConfirm.orderNumber} confirmed`);
        refetchOrders();
      } else {
        toast.error(result.error || 'Failed to confirm order');
      }
    } catch {
      toast.error('Failed to confirm order');
    } finally {
      setIsConfirming(false);
      setConfirmDialogOpen(false);
      setOrderToConfirm(null);
    }
  };

  const handleConfirmCancel = () => {
    setConfirmDialogOpen(false);
    setOrderToConfirm(null);
  };

  // Cancel Order
  const handleCancelClick = useCallback((order: SalesOrderListItem) => {
    setOrderToCancel(order);
    setCancelDialogOpen(true);
  }, []);

  const handleCancelOrder = async () => {
    if (!orderToCancel) {
      return;
    }

    setIsCancelling(true);
    try {
      const result = await cancelSalesOrder(orderToCancel.id, cancelReason || undefined);
      if (result.success) {
        toast.success(`Order ${orderToCancel.orderNumber} cancelled`);
        refetchOrders();
      } else {
        toast.error(result.error || 'Failed to cancel order');
      }
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setIsCancelling(false);
      setCancelDialogOpen(false);
      setOrderToCancel(null);
      setCancelReason('');
    }
  };

  const handleCancelDialogClose = () => {
    setCancelDialogOpen(false);
    setOrderToCancel(null);
    setCancelReason('');
  };

  // Row click (opens view drawer)
  const handleRowClick = useCallback((order: SalesOrderListItem) => {
    handleView(order);
  }, [handleView]);

  const handleRefresh = () => {
    refetchOrders();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as OrderStatus | 'all');
  };

  const handleOrderSeriesFilterChange = (value: string) => {
    setOrderSeriesFilter(value);
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6 self-start w-full">
      {/* Page Header */}
      <PageHeader
        title="Sales Orders"
        description="Manage customer sales orders."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isOrdersLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isOrdersLoading ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <Button onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                Create Sales Order
              </Button>
            )}
          </div>
        }
      />

      {/* Sales Orders Table */}
      <SalesOrdersTable
        data={salesOrders}
        isLoading={isOrdersLoading}
        onRowClick={canViewDetail ? handleRowClick : undefined}
        onView={canViewDetail ? handleView : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDeleteClick : undefined}
        onConfirm={canEdit ? handleConfirmClick : undefined}
        onCancel={canEdit ? handleCancelClick : undefined}
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(1); // Reset to first page when page size changes
          },
        }}
        toolbarContent={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={orderSeriesFilter} onValueChange={handleOrderSeriesFilterChange}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Order Series</SelectItem>
                {ORDER_SERIES.map((series) => (
                  <SelectItem key={series.id} value={series.code}>
                    {series.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Create Sales Order Drawer */}
      <CreateSalesOrderDrawer
        open={isCreateDrawerOpen}
        onClose={handleCreateDrawerClose}
        masterData={masterData}
      />

      {/* View Sales Order Drawer */}
      <ViewSalesOrderDrawer
        orderId={selectedOrderId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={handleEdit}
      />

      {/* Edit Sales Order Drawer */}
      <EditSalesOrderDrawer
        orderId={selectedOrderId}
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        onSuccess={handleEditSuccess}
        masterData={masterData}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete order{' '}
              <span className="font-semibold">{orderToDelete?.orderNumber}</span>?
              This action cannot be undone. Only draft orders can be deleted.
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

      {/* Confirm Order Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will confirm order{' '}
              <span className="font-semibold">{orderToConfirm?.orderNumber}</span>.
              <br /><br />
              Once confirmed, the order will be ready for processing and you can create a Purchase Order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmCancel} disabled={isConfirming}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOrder} disabled={isConfirming}>
              {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Order Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel order{' '}
              <span className="font-semibold">{orderToCancel?.orderNumber}</span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancelReason">Cancellation Reason (optional)</Label>
            <Textarea
              id="cancelReason"
              placeholder="Enter reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDialogClose} disabled={isCancelling}>
              Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
