/**
 * Pipedrive OAuth Callback Route
 *
 * GET /api/pipedrive/callback
 *
 * Handles the OAuth callback from Pipedrive:
 * - Requires a signed-in user allowed to manage the integration
 * - Validates state parameter
 * - Exchanges code for tokens
 * - Fetches user info
 * - Stores encrypted tokens
 * - Redirects to settings page
 */

import { cookies } from 'next/headers';
import { checkPermission } from '@/shared/lib/auth/check-permission';
import { pipedriveProvider } from '@/modules/integrations/providers/crm/pipedrive';
import {
  PIPEDRIVE_STATE_COOKIE_NAME,
  PIPEDRIVE_REDIRECT_PATHS,
  PIPEDRIVE_MANAGE_PERMISSION,
} from '@/modules/integrations/providers/crm/pipedrive';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // Extract callback parameters
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Helper to return HTML that closes popup
  const closePopupWithError = (message: string) => new Response(
    `<!DOCTYPE html>
    <html>
      <head><title>Connection Failed</title></head>
      <body>
        <script>
          if (window.opener) {
            setTimeout(() => window.close(), 2000);
          } else {
            window.location.href = '${origin}${PIPEDRIVE_REDIRECT_PATHS.TOKEN_ERROR}';
          }
        </script>
        <p>${message}</p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );

  const closePopupCancelled = () => new Response(
    `<!DOCTYPE html>
    <html>
      <head><title>Connection Cancelled</title></head>
      <body>
        <script>
          if (window.opener) {
            window.close();
          } else {
            window.location.href = '${origin}${PIPEDRIVE_REDIRECT_PATHS.CANCELLED}';
          }
        </script>
        <p>Connection cancelled. You can close this window.</p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );

  // Handle user cancellation
  if (error === 'access_denied') {
    return closePopupCancelled();
  }

  // Handle other OAuth errors
  if (error) {
    console.error('Pipedrive OAuth error:', error, searchParams.get('error_description'));
    return closePopupWithError('OAuth error occurred. This window will close automatically.');
  }

  // Only a signed-in user allowed to manage the integration may complete the
  // connection; otherwise anyone could replace the company's Pipedrive account.
  const { hasAccess, user: appUser } = await checkPermission(PIPEDRIVE_MANAGE_PERMISSION);
  if (!hasAccess || !appUser) {
    console.warn('Pipedrive callback rejected: user not signed in or lacks permission');
    return closePopupWithError('You are not allowed to connect Pipedrive. This window will close automatically.');
  }

  // Validate required parameters
  if (!code || !state) {
    console.error('Missing required callback parameters');
    return closePopupWithError('Missing parameters. This window will close automatically.');
  }

  // Validate state parameter against cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get(PIPEDRIVE_STATE_COOKIE_NAME)?.value;

  if (!savedState || savedState !== state) {
    console.error('State mismatch - possible CSRF attack');
    // Clear the cookie
    cookieStore.delete(PIPEDRIVE_STATE_COOKIE_NAME);
    return closePopupWithError('Invalid state. Please try again.');
  }

  // Clear the state cookie
  cookieStore.delete(PIPEDRIVE_STATE_COOKIE_NAME);

  try {
    // connected_by references users(id) (application user), not auth.users(id)
    await pipedriveProvider.handleOAuthCallback({ code }, appUser.id);

    // Success - return HTML that closes the popup (like QuickBooks)
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>Pipedrive Connected</title></head>
        <body>
          <script>
            if (window.opener) {
              window.close();
            } else {
              window.location.href = '${origin}${PIPEDRIVE_REDIRECT_PATHS.SUCCESS}';
            }
          </script>
          <p>Pipedrive connected successfully! You can close this window.</p>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('Pipedrive callback handling failed:', error);

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
              window.location.href = '${origin}${PIPEDRIVE_REDIRECT_PATHS.TOKEN_ERROR}';
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
