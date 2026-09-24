'use client';

/**
 * CustomersTable Component
 *
 * Data table for displaying the list of customers.
 * Uses the shared DataTable component with custom columns.
 *
 * All data is received via props - no internal data fetching.
 */

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { DataTable } from '@/shared/components/data-table';
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

import { getCustomersTableColumns } from './CustomersTableColumns';
import { deleteCustomer } from '../actions';
import type { CustomersTableProps, CustomerTableRow } from '../types';

// ============================================
// COMPONENT
// ============================================

export function CustomersTable({
  data,
  isLoading = false,
  onRowClick,
  onEdit,
  onDelete,
  toolbarContent,
  pagination,
}: CustomersTableProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [customerToDelete, setCustomerToDelete] = useState<CustomerTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleView = (customer: CustomerTableRow) => {
    onRowClick?.(customer);
  };

  const handleEdit = (customer: CustomerTableRow) => {
    onEdit?.(customer);
  };

  const handleDeleteClick = (customer: CustomerTableRow) => {
    setCustomerToDelete(customer);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) {return;}

    setIsDeleting(true);
    try {
      const result = await deleteCustomer(customerToDelete.id);

      if (result.success) {
        toast.success(`Customer "${customerToDelete.name}" deleted successfully`);
        onDelete?.(customerToDelete);
      } else {
        toast.error(result.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Delete customer error:', error);
      toast.error('Failed to delete customer');
    } finally {
      setIsDeleting(false);
      setCustomerToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setCustomerToDelete(null);
  };

  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  // Only pass handlers that are enabled by permissions
  const columns = useMemo(
    () =>
      getCustomersTableColumns({
        onView: onRowClick ? handleView : undefined,
        onEdit: onEdit ? handleEdit : undefined,
        onDelete: onDelete ? handleDeleteClick : undefined,
      }),
    [onRowClick, onEdit, onDelete]
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
        filterPlaceholder="Search customers..."
        searchableColumns={['customerCode', 'name', 'email', 'phone']}
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
            <p className="text-muted-foreground">No customers found.</p>
            <p className="text-sm text-muted-foreground">
              Add your first customer to get started.
            </p>
          </div>
        }
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!customerToDelete} onOpenChange={() => !isDeleting && handleDeleteCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete customer &quot;{customerToDelete?.name}&quot;?
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
