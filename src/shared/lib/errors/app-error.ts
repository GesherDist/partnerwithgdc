/**
 * AppError - Base Error Class
 *
 * Base class for all application errors.
 * Provides consistent error structure and serialization.
 */

import { ErrorCodes, type ErrorCode, getHttpStatus } from './error-codes';

/**
 * Error context for additional metadata
 */
export interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Serialized error format for API responses
 */
export interface SerializedError {
  name: string;
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  context?: ErrorContext;
  stack?: string;
}

/**
 * AppError - Base application error
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly timestamp: Date;
  public readonly context?: ErrorContext;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.UNKNOWN,
    context?: ErrorContext,
    isOperational: boolean = true
  ) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = getHttpStatus(code);
    this.timestamp = new Date();
    this.context = context;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize error for API response
   */
  toJSON(includeStack: boolean = false): SerializedError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(this.context && { context: this.context }),
      ...(includeStack && { stack: this.stack }),
    };
  }

  /**
   * Create error from unknown error type
   */
  static from(error: unknown, defaultMessage?: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(
        error.message || defaultMessage || 'An unexpected error occurred',
        ErrorCodes.UNKNOWN,
        { originalError: error.name }
      );
    }

    if (typeof error === 'string') {
      return new AppError(error, ErrorCodes.UNKNOWN);
    }

    return new AppError(
      defaultMessage || 'An unexpected error occurred',
      ErrorCodes.UNKNOWN,
      { originalError: String(error) }
    );
  }

  /**
   * Check if error is an AppError
   */
  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError;
  }

  /**
   * Check if error is operational (expected) or programming error
   */
  static isOperationalError(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }
}
