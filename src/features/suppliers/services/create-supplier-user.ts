/**
 * Create Supplier User Account
 *
 * Creates a Supabase Auth user and application user for a supplier.
 * This file is server-only and should never be imported on the client.
 */

import 'server-only';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/shared/lib/supabase/database';

// Lazy initialization of admin client
let adminClient: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  return adminClient;
}

interface CreateSupplierUserInput {
  supplierId: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  sendInvite?: boolean;
}

export async function createSupplierUserAccount(
  input: CreateSupplierUserInput
): Promise<{ userId: string | null; error?: string }> {
  try {
    // 1. Get the Supplier role ID
    const { data: supplierRole, error: roleError } = await db
      .from('roles')
      .select('id')
      .eq('name', 'Supplier')
      .single();

    if (roleError || !supplierRole) {
      console.error('[createSupplierUserAccount] Supplier role not found:', roleError);
      return { userId: null, error: 'Supplier role not found. Please ensure migrations are applied.' };
    }

    // 2. Check if user with this email already exists
    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('email', input.email.toLowerCase())
      .is('deleted_at', null)
      .single();

    if (existingUser) {
      return { userId: null, error: 'A user with this email already exists' };
    }

    // 3. Create auth user
    const supabaseAdmin = getSupabaseAdmin();
    let authUserId: string;

    if (input.sendInvite) {
      // Create user with invite (user sets their own password)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        input.email,
        {
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
          },
        }
      );

      if (authError || !authData.user) {
        console.error('[createSupplierUserAccount] Auth invite error:', authError);
        return { userId: null, error: authError?.message || 'Failed to send invite' };
      }

      authUserId = authData.user.id;
    } else {
      // Create user with password
      if (!input.password) {
        return { userId: null, error: 'Password is required when not sending invite' };
      }

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          first_name: input.firstName,
          last_name: input.lastName,
        },
      });

      if (authError || !authData.user) {
        console.error('[createSupplierUserAccount] Auth create error:', authError);
        return { userId: null, error: authError?.message || 'Failed to create auth user' };
      }

      authUserId = authData.user.id;
    }

    // 4. Create application user linked to supplier
    const { data: newUser, error: userError } = await db
      .from('users')
      .insert({
        auth_user_id: authUserId,
        email: input.email.toLowerCase(),
        first_name: input.firstName,
        last_name: input.lastName || input.firstName,
        role_id: supplierRole.id,
        supplier_id: input.supplierId,
        status: 'active',
        email_verified_at: input.sendInvite ? null : new Date().toISOString(),
      })
      .select('id')
      .single();

    if (userError || !newUser) {
      console.error('[createSupplierUserAccount] User insert error:', userError);
      // Try to cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return { userId: null, error: userError?.message || 'Failed to create user record' };
    }

    return { userId: newUser.id };
  } catch (error) {
    console.error('[createSupplierUserAccount] Unexpected error:', error);
    return {
      userId: null,
      error: error instanceof Error ? error.message : 'Failed to create supplier user',
    };
  }
}
