/**
 * Dashboard Page
 *
 * Role-based dashboard rendering:
 * - Operations roles: redirected to /operations
 * - Other roles: Shows executive dashboard with KPIs, charts, and inventory
 *
 * Permission-based rendering:
 * - dashboard.view_module: Access to dashboard page
 * - One permission per tab (migration 170):
 *   dashboard.view_financial_metrics_tab, dashboard.view_profitability_tab,
 *   dashboard.view_supply_chain_tab, dashboard.view_overview_tab
 * - One permission per Overview section (migration 171): KPI cards, each chart,
 *   Inventory Overview
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
import { getCurrentUser, hasPermission, isOperationsRoleName } from '@/shared/lib/auth';
import { allowedDashboardTabs, allowedOverviewSections } from '@/features/dashboard/lib/dashboard-tabs';

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

  // Operations users work from the Operations page
  if (isOperationsRoleName(user.role?.name)) {
    redirect('/operations');
  }

  // Tabs this user may open (one permission per tab)
  const tabs = allowedDashboardTabs((permission) => hasPermission(user, permission));
  const overviewSections = allowedOverviewSections((permission) => hasPermission(user, permission));
  const allowed = (section: (typeof overviewSections)[number]) => overviewSections.includes(section);
  const skipped = Promise.resolve({ success: false, data: undefined });

  // Default date range: Last 12 Months (charts; same as DashboardContent)
  const defaultDateRange = getDateRangeFromPreset('last_12_months');

  // Fetch real data from database with default date filter (no mock data fallback)
  const [unitsBySKUResult, channelResult, inventoryResult, statsResult, marginResult, revenueResult, commissionResult] = await Promise.all([
    allowed('unitsBySku') ? getUnitsBySKUData(defaultDateRange) : skipped,
    allowed('channel') ? getChannelPerformanceData(defaultDateRange) : skipped,
    allowed('inventory') ? getInventoryByLocationData() : skipped, // Inventory doesn't need date filter
    allowed('kpis') ? getDashboardStatsData(defaultDateRange) : skipped,
    allowed('margin') ? getMarginAnalysisData(defaultDateRange) : skipped,
    allowed('revenueTrend') ? getRevenueTrendData(defaultDateRange) : skipped,
    allowed('kpis') ? getCommissionStatsData() : skipped, // Commission is always YTD
  ]);

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    return `$${Math.round(amount).toLocaleString('en-US')}`;
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
      subtitle: 'Commission invoices to Galileo',
    });
  }

  return (
    <DashboardContent
      tabs={tabs}
      overviewSections={overviewSections}
      initialStats={dynamicStats}
      initialUnitsBySKU={dynamicUnitsBySKU}
      initialChannelData={dynamicChannelData}
      initialInventory={dynamicInventory}
      initialMarginData={dynamicMarginData}
      initialRevenueData={dynamicRevenueData}
    />
  );
}
