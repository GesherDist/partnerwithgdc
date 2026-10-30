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

// Live QuickBooks figures + executive dashboard tables (Ankur's spec).
// The earlier sample-data tables (financial-metrics/*, profitability/*,
// supply-chain/*) are no longer shown.
import { QuickBooksFinancials } from './financial-metrics/QuickBooksFinancials';
import {
  FinancialMetricsTables,
  ProfitabilityTables,
  SupplyChainTables,
} from './executive/ExecutiveTables';
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
import type { DashboardTab, OverviewSection } from '../lib/dashboard-tabs';

// ============================================
// TYPES
// ============================================

const TAB_LABELS: Record<DashboardTab, string> = {
  financial: 'Financial Metrics',
  profitability: 'Profitability',
  supply: 'Supply Chain',
  overview: 'Overview',
};

const TAB_GRID_COLS = ['grid-cols-1', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'];

interface DashboardContentProps {
  /** Tabs the user may open (one permission per tab), in display order */
  tabs: DashboardTab[];
  /** Overview sections the user may see (one permission per section) */
  overviewSections: OverviewSection[];
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
  tabs,
  overviewSections,
  initialStats,
  initialUnitsBySKU,
  initialChannelData,
  initialInventory,
  initialMarginData,
  initialRevenueData,
}: DashboardContentProps) {
  // Date range state
  // Default Last 12 Months for the charts (Oct 27 call); the KPI cards are always MTD + YTD
  const [datePreset, setDatePreset] = useState<DateRangePreset>('last_12_months');
  const [currentDateRange, setCurrentDateRange] = useState<DateRange>(() => getDateRangeFromPreset('last_12_months'));
  const [isLoading, setIsLoading] = useState(false);

  // Data state
  const [stats, setStats] = useState<DashboardStat[]>(initialStats);
  const [unitsBySKU, setUnitsBySKU] = useState<UnitsBySKUChartData>(initialUnitsBySKU);
  const [channelData, setChannelData] = useState<ChannelPerformanceDataPoint[]>(initialChannelData);
  const [inventory, setInventory] = useState<InventoryByLocation[]>(initialInventory);
  const [marginData, setMarginData] = useState<MarginDataPoint[]>(initialMarginData);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>(initialRevenueData);

  // Fetch data when date range changes (only the sections the user may see)
  const fetchData = useCallback(async (dateRange: DateRange) => {
    setIsLoading(true);
    const allowed = (section: OverviewSection) => overviewSections.includes(section);
    const skipped = Promise.resolve({ success: false, data: undefined });

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
        allowed('kpis') ? getDashboardStatsData(dateRange) : skipped,
        allowed('unitsBySku') ? getUnitsBySKUData(dateRange) : skipped,
        allowed('channel') ? getChannelPerformanceData(dateRange) : skipped,
        allowed('inventory') ? getInventoryByLocationData() : skipped, // Inventory doesn't need date filter
        allowed('margin') ? getMarginAnalysisData(dateRange) : skipped,
        allowed('revenueTrend') ? getRevenueTrendData(dateRange) : skipped,
        allowed('kpis') ? getCommissionStatsData() : skipped, // Commission is always YTD
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
            return `$${Math.round(amount).toLocaleString('en-US')}`;
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
            subtitle: 'Commission invoices to Galileo',
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
  }, [overviewSections]);

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

  const canView = (tab: DashboardTab) => tabs.includes(tab);
  const canSee = (section: OverviewSection) => overviewSections.includes(section);

  if (tabs.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <p className="text-sm text-muted-foreground">No dashboard tabs are assigned to your role. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Filter (the date range applies to the Overview tab) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DashboardHeader />
        {canView('overview') && (
          <DateRangeFilter
            value={datePreset}
            onChange={handleDateRangeChange}
            onRefresh={handleRefresh}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Tab Navigation: Financial Metrics first (QuickBooks numbers, Oct 27 call), one permission per tab */}
      <Tabs defaultValue={tabs[0]} className="w-full">
        <TabsList className={`grid w-full mb-6 ${TAB_GRID_COLS[tabs.length]}`}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>{TAB_LABELS[tab]}</TabsTrigger>
          ))}
        </TabsList>

        {canView('overview') && (
          <TabsContent value="overview" className="space-y-6 mt-0">
            {overviewSections.length === 0 && (
              <p className="text-sm text-muted-foreground">No Overview sections are assigned to your role. Please contact your administrator.</p>
            )}
            {canSee('kpis') && <DashboardStatsGrid stats={stats} dateRange={currentDateRange} />}
            <DashboardChartsGrid
              revenueData={revenueData}
              unitsData={unitsBySKU.data}
              unitsProducts={unitsBySKU.products}
              channelData={channelData}
              marginData={marginData}
              dateRange={currentDateRange}
              charts={overviewSections}
            />
            {canSee('inventory') && <InventoryOverview byLocation={inventory} />}
          </TabsContent>
        )}

        {canView('financial') && (
          <TabsContent value="financial" className="space-y-6 mt-0">
            <div className="grid gap-6">
              {/* Live figures from QuickBooks (Oct 12 call) */}
              <QuickBooksFinancials />
              <FinancialMetricsTables />
            </div>
          </TabsContent>
        )}

        {canView('profitability') && (
          <TabsContent value="profitability" className="space-y-6 mt-0">
            <ProfitabilityTables />
          </TabsContent>
        )}

        {canView('supply') && (
          <TabsContent value="supply" className="space-y-6 mt-0">
            <SupplyChainTables />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
