/**
 * Master Inventory Module Types
 *
 * Unified inventory view across all sources:
 * - Warehouse/GDC inventory (from inventory table)
 * - Platinum Dealer inventory (from platinum_dealer_inventory table)
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type InventorySource = 'warehouse' | 'platinum_dealer';

export const INVENTORY_SOURCES: InventorySource[] = ['warehouse', 'platinum_dealer'];

export const INVENTORY_SOURCE_LABELS: Record<InventorySource, string> = {
  warehouse: 'Warehouse/GDC',
  platinum_dealer: 'Platinum Dealer',
};

export const INVENTORY_SOURCE_COLORS: Record<InventorySource, string> = {
  warehouse: 'bg-blue-100 text-blue-800 border border-blue-200',
  platinum_dealer: 'bg-purple-100 text-purple-800 border border-purple-200',
};

// ============================================
// MASTER INVENTORY TYPES
// ============================================

/**
 * Unified inventory item across all sources
 */
export interface MasterInventoryItem {
  id: string;

  // Source
  sourceType: InventorySource;
  sourceId: string; // inventory.id or platinum_dealer_inventory.id

  // Product
  productId: string;
  productSku: string;
  productName: string;

  // Location
  locationId: string;
  locationName: string;
  locationCode: string;
  locationCity: string | null;
  locationState: string | null;

  // Quantities
  onHand: number;
  allocated: number;
  available: number; // Computed: onHand - allocated

  // Flags
  isLowStock: boolean;

  // Warehouse-specific (nullable for dealer inventory)
  reorderPoint: number | null;
  reorderQty: number | null;

  // Platinum Dealer-specific (nullable for warehouse inventory)
  dealerId: string | null;
  dealerName: string | null;
  dealerLocationId: string | null;
  lastCountedAt: Date | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Master inventory stats aggregated across all sources
 */
export interface MasterInventoryStats {
  // Total stats
  totalLocations: number;
  totalOnHand: number;
  totalAllocated: number;
  totalAvailable: number;
  lowStockCount: number;

  // Breakdown by source
  warehouse: {
    locationCount: number;
    onHand: number;
    allocated: number;
    available: number;
  };
  platinumDealer: {
    dealerCount: number;
    locationCount: number;
    onHand: number;
    allocated: number;
    available: number;
  };

  // On Order & In Transit (from existing system)
  onOrder: number;
  inTransit: number;
}

/**
 * Product inventory summary across all locations
 */
export interface ProductInventorySummary {
  productId: string;
  productSku: string;
  productName: string;

  // Total across all sources
  totalOnHand: number;
  totalAllocated: number;
  totalAvailable: number;

  // By source
  warehouseOnHand: number;
  warehouseAllocated: number;
  warehouseAvailable: number;

  dealerOnHand: number;
  dealerAllocated: number;
  dealerAvailable: number;

  // Location count
  warehouseLocationCount: number;
  dealerLocationCount: number;

  isLowStock: boolean;
}

// ============================================
// FILTERS & PARAMS
// ============================================

/**
 * Master inventory filters
 */
export interface MasterInventoryFilters {
  page?: number;
  limit?: number;
  search?: string; // Search by SKU, product name, location name

  // Source filter
  sourceType?: InventorySource | 'all';

  // Location filters
  locationId?: string;
  dealerId?: string;
  dealerLocationId?: string;

  // Product filter
  productId?: string;

  // Stock filters
  lowStockOnly?: boolean;

  // Sorting
  sortBy?: 'productSku' | 'productName' | 'locationName' | 'onHand' | 'allocated' | 'available' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// COMPONENT PROPS
// ============================================

export interface MasterInventoryTableProps {
  data: MasterInventoryItem[];
  isLoading?: boolean;
  onRowClick?: (item: MasterInventoryItem) => void;
  onView?: (item: MasterInventoryItem) => void;
}

export interface MasterInventoryStatsGridProps {
  stats: MasterInventoryStats;
  isLoading?: boolean;
}

export interface SourceBreakdownCardsProps {
  stats: MasterInventoryStats;
  isLoading?: boolean;
}

export interface ViewMasterInventoryDrawerProps {
  open: boolean;
  onClose: () => void;
  item: MasterInventoryItem | null;
}
