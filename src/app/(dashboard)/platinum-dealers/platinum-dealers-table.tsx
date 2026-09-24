'use client';

/**
 * Platinum Dealers Table Component
 *
 * Data table for displaying the list of platinum dealers.
 * Uses the shared DataTable component with custom columns.
 */

import { useMemo } from 'react';
import { DataTable } from '@/shared/components/data-table';
import { getPlatinumDealersTableColumns } from './platinum-dealers-table-columns';
import type { PlatinumDealer } from '@/features/platinum-dealers/types';

// ============================================
// TYPES
// ============================================

interface PlatinumDealersTableProps {
  data: PlatinumDealer[];
  isLoading?: boolean;
  onRowClick?: (dealer: PlatinumDealer) => void;
  onView?: (dealer: PlatinumDealer) => void;
  onEdit?: (dealer: PlatinumDealer) => void;
  onDelete?: (dealer: PlatinumDealer) => void;
  toolbarContent?: React.ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export function PlatinumDealersTable({
  data,
  isLoading = false,
  onRowClick,
  onView,
  onEdit,
  onDelete,
  toolbarContent,
}: PlatinumDealersTableProps) {
  // ----------------------------------------
  // COLUMNS
  // ----------------------------------------

  const columns = useMemo(
    () =>
      getPlatinumDealersTableColumns({
        onView: onView || onRowClick,
        onEdit,
        onDelete,
      }),
    [onView, onEdit, onDelete, onRowClick]
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
      filterPlaceholder="Search dealers..."
      searchableColumns={['dealerName', 'code', 'contactName', 'email']}
      showPagination
      pageSizeOptions={[10, 20, 50, 100]}
      defaultPageSize={10}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      toolbarContent={toolbarContent}
      emptyState={
        <div className="flex flex-col items-center justify-center py-8">
          <p className="text-muted-foreground">No dealers found.</p>
          <p className="text-sm text-muted-foreground">
            Add your first platinum dealer to get started.
          </p>
        </div>
      }
    />
  );
}
