/**
 * Product Categories API Route
 *
 * GET /api/products/categories - List the distinct categories in use
 */

import { productService } from '@/features/products/services/product.service';
import { successResponse, internalErrorResponse } from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';

/**
 * GET /api/products/categories
 * Returns the distinct, non-null categories across all active products.
 * Used to populate the category filter on the products list.
 */
export async function GET() {
  try {
    const guard = await requirePermission('products.view_module');
    if (guard.response) {return guard.response;}

    const result = await productService.getCategories();

    if (!result.success) {
      return internalErrorResponse(result.error);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('GET /api/products/categories error:', error);
    return internalErrorResponse('Failed to fetch categories');
  }
}
