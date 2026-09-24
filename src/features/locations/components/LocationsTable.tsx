'use client';

/**
 * Locations Table Component
 *
 * Data table for displaying and managing locations.
 * Uses drawers for view/edit operations.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/shared/components/data-table/DataTable';
import { getLocationsTableColumns } from './LocationsTableColumns';
import { ViewLocationDrawer } from './ViewLocationDrawer';
import { EditLocationDrawer } from './EditLocationDrawer';
import type { LocationTableRow } from '../types';
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
import { deleteLocation } from '../actions';

interface LocationsTableProps {
  data: LocationTableRow[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function LocationsTable({ data, isLoading = false, onRefresh }: LocationsTableProps) {
  const router = useRouter();

  // Drawer state
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<LocationTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleView = useCallback((location: LocationTableRow) => {
    setSelectedLocationId(location.id);
    setViewDrawerOpen(true);
  }, []);

  const handleEdit = useCallback((location: LocationTableRow) => {
    setSelectedLocationId(location.id);
    setEditDrawerOpen(true);
  }, []);

  const handleEditFromView = useCallback((locationId: string) => {
    setViewDrawerOpen(false);
    setSelectedLocationId(locationId);
    setEditDrawerOpen(true);
  }, []);

  const handleDeleteClick = useCallback((location: LocationTableRow) => {
    setLocationToDelete(location);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!locationToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteLocation(locationToDelete.id);

      if (result.success) {
        toast.success('Location deleted successfully');
        onRefresh?.();
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to delete location');
      }
    } catch {
      toast.error('An error occurred while deleting the location');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setLocationToDelete(null);
    }
  };

  const handleDrawerSuccess = useCallback(() => {
    onRefresh?.();
    router.refresh();
  }, [onRefresh, router]);

  const columns = getLocationsTableColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteClick,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        filterPlaceholder="Filter locations..."
        loading={isLoading}
        enableGlobalFilter
        searchableColumns={['name', 'code']}
        onRowClick={handleView}
      />

      {/* View Drawer */}
      <ViewLocationDrawer
        open={viewDrawerOpen}
        locationId={selectedLocationId}
        onClose={() => setViewDrawerOpen(false)}
        onEdit={handleEditFromView}
      />

      {/* Edit Drawer */}
      <EditLocationDrawer
        open={editDrawerOpen}
        locationId={selectedLocationId}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={handleDrawerSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{locationToDelete?.name}</span>? This
              action can be undone by an administrator.
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
