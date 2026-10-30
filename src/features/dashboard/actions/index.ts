'use server';

/**
 * Dashboard Server Actions
 *
 * API layer for dashboard data.
 * Supports date range filtering for all data fetches.
 */

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import * as dashboardRepo from '../repositories';
import { buildOverviewDrillDown } from '../services/overview-drilldown.service';
import { OVERVIEW_DRILLDOWNS, type CsvExport, type OverviewDrillDown } from '../lib/drilldown';
import {
  DASHBOARD_TAB_PERMISSIONS,
  OVERVIEW_SECTION_PERMISSIONS,
  overviewDrillDownSection,
  type OverviewSection,
} from '../lib/dashboard-tabs';
import type { UnitsBySKUChartData, ChannelPerformanceDataPoint, InventoryByLocation, DashboardStat, MarginDataPoint, RevenueDataPoint, DateRange, CommissionRevenueStats } from '../types';

// ============================================
// UNITS BY SKU
// ============================================

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Each Overview section (KPI cards, each chart, inventory) needs the Overview
 * tab permission and its own section permission, the same check the page uses.
 */
async function requireOverviewSection(
  section: OverviewSection
): Promise<{ success: false; error: string } | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  const missing = [DASHBOARD_TAB_PERMISSIONS.overview, OVERVIEW_SECTION_PERMISSIONS[section]].find((p) => !hasPermission(user, p));
  if (missing) {
    return { success: false, error: `Permission denied: ${missing}` };
  }
  return null;
}

/**
 * Get units sold by ALL products grouped by month
 */
export async function getUnitsBySKUData(dateRange?: DateRange): Promise<ActionResult<UnitsBySKUChartData>> {
  const denied = await requireOverviewSection('unitsBySku');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getUnitsBySKU(dateRange);

  return {
    success: true,
    data,
  };
}

// ============================================
// CHANNEL PERFORMANCE
// ============================================

/**
 * Get channel performance data (OEM vs Dealer)
 */
export async function getChannelPerformanceData(dateRange?: DateRange): Promise<ActionResult<ChannelPerformanceDataPoint[]>> {
  const denied = await requireOverviewSection('channel');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getChannelPerformance(dateRange);

  return {
    success: true,
    data,
  };
}

// ============================================
// INVENTORY BY LOCATION
// ============================================

/**
 * Get inventory overview by location
 */
export async function getInventoryByLocationData(): Promise<ActionResult<InventoryByLocation[]>> {
  const denied = await requireOverviewSection('inventory');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getInventoryByLocation();

  return {
    success: true,
    data,
  };
}

// ============================================
// DASHBOARD STATS (KPIs)
// ============================================

/**
 * Get dashboard KPI stats
 */
export async function getDashboardStatsData(dateRange?: DateRange): Promise<ActionResult<DashboardStat[]>> {
  const denied = await requireOverviewSection('kpis');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getDashboardStats(dateRange);

  return {
    success: true,
    data,
  };
}

// ============================================
// MARGIN ANALYSIS
// ============================================

/**
 * Get margin analysis data for last 6 months
 */
export async function getMarginAnalysisData(dateRange?: DateRange): Promise<ActionResult<MarginDataPoint[]>> {
  const denied = await requireOverviewSection('margin');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getMarginAnalysis(dateRange);

  return {
    success: true,
    data,
  };
}

// ============================================
// REVENUE TREND
// ============================================

/**
 * Get revenue trend data for last 8 months
 */
export async function getRevenueTrendData(dateRange?: DateRange): Promise<ActionResult<RevenueDataPoint[]>> {
  const denied = await requireOverviewSection('revenueTrend');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getRevenueTrend(dateRange);

  return {
    success: true,
    data,
  };
}

// ============================================
// COMMISSION REVENUE STATS
// ============================================

/**
 * Get commission revenue statistics (YTD)
 * Tracks expected and actual commission from service items
 */
export async function getCommissionStatsData(): Promise<ActionResult<CommissionRevenueStats>> {
  const denied = await requireOverviewSection('kpis');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getCommissionRevenue();

  return {
    success: true,
    data,
  };
}

// ============================================
// DRILL-DOWN EXPORTS (Overview)
// ============================================

/**
 * CSV of the rows behind an Overview KPI card or chart (download button next
 * to its eye icon). Same data and date range as the figure; last row = TOTAL.
 * Needs the permission of the section the card or chart is in.
 */
export async function getOverviewDrillDownCsv(
  kind: OverviewDrillDown,
  dateRange?: DateRange
): Promise<ActionResult<CsvExport>> {
  if (!OVERVIEW_DRILLDOWNS.includes(kind)) {
    return { success: false, error: 'Unknown export' };
  }
  const denied = await requireOverviewSection(overviewDrillDownSection(kind));
  if (denied) {
    return denied;
  }

  try {
    return { success: true, data: await buildOverviewDrillDown(kind, dateRange) };
  } catch (error) {
    console.error('getOverviewDrillDownCsv error:', error);
    return { success: false, error: 'Failed to build the export' };
  }
}
