/**
 * Cost Components Module Types
 *
 * All TypeScript interfaces for the Cost Components feature.
 * Per client doc: "type (ex_works, ocean_freight, duty, inland), amount. Sum = landed cost"
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

export type CostComponentType =
  | 'door_to_door'
  | 'ex_works'
  | 'ocean_freight'
  | 'duty'
  | 'inland'
  | 'other';

export const COST_COMPONENT_TYPES: CostComponentType[] = [
  'door_to_door',
  'ex_works',
  'ocean_freight',
  'duty',
  'inland',
  'other',
];

export const COST_COMPONENT_TYPE_LABELS: Record<CostComponentType, string> = {
  door_to_door: 'Door to Door',
  ex_works: 'Ex Works',
  ocean_freight: 'Ocean Freight',
  duty: 'Duty',
  inland: 'Inland',
  other: 'Other',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Cost Component entity from database
 */
export interface CostComponent {
  id: string;
  purchaseOrderId: string | null;
  purchaseOrderItemId: string | null;

  // Component Details
  componentType: CostComponentType;
  description: string | null;
  amount: number; // cents
  currencyCode: string;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

/**
 * Cost Component with related data
 */
export interface CostComponentWithDetails extends CostComponent {
  purchaseOrder?: {
    id: string;
    poNumber: string;
  };
  purchaseOrderItem?: {
    id: string;
    sku: string;
    description: string | null;
  };
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateCostComponentDTO {
  purchaseOrderId?: string | null;
  purchaseOrderItemId?: string | null;
  componentType: CostComponentType;
  description?: string | null;
  amount: number; // cents
  currencyCode?: string;
}

export interface UpdateCostComponentDTO {
  componentType?: CostComponentType;
  description?: string | null;
  amount?: number;
  currencyCode?: string;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface CostComponentListParams {
  purchaseOrderId?: string;
  purchaseOrderItemId?: string;
  componentType?: CostComponentType;
}

export interface CostComponentSummary {
  componentType: CostComponentType;
  totalAmount: number;
  count: number;
}

export interface LandedCostSummary {
  purchaseOrderId: string;
  components: CostComponentSummary[];
  totalLandedCost: number;
  currencyCode: string;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface CostComponentsListProps {
  purchaseOrderId?: string;
  purchaseOrderItemId?: string;
  components: CostComponent[];
  isLoading?: boolean;
  onAdd?: () => void;
  onEdit?: (component: CostComponent) => void;
  onDelete?: (component: CostComponent) => void;
}

export interface AddCostComponentDrawerProps {
  open: boolean;
  onClose: () => void;
  purchaseOrderId?: string;
  purchaseOrderItemId?: string;
  onSuccess?: () => void;
}

export interface EditCostComponentDrawerProps {
  open: boolean;
  onClose: () => void;
  componentId: string | null;
  onSuccess?: () => void;
}
