'use server';

/**
 * Logout Server Action
 *
 * Signs out the current user and clears cached profile.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/shared/lib/supabase/server';
import { clearCachedProfile } from '@/shared/lib/auth/profile-cache';

// ============================================
// ACTION
// ============================================

export async function logoutAction(): Promise<void> {
  const supabase = await createClient();

  // Clear cached profile
  await clearCachedProfile();

  await supabase.auth.signOut();

  redirect('/login');
}
