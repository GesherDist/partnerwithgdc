/**
 * Location by ID API Routes
 *
 * GET /api/locations/[id] - Get a single location
 * PUT /api/locations/[id] - Update a location
 * DELETE /api/locations/[id] - Soft delete a location
 */

import { NextRequest } from 'next/server';
import { locationService } from '@/features/locations/services/location.service';
import { updateLocationSchema } from '@/features/locations/lib/schemas';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  noContentResponse,
} from '@/shared/lib/api/response';
import { createClient } from '@/shared/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/locations/[id]
 * Get a single location by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // Fetch location
    const result = await locationService.getById(id);

    if (!result.success) {
      if (result.error === 'Location not found') {
        return notFoundResponse('Location');
      }
      return internalErrorResponse(result.error);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('GET /api/locations/[id] error:', error);
    return internalErrorResponse('Failed to fetch location');
  }
}

/**
 * PUT /api/locations/[id]
 * Update a location
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // TODO: Check permission (locations.edit)

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = updateLocationSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Update location
    const result = await locationService.update(id, validation.data, user.id);

    if (!result.success) {
      if (result.error === 'Location not found') {
        return notFoundResponse('Location');
      }
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      return badRequestResponse(result.error || 'Failed to update location');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('PUT /api/locations/[id] error:', error);
    return internalErrorResponse('Failed to update location');
  }
}

/**
 * DELETE /api/locations/[id]
 * Soft delete a location
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse('Authentication required');
    }

    // TODO: Check permission (locations.delete)

    // Delete location
    const result = await locationService.delete(id, user.id);

    if (!result.success) {
      if (result.error === 'Location not found') {
        return notFoundResponse('Location');
      }
      return badRequestResponse(result.error || 'Failed to delete location');
    }

    return noContentResponse();
  } catch (error) {
    console.error('DELETE /api/locations/[id] error:', error);
    return internalErrorResponse('Failed to delete location');
  }
}
