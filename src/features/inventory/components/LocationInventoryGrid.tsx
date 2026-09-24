'use client';

/**
 * Location Inventory Grid
 *
 * Matrix view showing all products (rows) and all locations (columns)
 * Makes it easy to compare inventory across locations for each product
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { AlertTriangle, Package } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { InventoryListItem } from '../types';

interface LocationInventoryGridProps {
  data: InventoryListItem[];
  isLoading?: boolean;
}

interface ProductInventoryRow {
  productId: string;
  productSku: string;
  productName: string;
  locations: Map<string, {
    locationId: string;
    locationCode: string;
    locationName: string;
    onHand: number;
    allocated: number;
    available: number;
    isLowStock: boolean;
  }>;
}

export function LocationInventoryGrid({ data, isLoading = false }: LocationInventoryGridProps) {
  // Transform data: Group by product, then by location
  const { productRows, allLocations } = useMemo(() => {
    const productMap = new Map<string, ProductInventoryRow>();
    const locationSet = new Set<string>();

    data.forEach((item) => {
      // Track all unique locations
      locationSet.add(item.locationId);

      // Get or create product row
      if (!productMap.has(item.productId)) {
        productMap.set(item.productId, {
          productId: item.productId,
          productSku: item.productSku,
          productName: item.productName,
          locations: new Map(),
        });
      }

      const productRow = productMap.get(item.productId)!;
      productRow.locations.set(item.locationId, {
        locationId: item.locationId,
        locationCode: item.locationCode,
        locationName: item.locationName,
        onHand: item.onHand,
        allocated: item.allocated,
        available: item.available,
        isLowStock: item.isLowStock,
      });
    });

    // Get unique locations with their details
    const locations = Array.from(locationSet).map((locationId) => {
      const sample = data.find(item => item.locationId === locationId);
      return {
        locationId,
        locationCode: sample?.locationCode || '',
        locationName: sample?.locationName || '',
      };
    });

    return {
      productRows: Array.from(productMap.values()),
      allLocations: locations,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-24" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (productRows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No inventory data found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {productRows.map((productRow) => {
        const totalOnHand = Array.from(productRow.locations.values())
          .reduce((sum, loc) => sum + loc.onHand, 0);
        const totalAllocated = Array.from(productRow.locations.values())
          .reduce((sum, loc) => sum + loc.allocated, 0);
        const totalAvailable = Array.from(productRow.locations.values())
          .reduce((sum, loc) => sum + loc.available, 0);
        const hasLowStock = Array.from(productRow.locations.values())
          .some(loc => loc.isLowStock);

        return (
          <Card key={productRow.productId} className={cn(
            "transition-all",
            hasLowStock && "border-amber-200 dark:border-amber-800"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg font-semibold">
                      {productRow.productName}
                    </CardTitle>
                    {hasLowStock && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Low Stock
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono mt-1">
                    SKU: {productRow.productSku}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{totalOnHand}</div>
                  <p className="text-xs text-muted-foreground">Total On Hand</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Location Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allLocations.map((location) => {
                  const locationData = productRow.locations.get(location.locationId);

                  if (!locationData) {
                    // No inventory at this location
                    return (
                      <div
                        key={location.locationId}
                        className="border rounded-lg p-4 bg-muted/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-sm">{location.locationName}</h4>
                            <p className="text-xs text-muted-foreground">{location.locationCode}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">No inventory</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={location.locationId}
                      className={cn(
                        "border rounded-lg p-4 transition-all hover:shadow-md",
                        locationData.isLowStock
                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                          : "bg-card hover:bg-accent/5"
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-sm">{locationData.locationName}</h4>
                          <p className="text-xs text-muted-foreground">{locationData.locationCode}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">On Hand</span>
                          <span className="text-sm font-semibold">{locationData.onHand}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Allocated</span>
                          <span className="text-sm text-amber-600">{locationData.allocated}</span>
                        </div>
                        <div className="h-px bg-border my-2" />
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-muted-foreground">Available</span>
                          <span className={cn(
                            "text-base font-bold",
                            locationData.isLowStock ? "text-amber-600" : "text-emerald-600"
                          )}>
                            {locationData.available}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Row */}
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground">All Locations Total:</span>
                  <div className="flex gap-6">
                    <div>
                      <span className="text-muted-foreground mr-2">On Hand:</span>
                      <span className="font-semibold">{totalOnHand}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-2">Allocated:</span>
                      <span className="font-semibold text-amber-600">{totalAllocated}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-2">Available:</span>
                      <span className={cn(
                        "font-bold",
                        hasLowStock ? "text-amber-600" : "text-emerald-600"
                      )}>
                        {totalAvailable}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
