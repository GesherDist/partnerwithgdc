'use client';

/**
 * Deals Page Content
 *
 * Client component for displaying and managing Pipedrive deals.
 */

import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Handshake,
  DollarSign,
  Target,
  TrendingUp,
  RefreshCw,
  Download,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { DealsTable } from '@/features/deals/components/DealsTable';
import { DealDetailDrawer } from '@/features/deals/components/DealDetailDrawer';
import { useDeals, useDealStats } from '@/features/deals/hooks/useDeals';
import { syncDealsFromPipedrive } from '@/features/pipedrive/actions';
import type { DealListItem, DealStatus, DealListParams } from '@/features/deals/types';

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================
// COMPONENT
// ============================================

export function DealsPageContent() {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [statusFilter, setStatusFilter] = useState<DealStatus | 'all'>('all');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ----------------------------------------
  // QUERY PARAMS
  // ----------------------------------------

  const queryParams = useMemo<DealListParams>(() => {
    const params: DealListParams = {
      page,
      limit: pageSize,
      sortBy: 'created_at',
      sortOrder: 'desc',
    };

    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    return params;
  }, [statusFilter, page, pageSize]);

  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const {
    data: deals,
    meta,
    isLoading,
    refetch,
  } = useDeals(queryParams);

  const { data: stats, isLoading: isLoadingStats } = useDealStats();

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleRowClick = (deal: DealListItem) => {
    setSelectedDealId(deal.id);
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedDealId(null);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleSyncFromPipedrive = async () => {
    setIsSyncing(true);
    try {
      const result = await syncDealsFromPipedrive();
      if (result.success && result.data) {
        const { created, updated, deleted } = result.data;
        toast.success(
          `Sync complete: ${created} created, ${updated} updated, ${deleted} removed`
        );
        refetch();
      } else {
        toast.error(result.error || 'Failed to sync deals');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync deals from Pipedrive');
    } finally {
      setIsSyncing(false);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deals</h1>
          <p className="text-muted-foreground">
            Manage deals synced from Pipedrive
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSyncFromPipedrive}
            disabled={isSyncing}
          >
            <Download className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync from Pipedrive'}
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deals</CardTitle>
            <Handshake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : stats.total}
            </div>
            <p className="text-xs text-muted-foreground">
              All deals in pipeline
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Value</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : formatCurrency(stats.openValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.openDeals} open deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Won Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {isLoadingStats ? '...' : formatCurrency(stats.wonValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.wonDeals} won deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? '...' : formatCurrency(stats.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              All deal values combined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Deals List
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as DealStatus | 'all')}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DealsTable
            data={deals}
            isLoading={isLoading}
            onRowClick={handleRowClick}
            onRefresh={handleRefresh}
            pagination={{
              page: meta.page,
              pageSize: meta.limit,
              total: meta.total,
              totalPages: meta.totalPages,
              onPageChange: setPage,
              onPageSizeChange: (newSize) => {
                setPageSize(newSize);
                setPage(1);
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <DealDetailDrawer
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        dealId={selectedDealId}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
