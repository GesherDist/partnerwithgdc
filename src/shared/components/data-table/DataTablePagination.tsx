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
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  pageSizeOptions = [10, 25, 50, 100],
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
    <div className="flex flex-col gap-4 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: Row Info */}
      <div className="text-sm text-muted-foreground">
        {showSelectedCount && selectedCount > 0 ? (
          <span>
            {selectedCount} of {totalRows} row(s) selected
          </span>
        ) : hasDataOnCurrentPage ? (
          <span>
            Showing {startRow} to {endRow} of {totalRows} results
          </span>
        ) : (
          <span>No results</span>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-6">
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
          {/* Previous Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </Button>

          {/* Page Info */}
          <div className="text-sm font-medium">
            Page {currentPage + 1} of {pageCount || 1}
          </div>

          {/* Next Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
