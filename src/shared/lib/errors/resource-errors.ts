/**
 * Resource Errors
 *
 * Errors for resource-related failures (not found, conflicts).
 */

import { AppError, type ErrorContext } from './app-error';
import { ErrorCodes, type ErrorCode } from './error-codes';

/**
 * NotFoundError - For resource not found errors
 */
export class NotFoundError extends AppError {
  public readonly resourceType?: string;
  public readonly resourceId?: string;

  constructor(
    message: string = 'Resource not found',
    code: ErrorCode = ErrorCodes.NOT_FOUND,
    context?: ErrorContext & { resourceType?: string; resourceId?: string }
  ) {
    super(message, code, context);
    this.resourceType = context?.resourceType;
    this.resourceId = context?.resourceId;
  }

  /**
   * Create error for resource not found
   */
  static resource(resourceType: string, resourceId?: string): NotFoundError {
    const message = resourceId
      ? `${resourceType} with ID ${resourceId} not found`
      : `${resourceType} not found`;
    return new NotFoundError(message, ErrorCodes.RESOURCE_NOT_FOUND, {
      resourceType,
      resourceId,
    });
  }

  /**
   * Create error for user not found
   */
  static user(userId?: string): NotFoundError {
    return new NotFoundError(
      userId ? `User with ID ${userId} not found` : 'User not found',
      ErrorCodes.USER_NOT_FOUND,
      { resourceType: 'User', resourceId: userId }
    );
  }

  /**
   * Create error for role not found
   */
  static role(roleId?: string): NotFoundError {
    return new NotFoundError(
      roleId ? `Role with ID ${roleId} not found` : 'Role not found',
      ErrorCodes.ROLE_NOT_FOUND,
      { resourceType: 'Role', resourceId: roleId }
    );
  }

  /**
   * Create error for permission not found
   */
  static permission(permissionId?: string): NotFoundError {
    return new NotFoundError(
      permissionId
        ? `Permission with ID ${permissionId} not found`
        : 'Permission not found',
      ErrorCodes.PERMISSION_NOT_FOUND,
      { resourceType: 'Permission', resourceId: permissionId }
    );
  }
}

/**
 * ConflictError - For conflict/duplicate errors
 */
export class ConflictError extends AppError {
  public readonly conflictField?: string;
  public readonly conflictValue?: string;

  constructor(
    message: string = 'Resource conflict',
    code: ErrorCode = ErrorCodes.CONFLICT,
    context?: ErrorContext & { conflictField?: string; conflictValue?: string }
  ) {
    super(message, code, context);
    this.conflictField = context?.conflictField;
    this.conflictValue = context?.conflictValue;
  }

  /**
   * Create error for duplicate entry
   */
  static duplicate(field: string, value?: string): ConflictError {
    const message = value
      ? `A record with ${field} "${value}" already exists`
      : `A record with this ${field} already exists`;
    return new ConflictError(message, ErrorCodes.DUPLICATE_ENTRY, {
      conflictField: field,
      conflictValue: value,
    });
  }

  /**
   * Create error for email already exists
   */
  static emailExists(email?: string): ConflictError {
    return new ConflictError(
      'An account with this email already exists',
      ErrorCodes.EMAIL_ALREADY_EXISTS,
      { conflictField: 'email', conflictValue: email }
    );
  }

  /**
   * Create error for concurrent modification
   */
  static concurrentModification(resource: string): ConflictError {
    return new ConflictError(
      `The ${resource} was modified by another user. Please refresh and try again.`,
      ErrorCodes.CONCURRENT_MODIFICATION,
      { resource }
    );
  }
}
