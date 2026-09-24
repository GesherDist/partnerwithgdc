/**
 * Suppliers Service
 *
 * Business logic for supplier management.
 * Server-only - do not import in client components.
 */

import 'server-only';

import * as repo from '../repositories/suppliers.repository';
import { createSupplierUserAccount } from './create-supplier-user';
import { auditService } from '@/shared/lib/audit';
import type { Supplier, CreateSupplierInput, UpdateSupplierInput } from '../types';

// Helper to convert supplier to audit data
function supplierToAuditData(supplier: Supplier): Record<string, unknown> {
  return {
    id: supplier.id,
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    status: supplier.status,
    primaryContactName: supplier.primaryContactName,
    primaryContactEmail: supplier.primaryContactEmail,
    primaryContactPhone: supplier.primaryContactPhone,
    paymentTerms: supplier.paymentTerms,
  };
}

export interface GetSuppliersOptions {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getSuppliers(
  options: GetSuppliersOptions = {}
): Promise<{ data: Supplier[]; total: number; page: number; pageSize: number }> {
  const page = options.page || 1;
  const pageSize = options.pageSize || 20;
  const offset = (page - 1) * pageSize;

  const { data, count } = await repo.getAllSuppliers({
    status: options.status,
    search: options.search,
    limit: pageSize,
    offset,
  });

  return {
    data,
    total: count,
    page,
    pageSize,
  };
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  return repo.getSupplierById(id);
}

export async function createSupplier(
  input: CreateSupplierInput,
  userId: string
): Promise<{ data: Supplier | null; error?: string }> {
  // Validate required fields
  if (!input.name?.trim()) {
    return { data: null, error: 'Supplier name is required' };
  }

  // Validate email format if provided
  if (input.primaryContactEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.primaryContactEmail)) {
      return { data: null, error: 'Invalid email format' };
    }
  }

  // Additional validation if creating user account
  if (input.createUserAccount) {
    if (!input.primaryContactEmail?.trim()) {
      return { data: null, error: 'Email is required to create user account' };
    }
    if (!input.primaryContactName?.trim()) {
      return { data: null, error: 'Contact name is required to create user account' };
    }
    if (!input.sendInviteEmail && !input.userPassword) {
      return { data: null, error: 'Password is required when not sending invite email' };
    }
  }

  // Create the supplier first
  const result = await repo.createSupplier(input, userId);

  if (!result.data) {
    return result;
  }

  // Log audit event (fire and forget)
  auditService.logCreate(
    'suppliers',
    'Supplier',
    result.data.id,
    supplierToAuditData(result.data),
    { userId },
    `Created supplier: ${result.data.name}`
  ).catch((err) => {
    console.error('Failed to log supplier create audit:', err);
  });

  // Create user account if requested
  if (input.createUserAccount && input.primaryContactEmail && input.primaryContactName) {
    const userResult = await createSupplierUserAccount({
      supplierId: result.data.id,
      email: input.primaryContactEmail,
      firstName: input.primaryContactName.split(' ')[0] || input.primaryContactName,
      lastName: input.primaryContactName.split(' ').slice(1).join(' ') || '',
      password: input.userPassword,
      sendInvite: input.sendInviteEmail ?? true,
    });

    if (userResult.error) {
      // Supplier created but user creation failed
      // We could rollback the supplier, but for now just return with warning
      console.error('[createSupplier] User creation failed:', userResult.error);
      return {
        data: result.data,
        error: `Supplier created, but user account creation failed: ${userResult.error}`,
      };
    }
  }

  return result;
}

export async function updateSupplier(
  input: UpdateSupplierInput,
  userId: string
): Promise<{ data: Supplier | null; error?: string }> {
  // Validate supplier exists
  const existing = await repo.getSupplierById(input.id);
  if (!existing) {
    return { data: null, error: 'Supplier not found' };
  }

  // Validate name if provided
  if (input.name !== undefined && !input.name?.trim()) {
    return { data: null, error: 'Supplier name cannot be empty' };
  }

  // Validate email format if provided
  if (input.primaryContactEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(input.primaryContactEmail)) {
      return { data: null, error: 'Invalid email format' };
    }
  }

  // Capture old data for audit
  const oldAuditData = supplierToAuditData(existing);

  const result = await repo.updateSupplier(input, userId);

  if (result.data) {
    // Log audit event (fire and forget)
    auditService.logUpdate(
      'suppliers',
      'Supplier',
      result.data.id,
      oldAuditData,
      supplierToAuditData(result.data),
      { userId },
      `Updated supplier: ${result.data.name}`
    ).catch((err) => {
      console.error('Failed to log supplier update audit:', err);
    });
  }

  return result;
}

export async function deleteSupplier(
  id: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate supplier exists
  const existing = await repo.getSupplierById(id);
  if (!existing) {
    return { success: false, error: 'Supplier not found' };
  }

  const result = await repo.deleteSupplier(id, userId);

  if (result.success) {
    // Log audit event (fire and forget)
    auditService.logDelete(
      'suppliers',
      'Supplier',
      id,
      supplierToAuditData(existing),
      { userId },
      `Deleted supplier: ${existing.name}`
    ).catch((err) => {
      console.error('Failed to log supplier delete audit:', err);
    });
  }

  return result;
}
