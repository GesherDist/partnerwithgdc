/**
 * Auth Callback Route - Password Recovery
 *
 * Handles password reset callbacks from Supabase.
 * Always redirects to /reset-password after successful code exchange.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // request.url reflects the internal address (localhost:3000) behind the
  // reverse proxy, not the public host, so origin must come from env instead.
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://ops.partnerwithgdc.com';
  const code = searchParams.get('code');
  const error_description = searchParams.get('error_description');

  console.log('=== Recovery Callback ===');
  console.log('Code present:', !!code);

  // Handle Supabase error redirects
  if (error_description) {
    console.error('Recovery callback error:', error_description);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password recovery - always redirect to reset-password
      console.log('Recovery successful, redirecting to reset-password');
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    console.error('Recovery code exchange error:', error.message);

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
      `${origin}/login?error=${encodeURIComponent(error.message || 'Password reset failed. Please try again.')}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Invalid password reset link.')}`
  );
}
