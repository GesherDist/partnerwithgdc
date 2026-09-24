/**
 * Supplier Contacts Feature Types
 *
 * Type definitions for supplier contact management.
 */

// ============================================
// CONTACT TYPE ENUM
// ============================================

export type ContactType = 'primary' | 'purchasing' | 'accounts_payable' | 'technical' | 'receiving';

export const CONTACT_TYPES: ContactType[] = [
  'primary',
  'purchasing',
  'accounts_payable',
  'technical',
  'receiving',
];

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  primary: 'Primary',
  purchasing: 'Purchasing',
  accounts_payable: 'Accounts Payable',
  technical: 'Technical',
  receiving: 'Receiving',
};

// ============================================
// ENTITY TYPES
// ============================================

/**
 * SupplierContact entity from database
 */
export interface SupplierContact {
  id: string;
  supplierId: string;

  // Identity
  firstName: string;
  lastName: string;
  title: string | null;
  contactType: ContactType;

  // Contact Info
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;

  // Preferences
  isPrimary: boolean;

  // Notes
  notes: string | null;

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
}

/**
 * SupplierContact list item (for tables)
 */
export interface SupplierContactListItem {
  id: string;
  supplierId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  title: string | null;
  contactType: ContactType;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
}

// ============================================
// DTO TYPES
// ============================================

/**
 * Create SupplierContact DTO
 */
export interface CreateSupplierContactDTO {
  supplierId: string;
  firstName: string;
  lastName: string;
  title?: string | null;
  contactType: ContactType;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

/**
 * Update SupplierContact DTO
 */
export interface UpdateSupplierContactDTO {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  contactType?: ContactType;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  fax?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
}

/**
 * Form values for supplier contact form
 */
export interface SupplierContactFormValues {
  firstName: string;
  lastName: string;
  title: string;
  contactType: ContactType;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  isPrimary: boolean;
  notes: string;
}

export const DEFAULT_SUPPLIER_CONTACT_FORM_VALUES: SupplierContactFormValues = {
  firstName: '',
  lastName: '',
  title: '',
  contactType: 'primary',
  email: '',
  phone: '',
  mobile: '',
  fax: '',
  isPrimary: false,
  notes: '',
};
