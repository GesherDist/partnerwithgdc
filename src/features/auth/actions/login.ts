'use server';

/**
 * Login Server Action
 *
 * Handles user authentication via Supabase.
 * Returns error messages on failure, redirects on success.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { setCachedProfile } from '@/shared/lib/auth/profile-cache';
import { loginSchema, type LoginFormData } from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface LoginResult {
  error?: string;
}

// ============================================
// ACTION
// ============================================

export async function loginAction(data: LoginFormData): Promise<LoginResult | void> {
  // Validate input
  const validatedData = loginSchema.safeParse(data);

  if (!validatedData.success) {
    return { error: 'Invalid form data. Please check your inputs.' };
  }

  const { email, password } = validatedData.data;

  // Create Supabase client
  const supabase = await createClient();

  // Attempt to sign in
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Log full error for debugging
    console.error('Login error FULL:', JSON.stringify(error, null, 2));
    console.error('Login error keys:', Object.keys(error));
    console.error('Login error message:', error.message);
    console.error('Login error cause:', (error as Error & { cause?: unknown }).cause);

    const errorMsg = error.message || error.name || JSON.stringify(error) || 'Unknown error';

    // Map Supabase errors to user-friendly messages
    if (errorMsg === 'Invalid login credentials') {
      return { error: 'Invalid email or password. Please try again.' };
    }

    if (errorMsg.includes('Email not confirmed')) {
      return { error: 'Please verify your email before signing in.' };
    }

    if (errorMsg.includes('Too many requests')) {
      return { error: 'Too many login attempts. Please try again later.' };
    }

    // Generic error for unexpected issues - show actual error in development
    return { error: `Login failed: ${errorMsg}` };
  }

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  let redirectUrl = '/dashboard';

  if (user) {
    // Fetch and cache user profile for fast page loads
    const appUser = await getAppUserByAuthId(user.id);
    if (appUser) {
      await setCachedProfile(appUser);

      // Check if user is a supplier - redirect to supplier portal
      if (appUser.supplierId) {
        redirectUrl = '/supplier-portal';
      }
    }
  }

  // Success - redirect based on user type
  redirect(redirectUrl);
}
