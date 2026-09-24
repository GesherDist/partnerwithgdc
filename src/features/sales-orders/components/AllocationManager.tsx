/**
 * AllocationManager Component
 *
 * Main UI for managing fulfillment allocations for a sales order item.
 * Allows creating, viewing, editing, and deleting allocations from multiple sources.
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Plus, Edit2, Trash2, AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FulfillmentAllocation, FulfillmentAllocationWithDetails, FulfillmentSource } from '@/features/sales-orders/types';
import {
  getAllocationsForItemAction,
  cancelAllocationAction,
} from '@/features/sales-orders/actions/fulfillment-allocation.actions';
import { CreateAllocationDialog } from './CreateAllocationDialog';
import { EditAllocationDialog } from './EditAllocationDialog';
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

// ============================================
// TYPES
// ============================================

interface AllocationManagerProps {
  salesOrderItemId: string;
  productId: string;
  productName: string;
  customerQty: number;
  onAllocationsChange?: () => void;
}

interface AllocationSummary {
  allocations: FulfillmentAllocationWithDetails[];
  totalAllocated: number;
  customerQty: number;
  remainingToAllocate: number;
  fullyAllocated: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSourceLabel(source: FulfillmentSource): string {
  const labels: Record<FulfillmentSource, string> = {
    direct: 'Manufacturer (Direct)',
    gdc_inventory: 'GDC Inventory',
    platinum_dealer_inventory: 'Dealer Inventory',
    platinum_dealer_fulfillment: 'Dealer Fulfillment',
  };
  return labels[source];
}

function getSourceBadgeVariant(
  source: FulfillmentSource
): 'default' | 'secondary' | 'outline' | 'destructive' {
  const variants: Record<FulfillmentSource, 'default' | 'secondary' | 'outline'> = {
    direct: 'default',
    gdc_inventory: 'secondary',
    platinum_dealer_inventory: 'outline',
    platinum_dealer_fulfillment: 'outline',
  };
  return variants[source];
}

function getStatusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    pending: 'outline',
    allocated: 'secondary',
    partially_fulfilled: 'default',
    fulfilled: 'default',
    cancelled: 'destructive',
  };
  return variants[status] || 'outline';
}

// ============================================
// COMPONENT
// ============================================

export function AllocationManager({
  salesOrderItemId,
  productId,
  productName,
  customerQty,
}: AllocationManagerProps) {

  // State
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<FulfillmentAllocation | null>(null);

  // ============================================
  // DATA FETCHING
  // ============================================

  async function loadAllocations() {
    try {
      setLoading(true);
      const result = await getAllocationsForItemAction(salesOrderItemId);

      if (result.success && result.data) {
        setSummary(result.data);
      } else {
        toast.error(result.error || 'Failed to load allocations');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllocations();
  }, [salesOrderItemId]);

  // ============================================
  // HANDLERS
  // ============================================

  function handleCreateSuccess() {
    setCreateDialogOpen(false);
    loadAllocations();
    // Removed onAllocationsChange - no need to reload entire drawer
    toast.success('Allocation created successfully');
  }

  function handleEditSuccess() {
    setEditDialogOpen(false);
    setSelectedAllocation(null);
    loadAllocations();
    // Removed onAllocationsChange - no need to reload entire drawer
    toast.success('Allocation updated successfully');
  }

  function handleEdit(allocation: FulfillmentAllocation) {
    setSelectedAllocation(allocation);
    setEditDialogOpen(true);
  }

  function handleDeleteClick(allocation: FulfillmentAllocation) {
    setSelectedAllocation(allocation);
    setDeleteDialogOpen(true);
  }

  async function handleConfirmDelete() {
    if (!selectedAllocation) return;

    try {
      setDeletingId(selectedAllocation.id);
      const result = await cancelAllocationAction(selectedAllocation.id);

      if (result.success) {
        toast.success('Allocation cancelled successfully');
        setDeleteDialogOpen(false);
        setSelectedAllocation(null);
        loadAllocations();
        // Removed onAllocationsChange - no need to reload entire drawer
      } else {
        toast.error(result.error || 'Failed to cancel allocation');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setDeletingId(null);
    }
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading allocations...
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load allocations</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { allocations, totalAllocated, remainingToAllocate, fullyAllocated } = summary;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fulfillment Allocations</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{productName}</p>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} disabled={fullyAllocated}>
              <Plus className="h-4 w-4 mr-2" />
              Add Allocation
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Customer Quantity</p>
              <p className="text-2xl font-bold">{customerQty}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Total Allocated</p>
              <p className="text-2xl font-bold">{totalAllocated}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p
                className={`text-2xl font-bold ${
                  remainingToAllocate === 0 ? 'text-green-600' : 'text-orange-600'
                }`}
              >
                {remainingToAllocate}
              </p>
            </div>
          </div>

          {/* Fully Allocated Alert */}
          {fullyAllocated && (
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                This item is fully allocated. All {customerQty} units have been assigned to
                fulfillment sources.
              </AlertDescription>
            </Alert>
          )}

          {/* Allocations Table */}
          {allocations.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No allocations yet. Click "Add Allocation" to assign fulfillment sources.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location/Dealer</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation) => (
                    <TableRow key={allocation.id}>
                      <TableCell>
                        <Badge variant={getSourceBadgeVariant(allocation.fulfillmentSource)}>
                          {getSourceLabel(allocation.fulfillmentSource)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{allocation.quantity}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(allocation.status)}>
                          {allocation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {allocation.location?.name ||
                          allocation.platinumDealer?.dealerName ||
                          allocation.dealerLocation?.locationName ||
                          '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(allocation)}
                            disabled={allocation.status === 'fulfilled'}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          {/* Only show delete button when status is "pending" */}
                          {allocation.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(allocation)}
                              disabled={deletingId === allocation.id}
                            >
                              {deletingId === allocation.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateAllocationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        salesOrderItemId={salesOrderItemId}
        productId={productId}
        remainingToAllocate={remainingToAllocate}
        onSuccess={handleCreateSuccess}
      />

      {selectedAllocation && (
        <EditAllocationDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          allocation={selectedAllocation}
          productId={productId}
          remainingToAllocate={remainingToAllocate}
          onSuccess={handleEditSuccess}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Allocation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the allocation and deallocate the inventory. This action cannot be undone.
              {selectedAllocation?.status === 'pending' && (
                <span className="block mt-2 text-sm text-muted-foreground">
                  💡 <strong>Tip:</strong> To change the fulfillment source type, delete this allocation and create a new one with the desired type.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete Allocation</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
