/**
 * User Restore API Route
 *
 * POST /api/users/[id]/restore - Restore a soft-deleted user
 */

import { NextRequest } from 'next/server';
import { userService } from '@/features/users/services/user.service';
import { resolveActor } from '@/features/users/lib/require-actor';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/shared/lib/api/response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/users/[id]/restore
 * Restore a soft-deleted user
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { actor, reason } = await resolveActor();

    if (!actor) {
      return reason === 'no-profile'
        ? forbiddenResponse('Your account is no longer active')
        : unauthorizedResponse('Authentication required');
    }

    // TODO: Check permission (users.restore or users.delete)

    const result = await userService.restore(id, actor.id);

    if (!result.success) {
      if (result.error === 'User not found') {
        return notFoundResponse(result.error);
      }
      return badRequestResponse(result.error || 'Failed to restore user');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('POST /api/users/[id]/restore error:', error);
    return internalErrorResponse('Failed to restore user');
  }
}
