/**
 * Auth Constants
 *
 * Authentication-related constants used throughout the auth module.
 */

// ============================================
// SESSION
// ============================================

/** Session duration in seconds (30 days) */
export const SESSION_DURATION = 30 * 24 * 60 * 60;

/** Remember me session duration in seconds (30 days) */
export const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60;

/** Default session duration in seconds (24 hours) */
export const DEFAULT_SESSION_DURATION = 24 * 60 * 60;

/** Session refresh threshold in seconds (5 minutes before expiry) */
export const SESSION_REFRESH_THRESHOLD = 5 * 60;

// ============================================
// PASSWORD
// ============================================

/** Minimum password length */
export const PASSWORD_MIN_LENGTH = 8;

/** Maximum password length */
export const PASSWORD_MAX_LENGTH = 128;

/** Password reset token expiry in seconds (1 hour) */
export const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60;

/** Password requirements regex */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// ============================================
// RATE LIMITING
// ============================================

/** Maximum login attempts before lockout */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Lockout duration in seconds (15 minutes) */
export const LOCKOUT_DURATION = 15 * 60;

/** Rate limit window in seconds (1 minute) */
export const RATE_LIMIT_WINDOW = 60;

// ============================================
// ROUTES
// ============================================

/** Public routes that don't require authentication */
export const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/forgot-password',
  '/reset-password',
] as const;

/** Auth routes (redirect to dashboard if authenticated) */
export const AUTH_ROUTES = [
  '/login',
  '/forgot-password',
  '/reset-password',
] as const;

/** Default redirect after login */
export const DEFAULT_LOGIN_REDIRECT = '/dashboard';

/** Default redirect after logout */
export const DEFAULT_LOGOUT_REDIRECT = '/login';

// ============================================
// ERROR CODES
// ============================================

export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  USER_DISABLED: 'AUTH_USER_DISABLED',
  EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  TOO_MANY_ATTEMPTS: 'AUTH_TOO_MANY_ATTEMPTS',
  WEAK_PASSWORD: 'AUTH_WEAK_PASSWORD',
  PASSWORD_MISMATCH: 'AUTH_PASSWORD_MISMATCH',
  UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  FORBIDDEN: 'AUTH_FORBIDDEN',
} as const;

// ============================================
// ERROR MESSAGES
// ============================================

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: 'Invalid email or password. Please try again.',
  [AUTH_ERROR_CODES.USER_NOT_FOUND]: 'No account found with this email address.',
  [AUTH_ERROR_CODES.USER_DISABLED]: 'Your account has been disabled. Please contact support.',
  [AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED]: 'Please verify your email before signing in.',
  [AUTH_ERROR_CODES.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [AUTH_ERROR_CODES.INVALID_TOKEN]: 'Invalid or malformed token.',
  [AUTH_ERROR_CODES.TOKEN_EXPIRED]: 'This link has expired. Please request a new one.',
  [AUTH_ERROR_CODES.TOO_MANY_ATTEMPTS]: 'Too many attempts. Please try again later.',
  [AUTH_ERROR_CODES.WEAK_PASSWORD]: 'Password is too weak. Please choose a stronger password.',
  [AUTH_ERROR_CODES.PASSWORD_MISMATCH]: 'Passwords do not match.',
  [AUTH_ERROR_CODES.UNAUTHORIZED]: 'You must be signed in to access this resource.',
  [AUTH_ERROR_CODES.FORBIDDEN]: 'You do not have permission to access this resource.',
};

// ============================================
// COOKIE NAMES
// ============================================

export const AUTH_COOKIES = {
  ACCESS_TOKEN: 'sb-access-token',
  REFRESH_TOKEN: 'sb-refresh-token',
  SESSION: 'sb-session',
} as const;

// ============================================
// STORAGE KEYS
// ============================================

export const AUTH_STORAGE_KEYS = {
  USER: 'auth-user',
  SESSION: 'auth-session',
  REDIRECT_URL: 'auth-redirect-url',
} as const;
