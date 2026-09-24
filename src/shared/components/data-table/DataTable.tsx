'use client';

/**
 * DataTable Component
 *
 * A flexible data table built on TanStack React Table.
 * Supports sorting, pagination, filtering, and row selection.
 */

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
  type PaginationState,
} from '@tanstack/react-table';
import { useState, useCallback, useEffect, useRef } from 'react';

import { cn } from '@/shared/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';
import { LoadingState } from '../feedback';

// ============================================
// TYPES
// ============================================

export interface DataTableProps<TData, TValue> {
  /** Column definitions */
  columns: ColumnDef<TData, TValue>[];
  /** Data array */
  data: TData[];
  /** Loading state */
  loading?: boolean;
  /** Enable row selection */
  enableRowSelection?: boolean;
  /** Enable multi-select */
  enableMultiRowSelection?: boolean;
  /** Enable column visibility toggle */
  enableColumnVisibility?: boolean;
  /** Enable global filter */
  enableGlobalFilter?: boolean;
  /** Global filter placeholder */
  filterPlaceholder?: string;
  /** Searchable columns for global filter */
  searchableColumns?: string[];
  /** Custom toolbar content */
  toolbarContent?: React.ReactNode;
  /** Custom empty state */
  emptyState?: React.ReactNode;
  /** Show pagination */
  showPagination?: boolean;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Default page size */
  defaultPageSize?: number;
  /** Server-side pagination - total row count */
  manualPagination?: boolean;
  /** Total row count for server-side pagination */
  rowCount?: number;
  /** Total page count for server-side pagination */
  pageCount?: number;
  /** External page index (0-based) for controlled pagination */
  pageIndex?: number;
  /** External page size for controlled pagination */
  pageSize?: number;
  /** Callback when pagination changes (server-side) */
  onPaginationChange?: (pagination: PaginationState) => void;
  /** Callback when row selection changes */
  onRowSelectionChange?: (rows: TData[]) => void;
  /** Custom class name */
  className?: string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Get row ID */
  getRowId?: (row: TData) => string;
}

// ============================================
// COMPONENT
// ============================================

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
  enableRowSelection = false,
  enableMultiRowSelection = true,
  enableColumnVisibility = false,
  enableGlobalFilter = true,
  filterPlaceholder = 'Search...',
  searchableColumns,
  toolbarContent,
  emptyState,
  showPagination = true,
  pageSizeOptions = [10, 20, 50, 100],
  defaultPageSize = 10,
  manualPagination = false,
  rowCount,
  pageCount,
  pageIndex: externalPageIndex,
  pageSize: externalPageSize,
  onPaginationChange,
  onRowSelectionChange,
  className,
  onRowClick,
  getRowId,
}: DataTableProps<TData, TValue>) {
  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: externalPageIndex ?? 0,
    pageSize: externalPageSize ?? defaultPageSize,
  });

  // Track pagination state for deferred callback
  const paginationUpdaterRef = useRef<PaginationState | null>(null);

  // Sync internal pagination state with external props
  useEffect(() => {
    if (externalPageIndex !== undefined || externalPageSize !== undefined) {
      setPagination((prev) => ({
        pageIndex: externalPageIndex ?? prev.pageIndex,
        pageSize: externalPageSize ?? prev.pageSize,
      }));
    }
  }, [externalPageIndex, externalPageSize]);

  // Handle row selection changes
  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      setRowSelection((old) => {
        const newSelection = typeof updater === 'function' ? updater(old) : updater;

        // Call external handler with selected rows
        if (onRowSelectionChange) {
          const selectedIndices = Object.keys(newSelection).filter(
            (key) => newSelection[key]
          );
          const selectedRows = selectedIndices
            .map((index) => data[parseInt(index)])
            .filter((row): row is TData => row !== undefined);
          onRowSelectionChange(selectedRows);
        }

        return newSelection;
      });
    },
    [data, onRowSelectionChange]
  );

  // Handle pagination changes
  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      // Update internal state
      setPagination((old) => {
        const newPagination = typeof updater === 'function' ? updater(old) : updater;
        // Store the new pagination state for deferred callback
        paginationUpdaterRef.current = newPagination;
        return newPagination;
      });
    },
    []
  );

  // Call parent pagination callback after state update (deferred to avoid setState-in-render)
  useEffect(() => {
    if (manualPagination && onPaginationChange && paginationUpdaterRef.current) {
      onPaginationChange(paginationUpdaterRef.current as any);
      paginationUpdaterRef.current = null;
    }
  }, [pagination, manualPagination, onPaginationChange]);

  // Create table instance
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: handleRowSelectionChange,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: handlePaginationChange,
    getRowId,
    enableRowSelection,
    enableMultiRowSelection,
    manualPagination,
    // Only pass rowCount and pageCount for manual (server-side) pagination
    ...(manualPagination && {
      rowCount,
      pageCount: pageCount ?? -1,
    }),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();

      // If searchable columns are specified, only search those
      if (searchableColumns && searchableColumns.length > 0) {
        return searchableColumns.some((col) => {
          const value = row.getValue(col);
          return String(value).toLowerCase().includes(search);
        });
      }

      // Otherwise, search all string/number columns
      const columnsToSearch = row.getAllCells();
      return columnsToSearch.some((cell) => {
        const value = cell.getValue();
        if (typeof value === 'string' || typeof value === 'number') {
          return String(value).toLowerCase().includes(search);
        }
        return false;
      });
    },
  });

  return (
    <div className={cn('space-y-4 w-full', className)}>
      {/* Toolbar */}
      {(enableGlobalFilter || enableColumnVisibility || toolbarContent) && (
        <DataTableToolbar
          table={table}
          enableGlobalFilter={enableGlobalFilter}
          enableColumnVisibility={enableColumnVisibility}
          filterPlaceholder={filterPlaceholder}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
        >
          {toolbarContent}
        </DataTableToolbar>
      )}

      {/* Table */}
      <div className="relative rounded-md border w-full overflow-x-auto">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <LoadingState message="Loading data..." />
          </div>
        )}

        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  {emptyState || 'No results.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <DataTablePagination
          table={table}
          pageSizeOptions={pageSizeOptions}
          showSelectedCount={enableRowSelection}
        />
      )}
    </div>
  );
}
