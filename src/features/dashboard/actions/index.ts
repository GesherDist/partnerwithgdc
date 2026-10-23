'use server';

/**
 * Dashboard Server Actions
 *
 * API layer for dashboard data.
 * Supports date range filtering for all data fetches.
 */

import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import * as dashboardRepo from '../repositories';
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
 * Overview KPIs and charts include revenue and margin: the page shows them only
 * with dashboard.view_analytics, so the actions check the same permission.
 * Inventory by location only needs dashboard access.
 */
async function requireDashboardPermission(
  permission: string
): Promise<{ success: false; error: string } | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, permission)) {
    return { success: false, error: `Permission denied: ${permission}` };
  }
  return null;
}

/**
 * Get units sold by ALL products grouped by month
 */
export async function getUnitsBySKUData(dateRange?: DateRange): Promise<ActionResult<UnitsBySKUChartData>> {
  const denied = await requireDashboardPermission('dashboard.view_analytics');
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
  const denied = await requireDashboardPermission('dashboard.view_analytics');
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
  const denied = await requireDashboardPermission('dashboard.view_module');
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
  const denied = await requireDashboardPermission('dashboard.view_analytics');
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
  const denied = await requireDashboardPermission('dashboard.view_analytics');
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
  const denied = await requireDashboardPermission('dashboard.view_analytics');
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
  const denied = await requireDashboardPermission('dashboard.view_analytics');
  if (denied) {
    return denied;
  }

  const data = await dashboardRepo.getCommissionRevenue();

  return {
    success: true,
    data,
  };
}
