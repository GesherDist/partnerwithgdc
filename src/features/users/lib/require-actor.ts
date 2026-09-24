/**
 * Users Module - Route Actor Resolution
 *
 * Resolves the signed-in caller to their row in our own `users` table.
 *
 * Routes elsewhere pass `user.id` straight from Supabase into the service as
 * the actor. That value is the *auth* id, not the id of the matching `users`
 * row, so it cannot be compared against a user id or used for "is this me?"
 * checks. The Users module needs that comparison - deleting yourself has to be
 * refused - so it resolves the application user instead.
 *
 * Performance: Uses React's cache() to dedupe auth checks within a request.
 */

import { cache } from 'react';
import { createClient } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth/get-app-user';
import type { AppUser } from '@/shared/stores/auth.store';

export interface ActorResult {
  actor: AppUser | null;
  /** Why there is no actor - lets the caller pick 401 vs 403 */
  reason?: 'unauthenticated' | 'no-profile';
}

/**
 * Internal function to resolve actor (not memoized)
 */
async function fetchActor(): Promise<ActorResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { actor: null, reason: 'unauthenticated' };
  }

  const appUser = await getAppUserByAuthId(user.id);

  if (!appUser) {
    // Authenticated with Supabase but no live row here - either never
    // provisioned, or soft-deleted.
    return { actor: null, reason: 'no-profile' };
  }

  return { actor: appUser };
}

/**
 * Resolve the current request's actor, or explain why there is none.
 *
 * Memoized with React's cache() - multiple calls within the same
 * request will only execute the auth check once.
 */
export const resolveActor = cache(fetchActor);
