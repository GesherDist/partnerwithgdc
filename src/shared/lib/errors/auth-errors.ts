/**
 * Authentication & Authorization Errors
 *
 * Errors for authentication and authorization failures.
 */

import { AppError, type ErrorContext } from './app-error';
import { ErrorCodes, type ErrorCode } from './error-codes';

/**
 * AuthenticationError - For authentication failures
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication failed',
    code: ErrorCode = ErrorCodes.AUTHENTICATION_FAILED,
    context?: ErrorContext
  ) {
    super(message, code, context);
  }

  /**
   * Create error for invalid credentials
   */
  static invalidCredentials(): AuthenticationError {
    return new AuthenticationError(
      'Invalid email or password',
      ErrorCodes.INVALID_CREDENTIALS
    );
  }

  /**
   * Create error for expired token
   */
  static tokenExpired(): AuthenticationError {
    return new AuthenticationError(
      'Your session has expired. Please sign in again.',
      ErrorCodes.TOKEN_EXPIRED
    );
  }

  /**
   * Create error for invalid token
   */
  static tokenInvalid(): AuthenticationError {
    return new AuthenticationError(
      'Invalid authentication token',
      ErrorCodes.TOKEN_INVALID
    );
  }

  /**
   * Create error for expired session
   */
  static sessionExpired(): AuthenticationError {
    return new AuthenticationError(
      'Your session has expired. Please sign in again.',
      ErrorCodes.SESSION_EXPIRED
    );
  }

  /**
   * Create error for locked account
   */
  static accountLocked(reason?: string): AuthenticationError {
    return new AuthenticationError(
      reason || 'Your account has been locked. Please contact support.',
      ErrorCodes.ACCOUNT_LOCKED
    );
  }

  /**
   * Create error for disabled account
   */
  static accountDisabled(): AuthenticationError {
    return new AuthenticationError(
      'Your account has been disabled. Please contact support.',
      ErrorCodes.ACCOUNT_DISABLED
    );
  }

  /**
   * Create error for unverified email
   */
  static emailNotVerified(): AuthenticationError {
    return new AuthenticationError(
      'Please verify your email address before signing in.',
      ErrorCodes.EMAIL_NOT_VERIFIED
    );
  }
}

/**
 * AuthorizationError - For authorization/permission failures
 */
export class AuthorizationError extends AppError {
  public readonly requiredPermission?: string;
  public readonly requiredRole?: string;

  constructor(
    message: string = 'Access denied',
    code: ErrorCode = ErrorCodes.AUTHORIZATION_FAILED,
    context?: ErrorContext & { requiredPermission?: string; requiredRole?: string }
  ) {
    super(message, code, context);
    this.requiredPermission = context?.requiredPermission;
    this.requiredRole = context?.requiredRole;
  }

  /**
   * Create error for permission denied
   */
  static permissionDenied(permission?: string): AuthorizationError {
    return new AuthorizationError(
      'You do not have permission to perform this action.',
      ErrorCodes.PERMISSION_DENIED,
      permission ? { requiredPermission: permission } : undefined
    );
  }

  /**
   * Create error for insufficient role
   */
  static insufficientRole(requiredRole: string): AuthorizationError {
    return new AuthorizationError(
      `This action requires ${requiredRole} role or higher.`,
      ErrorCodes.INSUFFICIENT_ROLE,
      { requiredRole }
    );
  }

  /**
   * Create error for resource access denied
   */
  static resourceAccessDenied(resource: string): AuthorizationError {
    return new AuthorizationError(
      `You do not have access to this ${resource}.`,
      ErrorCodes.RESOURCE_ACCESS_DENIED,
      { resource }
    );
  }
}
