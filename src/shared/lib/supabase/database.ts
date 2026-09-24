/**
 * Supabase Database Client
 *
 * Server-side database client for all data operations.
 * Uses the service role key to bypass RLS for server-side queries.
 *
 * IMPORTANT: Only use this in:
 * - API Routes
 * - Server Actions
 * - Server Components
 *
 * NEVER import this in client components.
 *
 * Usage:
 * ```ts
 * import { db } from '@/shared/lib/supabase/database';
 *
 * // Select
 * const { data, error } = await db.from('users').select('*');
 *
 * // Insert
 * const { data, error } = await db.from('users').insert({ ... }).select().single();
 *
 * // Update
 * const { data, error } = await db.from('users').update({ ... }).eq('id', id).select().single();
 *
 * // Delete
 * const { error } = await db.from('users').delete().eq('id', id);
 * ```
 */

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from './types';

/**
 * Environment variables validation
 */
function getSupabaseConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return { supabaseUrl, supabaseServiceKey };
}

/**
 * Singleton database client instance
 */
let dbClient: SupabaseClient | null = null;

/**
 * Get the database client instance
 *
 * This client uses the service role key to bypass RLS.
 * Use this for all server-side database operations.
 */
export function getDbClient(): SupabaseClient {
  // Ensure this is only called on the server
  if (typeof window !== 'undefined') {
    throw new Error(
      'Database client can only be used on the server. ' +
        'Do not import this module in client components.'
    );
  }

  if (!dbClient) {
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

    dbClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });
  }

  return dbClient;
}

/**
 * Database client singleton
 *
 * Use this for all database queries in repositories.
 *
 * Example:
 * ```ts
 * import { db } from '@/shared/lib/supabase/database';
 *
 * const { data } = await db.from('users').select('*');
 * ```
 */
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getDbClient();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

/**
 * Helper to handle Supabase errors consistently
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }

  static fromSupabaseError(error: { message: string; code?: string; details?: string }): DatabaseError {
    return new DatabaseError(error.message, error.code, error.details);
  }
}

/**
 * Helper to unwrap Supabase response and throw on error
 */
export function unwrap<T>(response: { data: T | null; error: { message: string; code?: string; details?: string } | null }): T {
  if (response.error) {
    throw DatabaseError.fromSupabaseError(response.error);
  }
  if (response.data === null) {
    throw new DatabaseError('No data returned');
  }
  return response.data;
}

/**
 * Helper to unwrap Supabase response, returning null if not found
 */
export function unwrapOrNull<T>(response: { data: T | null; error: { message: string; code?: string; details?: string } | null }): T | null {
  if (response.error) {
    // PGRST116 = "No rows found" - this is not an error, just no data
    if (response.error.code === 'PGRST116') {
      return null;
    }
    throw DatabaseError.fromSupabaseError(response.error);
  }
  return response.data;
}
