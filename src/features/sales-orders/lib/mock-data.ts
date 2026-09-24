/**
 * Sales Order Mock Data
 *
 * SAMPLE/DUMMY data for development and testing.
 * This file can be safely deleted in production as it only
 * contains sample data, not real application configuration.
 *
 * For permanent configuration data (shipping methods, currencies, etc.),
 * see: src/shared/lib/global-data.ts
 */

import type {
  Customer,
  Product,
  Warehouse,
  SalesRep,
  SalesOrderMasterData,
  SalesOrderListItem,
  SalesOrderListResponse,
  MasterDataResponse,
  OrderItem,
} from '../types';

// Import permanent configuration from global-data
import {
  SHIPPING_METHODS,
  CURRENCIES,
  UNITS,
  TAX_RATES,
} from '@/shared/lib/global-data';

// ============================================
// MASTER DATA
// ============================================

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'cust-001',
    code: 'ACME',
    name: 'Acme Farm Supply Co.',
    email: 'orders@acmefarm.com',
    phone: '+1 (555) 123-4567',
    billingAddress: {
      street: '123 Main Street',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'USA',
    },
    shippingAddress: {
      street: '456 Warehouse Blvd',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62702',
      country: 'USA',
    },
  },
  {
    id: 'cust-002',
    code: 'GREENF',
    name: 'Green Fields Agriculture',
    email: 'purchasing@greenfields.com',
    phone: '+1 (555) 234-5678',
    billingAddress: {
      street: '789 Oak Avenue',
      city: 'Columbus',
      state: 'OH',
      postalCode: '43215',
      country: 'USA',
    },
    shippingAddress: {
      street: '789 Oak Avenue',
      city: 'Columbus',
      state: 'OH',
      postalCode: '43215',
      country: 'USA',
    },
  },
  {
    id: 'cust-003',
    code: 'HARV',
    name: 'Harvest Equipment Inc.',
    email: 'info@harvestequip.com',
    phone: '+1 (555) 345-6789',
    billingAddress: {
      street: '321 Industrial Park',
      city: 'Des Moines',
      state: 'IA',
      postalCode: '50309',
      country: 'USA',
    },
    shippingAddress: {
      street: '999 Distribution Center',
      city: 'Des Moines',
      state: 'IA',
      postalCode: '50310',
      country: 'USA',
    },
  },
  {
    id: 'cust-004',
    code: 'PRAIRIE',
    name: 'Prairie Land Distributors',
    email: 'orders@prairieland.com',
    phone: '+1 (555) 456-7890',
    billingAddress: {
      street: '555 Plains Road',
      city: 'Topeka',
      state: 'KS',
      postalCode: '66603',
      country: 'USA',
    },
    shippingAddress: {
      street: '555 Plains Road',
      city: 'Topeka',
      state: 'KS',
      postalCode: '66603',
      country: 'USA',
    },
  },
  {
    id: 'cust-005',
    code: 'MIDWEST',
    name: 'Midwest Tire & Supply',
    email: 'sales@midwesttire.com',
    phone: '+1 (555) 567-8901',
    billingAddress: {
      street: '888 Commerce Street',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'USA',
    },
    shippingAddress: {
      street: '888 Commerce Street',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60601',
      country: 'USA',
    },
  },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    sku: 'TIR-AGR-001',
    name: 'Agricultural Tire 18.4-38',
    description: 'Heavy-duty agricultural tire for tractors',
    unitPrice: 485.0,
    unitId: 'unit-001',
  },
  {
    id: 'prod-002',
    sku: 'TIR-AGR-002',
    name: 'Agricultural Tire 16.9-30',
    description: 'Medium-duty agricultural tire',
    unitPrice: 395.0,
    unitId: 'unit-001',
  },
  {
    id: 'prod-003',
    sku: 'TIR-AGR-003',
    name: 'Agricultural Tire 14.9-24',
    description: 'Compact tractor tire',
    unitPrice: 285.0,
    unitId: 'unit-001',
  },
  {
    id: 'prod-004',
    sku: 'TIR-IND-001',
    name: 'Industrial Tire 12.00-20',
    description: 'Industrial equipment tire',
    unitPrice: 325.0,
    unitId: 'unit-001',
  },
  {
    id: 'prod-005',
    sku: 'TIR-IND-002',
    name: 'Industrial Tire 10.00-20',
    description: 'Forklift and loader tire',
    unitPrice: 275.0,
    unitId: 'unit-001',
  },
  {
    id: 'prod-006',
    sku: 'TUB-001',
    name: 'Inner Tube 18.4-38',
    description: 'Inner tube for 18.4-38 tires',
    unitPrice: 45.0,
    unitId: 'unit-001',
  },
  {
    id: 'prod-007',
    sku: 'TUB-002',
    name: 'Inner Tube 16.9-30',
    description: 'Inner tube for 16.9-30 tires',
    unitPrice: 38.0,
    unitId: 'unit-001',
  },
  {
    id: 'prod-008',
    sku: 'RIM-001',
    name: 'Wheel Rim W10x38',
    description: 'Agricultural wheel rim',
    unitPrice: 220.0,
    unitId: 'unit-001',
  },
];

