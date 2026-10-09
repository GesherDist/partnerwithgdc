/**
 * Dashboard Page
 *
 * Role-based dashboard rendering:
 * - Operations Manager: Shows Jenny's Operations Dashboard
 * - Other roles: Shows executive dashboard with KPIs, charts, and inventory
 *
 * Permission-based rendering:
 * - dashboard.view_module: Access to dashboard page
 * - dashboard.view_analytics: Stats Grid (KPIs) and Charts
 * - dashboard.view_inventory: Inventory overview
 *
 * Data: All data is fetched from database (no mock data fallback)
 * Date Filters: This Month, Last Month, This Quarter, Last Quarter, YTD, Last Year, etc.
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  DashboardContent,
  // Actions - fetch real data from database
  getUnitsBySKUData,
  getChannelPerformanceData,
  getInventoryByLocationData,
  getDashboardStatsData,
  getMarginAnalysisData,
  getRevenueTrendData,
  getCommissionStatsData,
  // Types
  getDateRangeFromPreset,
} from '@/features/dashboard';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';

// Operations Dashboard imports
import { OperationsDashboardContent } from './OperationsDashboardContent';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Dashboard | Gesher Distribution',
  description: 'Overview of your distribution operations',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user has Operations Manager role
 */
function isOperationsManager(roleName: string | undefined): boolean {
  if (!roleName) {
    return false;
  }
  const normalized = roleName.toLowerCase().replace(/[_\s]/g, '');
  return normalized === 'operationsmanager' || normalized === 'operations';
}

/**
 * Check if user is a supplier portal user
 */
function isSupplierUser(supplierId: string | null | undefined): boolean {
  return supplierId !== null && supplierId !== undefined;
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function DashboardPage() {
  // Get current user with permissions for server-side checks
  const user = await getCurrentUser();

  // Must be logged in
  if (!user) {
    redirect('/login');
  }

  // Check if user is a supplier FIRST - redirect to supplier portal
  // This must happen before permission checks since suppliers don't have dashboard permissions
  if (isSupplierUser(user.supplierId)) {
    redirect('/supplier-portal');
  }

  // Server-side module permission check (for non-supplier users)
  // If no permission for dashboard, redirect to no-permission page
  if (!hasPermission(user, 'dashboard.view_module')) {
    redirect('/no-permission');
  }

  // Check if user is Operations Manager - show Operations Dashboard
  if (isOperationsManager(user.role?.name)) {
    return <OperationsDashboardContent />;
  }

  // Permission checks for sub-sections (for executive dashboard)
  const canViewAnalytics = hasPermission(user, 'dashboard.view_analytics');
  const canViewInventory = hasPermission(user, 'dashboard.view_inventory');

  // Default date range: Last 6 Months
  const defaultDateRange = getDateRangeFromPreset('last_6_months');

  // Fetch real data from database with default date filter (no mock data fallback)
  const [unitsBySKUResult, channelResult, inventoryResult, statsResult, marginResult, revenueResult, commissionResult] = await Promise.all([
    getUnitsBySKUData(defaultDateRange),
    getChannelPerformanceData(defaultDateRange),
    getInventoryByLocationData(), // Inventory doesn't need date filter
    getDashboardStatsData(defaultDateRange),
    getMarginAnalysisData(defaultDateRange),
    getRevenueTrendData(defaultDateRange),
    getCommissionStatsData(), // Commission is always YTD
  ]);

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${Math.round(amount).toLocaleString()}`;
  };

  // Use real data only - empty arrays if no data
  const dynamicUnitsBySKU = unitsBySKUResult.success && unitsBySKUResult.data
    ? unitsBySKUResult.data
    : { data: [], products: [] };
  const dynamicChannelData = channelResult.success ? channelResult.data || [] : [];
  const dynamicInventory = inventoryResult.success ? inventoryResult.data || [] : [];
  let dynamicStats = statsResult.success ? statsResult.data || [] : [];
  const dynamicMarginData = marginResult.success ? marginResult.data || [] : [];
  const dynamicRevenueData = revenueResult.success ? revenueResult.data || [] : [];

  // Add commission stats as additional KPI cards if available
  if (commissionResult.success && commissionResult.data) {
    const commission = commissionResult.data;

    // Commission Expected (YTD) card
    dynamicStats.push({
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
    dynamicStats.push({
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

  return (
    <DashboardContent
      canViewAnalytics={canViewAnalytics}
      canViewInventory={canViewInventory}
      initialStats={dynamicStats}
      initialUnitsBySKU={dynamicUnitsBySKU}
      initialChannelData={dynamicChannelData}
      initialInventory={dynamicInventory}
      initialMarginData={dynamicMarginData}
      initialRevenueData={dynamicRevenueData}
    />
  );
}
