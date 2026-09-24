/**
 * Accounting Provider Interface
 *
 * Interface for accounting integrations like QuickBooks, Xero, etc.
 */

import type { IBaseProvider, ISyncableProvider } from './base.provider';

// ============================================
// ACCOUNTING ENTITY TYPES
// ============================================

/**
 * Customer data for accounting systems
 */
export interface AccountingCustomer {
  id?: string;
  externalId?: string;
  displayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  billingAddress?: AccountingAddress;
  shippingAddress?: AccountingAddress;
  taxExempt?: boolean;
  balance?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Invoice data for accounting systems
 */
export interface AccountingInvoice {
  id?: string;
  externalId?: string;
  invoiceNumber?: string;
  customerId: string;
  customerExternalId?: string;
  invoiceDate: string;
  dueDate?: string;
  lineItems: AccountingLineItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  total: number;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  memo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Line item for invoices
 */
export interface AccountingLineItem {
  id?: string;
  productId?: string;
  productExternalId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
  discountPercent?: number;
}

/**
 * Payment data for accounting systems
 */
export interface AccountingPayment {
  id?: string;
  externalId?: string;
  customerId: string;
  customerExternalId?: string;
  invoiceId?: string;
  invoiceExternalId?: string;
  paymentDate: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Product/Item data for accounting systems
 */
export interface AccountingProduct {
  id?: string;
  externalId?: string;
  name: string;
  sku?: string;
  description?: string;
  unitPrice?: number;
  type?: 'inventory' | 'service' | 'non_inventory';
  active?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Address for accounting entities
 */
export interface AccountingAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Company info from accounting system
 */
export interface AccountingCompanyInfo {
  id: string;
  name: string;
  legalName?: string;
  address?: AccountingAddress;
  email?: string;
  phone?: string;
  currency?: string;
  fiscalYearStart?: string;
}

// ============================================
// SYNC RESULTS
// ============================================

export interface CustomerSyncResult {
  created: AccountingCustomer[];
  updated: AccountingCustomer[];
  failed: Array<{ customer: AccountingCustomer; error: string }>;
}

export interface InvoiceSyncResult {
  created: AccountingInvoice[];
  updated: AccountingInvoice[];
  failed: Array<{ invoice: AccountingInvoice; error: string }>;
}

export interface PaymentSyncResult {
  created: AccountingPayment[];
  updated: AccountingPayment[];
  failed: Array<{ payment: AccountingPayment; error: string }>;
}

// ============================================
// ACCOUNTING PROVIDER INTERFACE
// ============================================

/**
 * Interface for accounting providers (QuickBooks, Xero, etc.)
 */
export interface IAccountingProvider extends IBaseProvider, ISyncableProvider {
  // ============================================
  // COMPANY INFO
  // ============================================

  /**
   * Get company information from accounting system
   */
  getCompanyInfo(connectionId: string): Promise<AccountingCompanyInfo>;

  // ============================================
  // CUSTOMERS
  // ============================================

  /**
   * Get all customers from accounting system
   */
  getCustomers(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<AccountingCustomer[]>;

  /**
   * Get a single customer by external ID
   */
  getCustomer(connectionId: string, externalId: string): Promise<AccountingCustomer | null>;

  /**
   * Create a customer in accounting system
   */
  createCustomer(connectionId: string, customer: AccountingCustomer): Promise<AccountingCustomer>;

  /**
   * Update a customer in accounting system
   */
  updateCustomer(
    connectionId: string,
    externalId: string,
    customer: Partial<AccountingCustomer>
  ): Promise<AccountingCustomer>;

  /**
   * Sync customers (push local customers to accounting system)
   */
  syncCustomers(connectionId: string, customers: AccountingCustomer[]): Promise<CustomerSyncResult>;

  // ============================================
  // INVOICES
  // ============================================

  /**
   * Get all invoices from accounting system
   */
  getInvoices(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number; status?: string }
  ): Promise<AccountingInvoice[]>;

  /**
   * Get a single invoice by external ID
   */
  getInvoice(connectionId: string, externalId: string): Promise<AccountingInvoice | null>;

  /**
   * Create an invoice in accounting system
   */
  createInvoice(connectionId: string, invoice: AccountingInvoice): Promise<AccountingInvoice>;

  /**
   * Update an invoice in accounting system
   */
  updateInvoice(
    connectionId: string,
    externalId: string,
    invoice: Partial<AccountingInvoice>
  ): Promise<AccountingInvoice>;

  /**
   * Sync invoices (push local invoices to accounting system)
   */
  syncInvoices(connectionId: string, invoices: AccountingInvoice[]): Promise<InvoiceSyncResult>;

  // ============================================
  // PAYMENTS
  // ============================================

  /**
   * Get payments from accounting system
   */
  getPayments(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<AccountingPayment[]>;

  /**
   * Get a single payment by external ID
   */
  getPayment(connectionId: string, externalId: string): Promise<AccountingPayment | null>;

  /**
   * Create a payment in accounting system
   */
  createPayment(connectionId: string, payment: AccountingPayment): Promise<AccountingPayment>;

  /**
   * Sync payments (pull payments from accounting system)
   */
  syncPayments(connectionId: string): Promise<PaymentSyncResult>;

  // ============================================
  // PRODUCTS
  // ============================================

  /**
   * Get products/items from accounting system
   */
  getProducts(
    connectionId: string,
    options?: { sinceDate?: Date; limit?: number; offset?: number }
  ): Promise<AccountingProduct[]>;

  /**
   * Get a single product by external ID
   */
  getProduct(connectionId: string, externalId: string): Promise<AccountingProduct | null>;

  /**
   * Create a product in accounting system
   */
  createProduct(connectionId: string, product: AccountingProduct): Promise<AccountingProduct>;

  /**
   * Update a product in accounting system
   */
  updateProduct(
    connectionId: string,
    externalId: string,
    product: Partial<AccountingProduct>
  ): Promise<AccountingProduct>;
}