export const MOCK_WAREHOUSES: Warehouse[] = [
  { id: 'wh-001', code: 'MAIN', name: 'Main Warehouse' },
  { id: 'wh-002', code: 'EAST', name: 'East Distribution Center' },
  { id: 'wh-003', code: 'WEST', name: 'West Distribution Center' },
  { id: 'wh-004', code: 'SOUTH', name: 'Southern Depot' },
];

export const MOCK_SALES_REPS: SalesRep[] = [
  { id: 'rep-001', name: 'John Smith', email: 'john.smith@gesher.com' },
  { id: 'rep-002', name: 'Sarah Johnson', email: 'sarah.johnson@gesher.com' },
  { id: 'rep-003', name: 'Michael Brown', email: 'michael.brown@gesher.com' },
  { id: 'rep-004', name: 'Emily Davis', email: 'emily.davis@gesher.com' },
];

// Note: Currencies, Shipping Methods, Units, and Tax Rates
// are now imported from @/shared/lib/global-data.ts
// Those are permanent configuration, not mock data.

// ============================================
// AGGREGATED MASTER DATA
// ============================================

export const MOCK_MASTER_DATA: SalesOrderMasterData = {
  customers: MOCK_CUSTOMERS,
  products: MOCK_PRODUCTS,
  warehouses: MOCK_WAREHOUSES,
  salesReps: MOCK_SALES_REPS,
  // Permanent configuration from global-data.ts
  currencies: CURRENCIES,
  shippingMethods: SHIPPING_METHODS,
  units: UNITS,
  taxRates: TAX_RATES,
};

// ============================================
// SALES ORDER LIST DATA
// ============================================

