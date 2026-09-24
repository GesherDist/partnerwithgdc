'use client';

/**
 * Invoices Page
 *
 * Main page for managing invoices.
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
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
  InvoicesTable,
  ViewInvoiceDrawer,
  EditInvoiceDrawer,
  useInvoices,
} from '@/features/invoices';
import { deleteInvoice } from '@/features/invoices/actions';
import type { InvoiceListItem, InvoiceStatus, InvoiceWithItems } from '@/features/invoices/types';
import { INVOICE_STATUS_LABELS } from '@/features/invoices/types';

export default function InvoicesPage() {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');

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

  const {
    data: invoices,
    meta,
    isLoading: isInvoicesLoading,
    refetch: refetchInvoices,
  } = useInvoices({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    page,
    limit: pageSize,
  });

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleCreateClick = () => {
    toast.info('Create invoice functionality coming soon');
  };

  const handleView = useCallback((invoice: InvoiceListItem) => {
    setSelectedInvoiceId(invoice.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedInvoiceId(null);
  }, []);

  const handleEdit = useCallback((invoice: InvoiceListItem | InvoiceWithItems) => {
    setSelectedInvoiceId(invoice.id);
    setIsViewDrawerOpen(false);
    setIsEditDrawerOpen(true);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedInvoiceId(null);
  }, []);

  const handleEditSuccess = useCallback(async () => {
    await refetchInvoices();
  }, [refetchInvoices]);

  const handleRecordPayment = useCallback((_invoice: InvoiceListItem | InvoiceWithItems) => {
    toast.info('Record payment functionality coming soon');
  }, []);

  const handleDeleteClick = useCallback((invoice: InvoiceListItem) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteInvoice(invoiceToDelete.id);
      if (result.success) {
        toast.success(`Invoice ${invoiceToDelete.invoiceNumber} deleted`);
        refetchInvoices();
      } else {
        toast.error(result.error || 'Failed to delete invoice');
      }
    } catch {
      toast.error('Failed to delete invoice');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setInvoiceToDelete(null);
  };

  const handleRowClick = useCallback((invoice: InvoiceListItem) => {
    handleView(invoice);
  }, [handleView]);

  const handleRefresh = () => {
    refetchInvoices();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as InvoiceStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Invoices"
        description="Manage customer invoices and payments."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isInvoicesLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isInvoicesLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          </div>
        }
      />

      {/* Invoices Table */}
      <InvoicesTable
        data={invoices}
        isLoading={isInvoicesLoading}
        onRowClick={handleRowClick}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onRecordPayment={handleRecordPayment}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
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

      {/* View Invoice Drawer */}
      <ViewInvoiceDrawer
        invoiceId={selectedInvoiceId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={handleEdit}
        onRecordPayment={handleRecordPayment}
      />

      {/* Edit Invoice Drawer */}
      <EditInvoiceDrawer
        invoiceId={selectedInvoiceId || ''}
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice{' '}
              <span className="font-semibold">{invoiceToDelete?.invoiceNumber}</span>?
              This action cannot be undone. Only draft invoices can be deleted.
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
