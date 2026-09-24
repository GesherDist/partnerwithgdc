/**
 * API Response Utilities
 *
 * Standardized response helpers for API routes.
 */

import { NextResponse } from 'next/server';

// ============================================
// TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

// ============================================
// SUCCESS RESPONSES
// ============================================

/**
 * Return a successful response with data
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Return a successful response with pagination
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationParams
): NextResponse<ApiResponse<T[]>> {
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return NextResponse.json(
    {
      success: true,
      data,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages,
      },
    },
    { status: 200 }
  );
}

/**
 * Return a created response (201)
 */
export function createdResponse<T>(data: T): NextResponse<ApiResponse<T>> {
  return successResponse(data, 201);
}

/**
 * Return a no content response (204)
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ============================================
// ERROR RESPONSES
// ============================================

/**
 * Return an error response
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: unknown
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

/**
 * Return a bad request error (400)
 */
export function badRequestResponse(
  message: string = 'Bad request',
  details?: unknown
): NextResponse<ApiResponse> {
  return errorResponse('BAD_REQUEST', message, 400, details);
}

/**
 * Return an unauthorized error (401)
 */
export function unauthorizedResponse(
  message: string = 'Unauthorized'
): NextResponse<ApiResponse> {
  return errorResponse('UNAUTHORIZED', message, 401);
}

/**
 * Return a forbidden error (403)
 */
export function forbiddenResponse(
  message: string = 'Forbidden'
): NextResponse<ApiResponse> {
  return errorResponse('FORBIDDEN', message, 403);
}

/**
 * Return a not found error (404)
 */
export function notFoundResponse(
  resource: string = 'Resource'
): NextResponse<ApiResponse> {
  return errorResponse('NOT_FOUND', `${resource} not found`, 404);
}

/**
 * Return a conflict error (409)
 */
export function conflictResponse(
  message: string = 'Resource already exists'
): NextResponse<ApiResponse> {
  return errorResponse('CONFLICT', message, 409);
}

/**
 * Return a validation error (422)
 */
export function validationErrorResponse(
  errors: Record<string, string[]>
): NextResponse<ApiResponse> {
  return errorResponse('VALIDATION_ERROR', 'Validation failed', 422, errors);
}

/**
 * Return an internal server error (500)
 */
export function internalErrorResponse(
  message: string = 'Internal server error'
): NextResponse<ApiResponse> {
  return errorResponse('INTERNAL_ERROR', message, 500);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Parse pagination params from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page: number; limit: number } = { page: 1, limit: 10 }
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || String(defaults.page)));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || String(defaults.limit))));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Parse sort params from URL search params
 */
export function parseSortParams(
  searchParams: URLSearchParams,
  allowedFields: string[],
  defaultSort: { field: string; order: 'asc' | 'desc' } = { field: 'createdAt', order: 'desc' }
): { field: string; order: 'asc' | 'desc' } {
  const sortBy = searchParams.get('sortBy');
  const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | null;

  const field = sortBy && allowedFields.includes(sortBy) ? sortBy : defaultSort.field;
  const order = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : defaultSort.order;

  return { field, order };
}
