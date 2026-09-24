/**
 * QuickBooks OAuth Authorization Route
 *
 * GET /api/quickbooks/auth
 *
 * Initiates the OAuth flow by generating a state token,
 * storing it in an HTTP-only cookie, and redirecting to Intuit.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import {
  STATE_COOKIE_NAME,
  STATE_COOKIE_MAX_AGE,
  QBO_REDIRECT_PATHS,
} from '@/modules/integrations/providers/accounting/quickbooks';

export async function GET(request: Request) {
  try {
    // Debug: Log environment variable status
    console.log('QuickBooks Auth Debug:', {
      hasClientId: !!process.env.NEXT_QUICKBOOKS_CLIENT_ID,
      hasClientSecret: !!process.env.NEXT_QUICKBOOKS_SECRET_ID,
      hasRedirectUri: !!process.env.NEXT_QUICKBOOKS_REDIRECT_URI,
      hasEncryptionKey: !!(process.env.INTEGRATION_ENCRYPTION_KEY || process.env.QBO_ENCRYPTION_KEY),
      environment: process.env.NEXT_QUICKBOOKS_ENVIRONMENT || 'sandbox',
    });

    // Generate state and authorization URL using the provider
    const { state, authorizationUrl } = quickBooksProvider.initiateOAuth();

    console.log('Generated authorization URL:', authorizationUrl);

    // Store state in HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STATE_COOKIE_MAX_AGE,
      path: '/',
    });

    // Redirect to Intuit authorization
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('QuickBooks auth initiation failed:', error);

    // Return error details for debugging
    const { origin } = new URL(request.url);

    // In development, show error details
    if (process.env.NODE_ENV === 'development') {
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head><title>QuickBooks Auth Error</title></head>
          <body>
            <h1>QuickBooks Auth Error</h1>
            <pre>${error instanceof Error ? error.message : 'Unknown error'}</pre>
            <p>Check your environment variables in .env.local:</p>
            <ul>
              <li>NEXT_QUICKBOOKS_CLIENT_ID</li>
              <li>NEXT_QUICKBOOKS_SECRET_ID</li>
              <li>NEXT_QUICKBOOKS_REDIRECT_URI</li>
              <li>QBO_ENCRYPTION_KEY</li>
            </ul>
            <a href="${origin}/settings">Back to Settings</a>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return NextResponse.redirect(`${origin}${QBO_REDIRECT_PATHS.NETWORK_ERROR}`);
  }
}
