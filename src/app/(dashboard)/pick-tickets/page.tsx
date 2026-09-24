'use client';

/**
 * Pick Tickets Page
 *
 * Main page for managing warehouse pick tickets.
 * Part of the Pick -> Pack -> Ship fulfillment workflow.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
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

import {
  PickTicketsTable,
  ViewPickTicketDrawer,
  EditPickTicketDrawer,
  AssignPickTicketDialog,
  usePickTickets,
} from '@/features/pick-tickets';
import { deletePickTicket, startPicking } from '@/features/pick-tickets/actions';
import type { PickTicketListItem, PickTicketStatus, PickTicketWithItems } from '@/features/pick-tickets/types';
import { PICK_TICKET_STATUS_LABELS } from '@/features/pick-tickets/types';

export default function PickTicketsPage() {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedPickTicketId, setSelectedPickTicketId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pickTicketToDelete, setPickTicketToDelete] = useState<PickTicketListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [pickTicketToAssign, setPickTicketToAssign] = useState<PickTicketListItem | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<PickTicketStatus | 'all'>('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Memoize params to prevent unnecessary re-renders
  const pickTicketsParams = useMemo(() => ({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    page,
    limit: pageSize,
  }), [statusFilter, page, pageSize]);

  const {
    data: pickTickets,
    meta,
    isLoading: isPickTicketsLoading,
    refetch: refetchPickTickets,
  } = usePickTickets(pickTicketsParams);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleView = useCallback((pickTicket: PickTicketListItem) => {
    setSelectedPickTicketId(pickTicket.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedPickTicketId(null);
  }, []);

  const handleEdit = useCallback((pickTicket: PickTicketListItem | PickTicketWithItems) => {
    setSelectedPickTicketId(pickTicket.id);
    // Close the view drawer first so the edit modal is the only surface on
    // screen. The sheet's close animation is 300ms (see ui/sheet.tsx).
    setIsViewDrawerOpen(false);
    setTimeout(() => setIsEditDrawerOpen(true), 320);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    // Don't clear selectedPickTicketId here as view drawer might still need it
  }, []);

  const handleEditSuccess = useCallback(() => {
    refetchPickTickets();
  }, [refetchPickTickets]);

  const handleAssign = useCallback((pickTicket: PickTicketListItem) => {
    setPickTicketToAssign(pickTicket);
    setAssignDialogOpen(true);
  }, []);

  const handleAssignDialogClose = useCallback(() => {
    setAssignDialogOpen(false);
    setPickTicketToAssign(null);
  }, []);

  const handleAssignSuccess = useCallback(() => {
    refetchPickTickets();
  }, [refetchPickTickets]);

  const handleStartPicking = useCallback(async (pickTicket: PickTicketListItem | PickTicketWithItems) => {
    try {
      const result = await startPicking(pickTicket.id);
      if (result.success) {
        toast.success(`Started picking for ${pickTicket.pickTicketNumber}`);
        refetchPickTickets();
      } else {
        toast.error(result.error || 'Failed to start picking');
      }
    } catch {
      toast.error('Failed to start picking');
    }
  }, [refetchPickTickets]);

  const handleDeleteClick = useCallback((pickTicket: PickTicketListItem) => {
    setPickTicketToDelete(pickTicket);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!pickTicketToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deletePickTicket(pickTicketToDelete.id);
      if (result.success) {
        toast.success(`Pick ticket ${pickTicketToDelete.pickTicketNumber} deleted`);
        refetchPickTickets();
      } else {
        toast.error(result.error || 'Failed to delete pick ticket');
      }
    } catch {
      toast.error('Failed to delete pick ticket');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setPickTicketToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setPickTicketToDelete(null);
  };

  const handleRowClick = useCallback((pickTicket: PickTicketListItem) => {
    handleView(pickTicket);
  }, [handleView]);

  const handleRefresh = () => {
    refetchPickTickets();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as PickTicketStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Pick Tickets"
        description="Warehouse fulfillment: Pick items from inventory for sales orders."
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isPickTicketsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isPickTicketsLoading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      {/* Pick Tickets Table */}
      <PickTicketsTable
        data={pickTickets}
        isLoading={isPickTicketsLoading}
        onRowClick={handleRowClick}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onAssign={handleAssign}
        onStartPicking={handleStartPicking}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(PICK_TICKET_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(1);
          },
        }}
      />

      {/* View Pick Ticket Drawer */}
      <ViewPickTicketDrawer
        pickTicketId={selectedPickTicketId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={handleEdit}
        onStartPicking={handleStartPicking}
        onPackingListCreated={refetchPickTickets}
      />

      {/* Edit Pick Ticket Drawer */}
      <EditPickTicketDrawer
        pickTicketId={selectedPickTicketId}
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pick Ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete pick ticket{' '}
              <span className="font-semibold">{pickTicketToDelete?.pickTicketNumber}</span>?
              This action cannot be undone. Only pending or cancelled pick tickets can be deleted.
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

      {/* Assign Pick Ticket Dialog */}
      <AssignPickTicketDialog
        pickTicket={pickTicketToAssign}
        open={assignDialogOpen}
        onClose={handleAssignDialogClose}
        onSuccess={handleAssignSuccess}
      />
    </div>
  );
}
