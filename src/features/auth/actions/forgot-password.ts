'use server';

/**
 * Forgot Password Server Action
 *
 * Sends password reset email via Supabase.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface ForgotPasswordResult {
  error?: string;
}

// ============================================
// ACTION
// ============================================

export async function forgotPasswordAction(
  data: ForgotPasswordFormData
): Promise<ForgotPasswordResult | void> {
  // Validate input
  const validatedData = forgotPasswordSchema.safeParse(data);

  if (!validatedData.success) {
    return { error: 'Please enter a valid email address.' };
  }

  const { email } = validatedData.data;

  // Create Supabase client
  const supabase = await createClient();

  // Get the origin for redirect URL
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Send password reset email.
  //
  // The link has to land on the callback route, not straight on the form:
  // Supabase appends a one-time `code` that must be exchanged for a session
  // before the password can be changed. Pointing at /reset-password directly
  // skipped that exchange, so every submit failed with "Auth session missing".
  // Use path-based redirect (Supabase strips query params from redirect URLs)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/api/auth/callback/recovery`,
  });

  if (error) {
    console.error('Forgot password error:', error);

    // Don't reveal if email exists or not for security
    // Always return success to prevent email enumeration
  }

  // Always return success to prevent email enumeration attacks
  return;
}
