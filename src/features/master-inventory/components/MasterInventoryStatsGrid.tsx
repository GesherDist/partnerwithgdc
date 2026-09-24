'use client';

import { Package, AlertTriangle, Building2 } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { MasterInventoryStatsGridProps } from '../types';

export function MasterInventoryStatsGrid({ stats, isLoading = false }: MasterInventoryStatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Total Locations */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.totalLocations}</div>
          </div>
          <p className="text-xs text-muted-foreground">Total Locations</p>
        </CardContent>
      </Card>

      {/* Total On Hand */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-emerald-600">
            {stats.totalOnHand.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Total On Hand</p>
        </CardContent>
      </Card>

      {/* Total Allocated */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-amber-600">
            {stats.totalAllocated.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Total Allocated</p>
        </CardContent>
      </Card>

      {/* Total Available */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold text-sky-600">
            {stats.totalAvailable.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">Total Available</p>
        </CardContent>
      </Card>

      {/* Low Stock */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-red-600">{stats.lowStockCount}</div>
            {stats.lowStockCount > 0 && <AlertTriangle className="h-5 w-5 text-red-600" />}
          </div>
          <p className="text-xs text-muted-foreground">Low Stock Items</p>
        </CardContent>
      </Card>

      {/* On Order */}
      <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.onOrder.toLocaleString()}
            </div>
          </div>
          <p className="text-xs text-purple-600/70 dark:text-purple-400/70">On Order</p>
        </CardContent>
      </Card>
    </div>
  );
}
