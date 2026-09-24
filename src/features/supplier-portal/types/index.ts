/**
 * Supplier Portal Types
 *
 * Type definitions for supplier portal feature.
 */

// ============================================
// ENUMS
// ============================================

export type ProductionStatus = 'not_started' | 'in_production' | 'ready_to_ship' | 'shipped';

export type SupplierStatus = 'active' | 'inactive' | 'pending';

export type POStatus = 'draft' | 'sent' | 'confirmed' | 'in_production' | 'ready_to_ship' | 'in_transit' | 'partial' | 'received' | 'cancelled';

export type ShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'failed';

// ============================================
// SUPPLIER
// ============================================

export interface Supplier {
  id: string;
  supplierCode: string;
  name: string;
  legalName: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string;
  paymentTerms: string | null;
  currencyCode: string;
  taxId: string | null;
  status: SupplierStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PURCHASE ORDER
// ============================================

export interface SupplierPurchaseOrder {
  id: string;
  poNumber: string;
  poDate: string;
  expectedDeliveryDate: string | null;
  // Supplier info is now at item level (see SupplierPurchaseOrderItem)
  salesOrderId: string | null;
  warehouseId: string | null;
  currencyCode: string;
  status: POStatus;
  // Supplier portal fields
  productionStatus: ProductionStatus;
  supplierConfirmedAt: string | null;
  supplierConfirmedBy: string | null;
  supplierRejectedAt: string | null;
  supplierRejectedBy: string | null;
  supplierRejectionReason: string | null;
  expectedCompletionDate: string | null;
  supplierNotes: string | null;
  // Totals
  subtotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;
  // Notes
  vendorNotes: string | null;
  internalNotes: string | null;
  // Audit
  createdAt: string;
  updatedAt: string;
  // Related data
  items?: SupplierPurchaseOrderItem[];
  salesOrder?: {
    id: string;
    soNumber: string;
  };
}

export interface SupplierPurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  sku: string;
  description: string | null;
  quantityOrdered: number;
  quantityReceived: number;
  unitCode: string;
  unitPrice: number;
  taxRate: number;
  lineTotal: number;
  sortOrder: number;
  // Per-item supplier
  supplierId: string | null;
  supplierName: string | null;
}

// ============================================
// SHIPMENT
// ============================================

export interface SupplierShipment {
  id: string;
  shipmentNumber: string;
  shipmentDate: string;
  estimatedArrival: string | null;
  actualArrival: string | null;
  salesOrderId: string | null;
  purchaseOrderId: string | null;
  supplierId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  serviceType: string | null;
  status: ShipmentStatus;
  // Supplier portal fields
  containerNumber: string | null;
  billOfLading: string | null;
  vesselName: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  etd: string | null;
  etaPort: string | null;
  etaCustomer: string | null;
  supplierUpdatedAt: string | null;
  supplierUpdatedBy: string | null;
  // Address
  shipToName: string | null;
  shipToAddressStreet: string | null;
  shipToAddressCity: string | null;
  shipToAddressState: string | null;
  shipToAddressPostalCode: string | null;
  shipToAddressCountry: string | null;
  // Package info
  totalWeight: number | null;
  weightUnit: string;
  totalPackages: number;
  // Notes
  notes: string | null;
  deliveryInstructions: string | null;
  // Audit
  createdAt: string;
  updatedAt: string;
  // Related
  items?: SupplierShipmentItem[];
  purchaseOrder?: {
    id: string;
    poNumber: string;
  };
}

export interface SupplierShipmentItem {
  id: string;
  shipmentId: string;
  productId: string;
  sku: string;
  description: string | null;
  quantityShipped: number;
  sortOrder: number;
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface SupplierDashboardStats {
  totalOrders: number;
  pendingConfirmation: number;
  inProduction: number;
  readyToShip: number;
  inTransit: number;
  delivered: number;
  delayed: number;
}

// ============================================
// FORM TYPES
// ============================================

export interface ConfirmPOInput {
  poId: string;
  expectedCompletionDate?: string;
  supplierNotes?: string;
  supplierReferenceNumber?: string; // Supplier's Sales Order # (e.g., Galileo SO2600028)
}

export interface RejectPOInput {
  poId: string;
  rejectionReason: string;
}

export interface UpdateProductionInput {
  poId: string;
  productionStatus: ProductionStatus;
  expectedCompletionDate?: string;
  supplierNotes?: string;
}

export interface UpdateShipmentInput {
  shipmentId: string;
  containerNumber?: string;
  billOfLading?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  etd?: string;
  etaPort?: string;
  etaCustomer?: string;
  notes?: string;
}
