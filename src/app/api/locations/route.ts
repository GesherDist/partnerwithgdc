/**
 * Locations API Routes
 *
 * GET /api/locations - List locations with pagination and filtering
 * POST /api/locations - Create a new location
 */

import { NextRequest } from 'next/server';
import { locationService } from '@/features/locations/services/location.service';
import { locationListParamsSchema, createLocationSchema } from '@/features/locations/lib/schemas';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
} from '@/shared/lib/api/response';
import { createClient } from '@/shared/lib/supabase/server';

/**
 * GET /api/locations
 * List locations with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      search: searchParams.get('search') || undefined,
      locationType: searchParams.get('locationType') || undefined,
      isActive: searchParams.get('isActive') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    // Validate params
    const validation = locationListParamsSchema.safeParse(params);
    if (!validation.success) {
      return badRequestResponse('Invalid query parameters', validation.error.flatten().fieldErrors);
    }

    // Fetch locations
    const result = await locationService.list(validation.data);

    if (!result.success) {
      return internalErrorResponse(result.error);
    }

    return successResponse({
      data: result.data?.data,
      meta: result.data?.meta,
    });
  } catch (error) {
    console.error('GET /api/locations error:', error);
    return internalErrorResponse('Failed to fetch locations');
  }
}

/**
 * POST /api/locations
 * Create a new location
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // TODO: Check permission (locations.create)

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = createLocationSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Create location
    const result = await locationService.create(validation.data, user.id);

    if (!result.success) {
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      return badRequestResponse(result.error || 'Failed to create location');
    }

    return createdResponse(result.data);
  } catch (error) {
    console.error('POST /api/locations error:', error);
    return internalErrorResponse('Failed to create location');
  }
}
