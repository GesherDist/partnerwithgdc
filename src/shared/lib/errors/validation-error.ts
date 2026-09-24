/**
 * ValidationError
 *
 * Error for validation failures (form inputs, data validation).
 */

import { AppError, type ErrorContext } from './app-error';
import { ErrorCodes, type ErrorCode } from './error-codes';

/**
 * Field error for form validation
 */
export interface FieldError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * ValidationError - For input/data validation failures
 */
export class ValidationError extends AppError {
  public readonly fields: FieldError[];

  constructor(
    message: string = 'Validation failed',
    fields: FieldError[] = [],
    code: ErrorCode = ErrorCodes.VALIDATION_FAILED,
    context?: ErrorContext
  ) {
    super(message, code, { ...context, fields });
    this.fields = fields;
  }

  /**
   * Create validation error from a single field
   */
  static field(
    field: string,
    message: string,
    value?: unknown
  ): ValidationError {
    return new ValidationError('Validation failed', [
      { field, message, value },
    ]);
  }

  /**
   * Create validation error from multiple fields
   */
  static fields(fields: FieldError[]): ValidationError {
    const message =
      fields.length === 1 && fields[0]
        ? fields[0].message
        : `${fields.length} validation errors occurred`;
    return new ValidationError(message, fields);
  }

  /**
   * Create validation error for missing required field
   */
  static required(fieldName: string): ValidationError {
    return new ValidationError(
      `${fieldName} is required`,
      [{ field: fieldName, message: `${fieldName} is required` }],
      ErrorCodes.MISSING_REQUIRED_FIELD
    );
  }

  /**
   * Create validation error for invalid format
   */
  static invalidFormat(field: string, expectedFormat: string): ValidationError {
    return new ValidationError(
      `${field} has invalid format`,
      [{ field, message: `${field} must be in ${expectedFormat} format` }],
      ErrorCodes.INVALID_FORMAT
    );
  }

  /**
   * Create validation error for invalid email
   */
  static invalidEmail(field: string = 'email'): ValidationError {
    return new ValidationError(
      'Invalid email address',
      [{ field, message: 'Please enter a valid email address' }],
      ErrorCodes.INVALID_EMAIL
    );
  }

  /**
   * Create validation error from Zod errors
   */
  static fromZod(zodError: { errors: Array<{ path: (string | number)[]; message: string }> }): ValidationError {
    const fields: FieldError[] = zodError.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    return ValidationError.fields(fields);
  }

  /**
   * Get error message for a specific field
   */
  getFieldError(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.message;
  }

  /**
   * Check if a specific field has an error
   */
  hasFieldError(field: string): boolean {
    return this.fields.some((f) => f.field === field);
  }
}
