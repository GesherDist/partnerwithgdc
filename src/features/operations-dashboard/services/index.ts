/**
 * Operations Dashboard Service
 *
 * Business logic for Jenny's operations dashboard.
 * Orchestrates repository calls and applies business rules.
 */

import {
  getOperationsStats,
  getSKUBreakdown,
  getCustomerCommitments,
  getShipmentStatusMix,
  getImmediateAttention,
  getSupplierShipmentSchedule,
  getGDC1Inventory,
  getAllGDCInventories,
  getRimInstallationRequired,
  generateStoryInBrief,
  getFilterOptions,
} from '../repositories';
import type { OperationsData, OperationsFilters, FilterOptions } from '../types';

// ============================================
// GET FULL OPERATIONS DATA
// ============================================

/**
 * Fetches all data needed for the operations dashboard
 * This is the main entry point for the dashboard
 * Uses Promise.allSettled for graceful error handling - each query can fail independently
 */
export async function getOperationsData(filters?: OperationsFilters): Promise<OperationsData> {
  // Default values for when queries fail
  const defaultStats = {
    availableInventoryQty: 0,
    availableLoads: 0,
    availableInventoryValue: 0,
    committedCustomerQty: 0,
    inTransitNext7Days: 0,
    openLoads: 0,
    outstandingQty: 0,
    invoiceAmount: 0,
  };

  // Fetch all data in parallel - use allSettled so one failure doesn't break everything
  const results = await Promise.allSettled([
    getOperationsStats(filters),           // 0
    getSKUBreakdown(filters),              // 1
    getCustomerCommitments(filters),       // 2
    getShipmentStatusMix(filters),         // 3
    getImmediateAttention(filters),        // 4
    getGDC1Inventory(filters),             // 5
    getAllGDCInventories(filters),         // 6
    getRimInstallationRequired(filters),   // 7
  ]);

  // Extract results with fallbacks for failed queries
  const stats = results[0].status === 'fulfilled' ? results[0].value : defaultStats;
  if (results[0].status === 'rejected') {
    console.error('getOperationsStats failed:', results[0].reason);
  }

  const skuBreakdown = results[1].status === 'fulfilled' ? results[1].value : [];
  if (results[1].status === 'rejected') {
    console.error('getSKUBreakdown failed:', results[1].reason);
  }

  const customerCommitments = results[2].status === 'fulfilled' ? results[2].value : [];
  if (results[2].status === 'rejected') {
    console.error('getCustomerCommitments failed:', results[2].reason);
  }

  const shipmentStatusMix = results[3].status === 'fulfilled' ? results[3].value : [];
  if (results[3].status === 'rejected') {
    console.error('getShipmentStatusMix failed:', results[3].reason);
  }

  const immediateAttention = results[4].status === 'fulfilled' ? results[4].value : [];
  if (results[4].status === 'rejected') {
    console.error('getImmediateAttention failed:', results[4].reason);
  }

  const gdc1InventoryResult = results[5].status === 'fulfilled'
    ? results[5].value
    : { data: [], uniqueSkus: [] };
  if (results[5].status === 'rejected') {
    console.error('getGDC1Inventory failed:', results[5].reason);
  }

  const gdcInventories = results[6].status === 'fulfilled' ? results[6].value : [];
  if (results[6].status === 'rejected') {
    console.error('getAllGDCInventories failed:', results[6].reason);
  }

  const rimInstallationResult = results[7].status === 'fulfilled'
    ? results[7].value
    : { data: [], uniqueSkus: [] };
  if (results[7].status === 'rejected') {
    console.error('getRimInstallationRequired failed:', results[7].reason);
  }

  // HIDDEN: Supplier Schedule - return empty data
  const supplierShipmentSchedule: never[] = [];
  const supplierScheduleSkus: never[] = [];

  // Extract data and unique SKUs from results
  const gdc1Inventory = gdc1InventoryResult.data;
  const gdc1InventorySkus = gdc1InventoryResult.uniqueSkus;
  const rimInstallationRequired = rimInstallationResult.data;
  const rimInstallationSkus = rimInstallationResult.uniqueSkus;

  // Generate story in brief based on fetched data
  let storyInBrief = '';
  try {
    storyInBrief = await generateStoryInBrief(stats, skuBreakdown, rimInstallationRequired);
  } catch (error) {
    console.error('generateStoryInBrief failed:', error);
  }

  return {
    stats,
    skuBreakdown,
    customerCommitments,
    shipmentStatusMix,
    immediateAttention,
    supplierShipmentSchedule,
    supplierScheduleSkus,
    gdc1Inventory,
    gdc1InventorySkus,
    gdcInventories,
    rimInstallationRequired,
    rimInstallationSkus,
    storyInBrief,
  };
}

