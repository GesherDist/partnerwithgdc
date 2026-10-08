/**
 * Executive Metrics Service
 *
 * Business logic and calculations for Executive Dashboard
 */

import type { DateRange } from '../types';
import {
  getProfitabilityData,
  getPerTireEconomics,
  getWorkingCapitalPosition,
  getCurrentInventoryData,
  getUncommittedMonthsOfSupply,
  getBacklogData,
} from '../repositories/executive-metrics.repository';

// ============================================
// HELPERS
// ============================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(amount).toLocaleString()}`;
}

/**
 * Format percentage
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format number
 */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString();
}

// ============================================
// SERVICE METHODS
// ============================================

/**
 * Get Profitability Table Data (Table 2.1)
 * Returns formatted data for display
 */
export async function getProfitabilityTableData(dateRange: DateRange) {
  const data = await getProfitabilityData(dateRange);

  return {
    revenue: {
      amount: data.revenue,
      formatted: formatCurrency(data.revenue),
    },
    cogs: {
      amount: data.cogs,
      formatted: formatCurrency(data.cogs),
      percent: data.cogsPercent,
      percentFormatted: formatPercent(data.cogsPercent),
    },
    grossProfit: {
      amount: data.grossProfit,
      formatted: formatCurrency(data.grossProfit),
      percent: data.grossProfitPercent,
      percentFormatted: formatPercent(data.grossProfitPercent),
    },
    breakdown: data.breakdown,
  };
}

/**
 * Get Per Tire Economics Table Data (Table 2.2)
 */
export async function getPerTireEconomicsTableData(dateRange: DateRange) {
  const data = await getPerTireEconomics(dateRange);

  return {
    tiresSold: {
      value: data.tiresSold,
      formatted: formatNumber(data.tiresSold),
    },
    revenuePerTire: {
      value: data.revenuePerTire,
      formatted: formatCurrency(data.revenuePerTire),
    },
    cogsPerTire: {
      value: data.cogsPerTire,
      formatted: formatCurrency(data.cogsPerTire),
    },
    gpPerTire: {
      value: data.gpPerTire,
      formatted: formatCurrency(data.gpPerTire),
    },
  };
}

/**
 * Get Working Capital Position Table Data (Table 1.2)
 */
export async function getWorkingCapitalTableData() {
  const data = await getWorkingCapitalPosition();

  return {
    accountsReceivable: {
      current: data.accountsReceivable,
      currentFormatted: formatCurrency(data.accountsReceivable),
      weightedTiming: data.arWeightedTiming,
      weightedTimingFormatted: `${data.arWeightedTiming} days`,
    },
    accountsPayable: {
      current: data.accountsPayable,
      currentFormatted: formatCurrency(data.accountsPayable),
      weightedTiming: data.apWeightedTiming,
      weightedTimingFormatted: data.apWeightedTiming > 0 ? `${data.apWeightedTiming} days` : 'N/A',
    },
    inventory: {
      current: data.inventory,
      currentFormatted: formatCurrency(data.inventory),
    },
  };
}

/**
 * Get Current Inventory Table Data (Table 4.2)
 */
export async function getCurrentInventoryTableData() {
  const data = await getCurrentInventoryData();
  const monthsOfSupply = await getUncommittedMonthsOfSupply();

  return {
    inventoryAtCost: {
      value: data.inventoryAtCost,
      formatted: formatCurrency(data.inventoryAtCost),
    },
    tiresOnHand: {
      value: data.tiresOnHand,
      formatted: formatNumber(data.tiresOnHand),
    },
    costPerTire: {
      value: data.costPerTire,
      formatted: formatCurrency(data.costPerTire),
    },
    uncommittedInventory: {
      value: data.uncommittedInventory,
      formatted: formatNumber(data.uncommittedInventory),
    },
    uncommittedMonthsOfSupply: {
      value: monthsOfSupply,
      formatted: `${monthsOfSupply.toFixed(1)} months`,
    },
  };
}

/**
 * Get Backlog Summary Table Data (Table 2.4)
 */
export async function getBacklogSummaryTableData() {
  const data = await getBacklogData();

  return {
    backlogTires: {
      value: data.backlogTires,
      formatted: formatNumber(data.backlogTires),
    },
    backlogRevenue: {
      value: data.backlogRevenue,
      formatted: formatCurrency(data.backlogRevenue),
    },
    revenuePerTire: {
      value: data.revenuePerTire,
      formatted: formatCurrency(data.revenuePerTire),
    },
    backlogGrossProfit: {
      value: data.backlogGrossProfit,
      formatted: formatCurrency(data.backlogGrossProfit),
    },
    gpPerTire: {
      value: data.gpPerTire,
      formatted: formatCurrency(data.gpPerTire),
    },
    gpPercent: {
      value: data.gpPercent,
      formatted: formatPercent(data.gpPercent),
    },
  };
}

/**
 * Get all executive metrics for a given date range
 * Used when fetching multiple tables at once
 */
export async function getAllExecutiveMetrics(dateRange: DateRange) {
  const [
    profitability,
    perTireEconomics,
    workingCapital,
    currentInventory,
    backlogSummary,
  ] = await Promise.all([
    getProfitabilityTableData(dateRange),
    getPerTireEconomicsTableData(dateRange),
    getWorkingCapitalTableData(),
    getCurrentInventoryTableData(),
    getBacklogSummaryTableData(),
  ]);

  return {
    profitability,
    perTireEconomics,
    workingCapital,
    currentInventory,
    backlogSummary,
  };
}
