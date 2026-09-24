/**
 * QuickBooks OAuth Callback Route
 *
 * GET /api/quickbooks/callback
 *
 * Handles the OAuth callback from Intuit:
 * - Validates state parameter
 * - Exchanges code for tokens
 * - Fetches company info
 * - Stores encrypted tokens
 * - Redirects to settings page
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUser } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks';
import {
  STATE_COOKIE_NAME,
  QBO_REDIRECT_PATHS,
} from '@/modules/integrations/providers/accounting/quickbooks';
import { qboAccountSyncService } from '@/modules/integrations/quickbooks';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Extract callback parameters
  const code = searchParams.get('code');
  const realmId = searchParams.get('realmId');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle user cancellation
  if (error === 'access_denied') {
    return NextResponse.redirect(`${origin}${QBO_REDIRECT_PATHS.CANCELLED}`);
  }

  // Handle other OAuth errors
  if (error) {
    console.error('QuickBooks OAuth error:', error, searchParams.get('error_description'));
    return NextResponse.redirect(`${origin}${QBO_REDIRECT_PATHS.TOKEN_ERROR}`);
  }

  // Validate required parameters
  if (!code || !realmId || !state) {
    console.error('Missing required callback parameters');
    return NextResponse.redirect(`${origin}${QBO_REDIRECT_PATHS.TOKEN_ERROR}`);
  }

  // Validate state parameter against cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

  if (!savedState || savedState !== state) {
    console.error('State mismatch - possible CSRF attack');
    // Clear the cookie
    cookieStore.delete(STATE_COOKIE_NAME);
    return NextResponse.redirect(`${origin}${QBO_REDIRECT_PATHS.INVALID_STATE}`);
  }

  // Clear the state cookie
  cookieStore.delete(STATE_COOKIE_NAME);

  try {
    console.log('QuickBooks Callback Debug:', {
      code: code?.substring(0, 10) + '...',
      realmId,
      state: state?.substring(0, 10) + '...',
    });

    // Get current user ID (must be the app user ID from public.users, not auth.users)
    const authUser = await getUser();
    let userId: string | undefined;

    if (authUser?.id) {
      const appUser = await getAppUserByAuthId(authUser.id);
      userId = appUser?.id;
    }

    console.log('Auth User ID:', authUser?.id);
    console.log('App User ID:', userId);

    // Handle the OAuth callback using the provider
    const connection = await quickBooksProvider.handleOAuthCallback({ code, realmId }, userId);

    console.log('Connection created:', {
      id: connection.id,
      status: connection.status,
      externalAccountName: connection.external_account_name,
    });

    // Auto-sync Chart of Accounts from QuickBooks
    try {
      const syncResult = await qboAccountSyncService.syncAccounts(connection.id);
      console.log('Chart of Accounts synced:', {
        created: syncResult.created,
        updated: syncResult.updated,
        errors: syncResult.errors.length,
      });
    } catch (syncError) {
      // Log but don't fail the connection - accounts can be synced later
      console.error('Chart of Accounts sync failed (non-fatal):', syncError);
    }

    // Success - return HTML that closes the popup
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>QuickBooks Connected</title></head>
        <body>
          <script>
            if (window.opener) {
              window.close();
            } else {
              window.location.href = '${origin}${QBO_REDIRECT_PATHS.SUCCESS}';
            }
          </script>
          <p>QuickBooks connected successfully! You can close this window.</p>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('QuickBooks callback handling failed:', error);

    // Return HTML that shows error and closes popup
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <script>
            if (window.opener) {
              setTimeout(() => window.close(), 2000);
            } else {
              window.location.href = '${origin}${QBO_REDIRECT_PATHS.TOKEN_ERROR}';
            }
          </script>
          <p>Connection failed. This window will close automatically.</p>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}