// ============================================
// INDIVIDUAL DATA FETCHERS (for targeted refresh)
// ============================================

/**
 * Get just the KPI stats
 */
export async function getStats() {
  return getOperationsStats();
}

/**
 * Get SKU breakdown data
 */
export async function getSkuData() {
  return getSKUBreakdown();
}

/**
 * Get customer commitments
 */
export async function getCustomerData() {
  return getCustomerCommitments();
}

/**
 * Get status mix data
 */
export async function getStatusMix() {
  return getShipmentStatusMix();
}

/**
 * Get immediate attention items
 */
export async function getAttentionItems() {
  return getImmediateAttention();
}

/**
 * Get supplier shipment schedule (Galileo)
 */
export async function getSupplierSchedule() {
  const result = await getSupplierShipmentSchedule();
  return { data: result.data, uniqueSkus: result.uniqueSkus };
}

/**
 * Get GDC1 warehouse inventory
 */
export async function getWarehouseInventory() {
  const result = await getGDC1Inventory();
  return { data: result.data, uniqueSkus: result.uniqueSkus };
}

/**
 * Get items requiring rim installation
 */
export async function getRimItems() {
  const result = await getRimInstallationRequired();
  return { data: result.data, uniqueSkus: result.uniqueSkus };
}

// ============================================
// DATA REFRESH
// ============================================

/**
 * Refresh all dashboard data
 * Called when user clicks refresh button
 */
export async function refreshDashboard(filters?: OperationsFilters): Promise<OperationsData> {
  return getOperationsData(filters);
}

/**
 * Get filter options for dropdowns
 */
export async function getFilterOptionsData(): Promise<FilterOptions> {
  return getFilterOptions();
}

// ============================================
// EXPORT FUNCTIONS (for Excel export)
// ============================================

export interface ExportOptions {
  includeStats?: boolean;
  includeSkuBreakdown?: boolean;
  includeCustomerCommitments?: boolean;
  includeShipmentSchedule?: boolean;
  includeGdc1Inventory?: boolean;
  includeRimInstallation?: boolean;
}

/**
 * Get data formatted for Excel export
 */
export async function getExportData(options: ExportOptions = {}) {
  const {
    includeStats = true,
    includeSkuBreakdown = true,
    includeCustomerCommitments = true,
    includeShipmentSchedule = true,
    includeGdc1Inventory = true,
    includeRimInstallation = true,
  } = options;

  const data: Partial<OperationsData> = {};

  const promises: Promise<void>[] = [];

  if (includeStats) {
    promises.push(getOperationsStats().then((result) => { data.stats = result; }));
  }

  if (includeSkuBreakdown) {
    promises.push(getSKUBreakdown().then((result) => { data.skuBreakdown = result; }));
  }

  if (includeCustomerCommitments) {
    promises.push(getCustomerCommitments().then((result) => { data.customerCommitments = result; }));
  }

  if (includeShipmentSchedule) {
    promises.push(getSupplierShipmentSchedule().then((result) => {
      data.supplierShipmentSchedule = result.data;
      data.supplierScheduleSkus = result.uniqueSkus;
    }));
  }

  if (includeGdc1Inventory) {
    promises.push(getGDC1Inventory().then((result) => {
      data.gdc1Inventory = result.data;
      data.gdc1InventorySkus = result.uniqueSkus;
    }));
  }

  if (includeRimInstallation) {
    promises.push(getRimInstallationRequired().then((result) => {
      data.rimInstallationRequired = result.data;
      data.rimInstallationSkus = result.uniqueSkus;
    }));
  }

  await Promise.all(promises);

  return data;
}
