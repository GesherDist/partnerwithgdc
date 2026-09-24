'use client';

/**
 * Inventory Page Content
 *
 * Client component with inventory table, filters, and actions.
 */

import { useState, useCallback, useEffect } from 'react';
import { Search, Filter, AlertTriangle, RefreshCw, Plus, Package, Truck, LayoutGrid, Table as TableIcon } from 'lucide-react';

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
import { Card, CardContent } from '@/shared/components/ui/card';

import { InventoryTable } from './InventoryTable';
import { LocationInventoryGrid } from './LocationInventoryGrid';
import { ViewInventoryDrawer } from './ViewInventoryDrawer';
import { AddInventoryDrawer } from './AddInventoryDrawer';
import { AdjustInventoryDialog } from './AdjustInventoryDialog';
import { useInventory } from '../hooks/useInventory';
import { getInventoryStats, type InventoryStats } from '../actions';
import type { InventoryListItem, InventoryListParams } from '../types';

export function InventoryPageContent() {
  // State
  const [params, setParams] = useState<InventoryListParams>({
    page: 1,
    limit: 20,
    search: '',
    lowStockOnly: false,
  });
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid'); // Default to grid view
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [selectedItemForAdjust, setSelectedItemForAdjust] = useState<InventoryListItem | null>(null);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats>({ onOrder: 0, inTransit: 0 });

  // Data fetching
  const { data, meta, isLoading, error, refetch } = useInventory(params);

  // Fetch On Order and In Transit stats
  useEffect(() => {
    async function fetchStats() {
      const result = await getInventoryStats();
      if (result.success && result.data) {
        setInventoryStats(result.data);
      }
    }
    fetchStats();
  }, []);

  // Handlers
  const handleSearch = useCallback((value: string) => {
    setParams((prev) => ({ ...prev, search: value, page: 1 }));
  }, []);

  const handleLowStockFilter = useCallback((value: string) => {
    setParams((prev) => ({
      ...prev,
      lowStockOnly: value === 'low-stock',
      page: 1,
    }));
  }, []);

  const handleView = useCallback((item: InventoryListItem) => {
    setSelectedInventoryId(item.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedInventoryId(null);
  }, []);

  const handleAdjust = useCallback((item: InventoryListItem) => {
    setSelectedItemForAdjust(item);
    setIsAdjustDialogOpen(true);
  }, []);

  const handleCloseAdjustDialog = useCallback(() => {
    setIsAdjustDialogOpen(false);
    setSelectedItemForAdjust(null);
  }, []);

  // Stats calculation
  const stats = {
    totalItems: meta.total,
    lowStockItems: data.filter((item) => item.isLowStock).length,
    totalOnHand: data.reduce((sum, item) => sum + item.onHand, 0),
    totalAllocated: data.reduce((sum, item) => sum + item.allocated, 0),
    totalAvailable: data.reduce((sum, item) => sum + item.available, 0),
  };

  return (
    <div className="space-y-6">
      {/* On Order & In Transit Cards - Prominent at Top */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {inventoryStats.onOrder.toLocaleString()}
                </div>
                <p className="text-xs text-purple-600/70 dark:text-purple-400/70">On Order (from POs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {inventoryStats.inTransit.toLocaleString()}
                </div>
                <p className="text-xs text-blue-600/70 dark:text-blue-400/70">In Transit (Shipments)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-600">
              {stats.totalOnHand.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">On Hand</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">
              {stats.totalAllocated.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Allocated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-sky-600">
              {stats.totalAvailable.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-red-600">
                {stats.lowStockItems}
              </div>
              {stats.lowStockItems > 0 && (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by SKU or product..."
              value={params.search || ''}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter */}
          <Select
            value={params.lowStockOnly ? 'low-stock' : 'all'}
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
                  {stats.lowStockItems > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5">
                      {stats.lowStockItems}
                    </Badge>
                  )}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* View Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-l-none"
            >
              <TableIcon className="h-4 w-4 mr-2" />
              Table
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsAddDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Inventory
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Inventory View - Table or Grid */}
      {viewMode === 'grid' ? (
        <LocationInventoryGrid
          data={data}
          isLoading={isLoading}
        />
      ) : (
        <InventoryTable
          data={data}
          isLoading={isLoading}
          onView={handleView}
          onAdjust={handleAdjust}
          onRowClick={handleView}
        />
      )}

      {/* Pagination Info - Only show for table view */}
      {viewMode === 'table' && !isLoading && data.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Showing {((meta.page - 1) * meta.limit) + 1} to{' '}
            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} items
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasPreviousPage}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.hasNextPage}
              onClick={() => setParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* View Drawer */}
      <ViewInventoryDrawer
        open={isViewDrawerOpen}
        onClose={handleCloseDrawer}
        inventoryId={selectedInventoryId}
      />

      {/* Add Drawer */}
      <AddInventoryDrawer
        open={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        onSuccess={refetch}
      />

      {/* Adjust Dialog */}
      <AdjustInventoryDialog
        open={isAdjustDialogOpen}
        item={selectedItemForAdjust}
        onClose={handleCloseAdjustDialog}
        onSuccess={refetch}
      />
    </div>
  );
}
