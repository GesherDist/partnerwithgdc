'use server';

/**
 * Profile Server Actions
 *
 * Lets the signed-in user read and update their own name, phone and
 * password. The user is always taken from the session, never from input,
 * so nobody can change another user's profile through these actions.
 */

import { revalidatePath } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { setCachedProfile } from '@/shared/lib/auth/profile-cache';
import { auditService } from '@/shared/lib/audit';
import { userRepository } from '@/features/users/repositories/user.repository';
import { userService } from '@/features/users/services/user.service';
import {
  profileSchema,
  changePasswordSchema,
  type ProfileFormData,
  type ChangePasswordFormData,
} from '../lib/schemas';

// ============================================
// TYPES
// ============================================

export interface MyProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  roleName: string | null;
  status: string;
}

interface ProfileActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// HELPERS
// ============================================

async function getSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return null;
  }
  const appUser = await getAppUserByAuthId(authUser.id);
  return appUser ? { authUser, appUser } : null;
}

/**
 * Checks the current password with a throwaway client, so the user's own
 * session cookies are not touched.
 */
async function isCurrentPassword(email: string, password: string): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return null;
  }

  const verifier = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await verifier.auth.signInWithPassword({ email, password });

  if (error) {
    return error.message.includes('Invalid login credentials') ? false : null;
  }

  await verifier.auth.signOut({ scope: 'local' });
  return true;
}

// ============================================
// ACTIONS
// ============================================

export async function getMyProfile(): Promise<ProfileActionResult<MyProfile>> {
  try {
    const signedIn = await getSignedInUser();
    if (!signedIn) {
      return { success: false, error: 'Please sign in again.' };
    }

    const user = await userRepository.findById(signedIn.appUser.id);
    if (!user) {
      return { success: false, error: 'Profile not found.' };
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        roleName: user.role?.name ?? null,
        status: user.status,
      },
    };
  } catch (error) {
    console.error('getMyProfile error:', error);
    return { success: false, error: 'Failed to load your profile.' };
  }
}

export async function updateMyProfile(
  input: ProfileFormData
): Promise<ProfileActionResult<{ firstName: string; lastName: string; phone: string | null }>> {
  const validation = profileSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Please fix the highlighted fields.',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const signedIn = await getSignedInUser();
    if (!signedIn) {
      return { success: false, error: 'Please sign in again.' };
    }
    const { appUser } = signedIn;

    const existing = await userRepository.findById(appUser.id);
    if (!existing) {
      return { success: false, error: 'Profile not found.' };
    }

    const next = {
      firstName: validation.data.firstName,
      lastName: validation.data.lastName,
      phone: validation.data.phone || null,
    };

    await userRepository.update(appUser.id, next, appUser.id);

    await auditService.logUpdate(
      'users',
      'User',
      appUser.id,
      { firstName: existing.firstName, lastName: existing.lastName, phone: existing.phone },
      next,
      { userId: appUser.id, userEmail: appUser.email },
      'Updated own profile'
    );

    await setCachedProfile({ ...appUser, firstName: next.firstName, lastName: next.lastName });
    revalidatePath('/', 'layout');

    return { success: true, data: next };
  } catch (error) {
    console.error('updateMyProfile error:', error);
    return { success: false, error: 'Failed to update your profile. Please try again.' };
  }
}

export async function changeMyPassword(input: ChangePasswordFormData): Promise<ProfileActionResult> {
  const validation = changePasswordSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: 'Please fix the highlighted fields.',
      errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const signedIn = await getSignedInUser();
    if (!signedIn?.authUser.email) {
      return { success: false, error: 'Please sign in again.' };
    }
    const { authUser, appUser } = signedIn;

    const currentOk = await isCurrentPassword(authUser.email!, validation.data.currentPassword);
    if (currentOk === false) {
      return {
        success: false,
        error: 'Current password is incorrect.',
        errors: { currentPassword: ['Current password is incorrect'] },
      };
    }
    if (currentOk === null) {
      return { success: false, error: 'Could not verify your current password. Please try again later.' };
    }

    const result = await userService.setPassword(appUser.id, validation.data.newPassword);
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update your password.',
        errors: result.errors?.password ? { newPassword: result.errors.password } : undefined,
      };
    }

    await auditService.logPasswordChange(appUser.id, { userEmail: appUser.email });

    return { success: true };
  } catch (error) {
    console.error('changeMyPassword error:', error);
    return { success: false, error: 'Failed to update your password. Please try again.' };
  }
}
