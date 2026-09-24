'use client';

/**
 * Platinum Dealers Page Content
 *
 * Client component for managing platinum dealers.
 * Follows the same pattern as Quotes module.
 */

import { useState, useCallback, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
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

import { PlatinumDealersTable } from './platinum-dealers-table';
import { CreateDealerDrawer } from './create-dealer-drawer';
import { EditDealerDialog } from './edit-dealer-dialog';
import { ViewDealerDrawer } from './view-dealer-drawer';
import {
  getAllDealersAction,
  deleteDealerAction,
} from '@/features/platinum-dealers/actions';
import type {
  PlatinumDealer,
  DealerStatus,
} from '@/features/platinum-dealers/types';

// ============================================
// COMPONENT
// ============================================

export function PlatinumDealersContent() {
  const { hasPermission } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canCreate = hasMounted && hasPermission('suppliers.create');
  const canViewDetail = hasMounted && hasPermission('suppliers.view_detail');
  const canEdit = hasMounted && hasPermission('suppliers.update');
  const canDelete = hasMounted && hasPermission('suppliers.delete');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Data
  const [dealers, setDealers] = useState<PlatinumDealer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealerToDelete, setDealerToDelete] = useState<PlatinumDealer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter
  const [statusFilter, setStatusFilter] = useState<DealerStatus | 'all'>('all');

  // ----------------------------------------
  // DATA LOADING
  // ----------------------------------------

  const loadDealers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAllDealersAction({
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });

      if (result.success && result.data) {
        setDealers(result.data);
      } else {
        toast.error(result.error || 'Failed to load dealers');
      }
    } catch (error) {
      console.error('Error loading dealers:', error);
      toast.error('Failed to load dealers');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  // Load dealers on mount and when filter changes
  useEffect(() => {
    loadDealers();
  }, [loadDealers]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  // Create
  const handleCreateClick = () => {
    setIsCreateDrawerOpen(true);
  };

  const handleCreateDrawerClose = useCallback(() => {
    setIsCreateDrawerOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    loadDealers();
  }, [loadDealers]);

  // View
  const handleView = useCallback((dealer: PlatinumDealer) => {
    setSelectedDealerId(dealer.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleRowClick = useCallback((dealer: PlatinumDealer) => {
    setSelectedDealerId(dealer.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedDealerId(null);
  }, []);

  // Edit (can be triggered from view drawer or table actions)
  const handleEdit = useCallback((dealer: PlatinumDealer) => {
    setSelectedDealerId(dealer.id);
    setIsViewDrawerOpen(false); // Close view drawer if open
    setIsEditDrawerOpen(true);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedDealerId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    loadDealers();
  }, [loadDealers]);

  // Delete
  const handleDeleteClick = useCallback((dealer: PlatinumDealer) => {
    setDealerToDelete(dealer);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!dealerToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteDealerAction(dealerToDelete.id);
      if (result.success) {
        toast.success(`Dealer ${dealerToDelete.dealerName} deleted`);
        loadDealers();
      } else {
        toast.error(result.error || 'Failed to delete dealer');
      }
    } catch {
      toast.error('Failed to delete dealer');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDealerToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDealerToDelete(null);
  };

  // Refresh
  const handleRefresh = () => {
    loadDealers();
  };

  // Filter
  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as DealerStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Platinum Dealers"
        description="Manage your platinum dealer network and their inventory."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <Button onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                Add Dealer
              </Button>
            )}
          </div>
        }
      />

      {/* Dealers Table */}
      <PlatinumDealersTable
        data={dealers}
        isLoading={isLoading}
        onRowClick={canViewDetail ? handleRowClick : undefined}
        onView={canViewDetail ? handleView : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDeleteClick : undefined}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {/* View Dealer Drawer */}
      <ViewDealerDrawer
        dealerId={selectedDealerId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={canEdit ? handleEdit : undefined}
      />

      {/* Create Dealer Drawer */}
      <CreateDealerDrawer
        open={isCreateDrawerOpen}
        onClose={handleCreateDrawerClose}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dealer Dialog */}
      <EditDealerDialog
        dealerId={selectedDealerId}
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dealer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete dealer{' '}
              <span className="font-semibold">{dealerToDelete?.dealerName}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
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
    </div>
  );
}
