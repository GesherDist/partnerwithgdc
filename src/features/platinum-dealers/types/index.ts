/**
 * Platinum Dealers Module Types
 *
 * Platinum dealers are top-tier partners who can:
 * 1. Fulfill orders from their existing inventory (platinum_dealer_inventory)
 * 2. Procure and ship products on our behalf (platinum_dealer_fulfillment)
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type DealerStatus = 'active' | 'inactive';

export const DEALER_STATUSES: DealerStatus[] = ['active', 'inactive'];

export const DEALER_STATUS_LABELS: Record<DealerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

export const DEALER_STATUS_COLORS: Record<DealerStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  inactive: 'bg-stone-100 text-stone-700 border border-stone-200',
};

// ============================================
// PLATINUM DEALER TYPES
// ============================================

/**
 * Platinum Dealer entity from database
 */
export interface PlatinumDealer {
  id: string;

  // Basic Info
  dealerName: string;
  code: string | null;

  // Contact
  contactName: string | null;
  phone: string | null;
  email: string | null;

  // Address
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;

  // Status
  status: DealerStatus;

  // Metadata
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  deletedAt: Date | null;
}

/**
 * Platinum Dealer Location entity from database
 *
 * One dealer can have multiple physical locations (yards, warehouses, etc.)
 * Inventory is tracked at the LOCATION level, not dealer level.
 */
export interface PlatinumDealerLocation {
  id: string;
  dealerId: string;

  // Location Info
  locationName: string; // "Kansas Yard", "Dallas Warehouse", etc.
  locationCode: string | null;

  // Address
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;

  // Contact (location-specific)
  contactName: string | null;
  phone: string | null;
  email: string | null;

  // Status
  status: DealerStatus;

  // Metadata
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Platinum Dealer Inventory entity from database
 *
 * Tracks inventory at each dealer location.
 * Location-specific, not dealer-level.
 */
export interface PlatinumDealerInventory {
  id: string;

  // Relations
  dealerId: string; // Denormalized for easier queries
  dealerLocationId: string;
  productId: string;

  // Quantities
  onHand: number; // Physical quantity at location
  allocated: number; // Reserved for pending orders
  available: number; // On hand - allocated (auto-calculated in DB)

  // Metadata
  lastCountedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// EXTENDED TYPES (with relations)
// ============================================

/**
 * Platinum Dealer with locations count
 */
export interface PlatinumDealerWithStats extends PlatinumDealer {
  locationsCount: number;
  totalInventoryValue: number; // Total value of all inventory across locations
}

/**
 * Platinum Dealer Location with dealer info
 */
export interface PlatinumDealerLocationWithDealer
  extends PlatinumDealerLocation {
  dealer: {
    id: string;
    dealerName: string;
    code: string | null;
  };
}

/**
 * Platinum Dealer Inventory with product and location details
 */
export interface PlatinumDealerInventoryWithDetails
  extends PlatinumDealerInventory {
  product: {
    id: string;
    sku: string;
    description: string | null;
  };
  dealerLocation: {
    id: string;
    locationName: string;
    addressCity: string | null;
    addressState: string | null;
  };
  dealer: {
    id: string;
    dealerName: string;
  };
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

/**
 * Create Platinum Dealer DTO
 */
export interface CreatePlatinumDealerDTO {
  dealerName: string;
  code?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  notes?: string;
}

/**
 * Update Platinum Dealer DTO
 */
export interface UpdatePlatinumDealerDTO {
  dealerName?: string;
  code?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  status?: DealerStatus;
  notes?: string;
}

/**
 * Create Platinum Dealer Location DTO
 */
export interface CreatePlatinumDealerLocationDTO {
  dealerId: string;
  locationName: string;
  locationCode?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

/**
 * Update Platinum Dealer Location DTO
 */
export interface UpdatePlatinumDealerLocationDTO {
  locationName?: string;
  locationCode?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  status?: DealerStatus;
  notes?: string;
}

/**
 * Adjust Platinum Dealer Inventory DTO
 */
export interface AdjustPlatinumDealerInventoryDTO {
  dealerLocationId: string;
  productId: string;
  onHand: number;
  notes?: string;
}

// ============================================
// FILTERS
// ============================================

/**
 * Platinum Dealer filters
 */
export interface PlatinumDealerFilters {
  status?: DealerStatus;
  search?: string; // Search in name, code, contact name
}

/**
 * Platinum Dealer Inventory filters
 */
export interface PlatinumDealerInventoryFilters {
  dealerId?: string;
  dealerLocationId?: string;
  productId?: string;
  lowStock?: boolean; // available < threshold
}
