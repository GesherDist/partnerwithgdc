/**
 * Suppliers Repository
 *
 * Database operations for supplier management.
 */

import { db } from '@/shared/lib/supabase/database';
import type { Supplier, CreateSupplierInput, UpdateSupplierInput } from '../types';

// ============================================
// READ OPERATIONS
// ============================================

export async function getAllSuppliers(options?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: Supplier[]; count: number }> {
  let query = db
    .from('suppliers')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.search) {
    query = query.or(
      `name.ilike.%${options.search}%,supplier_code.ilike.%${options.search}%,primary_contact_name.ilike.%${options.search}%`
    );
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[getAllSuppliers] Error:', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data || []).map(mapSupplier),
    count: count || 0,
  };
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const { data, error } = await db
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    console.error('[getSupplierById] Error:', error);
    return null;
  }

  return mapSupplier(data);
}

// ============================================
// WRITE OPERATIONS
// ============================================

export async function createSupplier(
  input: CreateSupplierInput,
  userId: string
): Promise<{ data: Supplier | null; error?: string }> {
  // Generate supplier code
  const { data: codeData, error: codeError } = await db.rpc('generate_supplier_code');

  if (codeError) {
    console.error('[createSupplier] Code generation error:', codeError);
    return { data: null, error: 'Failed to generate supplier code' };
  }

  const { data, error } = await db
    .from('suppliers')
    .insert({
      supplier_code: codeData,
      name: input.name,
      legal_name: input.legalName || null,
      primary_contact_name: input.primaryContactName || null,
      primary_contact_email: input.primaryContactEmail || null,
      primary_contact_phone: input.primaryContactPhone || null,
      address_street: input.addressStreet || null,
      address_city: input.addressCity || null,
      address_state: input.addressState || null,
      address_postal_code: input.addressPostalCode || null,
      address_country: input.addressCountry || 'US',
      payment_terms: input.paymentTerms || null,
      currency_code: input.currencyCode || 'USD',
      tax_id: input.taxId || null,
      status: input.status || 'active',
      notes: input.notes || null,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[createSupplier] Error:', error);
    return { data: null, error: error?.message || 'Failed to create supplier' };
  }

  return { data: mapSupplier(data) };
}

export async function updateSupplier(
  input: UpdateSupplierInput,
  userId: string
): Promise<{ data: Supplier | null; error?: string }> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }
  if (input.legalName !== undefined) {
    updates.legal_name = input.legalName;
  }
  if (input.primaryContactName !== undefined) {
    updates.primary_contact_name = input.primaryContactName;
  }
  if (input.primaryContactEmail !== undefined) {
    updates.primary_contact_email = input.primaryContactEmail;
  }
  if (input.primaryContactPhone !== undefined) {
    updates.primary_contact_phone = input.primaryContactPhone;
  }
  if (input.addressStreet !== undefined) {
    updates.address_street = input.addressStreet;
  }
  if (input.addressCity !== undefined) {
    updates.address_city = input.addressCity;
  }
  if (input.addressState !== undefined) {
    updates.address_state = input.addressState;
  }
  if (input.addressPostalCode !== undefined) {
    updates.address_postal_code = input.addressPostalCode;
  }
  if (input.addressCountry !== undefined) {
    updates.address_country = input.addressCountry;
  }
  if (input.paymentTerms !== undefined) {
    updates.payment_terms = input.paymentTerms;
  }
  if (input.currencyCode !== undefined) {
    updates.currency_code = input.currencyCode;
  }
  if (input.taxId !== undefined) {
    updates.tax_id = input.taxId;
  }
  if (input.status !== undefined) {
    updates.status = input.status;
  }
  if (input.notes !== undefined) {
    updates.notes = input.notes;
  }

  const { data, error } = await db
    .from('suppliers')
    .update(updates)
    .eq('id', input.id)
    .select()
    .single();

  if (error || !data) {
    console.error('[updateSupplier] Error:', error);
    return { data: null, error: error?.message || 'Failed to update supplier' };
  }

  return { data: mapSupplier(data) };
}

export async function deleteSupplier(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from('suppliers')
    .update({
      deleted_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', id);

  if (error) {
    console.error('[deleteSupplier] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// MAPPER
// ============================================

function mapSupplier(data: Record<string, unknown>): Supplier {
  return {
    id: data.id as string,
    supplierCode: data.supplier_code as string,
    name: data.name as string,
    legalName: data.legal_name as string | null,
    primaryContactName: data.primary_contact_name as string | null,
    primaryContactEmail: data.primary_contact_email as string | null,
    primaryContactPhone: data.primary_contact_phone as string | null,
    addressStreet: data.address_street as string | null,
    addressCity: data.address_city as string | null,
    addressState: data.address_state as string | null,
    addressPostalCode: data.address_postal_code as string | null,
    addressCountry: data.address_country as string,
    paymentTerms: data.payment_terms as string | null,
    currencyCode: data.currency_code as string,
    taxId: data.tax_id as string | null,
    status: data.status as Supplier['status'],
    notes: data.notes as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}
