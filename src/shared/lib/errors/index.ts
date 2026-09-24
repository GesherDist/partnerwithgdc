/**
 * Errors Module
 *
 * Centralized error classes and utilities for the application.
 */

import { AppError as AppErrorClass } from './app-error';

// Error codes
export {
  ErrorCodes,
  ErrorHttpStatus,
  getHttpStatus,
  type ErrorCode,
} from './error-codes';

// Base error
export {
  AppError,
  type ErrorContext,
  type SerializedError,
} from './app-error';

// Validation errors
export {
  ValidationError,
  type FieldError,
} from './validation-error';

// Auth errors
export {
  AuthenticationError,
  AuthorizationError,
} from './auth-errors';

// Resource errors
export {
  NotFoundError,
  ConflictError,
} from './resource-errors';

// Infrastructure errors
export {
  DatabaseError,
  NetworkError,
} from './infrastructure-errors';

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppErrorClass {
  return AppErrorClass.isAppError(error);
}

/**
 * Convert any error to AppError
 */
export function toAppError(error: unknown, defaultMessage?: string): AppErrorClass {
  return AppErrorClass.from(error, defaultMessage);
}

/**
 * Get a user-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppErrorClass) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}
