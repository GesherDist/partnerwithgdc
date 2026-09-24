/**
 * User Password API Route
 *
 * POST /api/users/[id]/password - Email the user a reset link
 * PUT  /api/users/[id]/password - Set the password directly (admin-initiated)
 *
 * POST is the normal path: the user picks their own password and the admin
 * never sees it. PUT exists for accounts that cannot receive email.
 */

import { NextRequest } from 'next/server';
import { userService } from '@/features/users/services/user.service';
import { adminResetPasswordSchema } from '@/features/users/lib/schemas';
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
 * POST /api/users/[id]/password
 * Send a password reset email
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

    // TODO: Check permission (users.edit)

    const result = await userService.sendPasswordReset(id);

    if (!result.success) {
      if (result.error === 'User not found') {
        return notFoundResponse(result.error);
      }
      return badRequestResponse(
        result.error || 'Failed to send the reset email'
      );
    }

    return successResponse({ sent: true });
  } catch (error) {
    console.error('POST /api/users/[id]/password error:', error);
    return internalErrorResponse('Failed to send the reset email');
  }
}

/**
 * PUT /api/users/[id]/password
 * Set a user's password directly
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

    // TODO: Check permission (users.edit)

    const body = await request.json();

    const validation = adminResetPasswordSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(
        validation.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const result = await userService.setPassword(id, validation.data.password);

    if (!result.success) {
      if (result.errors) {
        return validationErrorResponse(result.errors);
      }
      if (result.error === 'User not found') {
        return notFoundResponse(result.error);
      }
      return badRequestResponse(result.error || 'Failed to set the password');
    }

    return successResponse({ updated: true });
  } catch (error) {
    console.error('PUT /api/users/[id]/password error:', error);
    return internalErrorResponse('Failed to set the password');
  }
}
