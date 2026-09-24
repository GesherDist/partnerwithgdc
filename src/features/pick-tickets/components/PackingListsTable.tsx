'use client';

/**
 * PackingListsTable Component
 *
 * Data table for displaying the list of packing lists.
 * Uses the shared DataTable component with custom columns.
 *
 * All data is received via props - no internal data fetching.
 */

import { useMemo } from 'react';

import { DataTable } from '@/shared/components/data-table';

import { getPackingListsTableColumns } from './PackingListsTableColumns';
import type { PackingListsTableProps } from '../types';

// ============================================
// COMPONENT
// ============================================

export function PackingListsTable({
  data,
  isLoading = false,
  onRowClick,
  onView,
  onDelete,
  onMarkAsPacked,
  toolbarContent,
  pagination,
}: PackingListsTableProps) {
  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo(
    () =>
      getPackingListsTableColumns({
        onView: onView || onRowClick,
        onDelete,
        onMarkAsPacked,
      }),
    [onView, onDelete, onMarkAsPacked, onRowClick]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      enableRowSelection
      enableColumnVisibility
      enableGlobalFilter
      filterPlaceholder="Search packing lists..."
      searchableColumns={['packingListNumber', 'pickTicketNumber', 'customerName']}
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
          <p className="text-muted-foreground">No packing lists found.</p>
          <p className="text-sm text-muted-foreground">
            Packing lists will appear here when pick tickets are ready for packing.
          </p>
        </div>
      }
    />
  );
}
