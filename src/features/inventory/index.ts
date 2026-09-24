/**
 * Inventory Feature Module
 *
 * Public API for the Inventory feature.
 * Only export what should be accessible from outside this feature.
 */

// Types
export type {
  Inventory,
  InventoryWithDetails,
  InventoryListItem,
  InventoryListParams,
  CreateInventoryDTO,
  UpdateInventoryDTO,
  AdjustInventoryDTO,
  AllocateInventoryDTO,
  DeallocateInventoryDTO,
  InventoryTableProps,
  ProductSummary,
  LocationSummary,
} from './types';

// Components
export { InventoryTable, InventoryTableColumns, ViewInventoryDrawer } from './components';

// Hooks
export { useInventory, useInventoryItem } from './hooks';

// Actions
export {
  listInventory,
  getInventory,
  getInventoryByProductAndLocation,
  createInventory,
  updateInventory,
  adjustInventory,
  allocateInventory,
  deallocateInventory,
  deleteInventory,
  getLowStockItems,
} from './actions';

// Services (for internal use by other features)
export { inventoryService } from './services';
