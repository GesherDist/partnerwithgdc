/**
 * User Role API Route
 *
 * PUT /api/users/[id]/role - Change a user's role
 *
 * Kept separate from PUT /api/users/[id] so the "change role" action can carry
 * its own permission check - editing a name and granting someone Super Admin
 * are not the same privilege.
 */

import { NextRequest } from 'next/server';
import { userService } from '@/features/users/services/user.service';
import { changeUserRoleSchema } from '@/features/users/lib/schemas';
import { resolveActor } from '@/features/users/lib/require-actor';
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
 * PUT /api/users/[id]/role
 * Change a user's role
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

    // TODO: Check permission (roles.manage)

    // Changing your own role is how an admin accidentally demotes themselves
    // out of the screen they are standing on.
    if (actor.id === id) {
      return badRequestResponse('You cannot change your own role');
    }

    const body = await request.json();

    const validation = changeUserRoleSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(
        validation.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const result = await userService.changeRole(id, validation.data, actor.id);

    if (!result.success) {
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      if (result.error === 'User not found') {
        return notFoundResponse(result.error);
      }
      return badRequestResponse(result.error || 'Failed to change role');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('PUT /api/users/[id]/role error:', error);
    return internalErrorResponse('Failed to change role');
  }
}
