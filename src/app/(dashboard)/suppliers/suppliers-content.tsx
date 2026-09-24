'use client';

/**
 * Suppliers Page Content
 *
 * Client component for suppliers list with dialog functionality.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { toast } from 'sonner';
import { SuppliersTable, SupplierFormDialog, ViewSupplierDrawer } from '@/features/suppliers';
import { deleteSupplierAction } from '@/features/suppliers/actions';
import type { Supplier } from '@/features/suppliers/types';
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

interface SuppliersPageContentProps {
  suppliers: Supplier[];
  total: number;
  canCreate: boolean;
  canEdit: boolean;
}

export function SuppliersPageContent({
  suppliers,
  total: _total,
  canCreate,
  canEdit,
}: SuppliersPageContentProps) {
  const router = useRouter();

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  const handleRowClick = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setIsViewDrawerOpen(true);
  }, []);

  const handleCloseViewDrawer = useCallback(() => {
    setIsViewDrawerOpen(false);
    // Clear selection after animation completes
    setTimeout(() => setSelectedSupplier(null), 300);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingSupplier(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((supplier: Supplier) => {
    // Open edit dialog (keep view drawer open)
    setEditingSupplier(supplier);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback((supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!supplierToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteSupplierAction(supplierToDelete.id);

      if (result.error) {
        toast.error('Error', {
          description: result.error,
        });
      } else {
        toast.success('Supplier Deleted', {
          description: `${supplierToDelete.name} has been deleted successfully.`,
        });
        // Close view drawer if open
        setIsViewDrawerOpen(false);
        setSelectedSupplier(null);
        // Refresh the page
        router.refresh();
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to delete supplier',
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  }, [supplierToDelete, router]);

  const handleSuccess = useCallback((updatedSupplier?: Supplier) => {
    setDialogOpen(false);
    setEditingSupplier(null);

    // If drawer is open and we have updated supplier data, update it
    if (isViewDrawerOpen && updatedSupplier) {
      setSelectedSupplier(updatedSupplier);
    }

    // Refresh the table
    router.refresh();
  }, [router, isViewDrawerOpen]);

  const handleRefresh = useCallback(async () => {
    setIsSyncing(true);
    try {
      router.refresh();
      toast.success('Suppliers refreshed');
    } catch (error) {
      toast.error('Failed to refresh suppliers');
    } finally {
      // Add a small delay to show the animation
      setTimeout(() => setIsSyncing(false), 500);
    }
  }, [router]);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Suppliers"
        description="Manage supplier companies and portal access"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isSyncing}
              className="h-10 w-10"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            )}
          </div>
        }
      />

      {/* Suppliers Table */}
      <SuppliersTable
        suppliers={suppliers}
        onRowClick={handleRowClick}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={handleDelete}
      />

      {/* View Supplier Drawer */}
      <ViewSupplierDrawer
        supplier={selectedSupplier}
        open={isViewDrawerOpen}
        onClose={handleCloseViewDrawer}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={handleDelete}
      />

      {/* Supplier Form Dialog */}
      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier}
        onSuccess={handleSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{supplierToDelete?.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
