/**
 * User Counts API Route
 *
 * GET /api/users/counts - User totals grouped by status, for the stat cards
 */

import { userService } from '@/features/users/services/user.service';
import { resolveActor } from '@/features/users/lib/require-actor';
import {
  successResponse,
  internalErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/shared/lib/api/response';

/**
 * GET /api/users/counts
 */
export async function GET() {
  try {
    const { actor, reason } = await resolveActor();

    if (!actor) {
      return reason === 'no-profile'
        ? forbiddenResponse('Your account is no longer active')
        : unauthorizedResponse('Authentication required');
    }

    // TODO: Check permission (users.view)

    const result = await userService.getStatusCounts();

    if (!result.success) {
      return internalErrorResponse(result.error);
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('GET /api/users/counts error:', error);
    return internalErrorResponse('Failed to fetch user counts');
  }
}
