/**
 * Suppliers Feature Types
 *
 * Type definitions for admin supplier management.
 */

export type SupplierStatus = 'active' | 'inactive' | 'pending';

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

export interface CreateSupplierInput {
  name: string;
  legalName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  paymentTerms?: string;
  currencyCode?: string;
  taxId?: string;
  status?: SupplierStatus;
  notes?: string;
  // User account creation fields
  createUserAccount?: boolean;
  userPassword?: string;
  sendInviteEmail?: boolean;
}

export interface UpdateSupplierInput extends Partial<CreateSupplierInput> {
  id: string;
}
