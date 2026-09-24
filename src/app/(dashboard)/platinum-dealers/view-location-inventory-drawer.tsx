'use client';

/**
 * ViewLocationInventoryDrawer Component
 *
 * Displays inventory for a specific platinum dealer location.
 * Shows products, on-hand, allocated, and available quantities.
 * Allows adjusting inventory quantities.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Package,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
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

import { getAllInventoryForDealerAction, deleteDealerInventoryAction } from '@/features/platinum-dealers/actions';
import type { PlatinumDealerInventoryWithDetails } from '@/features/platinum-dealers/types';
import type { PlatinumDealerLocation } from '@/features/platinum-dealers/types';
import { AdjustDealerInventoryDialog } from './adjust-dealer-inventory-dialog';
import { AddDealerInventoryDialog } from './add-dealer-inventory-dialog';

// ============================================
// TYPES
// ============================================

interface ViewLocationInventoryDrawerProps {
  open: boolean;
  location: PlatinumDealerLocation | null;
  onClose: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function ViewLocationInventoryDrawer({
  open,
  location,
  onClose,
}: ViewLocationInventoryDrawerProps) {
  const [inventory, setInventory] = useState<PlatinumDealerInventoryWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<PlatinumDealerInventoryWithDetails | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PlatinumDealerInventoryWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch inventory for this location
  const fetchInventory = useCallback(async () => {
    if (!location) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getAllInventoryForDealerAction(location.dealerId, {
        dealerLocationId: location.id,
      });

      if (result.success && result.data) {
        setInventory(result.data);
      } else {
        setError(result.error || 'Failed to load inventory');
      }
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  }, [location]);

  useEffect(() => {
    if (open && location) {
      fetchInventory();
    } else {
      setInventory([]);
      setError(null);
    }
  }, [open, location, fetchInventory]);

  // Action handlers
  const handleAdd = () => {
    setAddDialogOpen(true);
  };

  const handleAddSuccess = () => {
    fetchInventory();
  };

  const handleAdjust = (item: PlatinumDealerInventoryWithDetails) => {
    setSelectedInventoryItem(item);
    setAdjustDialogOpen(true);
  };

  const handleAdjustSuccess = () => {
    fetchInventory();
  };

  const handleDeleteClick = (item: PlatinumDealerInventoryWithDetails) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteDealerInventoryAction({
        dealerLocationId: itemToDelete.dealerLocationId,
        productId: itemToDelete.productId,
      });

      if (result.success) {
        toast.success(`${itemToDelete.product.sku} removed from inventory`);
        fetchInventory();
      } else {
        toast.error(result.error || 'Failed to delete inventory');
      }
    } catch {
      toast.error('Failed to delete inventory');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-[900px]"
        >
          {/* Header */}
          <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-xl font-semibold">
              {location?.locationName} Inventory
            </SheetTitle>
            <SheetDescription>
              {location?.addressCity}, {location?.addressState}
            </SheetDescription>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="px-6 py-6">
              {/* Loading State */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : error ? (
                /* Error State */
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button variant="outline" onClick={fetchInventory}>
                    Try Again
                  </Button>
                </div>
              ) : inventory.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
                  <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No inventory found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    This location doesn't have any inventory yet.
                  </p>
                  <Button onClick={handleAdd}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Inventory
                  </Button>
                </div>
              ) : (
                /* Inventory Table */
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {inventory.length} {inventory.length === 1 ? 'product' : 'products'}
                      </span>
                    </div>
                    <Button size="sm" onClick={handleAdd}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Inventory
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>SKU</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">On Hand</TableHead>
                          <TableHead className="text-right">Allocated</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono font-medium">
                              {item.product.sku}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[300px]">
                                <p className="font-medium truncate">
                                  {item.product.description}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary" className="font-mono">
                                {item.onHand}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="font-mono">
                                {item.allocated}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={item.available > 0 ? 'default' : 'secondary'}
                                className={
                                  item.available > 0
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono'
                                    : 'font-mono'
                                }
                              >
                                {item.available}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Open menu</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleAdjust(item)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Adjust Quantity
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteClick(item)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total On Hand</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {inventory.reduce((sum, item) => sum + item.onHand, 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Allocated</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {inventory.reduce((sum, item) => sum + item.allocated, 0)}
                      </p>
                    </div>
                    <div className="rounded-lg border p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Available</p>
                      <p className="text-2xl font-bold text-sky-600">
                        {inventory.reduce((sum, item) => sum + item.available, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Add Inventory Dialog */}
      {location && (
        <AddDealerInventoryDialog
          open={addDialogOpen}
          dealerId={location.dealerId}
          dealerLocationId={location.id}
          locationName={location.locationName}
          onClose={() => setAddDialogOpen(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {/* Adjust Inventory Dialog */}
      <AdjustDealerInventoryDialog
        open={adjustDialogOpen}
        item={selectedInventoryItem}
        onClose={() => {
          setAdjustDialogOpen(false);
          setSelectedInventoryItem(null);
        }}
        onSuccess={handleAdjustSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold font-mono">{itemToDelete?.product.sku}</span>{' '}
              from this location's inventory? This action cannot be undone.
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
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