export const MOCK_SALES_ORDERS_LIST: SalesOrderListItem[] = [
  {
    id: 'so-001',
    orderNumber: 'SO-2024-00145',
    customerId: 'cust-001',
    customerName: 'Acme Farm Supply Co.',
    orderDate: '2024-01-15',
    requestedDeliveryDate: '2024-01-22',
    status: 'confirmed',
    creditStatus: 'ok',
    grandTotal: 384250, // cents
    currencyCode: 'USD',
    orderSeries: 'GDC 1',
    itemCount: 3,
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'so-002',
    orderNumber: 'SO-2024-00146',
    customerId: 'cust-002',
    customerName: 'Green Fields Agriculture',
    orderDate: '2024-01-16',
    requestedDeliveryDate: '2024-01-25',
    status: 'processing',
    creditStatus: 'ok',
    grandTotal: 215675, // cents
    currencyCode: 'USD',
    orderSeries: 'GDC 2',
    itemCount: 2,
    createdAt: new Date('2024-01-16'),
  },
  {
    id: 'so-003',
    orderNumber: 'SO-2024-00147',
    customerId: 'cust-003',
    customerName: 'Harvest Equipment Inc.',
    orderDate: '2024-01-17',
    requestedDeliveryDate: '2024-01-24',
    status: 'draft',
    creditStatus: 'ok',
    grandTotal: 158000, // cents
    currencyCode: 'USD',
    orderSeries: 'GDC 1',
    itemCount: 1,
    createdAt: new Date('2024-01-17'),
  },
  {
    id: 'so-004',
    orderNumber: 'SO-2024-00148',
    customerId: 'cust-004',
    customerName: 'Prairie Land Distributors',
    orderDate: '2024-01-18',
    requestedDeliveryDate: '2024-01-28',
    status: 'shipped',
    creditStatus: 'ok',
    grandTotal: 542525, // cents
    currencyCode: 'USD',
    orderSeries: 'GDC 3',
    itemCount: 4,
    createdAt: new Date('2024-01-18'),
  },
  {
    id: 'so-005',
    orderNumber: 'SO-2024-00149',
    customerId: 'cust-005',
    customerName: 'Midwest Tire & Supply',
    orderDate: '2024-01-19',
    requestedDeliveryDate: '2024-01-26',
    status: 'pending',
    creditStatus: 'hold',
    grandTotal: 875000, // cents
    currencyCode: 'USD',
    orderSeries: 'GDC 2',
    itemCount: 5,
    createdAt: new Date('2024-01-19'),
  },
  {
    id: 'so-006',
    orderNumber: 'SO-2024-00150',
    customerId: 'cust-001',
    customerName: 'Acme Farm Supply Co.',
    orderDate: '2024-01-20',
    requestedDeliveryDate: '2024-01-30',
    status: 'delivered',
    creditStatus: 'ok',
    grandTotal: 234000, // cents
    currencyCode: 'USD',
    itemCount: 2,
    createdAt: new Date('2024-01-20'),
  },
  {
    id: 'so-007',
    orderNumber: 'SO-2024-00151',
    customerId: 'cust-002',
    customerName: 'Green Fields Agriculture',
    orderDate: '2024-01-21',
    requestedDeliveryDate: '2024-02-01',
    status: 'cancelled',
    creditStatus: 'ok',
    grandTotal: 125050, // cents
    currencyCode: 'USD',
    itemCount: 1,
    createdAt: new Date('2024-01-21'),
  },
];

// ============================================
// SAMPLE ORDER ITEMS (for form demo)
// ============================================

export const MOCK_ORDER_ITEMS: OrderItem[] = [
  {
    id: 'item-001',
    productId: 'prod-001',
    sku: 'TIR-AGR-001',
    description: 'Agricultural Tire 18.4-38',
    quantity: 4,
    unitId: 'unit-001',
    unitPrice: 485.0,
    discountPercent: 5,
    taxRateId: 'tax-001',
    lineTotal: 1843.0,
  },
  {
    id: 'item-002',
    productId: 'prod-006',
    sku: 'TUB-001',
    description: 'Inner Tube 18.4-38',
    quantity: 4,
    unitId: 'unit-001',
    unitPrice: 45.0,
    discountPercent: 0,
    taxRateId: 'tax-001',
    lineTotal: 180.0,
  },
  {
    id: 'item-003',
    productId: 'prod-002',
    sku: 'TIR-AGR-002',
    description: 'Agricultural Tire 16.9-30',
    quantity: 2,
    unitId: 'unit-001',
    unitPrice: 395.0,
    discountPercent: 0,
    taxRateId: 'tax-001',
    lineTotal: 790.0,
  },
];

// ============================================
// API RESPONSE FACTORIES
// ============================================

export function getMockSalesOrdersListResponse(
  page: number = 1,
  limit: number = 10
): SalesOrderListResponse {
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedData = MOCK_SALES_ORDERS_LIST.slice(start, end);

  return {
    data: paginatedData,
    meta: {
      total: MOCK_SALES_ORDERS_LIST.length,
      page,
      limit,
      totalPages: Math.ceil(MOCK_SALES_ORDERS_LIST.length / limit),
    },
  };
}

export function getMockMasterDataResponse(): MasterDataResponse {
  return {
    data: MOCK_MASTER_DATA,
    meta: {
      cachedAt: new Date().toISOString(),
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const sequence = Math.floor(Math.random() * 90000) + 10000;
  return `SO-${year}-${sequence}`;
}

export function createEmptyOrderItem(): OrderItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    productId: '',
    sku: '',
    description: '',
    quantity: 1,
    unitId: 'EA', // Use code directly as expected by formToCreateDTO
    unitPrice: 0,
    discountPercent: 0,
    taxRateId: 'tax-003', // Default to tax exempt (0%)
    lineTotal: 0,
  };
}

export function formatCurrency(amount: number, symbol: string = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
