/**
 * Supabase Server Client
 *
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. This client has access to cookies for session management.
 *
 * IMPORTANT: Do NOT use this client for business data queries.
 * Business data must flow through Supabase Client.
 *
 * Performance: getUser() is memoized with React's cache() to avoid
 * duplicate auth calls within the same request.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { cache } from 'react';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { SupabaseClient } from './types';

/**
 * Cookie type for Supabase SSR
 */
interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Environment variables validation
 */
function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseAnonKey) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Create a Supabase client for Server Components
 *
 * Usage in Server Component:
 * ```tsx
 * import { createClient } from '@/lib/supabase/server';
 *
 * export default async function Page() {
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   return <div>Hello {user?.email}</div>;
 * }
 * ```
 *
 * Usage in Route Handler:
 * ```ts
 * import { createClient } from '@/lib/supabase/server';
 *
 * export async function GET() {
 *   const supabase = await createClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *
 *   return Response.json({ user });
 * }
 * ```
 */
export async function createClient(): Promise<SupabaseClient> {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Internal function to fetch user (not memoized)
 */
async function fetchUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // Only log unexpected errors, not "Auth session missing" which is expected
    // when user is not logged in or session expired
    if (!error.message.includes('Auth session missing')) {
      console.error('Error getting user:', error.message);
    }
    return null;
  }

  return user;
}

/**
 * Get the current authenticated user from Server Component
 *
 * Memoized with React's cache() - multiple calls within the same
 * request will only execute the auth check once.
 *
 * Usage:
 * ```tsx
 * import { getUser } from '@/lib/supabase/server';
 *
 * export default async function Page() {
 *   const user = await getUser();
 *
 *   if (!user) {
 *     redirect('/login');
 *   }
 *
 *   return <div>Hello {user.email}</div>;
 * }
 * ```
 */
export const getUser = cache(fetchUser);

/**
 * Get the current session from Server Component
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Error getting session:', error.message);
    return null;
  }

  return session;
}
