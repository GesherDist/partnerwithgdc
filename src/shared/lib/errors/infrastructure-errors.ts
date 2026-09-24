/**
 * Infrastructure Errors
 *
 * Errors for database, network, and system failures.
 */

import { AppError, type ErrorContext } from './app-error';
import { ErrorCodes, type ErrorCode } from './error-codes';

/**
 * DatabaseError - For database operation failures
 */
export class DatabaseError extends AppError {
  public readonly operation?: string;
  public readonly table?: string;

  constructor(
    message: string = 'Database operation failed',
    code: ErrorCode = ErrorCodes.DATABASE_ERROR,
    context?: ErrorContext & { operation?: string; table?: string }
  ) {
    // Database errors are not operational - they indicate system issues
    super(message, code, context, false);
    this.operation = context?.operation;
    this.table = context?.table;
  }

  /**
   * Create error for connection failure
   */
  static connectionFailed(details?: string): DatabaseError {
    return new DatabaseError(
      'Unable to connect to the database',
      ErrorCodes.CONNECTION_FAILED,
      details ? { details } : undefined
    );
  }

  /**
   * Create error for query failure
   */
  static queryFailed(operation: string, table?: string): DatabaseError {
    return new DatabaseError(
      `Database query failed: ${operation}`,
      ErrorCodes.QUERY_FAILED,
      { operation, table }
    );
  }

  /**
   * Create error for transaction failure
   */
  static transactionFailed(reason?: string): DatabaseError {
    return new DatabaseError(
      reason || 'Database transaction failed',
      ErrorCodes.TRANSACTION_FAILED
    );
  }

  /**
   * Create error for constraint violation
   */
  static constraintViolation(constraint: string): DatabaseError {
    return new DatabaseError(
      `Database constraint violation: ${constraint}`,
      ErrorCodes.CONSTRAINT_VIOLATION,
      { constraint }
    );
  }

  /**
   * Create error from Prisma error
   */
  static fromPrisma(error: { code?: string; meta?: { target?: string[] }; message?: string }): DatabaseError | ConflictError | NotFoundError {
    const { code, meta } = error;

    // Handle specific Prisma error codes
    switch (code) {
      case 'P2002': // Unique constraint violation
        const field = meta?.target?.[0] || 'field';
        return new ConflictError(
          `A record with this ${field} already exists`,
          ErrorCodes.DUPLICATE_ENTRY,
          { conflictField: field }
        );

      case 'P2025': // Record not found
        return new NotFoundError(
          'Record not found',
          ErrorCodes.NOT_FOUND
        );

      case 'P2003': // Foreign key constraint violation
        return new DatabaseError(
          'Referenced record does not exist',
          ErrorCodes.CONSTRAINT_VIOLATION
        );

      default:
        return new DatabaseError(
          error.message || 'Database operation failed',
          ErrorCodes.DATABASE_ERROR
        );
    }
  }
}

// Import for fromPrisma method
import { ConflictError, NotFoundError } from './resource-errors';

/**
 * NetworkError - For network/API call failures
 */
export class NetworkError extends AppError {
  public readonly url?: string;
  public readonly method?: string;
  public readonly responseStatus?: number;

  constructor(
    message: string = 'Network request failed',
    code: ErrorCode = ErrorCodes.NETWORK_ERROR,
    context?: ErrorContext & { url?: string; method?: string; responseStatus?: number }
  ) {
    super(message, code, context);
    this.url = context?.url;
    this.method = context?.method;
    this.responseStatus = context?.responseStatus;
  }

  /**
   * Create error for connection timeout
   */
  static timeout(url?: string): NetworkError {
    return new NetworkError(
      'Request timed out. Please try again.',
      ErrorCodes.CONNECTION_TIMEOUT,
      { url }
    );
  }

  /**
   * Create error for request failure
   */
  static requestFailed(
    url: string,
    method: string,
    status?: number
  ): NetworkError {
    return new NetworkError(
      `Request to ${url} failed`,
      ErrorCodes.REQUEST_FAILED,
      { url, method, responseStatus: status }
    );
  }

  /**
   * Create error for external service failure
   */
  static externalServiceError(
    service: string,
    details?: string
  ): NetworkError {
    return new NetworkError(
      `External service error: ${service}${details ? ` - ${details}` : ''}`,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      { service }
    );
  }
}
