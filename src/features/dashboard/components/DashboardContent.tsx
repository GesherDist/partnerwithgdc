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
import {
  getUnitsBySKUData,
  getChannelPerformanceData,
  getInventoryByLocationData,
  getDashboardStatsData,
  getMarginAnalysisData,
  getRevenueTrendData,
} from '../actions';
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
  const [datePreset, setDatePreset] = useState<DateRangePreset>('this_month');
  const [currentDateRange, setCurrentDateRange] = useState<DateRange>(() => getDateRangeFromPreset('this_month'));
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
      ] = await Promise.all([
        getDashboardStatsData(dateRange),
        getUnitsBySKUData(dateRange),
        getChannelPerformanceData(dateRange),
        getInventoryByLocationData(), // Inventory doesn't need date filter
        getMarginAnalysisData(dateRange),
        getRevenueTrendData(dateRange),
      ]);

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
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
    </div>
  );
}
