/**
 * Products API Routes
 *
 * GET /api/products - List products with pagination and filtering
 * POST /api/products - Create a new product
 */

import { NextRequest } from 'next/server';
import { productService } from '@/features/products/services/product.service';
import { productListParamsSchema, createProductSchema } from '@/features/products/lib/schemas';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';

/**
 * GET /api/products
 * List products with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('products.view_module');
    if (guard.response) {return guard.response;}

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      category: searchParams.get('category') || undefined,
      isSellable: searchParams.get('isSellable') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    // Validate params
    const validation = productListParamsSchema.safeParse(params);
    if (!validation.success) {
      return badRequestResponse('Invalid query parameters', validation.error.flatten().fieldErrors);
    }

    // Fetch products
    const result = await productService.list(validation.data);

    if (!result.success) {
      return internalErrorResponse(result.error);
    }

    return successResponse({
      data: result.data?.data,
      meta: result.data?.meta,
    });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return internalErrorResponse('Failed to fetch products');
  }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('products.create');
    if (guard.response) {return guard.response;}

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = createProductSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Create product
    const result = await productService.create(validation.data, guard.user.id);

    if (!result.success) {
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      return badRequestResponse(result.error || 'Failed to create product');
    }

    return createdResponse(result.data);
  } catch (error) {
    console.error('POST /api/products error:', error);
    return internalErrorResponse('Failed to create product');
  }
}
