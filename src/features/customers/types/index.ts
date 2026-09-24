/**
 * Customer Module Types
 *
 * All TypeScript interfaces for the Customer feature.
 * Structured to mirror the database schema and future REST API response formats.
 */

// ============================================
// ENUMS & CONSTANTS
// ============================================

// Database enum values must match exactly
export type CustomerStatus = 'active' | 'inactive';

export const CUSTOMER_STATUSES: CustomerStatus[] = [
  'active',
  'inactive',
];

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  inactive: 'bg-stone-100 text-stone-600 border border-stone-200',
};

// Database enum: 'oem', 'dealer'
export type CustomerChannel = 'oem' | 'dealer';

export const CUSTOMER_CHANNELS: CustomerChannel[] = [
  'oem',
  'dealer',
];

export const CUSTOMER_CHANNEL_LABELS: Record<CustomerChannel, string> = {
  oem: 'OEM',
  dealer: 'Dealer',
};

export const CUSTOMER_CHANNEL_COLORS: Record<CustomerChannel, string> = {
  oem: 'bg-teal-100 text-teal-800 border border-teal-200',
  dealer: 'bg-amber-100 text-amber-800 border border-amber-200',
};

// Database enum: 'approved', 'pending', 'hold', 'suspended', 'blocked', 'rejected'
export type CreditStatus = 'approved' | 'pending' | 'hold' | 'suspended' | 'blocked' | 'rejected';

export const CREDIT_STATUSES: CreditStatus[] = [
  'approved',
  'pending',
  'hold',
  'suspended',
  'blocked',
  'rejected',
];

export const CREDIT_STATUS_LABELS: Record<CreditStatus, string> = {
  approved: 'Approved',
  pending: 'Pending',
  hold: 'On Hold',
  suspended: 'Suspended',
  blocked: 'Blocked',
  rejected: 'Rejected',
};

export const CREDIT_STATUS_COLORS: Record<CreditStatus, string> = {
  approved: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  pending: 'bg-amber-100 text-amber-800 border border-amber-200',
  hold: 'bg-orange-100 text-orange-800 border border-orange-200',
  suspended: 'bg-red-100 text-red-800 border border-red-200',
  blocked: 'bg-red-200 text-red-900 border border-red-300',
  rejected: 'bg-red-100 text-red-800 border border-red-200',
};

// Database enum: contact_type
export type ContactType = 'purchasing' | 'accounts_payable' | 'receiving';

export const CONTACT_TYPES: ContactType[] = [
  'purchasing',
  'accounts_payable',
  'receiving',
];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  purchasing: 'Purchasing',
  accounts_payable: 'Accounts Payable',
  receiving: 'Receiving',
};

// ============================================
// DATABASE ENTITY TYPES
// ============================================

/**
 * Customer entity from database
 */
export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  legalName: string | null;
  channel: CustomerChannel;

  // Billing Address
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;

  // Shipping Address
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingCountry: string | null;
  useSeparateShipping: boolean;

  // Contact
  phone: string | null;
  email: string | null;
  website: string | null;

  // Tax
  taxId: string | null;
  taxExempt: boolean;
  taxExemptNumber: string | null;
  taxExemptExpiryAt: string | null; // ISO date string (YYYY-MM-DD)

  // Credit
  creditStatus: CreditStatus;
  creditLimit: number; // cents
  openBalance: number; // cents - current outstanding balance
  creditTerms: string | null;

  // Settings
  preferredLocationId: string | null;
  defaultPaymentMethod: string | null;
  status: CustomerStatus;
  internalNotes: string | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;

  // QuickBooks Sync
  qboCustomerId: string | null;
  qboRealmId: string | null;
  qboSyncedAt: Date | null;
  qboSyncError: string | null;

  // Pipedrive Sync
  pipedrivePersonId: number | null;
  pipedriveDealId: number | null;
  pipedriveOrgId: number | null;
}

/**
 * CustomerContact entity from database
 * Per client doc: many per customer, with role (purchasing, AP, receiving)
 */
export interface CustomerContact {
  id: string;
  customerId: string;

  // Identity
  firstName: string;
  lastName: string;
  contactType: ContactType;

  // Contact Info
  email: string | null;
  phone: string | null;
  mobile: string | null;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: Date | null;
}

/**
 * CustomerContact for display in lists
 */
export interface CustomerContactListItem {
  id: string;
  customerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  contactType: ContactType;
  email: string | null;
  phone: string | null;
  mobile: string | null;
}

/**
 * DTO for creating a customer contact
 */
export interface CreateCustomerContactDTO {
  customerId: string;
  firstName: string;
  lastName: string;
  contactType: ContactType;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
}

/**
 * DTO for updating a customer contact
 */
export interface UpdateCustomerContactDTO {
  firstName?: string;
  lastName?: string;
  contactType?: ContactType;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
}

/**
 * Form values for customer contact form
 */
export interface CustomerContactFormValues {
  firstName: string;
  lastName: string;
  contactType: ContactType;
  email: string;
  phone: string;
  mobile: string;
}

