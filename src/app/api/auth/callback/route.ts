/**
 * Auth Callback Route
 *
 * Handles OAuth callbacks and email confirmation redirects from Supabase.
 * Supports: login, signup, password reset (recovery), and email change.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';
import { auditService } from '@/shared/lib/audit';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;

  // Log all parameters for debugging
  console.log('=== Auth Callback Debug ===');
  console.log('Full URL:', url.toString());
  console.log('All params:', Object.fromEntries(searchParams.entries()));

  const code = searchParams.get('code');
  const type = searchParams.get('type'); // Supabase sends: recovery, signup, invite, magiclink
  const next = searchParams.get('next');
  const error_description = searchParams.get('error_description');

  console.log('Parsed - code:', code ? 'present' : 'missing');
  console.log('Parsed - type:', type);
  console.log('Parsed - next:', next);

  // Handle Supabase error redirects (e.g., expired or invalid link)
  if (error_description) {
    console.error('Auth callback error from Supabase:', error_description);
    const errorMessage = encodeURIComponent(error_description);
    return NextResponse.redirect(`${origin}/login?error=${errorMessage}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    console.log('Code exchange result - error:', error?.message);
    console.log('Code exchange result - session:', data?.session ? 'present' : 'missing');

    if (!error) {
      // Determine redirect based on type or next parameter
      let redirectTo = '/dashboard'; // default

      // Password reset flow - redirect to reset password page
      // Supabase sends type=recovery for password reset links
      const isRecovery = type === 'recovery';

      console.log('Is recovery flow:', isRecovery);

      if (isRecovery) {
        redirectTo = '/reset-password';
        // Log password reset audit
        if (data.session?.user) {
          await auditService.logPasswordChange(data.session.user.id, {
            userEmail: data.session.user.email,
          });
        }
      } else {
        // Log login audit
        if (data.session?.user) {
          await auditService.logLogin(data.session.user.id, {
            userEmail: data.session.user.email,
          });
        }
        if (next) {
          redirectTo = next;
        }
      }

      console.log('Redirecting to:', redirectTo);
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    // Log the specific error for debugging
    console.error('Code exchange error:', {
      message: error.message,
      code: error.code,
      status: error.status,
    });

    // Provide more specific error messages
    if (error.message.includes('expired')) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('This link has expired. Please request a new password reset.')}`
      );
    }

    if (error.message.includes('already been used')) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('This link has already been used. Please request a new password reset.')}`
      );
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message || 'Authentication failed. Please try again.')}`
    );
  }

  // No code provided
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Invalid authentication link.')}`);
}
