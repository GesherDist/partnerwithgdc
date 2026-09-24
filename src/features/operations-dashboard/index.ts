/**
 * Operations Dashboard Feature
 *
 * Jenny's operations dashboard for tracking supplier and GDC inventory and shipments.
 */

// Types - export with explicit names to avoid conflicts
export type {
  OperationsStats,
  SKUBreakdown as SKUBreakdownData,
  CustomerCommitment,
  ShipmentStatusMix as ShipmentStatusMixData,
  ShipmentStatus,
  ImmediateAttentionItem,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  RimInstallationItem,
  OperationsData,
} from './types';

// Components
export {
  OperationsHeader,
  OperationsStatsGrid,
  ImmediateAttentionTable,
  SKUBreakdown,
  CustomerCommitments,
  ShipmentStatusMix,
  RimInstallationRequired,
  StoryInBrief,
} from './components';

// Lib
export { operationsData } from './lib';

// Actions
export {
  fetchOperationsData,
  fetchOperationsStats,
  fetchImmediateAttention,
  fetchSupplierSchedule,
  fetchGDC1Inventory,
  fetchRimInstallation,
  refreshOperationsData,
  fetchExportData,
} from './actions';
