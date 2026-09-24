'use server';

/**
 * Suppliers Server Actions
 *
 * Server actions for supplier management (admin).
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import * as service from '../services/suppliers.service';
import type { CreateSupplierInput, UpdateSupplierInput, Supplier } from '../types';

// ============================================
// HELPER
// ============================================

async function getAuthorizedUser(permission: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, error: 'Authentication required' };
  }
  if (!hasPermission(user, permission)) {
    return { user: null, error: 'Permission denied' };
  }
  return { user, error: null };
}

// ============================================
// CREATE
// ============================================

export async function createSupplierAction(
  input: CreateSupplierInput
): Promise<{ data: Supplier | null; error?: string }> {
  const { user, error } = await getAuthorizedUser('suppliers.create');
  if (error || !user) {
    return { data: null, error: error || 'Authentication required' };
  }

  const result = await service.createSupplier(input, user.id);

  if (result.data) {
    revalidatePath('/suppliers');
  }

  return result;
}

// ============================================
// UPDATE
// ============================================

export async function updateSupplierAction(
  input: UpdateSupplierInput
): Promise<{ data: Supplier | null; error?: string }> {
  const { user, error } = await getAuthorizedUser('suppliers.edit');
  if (error || !user) {
    return { data: null, error: error || 'Authentication required' };
  }

  const result = await service.updateSupplier(input, user.id);

  if (result.data) {
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${input.id}`);
  }

  return result;
}

// ============================================
// DELETE
// ============================================

export async function deleteSupplierAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { user, error } = await getAuthorizedUser('suppliers.delete');
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  const result = await service.deleteSupplier(id, user.id);

  if (result.success) {
    revalidatePath('/suppliers');
  }

  return result;
}
