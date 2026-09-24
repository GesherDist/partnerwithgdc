/**
 * Products Module - TypeScript Types
 *
 * DTOs and types for the Products module
 */

/**
 * Product status enum
 */
export type ProductStatus = 'active' | 'inactive' | 'discontinued';

/**
 * Product item type enum
 */
export type ProductItemType = 'inventory' | 'non_inventory' | 'service';

// ============================================
// BASE TYPES
// ============================================

/**
 * Product entity type (from database)
 */
export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  category: string | null;
  rimSize: string | null;
  tireSize: string | null;
  weightLbs: number | null;
  baseCost: number;
  basePrice: number;
  status: ProductStatus;
  itemType: ProductItemType;
  isSellable: boolean;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;

  // QuickBooks Sync
  qboItemId: string | null;
  qboRealmId: string | null;
  qboSyncedAt: Date | null;
  qboSyncError: string | null;

  // QuickBooks Account Fields
  qboIncomeAccount: string | null;
  qboExpenseAccount: string | null;
  qboInventoryAssetAccount: string | null;

  // Description Fields
  salesDescription: string | null;
  purchaseDescription: string | null;

  // Other Fields
  barcode: string | null;
  isTaxable: boolean;
}

/**
 * Product with formatted prices (for display)
 */
export interface ProductWithFormattedPrices extends Product {
  formattedBaseCost: string;
  formattedBasePrice: string;
  margin: number;
  marginPercent: number;
}

// ============================================
// DTO TYPES
// ============================================

/**
 * Create Product DTO
 */
export interface CreateProductDTO {
  sku: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  category?: string | null;
  rimSize?: string | null;
  tireSize?: string | null;
  weightLbs?: number | null;
  baseCost: number;
  basePrice: number;
  status?: ProductStatus;
  itemType?: ProductItemType;
  isSellable?: boolean;
  imageUrl?: string | null;
  // QuickBooks Account Fields
  qboIncomeAccount?: string | null;
  qboExpenseAccount?: string | null;
  qboInventoryAssetAccount?: string | null;
  // Description Fields
  salesDescription?: string | null;
  purchaseDescription?: string | null;
  // Other Fields
  barcode?: string | null;
  isTaxable?: boolean;
}

/**
 * Update Product DTO
 */
export interface UpdateProductDTO {
  sku?: string;
  name?: string;
  description?: string | null;
  shortDescription?: string | null;
  category?: string | null;
  rimSize?: string | null;
  tireSize?: string | null;
  weightLbs?: number | null;
  baseCost?: number;
  basePrice?: number;
  status?: ProductStatus;
  itemType?: ProductItemType;
  isSellable?: boolean;
  imageUrl?: string | null;
  // QuickBooks Account Fields
  qboIncomeAccount?: string | null;
  qboExpenseAccount?: string | null;
  qboInventoryAssetAccount?: string | null;
  // Description Fields
  salesDescription?: string | null;
  purchaseDescription?: string | null;
  // Other Fields
  barcode?: string | null;
  isTaxable?: boolean;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Product list query parameters
 */
export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ProductStatus;
  itemType?: ProductItemType;
  category?: string;
  isSellable?: boolean;
  sortBy?: keyof Product;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Product list response
 */
export interface ProductListResponse {
  data: Product[];
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
// FORM TYPES
// ============================================

/**
 * Product form values (for React Hook Form)
 */
export interface ProductFormValues {
  sku: string;
  name: string;
  description: string;
  shortDescription: string;
  category: string;
  rimSize: string;
  tireSize: string;
  weightLbs: string; // String for form input, converted to number
  baseCost: string; // String in dollars, converted to cents
  basePrice: string; // String in dollars, converted to cents
  status: ProductStatus;
  itemType: ProductItemType;
  isSellable: boolean;
  imageUrl: string;
  // QuickBooks Account Fields
  qboIncomeAccount: string;
  qboExpenseAccount: string;
  qboInventoryAssetAccount: string;
  // Description Fields
  salesDescription: string;
  purchaseDescription: string;
  // Other Fields
  barcode: string;
  isTaxable: boolean;
}

// ============================================
// TABLE TYPES
// ============================================

/**
 * Product table row (for TanStack Table)
 */
export interface ProductTableRow {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  itemType: ProductItemType;
  baseCost: number;
  basePrice: number;
  formattedBaseCost: string;
  formattedBasePrice: string;
  margin: number;
  marginPercent: number;
  status: ProductStatus;
  isSellable: boolean;
  createdAt: Date;
}

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Single product API response
 */
export interface ProductResponse {
  success: boolean;
  data: Product | null;
  error?: string;
}

/**
 * Product list API response
 */
export interface ProductsResponse {
  success: boolean;
  data: Product[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Product status options for select inputs
 */
export const PRODUCT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'discontinued', label: 'Discontinued' },
] as const;

/**
 * Product item type options for select inputs
 */
export const PRODUCT_ITEM_TYPE_OPTIONS = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'non_inventory', label: 'Non-Inventory' },
  { value: 'service', label: 'Service' },
] as const;

/**
 * Default product form values
 */
export const DEFAULT_PRODUCT_FORM_VALUES: ProductFormValues = {
  sku: '',
  name: '',
  description: '',
  shortDescription: '',
  category: '',
  rimSize: '',
  tireSize: '',
  weightLbs: '',
  baseCost: '',
  basePrice: '',
  status: 'active',
  itemType: 'inventory',
  isSellable: true,
  imageUrl: '',
  // QuickBooks Account Fields
  qboIncomeAccount: '',
  qboExpenseAccount: '',
  qboInventoryAssetAccount: '',
  // Description Fields
  salesDescription: '',
  purchaseDescription: '',
  // Other Fields
  barcode: '',
  isTaxable: false,
};
