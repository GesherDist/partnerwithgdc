'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Pencil, ArrowUpDown, Package, MapPin, AlertTriangle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useInventoryItem } from '../hooks/useInventoryItem';
import type { ViewInventoryDrawerProps } from '../types';

export function ViewInventoryDrawer({
  open,
  onClose,
  inventoryId,
  onEdit,
  onAdjust,
}: ViewInventoryDrawerProps) {
  const { data: inventory, isLoading } = useInventoryItem(open ? inventoryId : null);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </>
              ) : inventory ? (
                <>
                  <SheetTitle className="text-xl">
                    {inventory.product?.sku || 'Unknown SKU'}
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {inventory.product?.name || 'Unknown Product'}
                  </p>
                </>
              ) : null}
            </div>
            {inventory && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium',
                  inventory.isLowStock
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                )}
              >
                {inventory.isLowStock ? 'Low Stock' : 'In Stock'}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : inventory ? (
          <div className="mt-6 space-y-6">
            {/* Location Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Location
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{inventory.location?.name || 'Unknown'}</p>
                  {inventory.location?.code && (
                    <p className="text-muted-foreground font-mono text-xs">
                      {inventory.location.code}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Quantities */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Quantities
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{inventory.onHand}</p>
                  <p className="text-xs text-muted-foreground">On Hand</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-muted-foreground">{inventory.allocated}</p>
                  <p className="text-xs text-muted-foreground">Allocated</p>
                </div>
                <div className={cn(
                  "text-center p-4 rounded-lg",
                  inventory.isLowStock ? "bg-amber-50" : "bg-emerald-50"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    inventory.isLowStock ? "text-amber-600" : "text-emerald-600"
                  )}>
                    {inventory.available}
                  </p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Reorder Settings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Reorder Settings
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reorder Point</span>
                  <span className="font-medium">{inventory.reorderPoint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reorder Qty</span>
                  <span className="font-medium">{inventory.reorderQty}</span>
                </div>
              </div>

              {inventory.isLowStock && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Available quantity ({inventory.available}) is at or below reorder point ({inventory.reorderPoint})
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* Product Details */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Product Details
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">{inventory.product?.name || 'Unknown'}</p>
                  <p className="text-muted-foreground font-mono text-xs">
                    SKU: {inventory.product?.sku || 'N/A'}
                  </p>
                  {inventory.product?.unitCode && (
                    <p className="text-muted-foreground text-xs">
                      Unit: {inventory.product.unitCode}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <Separator />
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" onClick={onEdit} className="flex-1">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {onAdjust && (
                <Button onClick={onAdjust} className="flex-1">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Adjust
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Inventory record not found
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
