'use client';

/**
 * PickTicketsTable Component
 *
 * Data table for displaying the list of pick tickets.
 * Uses the shared DataTable component with custom columns.
 *
 * All data is received via props - no internal data fetching.
 */

import { useMemo, useState } from 'react';
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

import { DataTable } from '@/shared/components/data-table';

import { PickTicketsTableColumns } from './PickTicketsTableColumns';
import type { PickTicketsTableProps, PickTicketListItem } from '../types';

// ============================================
// COMPONENT
// ============================================

export function PickTicketsTable({
  data,
  isLoading = false,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  onAssign,
  onStartPicking,
  toolbarContent,
  pagination,
}: PickTicketsTableProps) {
  const [showShippedEditConfirm, setShowShippedEditConfirm] = useState(false);
  const [pendingEditPickTicket, setPendingEditPickTicket] = useState<PickTicketListItem | null>(null);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  // Wrap onEdit to check for shipped status and show confirmation
  const handleEdit = onEdit
    ? (pickTicket: PickTicketListItem) => {
        if (pickTicket.status === 'shipped') {
          setPendingEditPickTicket(pickTicket);
          setShowShippedEditConfirm(true);
        } else {
          onEdit(pickTicket);
        }
      }
    : undefined;

  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo(
    () =>
      PickTicketsTableColumns({
        onView: onView || onRowClick,
        onEdit: handleEdit,
        onDelete,
        onAssign,
        onStartPicking,
      }),
    [onView, handleEdit, onDelete, onAssign, onStartPicking, onRowClick]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        enableRowSelection
        enableColumnVisibility
        enableGlobalFilter
        filterPlaceholder="Search pick tickets..."
        searchableColumns={['pickTicketNumber', 'salesOrderNumber', 'customerName']}
        showPagination
        pageSizeOptions={[10, 20, 50, 100]}
        defaultPageSize={10}
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
            <p className="text-muted-foreground">No pick tickets found.</p>
            <p className="text-sm text-muted-foreground">
              Pick tickets will appear here when sales orders are ready for warehouse fulfillment.
            </p>
          </div>
        }
      />

      {/* Confirmation dialog for editing shipped pick tickets */}
      <AlertDialog open={showShippedEditConfirm} onOpenChange={setShowShippedEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit shipped pick ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              This pick ticket has already been shipped. Editing shipped records may affect
              inventory tracking and shipment history.
              <br />
              <br />
              Are you sure you want to make changes to this shipped pick ticket?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEditPickTicket(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowShippedEditConfirm(false);
                if (pendingEditPickTicket && onEdit) {
                  onEdit(pendingEditPickTicket);
                }
                setPendingEditPickTicket(null);
              }}
            >
              Yes, Edit Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
