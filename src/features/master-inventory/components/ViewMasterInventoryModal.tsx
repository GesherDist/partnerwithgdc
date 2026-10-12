'use client';

/**
 * View Master Inventory Modal
 *
 * Shows detailed inventory information with allocation breakdown
 * across Sales Orders and Customers in a centered modal dialog
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Package,
  MapPin,
  Building2,
  ShoppingCart,
  User,
  ExternalLink,
  AlertCircle,
  Loader2,
  Warehouse,
  Truck,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import Link from 'next/link';
import type { ViewMasterInventoryDrawerProps } from '../types';
import { getInventoryAllocationsForMaster } from '../actions';

interface AllocationDetail {
  id: string;
  quantity: number;
  status: string;
  fulfillmentSource: string;
  createdAt: Date;
  salesOrderId: string;
  salesOrderNumber: string;
  salesOrderStatus: string;
  customerId: string;
  customerName: string;
  salesOrderItemId: string;
  sku: string;
  description: string;
}

export function ViewMasterInventoryModal({
  open,
  onClose,
  item,
}: ViewMasterInventoryDrawerProps) {
  const [allocations, setAllocations] = useState<AllocationDetail[]>([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false);
  const [allocationError, setAllocationError] = useState<string | null>(null);

  // Fetch allocations when modal opens
  const fetchAllocations = useCallback(async () => {
    if (!item || item.allocated === 0) {
      setAllocations([]);
      return;
    }

    setIsLoadingAllocations(true);
    setAllocationError(null);

    try {
      const result = await getInventoryAllocationsForMaster(
        item.productId,
        item.sourceType === 'warehouse' ? item.locationId : item.dealerLocationId || item.locationId,
        item.sourceType,
        item.dealerId // Pass dealerId for fetching fulfillment allocations
      );

      if (result.success) {
        setAllocations(result.data);
      } else {
        setAllocationError(result.error || 'Failed to fetch allocations');
        setAllocations([]);
      }
    } catch (err) {
      setAllocationError('An unexpected error occurred');
      setAllocations([]);
      console.error('fetchAllocations error:', err);
    } finally {
      setIsLoadingAllocations(false);
    }
  }, [item]);

  // Auto-fetch allocations when modal opens
  useEffect(() => {
    if (open && item && item.allocated > 0) {
      fetchAllocations();
    }
  }, [open, item, fetchAllocations]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setAllocations([]);
      setAllocationError(null);
    }
  }, [open]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      allocated: { label: 'Allocated', className: 'bg-blue-100 text-blue-800 border-blue-300' },
      partially_fulfilled: { label: 'Partial', className: 'bg-purple-100 text-purple-800 border-purple-300' },
      fulfilled: { label: 'Fulfilled', className: 'bg-green-100 text-green-800 border-green-300' },
      cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800 border-gray-300' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
        {config.label}
      </Badge>
    );
  };

  const getSOStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-300' },
      confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      processing: { label: 'Processing', className: 'bg-amber-100 text-amber-800 border-amber-300' },
      shipped: { label: 'Shipped', className: 'bg-violet-100 text-violet-800 border-violet-300' },
      delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 border-green-300' },
      cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-300' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
        {config.label}
      </Badge>
    );
  };

  const getFulfillmentSourceBadge = (source: string) => {
    const sourceConfig: Record<string, { label: string; className: string; icon: typeof Warehouse }> = {
      gdc_inventory: {
        label: 'GDC Inventory',
        className: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: Warehouse
      },
      platinum_dealer_inventory: {
        label: 'Dealer Inventory',
        className: 'bg-purple-100 text-purple-800 border-purple-300',
        icon: Warehouse
      },
      platinum_dealer_fulfillment: {
        label: 'Dealer Fulfillment',
        className: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        icon: Truck
      },
      direct: {
        label: 'Direct',
        className: 'bg-teal-100 text-teal-800 border-teal-300',
        icon: Truck
      },
    };

    const config = sourceConfig[source] || {
      label: source?.replace(/_/g, ' ') || 'Unknown',
      className: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: Package
    };
    const IconComponent = config.icon;

    return (
      <Badge variant="outline" className={cn('text-xs font-medium gap-1', config.className)}>
        <IconComponent className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {item ? (
                <>
                  <DialogTitle className="text-xl font-bold text-slate-900">
                    {item.productSku}
                  </DialogTitle>
                  <p className="text-sm text-slate-500">{item.productName}</p>
                </>
              ) : (
                <>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        {!item ? (
          <div className="p-6 space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="flex flex-col max-h-[70vh]">
            {/* Location & Quantities - Fixed Section */}
            <div className="px-6 py-4 bg-white border-b">
              <div className="grid grid-cols-2 gap-6">
                {/* Location */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Location
                  </h3>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">{item.locationName}</p>
                      {item.locationCode && (
                        <p className="text-xs text-slate-500 font-mono">{item.locationCode}</p>
                      )}
                      {(item.locationCity || item.locationState) && (
                        <p className="text-xs text-slate-500">
                          {[item.locationCity, item.locationState].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {item.sourceType === 'platinum_dealer' && item.dealerName && (
                    <div className="flex items-start gap-2 mt-3 p-2 bg-purple-50 rounded-lg border border-purple-100">
                      <Building2 className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-purple-400 font-medium">Platinum Dealer</p>
                        <p className="font-semibold text-purple-700">{item.dealerName}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quantities */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Quantities
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                      <p className="text-2xl font-bold text-emerald-600">{item.onHand}</p>
                      <p className="text-xs text-emerald-600/70 font-medium">On Hand</p>
                    </div>
                    <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-2xl font-bold text-amber-600">{item.allocated}</p>
                      <p className="text-xs text-amber-600/70 font-medium">Allocated</p>
                    </div>
                    <div className="text-center p-3 bg-sky-50 rounded-lg border border-sky-100">
                      <p className="text-2xl font-bold text-sky-600">{item.available}</p>
                      <p className="text-xs text-sky-600/70 font-medium">Available</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocation Details - Scrollable Section */}
            {item.allocated > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Allocation Header */}
                <div className="px-6 py-3 bg-slate-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Allocation Details</h3>
                    <Badge variant="secondary" className="bg-slate-200 text-slate-700 font-semibold">
                      {item.allocated} units
                    </Badge>
                  </div>
                  {isLoadingAllocations && (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  )}
                </div>

                {/* Allocation List - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-3 space-y-3 bg-slate-50/50 max-h-[300px]">
                  {isLoadingAllocations ? (
                    <div className="space-y-3">
                      <Skeleton className="h-28 w-full" />
                      <Skeleton className="h-28 w-full" />
                    </div>
                  ) : allocationError ? (
                    <div className="flex items-center gap-2 p-4 bg-red-50 rounded-lg text-red-700 text-sm border border-red-200">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      <span>{allocationError}</span>
                    </div>
                  ) : allocations.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-sm">No allocation details found</p>
                    </div>
                  ) : (() => {
                    // Group allocations by Sales Order
                    const groupedBySO = allocations.reduce((acc, allocation) => {
                      const soId = allocation.salesOrderId;
                      if (!acc[soId]) {
                        acc[soId] = {
                          salesOrderId: allocation.salesOrderId,
                          salesOrderNumber: allocation.salesOrderNumber,
                          salesOrderStatus: allocation.salesOrderStatus,
                          customerName: allocation.customerName,
                          customerId: allocation.customerId,
                          allocations: [],
                          totalQty: 0,
                        };
                      }
                      acc[soId].allocations.push(allocation);
                      acc[soId].totalQty += allocation.quantity;
                      return acc;
                    }, {} as Record<string, {
                      salesOrderId: string;
                      salesOrderNumber: string;
                      salesOrderStatus: string;
                      customerName: string;
                      customerId: string;
                      allocations: AllocationDetail[];
                      totalQty: number;
                    }>);

                    return Object.values(groupedBySO).map((group) => (
                      <div
                        key={group.salesOrderId}
                        className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                      >
                        {/* Card Header */}
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/sales-orders?view=${group.salesOrderId}`}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {group.salesOrderNumber}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            {getSOStatusBadge(group.salesOrderStatus)}
                          </div>
                          <div className="text-right">
                            <span className="text-2xl font-bold text-slate-900">
                              {group.totalQty}
                            </span>
                            <span className="text-sm text-slate-500 ml-1">units</span>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="px-4 py-3 space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-500">Customer:</span>
                            <span className="font-medium text-slate-900 truncate">
                              {group.customerName}
                            </span>
                          </div>

                          {/* Allocation Breakdown */}
                          <div className="space-y-2">
                            {group.allocations.map((allocation) => (
                              <div
                                key={allocation.id}
                                className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2 border border-slate-100"
                              >
                                <div className="flex items-center gap-2">
                                  {getFulfillmentSourceBadge(allocation.fulfillmentSource)}
                                  <span className="font-mono text-xs text-slate-600 bg-white px-2 py-0.5 rounded border">
                                    {allocation.sku}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {getStatusBadge(allocation.status)}
                                  <span className="font-semibold text-slate-900">
                                    {allocation.quantity} <span className="text-slate-500 font-normal text-xs">units</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {group.allocations.length} allocation{group.allocations.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(Math.max(...group.allocations.map(a => a.createdAt.getTime()))).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Allocation Summary Footer */}
                {!isLoadingAllocations && !allocationError && allocations.length > 0 && (() => {
                  // Group allocations by fulfillment source
                  const sourceGroups = allocations.reduce((acc, a) => {
                    const source = a.fulfillmentSource || 'unknown';
                    if (!acc[source]) {
                      acc[source] = { count: 0, qty: 0 };
                    }
                    acc[source].count += 1;
                    acc[source].qty += a.quantity;
                    return acc;
                  }, {} as Record<string, { count: number; qty: number }>);

                  const sourceLabels: Record<string, string> = {
                    gdc_inventory: 'GDC Inventory',
                    platinum_dealer_inventory: 'Dealer Inventory',
                    platinum_dealer_fulfillment: 'Dealer Fulfillment',
                    direct: 'Direct',
                  };

                  return (
                    <div className="px-6 py-3 bg-slate-100 border-t">
                      <div className="text-center mb-2">
                        <span className="text-sm text-slate-600">
                          Total:{' '}
                          <span className="font-bold text-slate-900">
                            {allocations.reduce((sum, a) => sum + a.quantity, 0)} units
                          </span>{' '}
                          across{' '}
                          <span className="font-bold text-slate-900">{allocations.length}</span>{' '}
                          allocation{allocations.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {Object.keys(sourceGroups).length > 1 && (
                        <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500">
                          {Object.entries(sourceGroups).map(([source, data]) => (
                            <span key={source} className="flex items-center gap-1">
                              <span className={cn(
                                'w-2 h-2 rounded-full',
                                source === 'gdc_inventory' ? 'bg-blue-500' :
                                source === 'platinum_dealer_inventory' ? 'bg-purple-500' :
                                source === 'platinum_dealer_fulfillment' ? 'bg-indigo-500' :
                                source === 'direct' ? 'bg-teal-500' : 'bg-gray-500'
                              )} />
                              {sourceLabels[source] || source}: {data.qty} units
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* No Allocations State */}
            {item.allocated === 0 && (
              <div className="px-6 py-8 text-center text-slate-500 bg-slate-50/50">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No allocations for this inventory</p>
                <p className="text-xs text-slate-400 mt-1">
                  All {item.onHand} units are available
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end">
          <Button onClick={onClose} className="px-6">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
