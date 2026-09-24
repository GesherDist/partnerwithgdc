/**
 * Supabase Admin Client
 *
 * Creates a Supabase client with admin/service role privileges.
 * This client bypasses Row Level Security (RLS).
 *
 * ⚠️ SECURITY WARNING:
 * - Only use this on the server-side (API routes, Server Actions)
 * - Never expose the service role key to the client
 * - Use sparingly - prefer RLS-enabled clients when possible
 *
 * Use cases:
 * - Creating users programmatically
 * - Admin operations that need to bypass RLS
 * - Background jobs and cron tasks
 */

import { createClient } from '@supabase/supabase-js';

import type { SupabaseClient } from './types';

/**
 * Environment variables validation
 */
function getSupabaseAdminConfig() {
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
 * Singleton admin client instance
 */
let adminClient: SupabaseClient | null = null;

/**
 * Create a Supabase admin client with service role privileges
 *
 * Usage:
 * ```ts
 * // In API route or Server Action only!
 * import { createAdminClient } from '@/lib/supabase/admin';
 *
 * export async function POST(request: Request) {
 *   const supabase = createAdminClient();
 *
 *   // Create a new user (bypasses RLS)
 *   const { data, error } = await supabase.auth.admin.createUser({
 *     email: 'newuser@example.com',
 *     password: 'securepassword',
 *     email_confirm: true,
 *   });
 *
 *   return Response.json({ data, error });
 * }
 * ```
 */
export function createAdminClient(): SupabaseClient {
  // Ensure this is only called on the server
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient can only be used on the server. ' +
        'Do not import this module in client components.'
    );
  }

  const { supabaseUrl, supabaseServiceKey } = getSupabaseAdminConfig();

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get the singleton admin client instance
 *
 * Useful when you need to reuse the same client across multiple operations
 */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createAdminClient();
  }
  return adminClient;
}

/**
 * Admin user management functions
 */
export const adminAuth = {
  /**
   * Create a new user with admin privileges
   */
  async createUser(email: string, password: string, metadata?: Record<string, unknown>) {
    const supabase = getAdminClient();
    return supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
  },

  /**
   * Invite a new user by email.
   *
   * Creates the auth account and emails a link for the user to set their own
   * password - use this instead of createUser when no password is supplied.
   */
  async inviteUser(email: string, redirectTo?: string, metadata?: Record<string, unknown>) {
    const supabase = getAdminClient();
    return supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: metadata,
    });
  },

  /**
   * Delete a user by ID
   */
  async deleteUser(userId: string) {
    const supabase = getAdminClient();
    return supabase.auth.admin.deleteUser(userId);
  },

  /**
   * Update a user's metadata
   */
  async updateUser(userId: string, attributes: {
    email?: string;
    password?: string;
    user_metadata?: Record<string, unknown>;
  }) {
    const supabase = getAdminClient();
    return supabase.auth.admin.updateUserById(userId, attributes);
  },

  /**
   * Get a user by ID
   */
  async getUser(userId: string) {
    const supabase = getAdminClient();
    return supabase.auth.admin.getUserById(userId);
  },

  /**
   * List all users with pagination
   */
  async listUsers(page = 1, perPage = 50) {
    const supabase = getAdminClient();
    return supabase.auth.admin.listUsers({
      page,
      perPage,
    });
  },

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, redirectTo?: string) {
    const supabase = getAdminClient();
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
  },

  /**
   * Verify a user's email
   */
  async verifyEmail(userId: string) {
    const supabase = getAdminClient();
    return supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
  },
};
