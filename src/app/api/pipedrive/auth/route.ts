/**
 * Pipedrive OAuth Authorization Route
 *
 * GET /api/pipedrive/auth
 *
 * Initiates the OAuth flow by generating a state token,
 * storing it in an HTTP-only cookie, and redirecting to Pipedrive.
 * Requires a signed-in user allowed to manage the integration.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { checkPermission } from '@/shared/lib/auth/check-permission';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import {
  PIPEDRIVE_STATE_COOKIE_NAME,
  PIPEDRIVE_STATE_COOKIE_MAX_AGE,
  PIPEDRIVE_REDIRECT_PATHS,
  PIPEDRIVE_MANAGE_PERMISSION,
} from '@/modules/integrations/providers/crm/pipedrive';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  // /api routes bypass the auth middleware, so check here. This route opens in
  // a popup, so redirect rather than returning JSON.
  const { hasAccess } = await checkPermission(PIPEDRIVE_MANAGE_PERMISSION);
  if (!hasAccess) {
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.UNAUTHORIZED}`);
  }

  try {
    // Generate state and authorization URL using the provider
    const { state, authorizationUrl } = pipedriveProvider.initiateOAuth();

    // Store state in HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(PIPEDRIVE_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: PIPEDRIVE_STATE_COOKIE_MAX_AGE,
      path: '/',
    });

    // Redirect to Pipedrive authorization
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('Pipedrive auth initiation failed:', error);
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.NETWORK_ERROR}`);
  }
}
