/**
 * Supabase Browser Client
 *
 * Creates a Supabase client for use in browser/client components.
 * This client is used for authentication and storage operations only.
 *
 * IMPORTANT: Do NOT use this client for business data queries.
 * Business data must flow through API routes using Prisma.
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createBrowserClient } from '@supabase/ssr';

import type { SupabaseClient } from './types';

/**
 * Environment variables validation
 * Returns empty strings during build/prerender to avoid errors
 */
function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Only validate at runtime, not during build
  if (typeof window !== 'undefined') {
    if (!supabaseUrl) {
      throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
    }

    if (!supabaseAnonKey) {
      throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Create a Supabase client for browser/client components
 *
 * Usage:
 * ```tsx
 * 'use client';
 *
 * import { createClient } from '@/lib/supabase/client';
 *
 * export function LoginButton() {
 *   const supabase = createClient();
 *
 *   const handleLogin = async () => {
 *     await supabase.auth.signInWithPassword({
 *       email: 'user@example.com',
 *       password: 'password',
 *     });
 *   };
 *
 *   return <button onClick={handleLogin}>Login</button>;
 * }
 * ```
 */
export function createClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Singleton instance for contexts where re-creation is expensive
 * Use createClient() in most cases for proper cookie handling
 */
let browserClient: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}
