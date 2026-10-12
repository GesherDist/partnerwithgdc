'use client';

/**
 * DashboardContent Component
 *
 * Client wrapper for the executive dashboard with date range filtering.
 * Manages state for date filters and fetches data accordingly.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { DashboardHeader } from './DashboardHeader';
import { DashboardStatsGrid } from './DashboardStatsCard';
import { DashboardChartsGrid } from './DashboardCharts';
import { InventoryOverview } from './InventoryOverview';
import { DateRangeFilter } from './DateRangeFilter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import {
  getUnitsBySKUData,
  getChannelPerformanceData,
  getInventoryByLocationData,
  getDashboardStatsData,
  getMarginAnalysisData,
  getRevenueTrendData,
  getCommissionStatsData,
} from '../actions';

// Financial Metrics components
import { LiquidityTable } from './financial-metrics/LiquidityTable';
import { WorkingCapitalPosition } from './financial-metrics/WorkingCapitalPosition';
import { WorkingCapitalEfficiency } from './financial-metrics/WorkingCapitalEfficiency';
import { CashOperations } from './financial-metrics/CashOperations';

// Profitability components
import { ProfitabilityTable } from './profitability/ProfitabilityTable';
import { PerTireEconomics } from './profitability/PerTireEconomics';
import { OpexRunRate } from './profitability/OpexRunRate';
import { BacklogSummary } from './profitability/BacklogSummary';

// Supply Chain components
import { IncomingSupply } from './supply-chain/IncomingSupply';
import { CurrentInventory } from './supply-chain/CurrentInventory';
import type {
  DateRange,
  DateRangePreset,
  DashboardStat,
  UnitsBySKUChartData,
  ChannelPerformanceDataPoint,
  InventoryByLocation,
  MarginDataPoint,
  RevenueDataPoint,
} from '../types';
import { getDateRangeFromPreset, DATE_RANGE_LABELS } from '../types';

// ============================================
// TYPES
// ============================================

interface DashboardContentProps {
  canViewAnalytics: boolean;
  canViewInventory: boolean;
  initialStats: DashboardStat[];
  initialUnitsBySKU: UnitsBySKUChartData;
  initialChannelData: ChannelPerformanceDataPoint[];
  initialInventory: InventoryByLocation[];
  initialMarginData: MarginDataPoint[];
  initialRevenueData: RevenueDataPoint[];
}

// ============================================
// COMPONENT
// ============================================

export function DashboardContent({
  canViewAnalytics,
  canViewInventory,
  initialStats,
  initialUnitsBySKU,
  initialChannelData,
  initialInventory,
  initialMarginData,
  initialRevenueData,
}: DashboardContentProps) {
  // Date range state
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last_6_months');
  const [currentDateRange, setCurrentDateRange] = useState<DateRange>(() => getDateRangeFromPreset('last_6_months'));
  const [isLoading, setIsLoading] = useState(false);

  // Data state
  const [stats, setStats] = useState<DashboardStat[]>(initialStats);
  const [unitsBySKU, setUnitsBySKU] = useState<UnitsBySKUChartData>(initialUnitsBySKU);
  const [channelData, setChannelData] = useState<ChannelPerformanceDataPoint[]>(initialChannelData);
  const [inventory, setInventory] = useState<InventoryByLocation[]>(initialInventory);
  const [marginData, setMarginData] = useState<MarginDataPoint[]>(initialMarginData);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>(initialRevenueData);

  // Fetch data when date range changes
  const fetchData = useCallback(async (dateRange: DateRange) => {
    setIsLoading(true);

    try {
      const [
        statsResult,
        unitsResult,
        channelResult,
        inventoryResult,
        marginResult,
        revenueResult,
        commissionResult,
      ] = await Promise.all([
        getDashboardStatsData(dateRange),
        getUnitsBySKUData(dateRange),
        getChannelPerformanceData(dateRange),
        getInventoryByLocationData(), // Inventory doesn't need date filter
        getMarginAnalysisData(dateRange),
        getRevenueTrendData(dateRange),
        getCommissionStatsData(), // Commission is always YTD
      ]);

      // Process stats and add commission cards
      if (statsResult.success && statsResult.data) {
        let updatedStats = [...statsResult.data];

        // Add commission stats as additional KPI cards if available
        if (commissionResult.success && commissionResult.data) {
          const commission = commissionResult.data;

          // Helper to format currency
          const formatCurrency = (amount: number) => {
            if (amount >= 1000000) {
              return `$${(amount / 1000000).toFixed(1)}M`;
            }
            return `$${Math.round(amount).toLocaleString()}`;
          };

          // Commission Expected (YTD) card
          updatedStats.push({
            id: 'commission-expected-ytd',
            title: 'Commission Expected (YTD)',
            value: formatCurrency(commission.expectedYTD),
            change: `${commission.change >= 0 ? '+' : ''}${commission.change.toFixed(1)}%`,
            trend: commission.trend,
            icon: 'credit-card',
            color: 'bg-purple-500',
            subtitle: 'vs same period last year',
          });

          // Commission Actual (YTD) card
          updatedStats.push({
            id: 'commission-actual-ytd',
            title: 'Commission Actual (YTD)',
            value: formatCurrency(commission.actualYTD),
            change: `${commission.change >= 0 ? '+' : ''}${commission.change.toFixed(1)}%`,
            trend: commission.trend,
            icon: 'dollar-sign',
            color: 'bg-fuchsia-500',
            subtitle: 'Delivered orders only',
          });
        }

        setStats(updatedStats);
      }

      if (unitsResult.success && unitsResult.data) {
        setUnitsBySKU(unitsResult.data);
      }
      if (channelResult.success && channelResult.data) {
        setChannelData(channelResult.data);
      }
      if (inventoryResult.success && inventoryResult.data) {
        setInventory(inventoryResult.data);
      }
      if (marginResult.success && marginResult.data) {
        setMarginData(marginResult.data);
      }
      if (revenueResult.success && revenueResult.data) {
        setRevenueData(revenueResult.data);
      }

      // Show success message with period label
      const label = dateRange.preset ? DATE_RANGE_LABELS[dateRange.preset] : 'Custom Date';
      toast.success(`Data updated for ${label}`);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to update dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle date range change
  const handleDateRangeChange = (preset: DateRangePreset, customRange?: DateRange) => {
    setDatePreset(preset);
    // Use custom range if provided, otherwise calculate from preset
    const dateRange = customRange || getDateRangeFromPreset(preset);
    setCurrentDateRange(dateRange);
    fetchData(dateRange);
  };

  // Handle refresh - re-fetch data with current date range
  const handleRefresh = useCallback(() => {
    fetchData(currentDateRange);
  }, [currentDateRange, fetchData]);

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardHeader />
        <DateRangeFilter
          value={datePreset}
          onChange={handleDateRangeChange}
          onRefresh={handleRefresh}
          isLoading={isLoading}
        />
      </div>

      {/* Tab Navigation */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial Metrics</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="supply">Supply Chain</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview - Existing Content */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          {/* KPI Stats Grid */}
          {canViewAnalytics && (
            <DashboardStatsGrid stats={stats} />
          )}

          {/* Charts Grid */}
          {canViewAnalytics && (
            <DashboardChartsGrid
              revenueData={revenueData}
              unitsData={unitsBySKU.data}
              unitsProducts={unitsBySKU.products}
              channelData={channelData}
              marginData={marginData}
            />
          )}

          {/* Inventory Overview */}
          {canViewInventory && (
            <InventoryOverview byLocation={inventory} />
          )}
        </TabsContent>

        {/* Tab 2: Financial Metrics */}
        <TabsContent value="financial" className="space-y-6 mt-0">
          <div className="grid gap-6">
            <LiquidityTable />
            <WorkingCapitalPosition />
            <WorkingCapitalEfficiency />
            <CashOperations />
          </div>
        </TabsContent>

        {/* Tab 3: Profitability */}
        <TabsContent value="profitability" className="space-y-6 mt-0">
          <div className="grid gap-6">
            <ProfitabilityTable dateRange={currentDateRange} />
            <PerTireEconomics dateRange={currentDateRange} />
            <div className="grid gap-6 md:grid-cols-2">
              <OpexRunRate />
              <BacklogSummary />
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Supply Chain */}
        <TabsContent value="supply" className="space-y-6 mt-0">
          <div className="grid gap-6">
            <IncomingSupply />
            <CurrentInventory />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
