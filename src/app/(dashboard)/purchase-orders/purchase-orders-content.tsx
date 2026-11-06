'use client';

/**
 * Purchase Orders Page Content
 *
 * Client component for managing purchase orders.
 * Permission check is done in the server component wrapper (page.tsx).
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
  EditPOStatusDialogV2,
  EmailPurchaseOrderDialog,
} from '@/features/purchase-orders/components';
import { PdfViewerModal } from '@/shared/components/pdf-viewer';
import { usePurchaseOrders } from '@/features/purchase-orders/hooks';
// sendPurchaseOrder: now called through emailPurchaseOrderToSupplier (EmailPurchaseOrderDialog, Nov 7 2026)
// import { deletePurchaseOrder, sendPurchaseOrder } from '@/features/purchase-orders/actions';
import { deletePurchaseOrder } from '@/features/purchase-orders/actions';
import type { POListItem, POStatus, PurchaseOrderWithItems, POSortColumn, SortDirection } from '@/features/purchase-orders/types';
import { PO_STATUS_LABELS } from '@/features/purchase-orders/types';
import { useAuthStore } from '@/shared/stores/auth.store';

export function PurchaseOrdersPageContent() {
  const { hasPermission } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration; same as the server actions)
  // ----------------------------------------

  const canCreate = hasMounted && hasPermission('purchase_orders.create');
  const canEdit = hasMounted && hasPermission('purchase_orders.edit');
  const canSend = hasMounted && hasPermission('purchase_orders.send');
  const canDelete = hasMounted && hasPermission('purchase_orders.delete');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [isEditStatusDialogOpen, setIsEditStatusDialogOpen] = useState(false);
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [selectedPOForStatus, setSelectedPOForStatus] = useState<POListItem | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [poToDelete, setPOToDelete] = useState<POListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all');
  // Sold = container linked to a customer sales order (pre-sold before arrival)
  const [soldFilter, setSoldFilter] = useState<'all' | 'sold' | 'available'>('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<POSortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle sort change
  const handleSortChange = (column: POSortColumn) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to asc
      setSortColumn(column);
      setSortDirection('asc');
    }
    // Reset to page 1 when sorting changes
    setPage(1);
  };

  // Reset to page 1 when a filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, soldFilter]);

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Memoized params to prevent unnecessary re-fetches
  const poParams = useMemo(() => ({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(soldFilter !== 'all' && { sold: soldFilter }),
    page,
    limit: pageSize,
    ...(sortColumn && { sortBy: sortColumn, sortOrder: sortDirection }),
  }), [statusFilter, soldFilter, page, pageSize, sortColumn, sortDirection]);

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

  const handleEditStatus = useCallback((po: POListItem) => {
    setSelectedPOForStatus(po);
    setIsEditStatusDialogOpen(true);
  }, []);

  const handleEditStatusSuccess = useCallback(async () => {
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

  // Old: status change only, no email (replaced Nov 7 2026 by the email dialog below)
  // const handleSendToSupplier = useCallback(async (po: POListItem) => {
  //   try {
  //     const result = await sendPurchaseOrder(po.id);
  //     if (result.success) {
  //       toast.success(`Purchase Order ${po.poNumber} sent to supplier`);
  //       refetchPOs();
  //     } else {
  //       toast.error(result.error || 'Failed to send purchase order');
  //     }
  //   } catch (error) {
  //     console.error('[handleSendToSupplier] Error:', error);
  //     toast.error('Failed to send purchase order');
  //   }
  // }, [refetchPOs]);

  // Row menu: View PDF / Send to Supplier (draft: email + mark Sent) / Email PO to Supplier (re-send)
  const [pdfPO, setPdfPO] = useState<POListItem | null>(null);
  const [emailPO, setEmailPO] = useState<{ po: POListItem; mode: 'send' | 'email' } | null>(null);

  const handleViewPdf = useCallback((po: POListItem) => {
    setPdfPO(po);
  }, []);

  const handleSendToSupplier = useCallback((po: POListItem) => {
    setEmailPO({ po, mode: 'send' });
  }, []);

  const handleEmailToSupplier = useCallback((po: POListItem) => {
    setEmailPO({ po, mode: 'email' });
  }, []);

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
            {canCreate && (
              <Button onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                Create PO
              </Button>
            )}
          </div>
        }
      />

      {/* Purchase Orders Table */}
      <PurchaseOrdersTable
        data={purchaseOrders}
        isLoading={isPOsLoading}
        onRowClick={handleRowClick}
        onView={handleView}
        onEdit={canEdit ? handleEdit : undefined}
        onEditStatus={canEdit ? handleEditStatus : undefined}
        onSendToSupplier={canSend ? handleSendToSupplier : undefined}
        onViewPdf={handleViewPdf}
        onEmailToSupplier={canSend ? handleEmailToSupplier : undefined}
        onDelete={canDelete ? handleDeleteClick : undefined}
        toolbarContent={
          <div className="flex items-center gap-2">
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
            <Select value={soldFilter} onValueChange={(value) => setSoldFilter(value as 'all' | 'sold' | 'available')}>
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sold &amp; Available</SelectItem>
                <SelectItem value="sold">Sold (linked to SO)</SelectItem>
                <SelectItem value="available">Available</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        sorting={{
          column: sortColumn,
          direction: sortDirection,
          onSortChange: handleSortChange,
        }}
      />

      {/* View Purchase Order Drawer */}
      <ViewPurchaseOrderDrawer
        poId={selectedPOId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={canEdit ? handleEdit : undefined}
      />

      {/* PO PDF (view + download), from the row menu */}
      {pdfPO && (
        <PdfViewerModal
          open={Boolean(pdfPO)}
          onClose={() => setPdfPO(null)}
          pdfUrl={`/api/purchase-orders/${pdfPO.id}/pdf`}
          title={`Purchase Order - ${pdfPO.poNumber}`}
          fileName={`PurchaseOrder-${pdfPO.poNumber}.pdf`}
        />
      )}

      {/* Send / Email PO to Supplier, from the row menu */}
      {emailPO && (
        <EmailPurchaseOrderDialog
          open={Boolean(emailPO)}
          onOpenChange={(next) => {
            if (!next) {
              setEmailPO(null);
            }
          }}
          purchaseOrderId={emailPO.po.id}
          poNumber={emailPO.po.poNumber}
          mode={emailPO.mode}
          onDone={() => refetchPOs()}
        />
      )}

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

      {/* Edit PO Status Dialog (Sequential: Confirmation → Production → Shipment) */}
      {selectedPOForStatus && (
        <EditPOStatusDialogV2
          open={isEditStatusDialogOpen}
          onOpenChange={setIsEditStatusDialogOpen}
          poId={selectedPOForStatus.id}
          poNumber={selectedPOForStatus.poNumber}
          supplierConfirmedAt={selectedPOForStatus.supplierConfirmedAt || null}
          currentProductionStatus={selectedPOForStatus.productionStatus || null}
          currentLoadStatus={selectedPOForStatus.latestShipmentStatus || null}
          shipmentId={selectedPOForStatus.latestShipmentId || null}
          onSuccess={handleEditStatusSuccess}
        />
      )}

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
