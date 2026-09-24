/**
 * Supabase Type Definitions
 *
 * Type definitions for Supabase client and auth.
 */

import type { SupabaseClient as BaseSupabaseClient } from '@supabase/supabase-js';
import type { User, Session } from '@supabase/supabase-js';

// ============================================
// CLIENT TYPES
// ============================================

/**
 * Supabase client type
 * Using generic Database type - can be extended with generated types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SupabaseClient = BaseSupabaseClient<any, 'public', any>;

// ============================================
// AUTH TYPES
// ============================================

/**
 * Re-export Supabase auth types
 */
export type { User, Session };

/**
 * Auth user with metadata
 */
export interface AuthUser extends User {
  user_metadata: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

/**
 * Sign in credentials
 */
export interface SignInCredentials {
  email: string;
  password: string;
}

/**
 * Sign up credentials
 */
export interface SignUpCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password update request
 */
export interface PasswordUpdateRequest {
  password: string;
}

/**
 * Auth response type
 */
export interface AuthResponse<T = unknown> {
  data: T | null;
  error: AuthError | null;
}

/**
 * Auth error type
 */
export interface AuthError {
  message: string;
  status?: number;
  code?: string;
}

// ============================================
// SESSION TYPES
// ============================================

/**
 * Session with user
 */
export interface SessionWithUser {
  session: Session;
  user: User;
}

/**
 * Session status
 */
export type SessionStatus = 'authenticated' | 'unauthenticated' | 'loading';

// ============================================
// AUTH STATE TYPES
// ============================================

/**
 * Auth state for client-side state management
 */
export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
}

/**
 * Auth actions for state management
 */
export interface AuthActions {
  signIn: (credentials: SignInCredentials) => Promise<AuthResponse<Session>>;
  signOut: () => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<AuthResponse<User>>;
  resetPassword: (email: string) => Promise<AuthResponse<void>>;
  updatePassword: (password: string) => Promise<AuthResponse<User>>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

// ============================================
// STORAGE TYPES
// ============================================

/**
 * Storage bucket names
 */
export type StorageBucket = 'avatars' | 'attachments' | 'documents';

/**
 * File upload options
 */
export interface FileUploadOptions {
  bucket: StorageBucket;
  path: string;
  file: File;
  upsert?: boolean;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  path: string;
  publicUrl: string;
}
