'use server';

/**
 * Supplier Contact Server Actions
 *
 * Server actions for supplier contact management.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { supplierContactService } from '../services/supplier-contact.service';
import type {
  SupplierContact,
  SupplierContactListItem,
  CreateSupplierContactDTO,
  UpdateSupplierContactDTO,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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
// ACTIONS
// ============================================

/**
 * Get all contacts for a supplier
 */
export async function getSupplierContactsAction(
  supplierId: string
): Promise<ActionResult<SupplierContactListItem[]>> {
  const { user, error } = await getAuthorizedUser('suppliers.view_module');
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  const result = await supplierContactService.getContactsBySupplierId(supplierId);

  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
}

/**
 * Get a single contact by ID
 */
export async function getSupplierContactAction(
  id: string
): Promise<ActionResult<SupplierContact>> {
  const { user, error } = await getAuthorizedUser('suppliers.view_module');
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  const result = await supplierContactService.getContactById(id);

  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
}

/**
 * Create a new supplier contact
 */
export async function createSupplierContactAction(
  dto: CreateSupplierContactDTO
): Promise<ActionResult<SupplierContact>> {
  const { user, error } = await getAuthorizedUser('suppliers.edit');
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  const result = await supplierContactService.createContact(dto, user.id);

  if (result.success) {
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${dto.supplierId}`);
  }

  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
}

/**
 * Update a supplier contact
 */
export async function updateSupplierContactAction(
  id: string,
  dto: UpdateSupplierContactDTO
): Promise<ActionResult<SupplierContact>> {
  const { user, error } = await getAuthorizedUser('suppliers.edit');
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  const result = await supplierContactService.updateContact(id, dto, user.id);

  if (result.success && result.data) {
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${result.data.supplierId}`);
  }

  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
}

/**
 * Delete a supplier contact
 */
export async function deleteSupplierContactAction(
  id: string
): Promise<ActionResult<void>> {
  const { user, error } = await getAuthorizedUser('suppliers.edit');
  if (error || !user) {
    return { success: false, error: error || 'Authentication required' };
  }

  // Get contact first to get supplier ID for revalidation
  const contactResult = await supplierContactService.getContactById(id);
  const supplierId = contactResult.data?.supplierId;

  const result = await supplierContactService.deleteContact(id, user.id);

  if (result.success && supplierId) {
    revalidatePath('/suppliers');
    revalidatePath(`/suppliers/${supplierId}`);
  }

  return {
    success: result.success,
    error: result.error,
  };
}
