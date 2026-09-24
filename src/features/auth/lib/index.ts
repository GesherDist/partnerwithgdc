/**
 * Auth Lib Index
 *
 * Central export point for auth utilities and schemas.
 */

// Schemas
export {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  type LoginFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
  type ChangePasswordFormData,
} from './schemas';

// Constants
export {
  SESSION_DURATION,
  REMEMBER_ME_DURATION,
  DEFAULT_SESSION_DURATION,
  SESSION_REFRESH_THRESHOLD,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_RESET_TOKEN_EXPIRY,
  PASSWORD_REGEX,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION,
  RATE_LIMIT_WINDOW,
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  DEFAULT_LOGIN_REDIRECT,
  DEFAULT_LOGOUT_REDIRECT,
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  AUTH_COOKIES,
  AUTH_STORAGE_KEYS,
} from './constants';
