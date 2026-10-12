'use client';

import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Button } from '@/shared/components/ui/button';
import {
  ShoppingCart,
  User,
  Package,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { getInventoryAllocations } from '../actions';
import type { InventoryAllocationDetail } from '../types';
import Link from 'next/link';

interface InventoryAllocationsListProps {
  productId: string | null;
  locationId: string | null;
  sourceType?: 'warehouse' | 'dealer';
  totalAllocated?: number;
}

export function InventoryAllocationsList({
  productId,
  locationId,
  sourceType = 'warehouse',
  totalAllocated = 0,
}: InventoryAllocationsListProps) {
  const [allocations, setAllocations] = useState<InventoryAllocationDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchAllocations = useCallback(async () => {
    if (!productId || !locationId) {
      setAllocations([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getInventoryAllocations(productId, locationId, sourceType);

      if (result.success && result.data) {
        setAllocations(result.data);
      } else {
        setError(result.error || 'Failed to fetch allocations');
        setAllocations([]);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setAllocations([]);
      console.error('fetchAllocations error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [productId, locationId, sourceType]);

  useEffect(() => {
    if (isExpanded) {
      fetchAllocations();
    }
  }, [fetchAllocations, isExpanded]);

  // Don't render if no allocations exist
  if (totalAllocated === 0) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      allocated: { label: 'Allocated', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      partially_fulfilled: { label: 'Partial', className: 'bg-purple-100 text-purple-800 border-purple-200' },
      fulfilled: { label: 'Fulfilled', className: 'bg-green-100 text-green-800 border-green-200' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800 border-gray-200' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <Badge variant="outline" className={cn('text-xs', config.className)}>
        {config.label}
      </Badge>
    );
  };

  const getSOStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
      confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800' },
      processing: { label: 'Processing', className: 'bg-yellow-100 text-yellow-800' },
      shipped: { label: 'Shipped', className: 'bg-purple-100 text-purple-800' },
      delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <Badge variant="outline" className={cn('text-xs', config.className)}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header with expand/collapse */}
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Allocation Details
          <Badge variant="secondary" className="ml-2">
            {totalAllocated} units
          </Badge>
        </h3>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      {/* Collapsed hint */}
      {!isExpanded && (
        <p className="text-xs text-muted-foreground">
          Click to see which Sales Orders have this inventory allocated
        </p>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-800 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No allocation details found
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {allocations.map((allocation) => (
                <div
                  key={allocation.id}
                  className="border rounded-lg p-3 space-y-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  {/* Header: SO Number and Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/sales-orders?view=${allocation.salesOrderId}`}
                        className="font-medium text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {allocation.salesOrderNumber}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {getSOStatusBadge(allocation.salesOrderStatus)}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">
                        {allocation.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">units</span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{allocation.customerName}</span>
                  </div>

                  {/* Product/SKU Info */}
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Item:</span>
                    <span className="font-mono text-xs">{allocation.sku}</span>
                    {allocation.description && (
                      <span className="text-muted-foreground truncate max-w-[150px]">
                        - {allocation.description}
                      </span>
                    )}
                  </div>

                  {/* Footer: Allocation Status and Date */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    {getStatusBadge(allocation.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(allocation.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {!isLoading && !error && allocations.length > 0 && (
            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
              Total: {allocations.reduce((sum, a) => sum + a.quantity, 0)} units across{' '}
              {allocations.length} allocation{allocations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
