'use client';

/**
 * DataTablePagination Component
 *
 * Pagination controls for the DataTable.
 * Shows page info, page size selector, and navigation buttons.
 */

import { type Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================
// TYPES
// ============================================

interface DataTablePaginationProps<TData> {
  /** Table instance */
  table: Table<TData>;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Show selected row count */
  showSelectedCount?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 50, 100],
  showSelectedCount = false,
}: DataTablePaginationProps<TData>) {
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  // With server-side pagination the row model only holds the current page,
  // so use the table's row count (falls back to the filtered rows client-side).
  const totalRows = table.getRowCount();
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  // Calculate "showing X to Y of Z" text
  const startRow = totalRows === 0 ? 0 : currentPage * pageSize + 1;
  const endRow = Math.min((currentPage + 1) * pageSize, totalRows);

  // Check if current page is beyond available data
  const hasDataOnCurrentPage = totalRows > 0 && startRow <= totalRows;

  return (
    <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between">
      {/* Row Info */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {showSelectedCount && selectedCount > 0 ? (
          <span>
            {selectedCount} of {totalRows} row(s) selected
          </span>
        ) : (
          <span>
            {hasDataOnCurrentPage
              ? `Showing ${startRow} to ${endRow} of ${totalRows} results`
              : 'No results'}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          {/* Previous Page with Text */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            <span className="hidden sm:inline">Previous</span>
          </Button>

          {/* Page Info */}
          <div className="flex items-center justify-center text-sm font-medium">
            Page {currentPage + 1} of {pageCount || 1}
          </div>

          {/* Next Page with Text */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="hidden sm:inline">Next</span>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
