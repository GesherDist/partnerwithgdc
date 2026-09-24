/**
 * Supabase Exports
 *
 * Central export point for Supabase-related utilities.
 *
 * USAGE GUIDE:
 *
 * 1. Client Components (browser):
 *    ```tsx
 *    'use client';
 *    import { createClient } from '@/lib/supabase/client';
 *    const supabase = createClient();
 *    ```
 *
 * 2. Server Components:
 *    ```tsx
 *    import { createClient } from '@/lib/supabase/server';
 *    const supabase = await createClient();
 *    ```
 *
 * 3. API Routes / Server Actions:
 *    ```ts
 *    import { createClient } from '@/lib/supabase/server';
 *    const supabase = await createClient();
 *    ```
 *
 * 4. Admin Operations (server-only):
 *    ```ts
 *    import { createAdminClient } from '@/lib/supabase/admin';
 *    const supabase = createAdminClient();
 *    ```
 *
 * 5. Middleware:
 *    ```ts
 *    import { updateSession } from '@/lib/supabase/middleware';
 *    ```
 */

// Browser client
export { createClient as createBrowserClient, getBrowserClient } from './client';

// Server client
export {
  createClient as createServerClient,
  getUser,
  getSession,
} from './server';

// Middleware
export {
  updateSession,
  isPublicRoute,
  isApiRoute,
  isStaticAsset,
  PUBLIC_ROUTES,
  PROTECTED_ROUTES,
} from './middleware';

// Admin client (server-only)
export { createAdminClient, getAdminClient, adminAuth } from './admin';

// Database client (server-only)
export { db, getDbClient, unwrap, unwrapOrNull, DatabaseError } from './database';

// Types
export type {
  SupabaseClient,
  AuthUser,
  SignInCredentials,
  SignUpCredentials,
  PasswordResetRequest,
  PasswordUpdateRequest,
  AuthResponse,
  AuthError,
  SessionWithUser,
  SessionStatus,
  AuthState,
  AuthActions,
  StorageBucket,
  FileUploadOptions,
  FileUploadResponse,
} from './types';

// Re-export User and Session from Supabase
export type { User, Session } from './types';
