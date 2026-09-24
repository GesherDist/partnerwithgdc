/**
 * Inventory Module Types
 *
 * All TypeScript interfaces for the Inventory feature.
 * Per client doc: "per product per location: on_hand, allocated. Derived available = on_hand - allocated"
 */

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Inventory entity from database
 */
export interface Inventory {
  id: string;
  productId: string;
  locationId: string;

  // Quantities
  onHand: number;
  allocated: number;
  // available is computed: onHand - allocated

  // Reorder Settings
  reorderPoint: number;
  reorderQty: number;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Inventory with computed available and related data
 */
export interface InventoryWithDetails extends Inventory {
  available: number;
  product?: ProductSummary;
  location?: LocationSummary;
  isLowStock: boolean;
}

// ============================================
// SUMMARY TYPES (for joins)
// ============================================

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  unitCode: string;
}

export interface LocationSummary {
  id: string;
  code: string;
  name: string;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateInventoryDTO {
  productId: string;
  locationId: string;
  onHand?: number;
  allocated?: number;
  reorderPoint?: number;
  reorderQty?: number;
}

export interface UpdateInventoryDTO {
  onHand?: number;
  allocated?: number;
  reorderPoint?: number;
  reorderQty?: number;
}

export interface AdjustInventoryDTO {
  adjustment: number; // positive to add, negative to subtract
  reason?: string;
}

export interface AllocateInventoryDTO {
  quantity: number;
  salesOrderId?: string;
  salesOrderItemId?: string;
}

export interface DeallocateInventoryDTO {
  quantity: number;
  salesOrderId?: string;
  salesOrderItemId?: string;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface InventoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
  locationId?: string;
  lowStockOnly?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InventoryListItem {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number;
  reorderQty: number;
  isLowStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
// COMPONENT PROP TYPES
// ============================================

export interface InventoryTableProps {
  data: InventoryListItem[];
  isLoading?: boolean;
  onRowClick?: (item: InventoryListItem) => void;
  onView?: (item: InventoryListItem) => void;
  onEdit?: (item: InventoryListItem) => void;
  onAdjust?: (item: InventoryListItem) => void;
  toolbarContent?: React.ReactNode;
}

export interface ViewInventoryDrawerProps {
  open: boolean;
  onClose: () => void;
  inventoryId: string | null;
  onEdit?: () => void;
  onAdjust?: () => void;
}

export interface AdjustInventoryDrawerProps {
  open: boolean;
  onClose: () => void;
  inventoryId: string | null;
  onSuccess?: () => void;
}

export interface CreateInventoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface EditInventoryDrawerProps {
  open: boolean;
  onClose: () => void;
  inventoryId: string | null;
  onSuccess?: () => void;
}
