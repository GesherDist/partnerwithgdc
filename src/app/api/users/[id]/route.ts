/**
 * User by ID API Routes
 *
 * GET    /api/users/[id] - Get a single user
 * PUT    /api/users/[id] - Update a user
 * DELETE /api/users/[id] - Soft delete a user
 */

import { NextRequest } from 'next/server';
import { userService } from '@/features/users/services/user.service';
import { updateUserSchema } from '@/features/users/lib/schemas';
import { resolveActor } from '@/features/users/lib/require-actor';
import { denyWithout, denySuperAdminRoleGrant, denySuperAdminTarget } from '@/features/users/lib/user-guards';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/shared/lib/api/response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]
 * Get a single user by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { actor, reason } = await resolveActor();

    if (!actor) {
      return reason === 'no-profile'
        ? forbiddenResponse('Your account is no longer active')
        : unauthorizedResponse('Authentication required');
    }

    const denied = denyWithout(actor, 'users.view_module');
    if (denied) {return denied;}

    const result = await userService.getById(id);

    if (!result.success) {
      return notFoundResponse(result.error || 'User not found');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('GET /api/users/[id] error:', error);
    return internalErrorResponse('Failed to fetch user');
  }
}

/**
 * PUT /api/users/[id]
 * Update a user
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { actor, reason } = await resolveActor();

    if (!actor) {
      return reason === 'no-profile'
        ? forbiddenResponse('Your account is no longer active')
        : unauthorizedResponse('Authentication required');
    }

    const denied = denyWithout(actor, 'users.edit');
    if (denied) {return denied;}
    const targetDenied = await denySuperAdminTarget(actor, id);
    if (targetDenied) {return targetDenied;}

    const body = await request.json();

    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(
        validation.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    // Changing the role or password through the general edit needs the same
    // permission as the dedicated endpoints
    const { roleId, password } = validation.data;
    if (roleId) {
      const current = await userService.getById(id);
      if (current.data && current.data.roleId !== roleId) {
        const roleDenied =
          denyWithout(actor, 'users.change_role') ?? (await denySuperAdminRoleGrant(actor, roleId));
        if (roleDenied) {return roleDenied;}
      }
    }
    if (password) {
      const passwordDenied = denyWithout(actor, 'users.reset_password');
      if (passwordDenied) {return passwordDenied;}
    }

    const result = await userService.update(id, validation.data, actor.id);

    if (!result.success) {
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      if (result.error === 'User not found') {
        return notFoundResponse(result.error);
      }
      return badRequestResponse(result.error || 'Failed to update user');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error);
    return internalErrorResponse('Failed to update user');
  }
}

/**
 * DELETE /api/users/[id]
 * Soft delete a user
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { actor, reason } = await resolveActor();

    if (!actor) {
      return reason === 'no-profile'
        ? forbiddenResponse('Your account is no longer active')
        : unauthorizedResponse('Authentication required');
    }

    const denied = denyWithout(actor, 'users.delete') ?? (await denySuperAdminTarget(actor, id));
    if (denied) {return denied;}

    const result = await userService.delete(id, actor.id);

    if (!result.success) {
      if (result.error === 'User not found') {
        return notFoundResponse(result.error);
      }
      return badRequestResponse(result.error || 'Failed to delete user');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error);
    return internalErrorResponse('Failed to delete user');
  }
}
