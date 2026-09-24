'use client';

/**
 * Suppliers Table
 *
 * Data table for displaying the list of suppliers.
 * Uses the shared DataTable component with custom columns.
 */

import { useMemo } from 'react';
import { Building2 } from 'lucide-react';

import { DataTable } from '@/shared/components/data-table';
import { getSuppliersTableColumns } from './SuppliersTableColumns';
import type { Supplier } from '../types';

// ============================================
// TYPES
// ============================================

interface SuppliersTableProps {
  suppliers: Supplier[];
  onRowClick?: (supplier: Supplier) => void;
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

// ============================================
// COMPONENT
// ============================================

export function SuppliersTable({
  suppliers,
  onRowClick,
  onEdit,
  onDelete,
}: SuppliersTableProps) {
  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo(
    () =>
      getSuppliersTableColumns({
        onEdit,
        onDelete,
      }),
    [onEdit, onDelete]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <DataTable
      columns={columns}
      data={suppliers}
      enableRowSelection
      enableColumnVisibility
      enableGlobalFilter
      filterPlaceholder="Search suppliers..."
      searchableColumns={['supplierCode', 'name', 'primaryContactName', 'primaryContactEmail']}
      showPagination
      pageSizeOptions={[10, 20, 50, 100]}
      defaultPageSize={20}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      emptyState={
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No suppliers found.</p>
          <p className="text-sm text-muted-foreground">
            Create a supplier to get started.
          </p>
        </div>
      }
    />
  );
}
