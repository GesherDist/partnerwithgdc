/**
 * Pipedrive OAuth Authorization Route
 *
 * GET /api/pipedrive/auth
 *
 * Initiates the OAuth flow by generating a state token,
 * storing it in an HTTP-only cookie, and redirecting to Pipedrive.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import {
  PIPEDRIVE_STATE_COOKIE_NAME,
  PIPEDRIVE_STATE_COOKIE_MAX_AGE,
  PIPEDRIVE_REDIRECT_PATHS,
} from '@/modules/integrations/providers/crm/pipedrive';

export async function GET(request: Request) {
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

    // Get origin for redirect
    const { origin } = new URL(request.url);
    return NextResponse.redirect(`${origin}${PIPEDRIVE_REDIRECT_PATHS.NETWORK_ERROR}`);
  }
}
