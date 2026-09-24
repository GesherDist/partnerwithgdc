/**
 * DataTable Components Index
 *
 * Central export point for all data table components.
 */

export { DataTable, type DataTableProps } from './DataTable';
export { DataTablePagination } from './DataTablePagination';
export { DataTableToolbar } from './DataTableToolbar';
export { DataTableColumnHeader } from './DataTableColumnHeader';
export {
  DataTableRowActions,
  createCommonRowActions,
} from './DataTableRowActions';

// Re-export useful types from tanstack
export type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  PaginationState,
} from '@tanstack/react-table';
