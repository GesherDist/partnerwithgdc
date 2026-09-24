'use server';

/**
 * Reset Password Server Action
 *
 * Updates user password after reset.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { resetPasswordSchema, type ResetPasswordFormData } from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface ResetPasswordResult {
  error?: string;
}

// ============================================
// ACTION
// ============================================

export async function resetPasswordAction(
  data: ResetPasswordFormData
): Promise<ResetPasswordResult | void> {
  // Validate input
  const validatedData = resetPasswordSchema.safeParse(data);

  if (!validatedData.success) {
    const errors = validatedData.error.flatten().fieldErrors;
    const firstError = Object.values(errors)[0]?.[0];
    return { error: firstError || 'Invalid form data.' };
  }

  const { password } = validatedData.data;

  // Create Supabase client
  const supabase = await createClient();

  // Update password
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    console.error('Reset password error:', error);

    // Reaching the form without a recovery session - the page was opened
    // directly, or the emailed link was already used or has expired. Retrying
    // cannot help, so say what actually needs to happen.
    if (
      error.name === 'AuthSessionMissingError' ||
      error.message.includes('Auth session missing')
    ) {
      return {
        error:
          'This password reset link is no longer valid. Request a new one from the "Forgot password" page.',
      };
    }

    if (error.message.includes('same as')) {
      return { error: 'New password must be different from your current password.' };
    }

    if (error.message.includes('weak')) {
      return { error: 'Password is too weak. Please choose a stronger password.' };
    }

    return { error: 'Failed to update password. Please try again.' };
  }

  // Success
  return;
}
