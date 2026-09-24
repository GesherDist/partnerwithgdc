/**
 * Price Matrix Module - TypeScript Types
 *
 * Types for channel-based product pricing with quantity tiers.
 * Supports OEM and Dealer channels with volume-based pricing.
 */

import type { CustomerChannel } from '@/features/customers/types';

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type PriceStatus = 'active' | 'inactive';

export const PRICE_STATUSES: PriceStatus[] = ['active', 'inactive'];

export const PRICE_STATUS_LABELS: Record<PriceStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

export const PRICE_STATUS_COLORS: Record<PriceStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  inactive: 'bg-stone-100 text-stone-600 border border-stone-200',
};

// Re-export channel types for convenience
export { type CustomerChannel } from '@/features/customers/types';
export { CUSTOMER_CHANNEL_LABELS, CUSTOMER_CHANNEL_COLORS } from '@/features/customers/types';

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Price Matrix entity from database
 */
export interface PriceMatrixEntry {
  id: string;
  productId: string;
  channel: CustomerChannel;
  minQuantity: number;
  maxQuantity: number | null;
  cost: number; // cents
  price: number; // cents
  status: PriceStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * Price Matrix with product info (for display)
 */
export interface PriceMatrixWithProduct extends PriceMatrixEntry {
  product: {
    id: string;
    sku: string;
    name: string;
  };
}

/**
 * Price lookup result (from get_product_price function)
 */
export interface PriceLookupResult {
  cost: number;
  price: number;
  minQuantity: number;
  maxQuantity: number | null;
}

// ============================================
// DTO TYPES
// ============================================

/**
 * Create Price Matrix Entry DTO
 */
export interface CreatePriceMatrixDTO {
  productId: string;
  channel: CustomerChannel;
  minQuantity: number;
  maxQuantity?: number | null;
  cost: number; // cents
  price: number; // cents
  status?: PriceStatus;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}

/**
 * Update Price Matrix Entry DTO
 */
export interface UpdatePriceMatrixDTO {
  channel?: CustomerChannel;
  minQuantity?: number;
  maxQuantity?: number | null;
  cost?: number; // cents
  price?: number; // cents
  status?: PriceStatus;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
}

/**
 * Bulk create price entries for a product
 */
export interface BulkCreatePriceMatrixDTO {
  productId: string;
  entries: Omit<CreatePriceMatrixDTO, 'productId'>[];
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Price Matrix list query parameters
 */
export interface PriceMatrixListParams {
  productId?: string;
  channel?: CustomerChannel;
  status?: PriceStatus;
  page?: number;
  limit?: number;
  sortBy?: keyof PriceMatrixEntry;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Price lookup query parameters
 */
export interface PriceLookupParams {
  productId: string;
  channel: CustomerChannel;
  quantity?: number;
}

// ============================================
// TABLE TYPES
// ============================================

/**
 * Price Matrix table row (for TanStack Table)
 */
export interface PriceMatrixTableRow {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  channel: CustomerChannel;
  minQuantity: number;
  maxQuantity: number | null;
  quantityRange: string; // e.g., "1-99" or "100+"
  cost: number;
  price: number;
  formattedCost: string;
  formattedPrice: string;
  margin: number;
  marginPercent: number;
  status: PriceStatus;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

// ============================================
// FORM TYPES
// ============================================

/**
 * Price Matrix form values (for React Hook Form)
 */
export interface PriceMatrixFormValues {
  productId: string;
  channel: CustomerChannel;
  minQuantity: string; // String for form input
  maxQuantity: string; // String for form input, empty = unlimited
  cost: string; // String in dollars, converted to cents
  price: string; // String in dollars, converted to cents
  status: PriceStatus;
  effectiveFrom: string; // ISO date string
  effectiveTo: string; // ISO date string, empty = no expiry
}

/**
 * Default form values
 */
export const DEFAULT_PRICE_MATRIX_FORM_VALUES: PriceMatrixFormValues = {
  productId: '',
  channel: 'dealer',
  minQuantity: '1',
  maxQuantity: '',
  cost: '',
  price: '',
  status: 'active',
  effectiveFrom: new Date().toISOString().split('T')[0] ?? '',
  effectiveTo: '',
};

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Action result type
 */
export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Paginated result
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
// COMPONENT PROP TYPES
// ============================================

export interface PriceMatrixFormProps {
  productId?: string;
  initialData?: Partial<PriceMatrixFormValues>;
  onSubmit: (data: PriceMatrixFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

export interface PriceMatrixTableProps {
  productId?: string;
  data: PriceMatrixTableRow[];
  isLoading?: boolean;
  onEdit?: (entry: PriceMatrixTableRow) => void;
  onDelete?: (entry: PriceMatrixTableRow) => void;
}

export interface CreatePriceMatrixDrawerProps {
  open: boolean;
  productId?: string;
  onClose: () => void;
  onSuccess?: (entry: PriceMatrixEntry) => void;
}

export interface EditPriceMatrixDrawerProps {
  open: boolean;
  entryId: string | null;
  onClose: () => void;
  onSuccess?: (entry: PriceMatrixEntry) => void;
}
