/**
 * Users API Routes
 *
 * GET  /api/users - List users with pagination and filtering
 * POST /api/users - Create a new user (and its Supabase Auth account)
 */

import { NextRequest } from 'next/server';
import { userService } from '@/features/users/services/user.service';
import {
  userListParamsSchema,
  createUserSchema,
} from '@/features/users/lib/schemas';
import { resolveActor } from '@/features/users/lib/require-actor';
import { denyWithout, denyWithoutAny, denySuperAdminRoleGrant } from '@/features/users/lib/user-guards';
import {
  successResponse,
  createdResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/shared/lib/api/response';

/**
 * GET /api/users
 * List users with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { actor, reason } = await resolveActor();

    if (!actor) {
      return reason === 'no-profile'
        ? forbiddenResponse('Your account is no longer active')
        : unauthorizedResponse('Authentication required');
    }

    // Invoice editing also lists users (sales rep picker)
    const denied = denyWithoutAny(actor, ['users.view_module', 'orders.view_module']);
    if (denied) {return denied;}

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      roleId: searchParams.get('roleId') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      includeDeleted: searchParams.get('includeDeleted') || 'false',
    };

    // Validate params
    const validation = userListParamsSchema.safeParse(params);
    if (!validation.success) {
      return badRequestResponse(
        'Invalid query parameters',
        validation.error.flatten().fieldErrors
      );
    }

    // Fetch users
    const result = await userService.list(validation.data);

    if (!result.success) {
      return internalErrorResponse(result.error);
    }

    return successResponse({
      data: result.data?.data,
      meta: result.data?.meta,
    });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return internalErrorResponse('Failed to fetch users');
  }
}

/**
 * POST /api/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { actor, reason } = await resolveActor();

    if (!actor) {
      return reason === 'no-profile'
        ? forbiddenResponse('Your account is no longer active')
        : unauthorizedResponse('Authentication required');
    }

    const denied = denyWithout(actor, 'users.create');
    if (denied) {return denied;}

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(
        validation.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const roleDenied = await denySuperAdminRoleGrant(actor, validation.data.roleId);
    if (roleDenied) {return roleDenied;}

    // Create user
    const result = await userService.create(validation.data, actor.id);

    if (!result.success) {
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      return badRequestResponse(result.error || 'Failed to create user');
    }

    return createdResponse(result.data);
  } catch (error) {
    console.error('POST /api/users error:', error);
    return internalErrorResponse('Failed to create user');
  }
}
