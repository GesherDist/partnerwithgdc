'use server';

/**
 * Executive Metrics Server Actions
 *
 * API endpoints for Executive Dashboard tables
 */

import type { DateRange } from '../types';
import {
  getProfitabilityTableData,
  getPerTireEconomicsTableData,
  getWorkingCapitalTableData,
  getCurrentInventoryTableData,
  getBacklogSummaryTableData,
  getAllExecutiveMetrics,
} from '../services/executive-metrics.service';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { DASHBOARD_TAB_PERMISSIONS, EXECUTIVE_TABS, type ExecutiveTab } from '../lib/dashboard-tabs';

/** Permission error for the tabs the user cannot open, or null */
async function deniedFor(tabs: ExecutiveTab[]): Promise<string | null> {
  const user = await getCurrentUser();
  const missing = tabs.map((tab) => DASHBOARD_TAB_PERMISSIONS[tab]).find((p) => !user || !hasPermission(user, p));
  return missing ? `Permission denied: ${missing}` : null;
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Get Profitability data (Table 2.1)
 */
export async function getExecutiveProfitabilityData(dateRange: DateRange) {
  const denied = await deniedFor(['profitability']);
  if (denied) {
    return { success: false, error: denied, data: null };
  }
  try {
    const data = await getProfitabilityTableData(dateRange);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error fetching profitability data:', error);
    return {
      success: false,
      error: 'Failed to fetch profitability data',
      data: null,
    };
  }
}

/**
 * Get Per Tire Economics data (Table 2.2)
 */
export async function getExecutivePerTireEconomicsData(dateRange: DateRange) {
  const denied = await deniedFor(['profitability']);
  if (denied) {
    return { success: false, error: denied, data: null };
  }
  try {
    const data = await getPerTireEconomicsTableData(dateRange);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error fetching per tire economics data:', error);
    return {
      success: false,
      error: 'Failed to fetch per tire economics data',
      data: null,
    };
  }
}

/**
 * Get Working Capital Position data (Table 1.2)
 */
export async function getExecutiveWorkingCapitalData() {
  const denied = await deniedFor(['financial']);
  if (denied) {
    return { success: false, error: denied, data: null };
  }
  try {
    const data = await getWorkingCapitalTableData();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error fetching working capital data:', error);
    return {
      success: false,
      error: 'Failed to fetch working capital data',
      data: null,
    };
  }
}

/**
 * Get Current Inventory data (Table 4.2)
 */
export async function getExecutiveCurrentInventoryData() {
  const denied = await deniedFor(['supply']);
  if (denied) {
    return { success: false, error: denied, data: null };
  }
  try {
    const data = await getCurrentInventoryTableData();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error fetching current inventory data:', error);
    return {
      success: false,
      error: 'Failed to fetch current inventory data',
      data: null,
    };
  }
}

/**
 * Get Backlog Summary data (Table 2.4)
 */
export async function getExecutiveBacklogSummaryData() {
  const denied = await deniedFor(['profitability']);
  if (denied) {
    return { success: false, error: denied, data: null };
  }
  try {
    const data = await getBacklogSummaryTableData();
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error fetching backlog summary data:', error);
    return {
      success: false,
      error: 'Failed to fetch backlog summary data',
      data: null,
    };
  }
}

/**
 * Get all executive metrics at once
 * Useful for initial page load
 */
export async function getExecutiveMetrics(dateRange: DateRange) {
  const denied = await deniedFor(EXECUTIVE_TABS);
  if (denied) {
    return { success: false, error: denied, data: null };
  }
  try {
    const data = await getAllExecutiveMetrics(dateRange);
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Error fetching executive metrics:', error);
    return {
      success: false,
      error: 'Failed to fetch executive metrics',
      data: null,
    };
  }
}