export const DEFAULT_CUSTOMER_CONTACT_FORM_VALUES: CustomerContactFormValues = {
  firstName: '',
  lastName: '',
  contactType: 'purchasing',
  email: '',
  phone: '',
  mobile: '',
};

// ============================================
// ADDRESS TYPES
// ============================================

export interface Address {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface CustomerAddresses {
  billing: Address;
  shipping: Address;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateCustomerDTO {
  customerCode: string;
  name: string;
  legalName?: string | null;
  channel: CustomerChannel;

  // Billing Address
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;

  // Shipping Address
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string | null;
  useSeparateShipping?: boolean;

  // Contact
  phone?: string | null;
  email?: string | null;
  website?: string | null;

  // Tax
  taxId?: string | null;
  taxExempt?: boolean;
  taxExemptNumber?: string | null;
  taxExemptExpiryAt?: string | null;

  // Credit
  creditStatus?: CreditStatus;
  creditLimit?: number;
  openBalance?: number;
  creditTerms?: string | null;

  // Settings
  preferredLocationId?: string | null;
  defaultPaymentMethod?: string | null;
  status?: CustomerStatus;
  internalNotes?: string | null;
}

export interface UpdateCustomerDTO {
  customerCode?: string;
  name?: string;
  legalName?: string | null;
  channel?: CustomerChannel;

  // Billing Address
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;

  // Shipping Address
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string | null;
  useSeparateShipping?: boolean;

  // Contact
  phone?: string | null;
  email?: string | null;
  website?: string | null;

  // Tax
  taxId?: string | null;
  taxExempt?: boolean;
  taxExemptNumber?: string | null;
  taxExemptExpiryAt?: string | null;

  // Credit
  creditStatus?: CreditStatus;
  creditLimit?: number;
  openBalance?: number;
  creditTerms?: string | null;

  // Settings
  preferredLocationId?: string | null;
  defaultPaymentMethod?: string | null;
  status?: CustomerStatus;
  internalNotes?: string | null;
}

// ============================================
// LIST & QUERY TYPES
// ============================================

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatus;
  channel?: CustomerChannel;
  creditStatus?: CreditStatus;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CustomerListItem {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  channel: CustomerChannel;
  status: CustomerStatus;
  creditStatus: CreditStatus;
  creditLimit: number; // cents
  openBalance: number; // cents
  createdAt: Date;
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
// TABLE ROW TYPE (for display)
// ============================================

export interface CustomerTableRow {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  channel: CustomerChannel;
  status: CustomerStatus;
  creditStatus: CreditStatus;
  formattedCreditLimit: string;
  formattedOpenBalance: string;
}

// ============================================
// FORM TYPES
// ============================================

export interface CustomerFormValues {
  customerCode?: string; // Auto-generated, optional in form
  name: string;
  legalName?: string;
  channel?: CustomerChannel;

  // Billing Address
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;

  // Shipping Address
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  shippingCountry?: string;
  useSeparateShipping?: boolean;

  // Contact
  phone?: string;
  email?: string;
  website?: string;

  // Tax
  taxId?: string;
  taxExempt?: boolean;
  taxExemptNumber?: string;
  taxExemptExpiryAt?: string; // YYYY-MM-DD format

  // Credit
  creditStatus?: CreditStatus;
  creditLimit?: string; // string for form input
  openBalance?: string; // string for form input
  creditTerms?: string;

  // Settings
  preferredLocationId?: string;
  defaultPaymentMethod?: string;
  status?: CustomerStatus;
  internalNotes?: string;
}

export const DEFAULT_CUSTOMER_FORM_VALUES: CustomerFormValues = {
  customerCode: '',
  name: '',
  legalName: '',
  channel: 'dealer',

  // Billing Address
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',

  // Shipping Address
  shippingAddress1: '',
  shippingAddress2: '',
  shippingCity: '',
  shippingState: '',
  shippingZip: '',
  shippingCountry: 'US',
  useSeparateShipping: false,

  // Contact
  phone: '',
  email: '',
  website: '',

  // Tax
  taxId: '',
  taxExempt: false,
  taxExemptNumber: '',
  taxExemptExpiryAt: '',

  // Credit
  creditStatus: 'pending',
  creditLimit: '0',
  openBalance: '0',
  creditTerms: 'Net 30',

  // Settings
  preferredLocationId: '',
  defaultPaymentMethod: '',
  status: 'active',
  internalNotes: '',
};

// ============================================
// DROPDOWN TYPES (for Sales Order integration)
// ============================================

export interface CustomerDropdownItem {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface CustomerFormProps {
  initialData?: Partial<CustomerFormValues>;
  onSubmit?: (data: CustomerFormValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

export interface CreateCustomerDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (customer: Customer) => void;
}

export interface CustomersTableProps {
  data: CustomerTableRow[];
  isLoading?: boolean;
  onRowClick?: (customer: CustomerTableRow) => void;
  onEdit?: (customer: CustomerTableRow) => void;
  onDelete?: (customer: CustomerTableRow) => void;
  toolbarContent?: React.ReactNode;
  // Server-side pagination
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerListResponse {
  data: CustomerListItem[];
  meta: PaginationMeta;
}
