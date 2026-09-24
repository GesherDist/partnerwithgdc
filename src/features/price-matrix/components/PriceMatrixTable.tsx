'use client';

/**
 * Price Matrix Table Component
 *
 * Data table for displaying and managing price matrix entries.
 */

import { useState, useCallback } from 'react';
import { DataTable } from '@/shared/components/data-table/DataTable';
import { getPriceMatrixTableColumns } from './PriceMatrixTableColumns';
import { EditPriceMatrixDrawer } from './EditPriceMatrixDrawer';
import type { PriceMatrixTableRow } from '../types';
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
import { toast } from 'sonner';
import { deletePriceMatrixEntry } from '../actions';

interface PriceMatrixTableProps {
  data: PriceMatrixTableRow[];
  isLoading?: boolean;
  showProduct?: boolean;
  onRefresh?: () => void;
}

export function PriceMatrixTable({
  data,
  isLoading = false,
  showProduct = false,
  onRefresh,
}: PriceMatrixTableProps) {
  // Edit drawer state
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<PriceMatrixTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = useCallback((entry: PriceMatrixTableRow) => {
    setSelectedEntryId(entry.id);
    setEditDrawerOpen(true);
  }, []);

  const handleDeleteClick = useCallback((entry: PriceMatrixTableRow) => {
    setEntryToDelete(entry);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) { return; }

    setIsDeleting(true);
    try {
      const result = await deletePriceMatrixEntry(entryToDelete.id);

      if (result.success) {
        toast.success('Price entry deleted successfully');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to delete price entry');
      }
    } catch {
      toast.error('An error occurred while deleting the price entry');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    }
  };

  const handleEditSuccess = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  const columns = getPriceMatrixTableColumns({
    onEdit: handleEdit,
    onDelete: handleDeleteClick,
    showProduct,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        filterPlaceholder="Filter prices..."
        loading={isLoading}
        enableGlobalFilter
        searchableColumns={['productSku', 'productName']}
        showPagination={data.length > 10}
        defaultPageSize={10}
      />

      {/* Edit Drawer */}
      <EditPriceMatrixDrawer
        open={editDrawerOpen}
        entryId={selectedEntryId}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Price Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the{' '}
              <span className="font-semibold">
                {entryToDelete?.channel.toUpperCase()} {entryToDelete?.quantityRange}
              </span>{' '}
              price tier? This action cannot be undone.
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
