/**
 * Price Matrix Server Actions
 *
 * Server actions for the Price Matrix module.
 * Handles channel-based product pricing operations.
 */

'use server';

// Note: No revalidatePath - ProductPriceMatrix handles data refresh client-side
import { priceMatrixService } from '../services/price-matrix.service';
import {
  priceMatrixFormSchema,
  createPriceMatrixSchema,
  updatePriceMatrixSchema,
  formToDTO,
} from '../lib/schemas';
import type {
  PriceMatrixEntry,
  PriceMatrixWithProduct,
  PriceMatrixTableRow,
  PriceMatrixListParams,
  PriceLookupResult,
  ActionResult,
  PaginatedResult,
  PriceMatrixFormValues,
} from '../types';
import type { CustomerChannel } from '@/features/customers/types';
import { getCurrentUser, hasPermission, hasAnyPermission } from '@/shared/lib/auth';
import type { AppUser } from '@/shared/stores/auth.store';

// ============================================
// AUTHORIZATION HELPER
// ============================================

type AuthorizeResult =
  | { ok: true; user: AppUser }
  | { ok: false; result: ActionResult<never> };

async function authorize(permission: string): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasPermission(user, permission)) {
    return { ok: false, result: { success: false, error: `Permission denied: ${permission}` } };
  }

  return { ok: true, user };
}

async function authorizeAny(permissions: string[]): Promise<AuthorizeResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, result: { success: false, error: 'Authentication required' } };
  }

  if (!hasAnyPermission(user, permissions)) {
    return {
      ok: false,
      result: { success: false, error: `Permission denied: requires one of [${permissions.join(', ')}]` },
    };
  }

  return { ok: true, user };
}

// Note: No revalidatePath needed - ProductPriceMatrix handles data refresh client-side

// ============================================
// LIST ACTIONS
// ============================================

/**
 * Get paginated list of price entries
 */
export async function getPriceMatrixList(
  params: PriceMatrixListParams = {}
): Promise<ActionResult<PaginatedResult<PriceMatrixTableRow>>> {
  // Anyone with products.view_module can view pricing
  const auth = await authorizeAny(['pricing.view', 'products.view_module']);
  if (!auth.ok) { return auth.result; }

  try {
    const result = await priceMatrixService.getList(params);
    return { success: true, data: result };
  } catch (error) {
    console.error('getPriceMatrixList error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch price matrix',
    };
  }
}

/**
 * Get all price entries for a product
 */
export async function getPriceMatrixByProduct(
  productId: string
): Promise<ActionResult<PriceMatrixTableRow[]>> {
  const auth = await authorizeAny(['pricing.view', 'products.view_detail']);
  if (!auth.ok) { return auth.result; }

  try {
    const result = await priceMatrixService.getTableRowsByProductId(productId);
    return { success: true, data: result };
  } catch (error) {
    console.error('getPriceMatrixByProduct error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch price matrix',
    };
  }
}

/**
 * Get a single price entry by ID
 */
export async function getPriceMatrixEntry(
  id: string
): Promise<ActionResult<PriceMatrixWithProduct>> {
  const auth = await authorizeAny(['pricing.view', 'pricing.edit']);
  if (!auth.ok) { return auth.result; }

  try {
    const entry = await priceMatrixService.getByIdWithProduct(id);
    if (!entry) {
      return { success: false, error: 'Price entry not found' };
    }
    return { success: true, data: entry };
  } catch (error) {
    console.error('getPriceMatrixEntry error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch price entry',
    };
  }
}

/**
 * Look up price for a product/channel/quantity
 */
export async function lookupProductPrice(
  productId: string,
  channel: CustomerChannel,
  quantity: number = 1
): Promise<ActionResult<PriceLookupResult | null>> {
  const auth = await authorizeAny(['pricing.view', 'quotes.create', 'sales_orders.create']);
  if (!auth.ok) { return auth.result; }

  try {
    const result = await priceMatrixService.lookupPrice(productId, channel, quantity);
    return { success: true, data: result };
  } catch (error) {
    console.error('lookupProductPrice error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to lookup price',
    };
  }
}

// ============================================
// MUTATION ACTIONS
// ============================================

/**
 * Create a new price entry from form data
 */
export async function createPriceMatrixEntry(
  formData: PriceMatrixFormValues
): Promise<ActionResult<PriceMatrixEntry>> {
  const auth = await authorize('pricing.create');
  if (!auth.ok) { return auth.result; }

  // Validate form data
  const formValidation = priceMatrixFormSchema.safeParse(formData);
  if (!formValidation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: formValidation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  // Convert to DTO
  const dto = formToDTO(formValidation.data);

  // Validate DTO
  const validation = createPriceMatrixSchema.safeParse(dto);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const result = await priceMatrixService.create(validation.data, auth.user.id);
    return { success: true, data: result };
  } catch (error) {
    console.error('createPriceMatrixEntry error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create price entry',
    };
  }
}

/**
 * Update an existing price entry
 */
export async function updatePriceMatrixEntry(
  id: string,
  formData: Partial<PriceMatrixFormValues>
): Promise<ActionResult<PriceMatrixEntry>> {
  const auth = await authorize('pricing.edit');
  if (!auth.ok) { return auth.result; }

  // Build update data (convert form values to DTO format)
  const updateData: Record<string, unknown> = {};

  if (formData.channel !== undefined) {
    updateData.channel = formData.channel;
  }
  if (formData.minQuantity !== undefined) {
    updateData.minQuantity = parseInt(formData.minQuantity);
  }
  if (formData.maxQuantity !== undefined) {
    updateData.maxQuantity = formData.maxQuantity ? parseInt(formData.maxQuantity) : null;
  }
  if (formData.cost !== undefined) {
    updateData.cost = Math.round(parseFloat(formData.cost) * 100);
  }
  if (formData.price !== undefined) {
    updateData.price = Math.round(parseFloat(formData.price) * 100);
  }
  if (formData.status !== undefined) {
    updateData.status = formData.status;
  }
  if (formData.effectiveFrom !== undefined) {
    updateData.effectiveFrom = new Date(formData.effectiveFrom);
  }
  if (formData.effectiveTo !== undefined) {
    updateData.effectiveTo = formData.effectiveTo ? new Date(formData.effectiveTo) : null;
  }

  // Validate
  const validation = updatePriceMatrixSchema.safeParse(updateData);
  if (!validation.success) {
    return {
      success: false,
      error: 'Validation failed',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const result = await priceMatrixService.update(id, validation.data, auth.user.id);
    return { success: true, data: result };
  } catch (error) {
    console.error('updatePriceMatrixEntry error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update price entry',
    };
  }
}

/**
 * Delete a price entry
 */
export async function deletePriceMatrixEntry(id: string): Promise<ActionResult<PriceMatrixEntry>> {
  const auth = await authorize('pricing.delete');
  if (!auth.ok) { return auth.result; }

  try {
    const result = await priceMatrixService.delete(id, auth.user.id);
    return { success: true, data: result };
  } catch (error) {
    console.error('deletePriceMatrixEntry error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete price entry',
    };
  }
}

// ============================================
// UTILITY ACTIONS
// ============================================

/**
 * Get count of price entries for a product
 */
export async function getPriceMatrixCount(
  productId: string
): Promise<ActionResult<number>> {
  const auth = await authorizeAny(['pricing.view', 'products.view_detail']);
  if (!auth.ok) { return auth.result; }

  try {
    const count = await priceMatrixService.getCountByProduct(productId);
    return { success: true, data: count };
  } catch (error) {
    console.error('getPriceMatrixCount error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get count',
    };
  }
}
