'use client';

/**
 * Master Inventory Page Content
 *
 * Unified inventory view across all sources with tabs and filters
 */

import { useState, useCallback, useEffect } from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { MasterInventoryStatsGrid } from './MasterInventoryStatsGrid';
import { SourceBreakdownCards } from './SourceBreakdownCards';
import { MasterInventoryTable } from './MasterInventoryTable';
import { getMasterInventory, getMasterInventoryStats } from '../actions';
import type {
  MasterInventoryItem,
  MasterInventoryFilters,
  MasterInventoryStats,
  InventorySource,
} from '../types';

export function MasterInventoryPageContent() {
  // State
  const [activeTab, setActiveTab] = useState<'all' | InventorySource>('all');
  const [filters, setFilters] = useState<MasterInventoryFilters>({
    page: 1,
    limit: 50,
    search: '',
    sourceType: 'all',
    lowStockOnly: false,
  });
  const [data, setData] = useState<MasterInventoryItem[]>([]);
  const [stats, setStats] = useState<MasterInventoryStats>({
    totalLocations: 0,
    totalOnHand: 0,
    totalAllocated: 0,
    totalAvailable: 0,
    lowStockCount: 0,
    warehouse: { locationCount: 0, onHand: 0, allocated: 0, available: 0 },
    platinumDealer: { dealerCount: 0, locationCount: 0, onHand: 0, allocated: 0, available: 0 },
    onOrder: 0,
    inTransit: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch inventory data
      const inventoryResult = await getMasterInventory(filters);
      if (!inventoryResult.success) {
        throw new Error(inventoryResult.error);
      }
      setData(inventoryResult.data.data);

      // Fetch stats
      const statsResult = await getMasterInventoryStats();
      if (!statsResult.success) {
        throw new Error(statsResult.error);
      }
      setStats(statsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
      console.error('[MasterInventoryPageContent] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleLowStockFilter = useCallback((value: string) => {
    setFilters((prev) => ({
      ...prev,
      lowStockOnly: value === 'low-stock',
      page: 1,
    }));
  }, []);

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as 'all' | InventorySource;
    setActiveTab(newTab);
    setFilters((prev) => ({
      ...prev,
      sourceType: newTab,
      page: 1,
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <MasterInventoryStatsGrid stats={stats} isLoading={isLoading} />

      {/* Source Breakdown */}
      <SourceBreakdownCards stats={stats} isLoading={isLoading} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="all">All Sources</TabsTrigger>
            <TabsTrigger value="warehouse">
              Warehouses
              {!isLoading && (
                <Badge variant="secondary" className="ml-2">
                  {stats.warehouse.locationCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="platinum_dealer">
              Platinum Dealers
              {!isLoading && (
                <Badge variant="secondary" className="ml-2">
                  {stats.platinumDealer.locationCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SKU, product, location..."
                value={filters.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Low Stock Filter */}
            <Select
              value={filters.lowStockOnly ? 'low-stock' : 'all'}
              onValueChange={handleLowStockFilter}
            >
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="low-stock">
                  <span className="flex items-center gap-2">
                    Low Stock Only
                    {stats.lowStockCount > 0 && (
                      <Badge variant="destructive" className="h-5 px-1.5">
                        {stats.lowStockCount}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Tab Content */}
        <TabsContent value="all" className="mt-0">
          <MasterInventoryTable data={data} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="warehouse" className="mt-0">
          <MasterInventoryTable
            data={data.filter((item) => item.sourceType === 'warehouse')}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="platinum_dealer" className="mt-0">
          <MasterInventoryTable
            data={data.filter((item) => item.sourceType === 'platinum_dealer')}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Summary Footer */}
      {!isLoading && data.length > 0 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {data.length} inventory records across {stats.totalLocations} locations
        </div>
      )}
    </div>
  );
}
