'use client';

import { Warehouse, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import type { SourceBreakdownCardsProps } from '../types';

export function SourceBreakdownCards({ stats, isLoading = false }: SourceBreakdownCardsProps) {
  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Warehouse Inventory */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Warehouse className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Warehouse/GDC Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Locations</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.warehouse.locationCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">On Hand</div>
              <div className="text-2xl font-bold text-emerald-600">
                {stats.warehouse.onHand.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Allocated</div>
              <div className="text-lg font-semibold text-amber-600">
                {stats.warehouse.allocated.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Available</div>
              <div className="text-lg font-semibold text-sky-600">
                {stats.warehouse.available.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platinum Dealer Inventory */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            Platinum Dealer Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Dealers</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.platinumDealer.dealerCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Locations</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.platinumDealer.locationCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">On Hand</div>
              <div className="text-lg font-semibold text-emerald-600">
                {stats.platinumDealer.onHand.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Allocated</div>
              <div className="text-lg font-semibold text-amber-600">
                {stats.platinumDealer.allocated.toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
