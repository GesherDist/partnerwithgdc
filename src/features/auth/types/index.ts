/**
 * Auth Types
 *
 * Type definitions for the authentication module.
 */

import type { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

// ============================================
// USER TYPES
// ============================================

/**
 * Supabase user (re-export for convenience)
 */
export type AuthUser = SupabaseUser;

/**
 * Supabase session (re-export for convenience)
 */
export type AuthSession = SupabaseSession;

/**
 * Application user with extended profile
 */
export interface AppUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  status: UserStatus;
  role: UserRole | null;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/**
 * User status enum
 */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

/**
 * User role
 */
export interface UserRole {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
}

/**
 * User permission
 */
export interface UserPermission {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  resource: string;
  action: string;
}

// ============================================
// AUTH STATE TYPES
// ============================================

/**
 * Authentication state
 */
export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  appUser: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AuthError | null;
}

/**
 * Auth error
 */
export interface AuthError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// AUTH ACTION TYPES
// ============================================

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login result
 */
export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  session?: AuthSession;
  error?: AuthError;
}

/**
 * Logout result
 */
export interface LogoutResult {
  success: boolean;
  error?: AuthError;
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password reset result
 */
export interface PasswordResetResult {
  success: boolean;
  error?: AuthError;
}

/**
 * Password update request
 */
export interface PasswordUpdateRequest {
  password: string;
  confirmPassword: string;
}

/**
 * Password update result
 */
export interface PasswordUpdateResult {
  success: boolean;
  error?: AuthError;
}

/**
 * Password change request (for authenticated users)
 */
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// ============================================
// SESSION TYPES
// ============================================

/**
 * Session info
 */
export interface SessionInfo {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  valid: boolean;
  session?: AuthSession;
  user?: AuthUser;
  error?: AuthError;
}

// ============================================
// TOKEN TYPES
// ============================================

/**
 * Token payload
 */
export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  payload?: TokenPayload;
  error?: AuthError;
}

// ============================================
// PROVIDER TYPES
// ============================================

/**
 * OAuth provider
 */
export type OAuthProvider = 'google' | 'github' | 'azure';

/**
 * OAuth login options
 */
export interface OAuthLoginOptions {
  provider: OAuthProvider;
  redirectTo?: string;
  scopes?: string[];
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Auth action response (generic)
 */
export interface AuthActionResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server action result (for Next.js server actions)
 */
export type ServerActionResult<T = void> = Promise<AuthActionResponse<T>>;
