/**
 * Error Codes
 *
 * Standardized error codes for the application.
 * Used for consistent error handling and client-side error mapping.
 */

export const ErrorCodes = {
  // General Errors (1000-1099)
  UNKNOWN: 'ERR_1000',
  INTERNAL_SERVER: 'ERR_1001',
  SERVICE_UNAVAILABLE: 'ERR_1002',
  TIMEOUT: 'ERR_1003',
  RATE_LIMITED: 'ERR_1004',

  // Validation Errors (1100-1199)
  VALIDATION_FAILED: 'ERR_1100',
  INVALID_INPUT: 'ERR_1101',
  MISSING_REQUIRED_FIELD: 'ERR_1102',
  INVALID_FORMAT: 'ERR_1103',
  VALUE_OUT_OF_RANGE: 'ERR_1104',
  INVALID_EMAIL: 'ERR_1105',
  INVALID_PHONE: 'ERR_1106',
  INVALID_DATE: 'ERR_1107',
  INVALID_UUID: 'ERR_1108',

  // Authentication Errors (1200-1299)
  AUTHENTICATION_FAILED: 'ERR_1200',
  INVALID_CREDENTIALS: 'ERR_1201',
  TOKEN_EXPIRED: 'ERR_1202',
  TOKEN_INVALID: 'ERR_1203',
  SESSION_EXPIRED: 'ERR_1204',
  ACCOUNT_LOCKED: 'ERR_1205',
  ACCOUNT_DISABLED: 'ERR_1206',
  EMAIL_NOT_VERIFIED: 'ERR_1207',
  PASSWORD_RESET_REQUIRED: 'ERR_1208',

  // Authorization Errors (1300-1399)
  AUTHORIZATION_FAILED: 'ERR_1300',
  PERMISSION_DENIED: 'ERR_1301',
  INSUFFICIENT_ROLE: 'ERR_1302',
  RESOURCE_ACCESS_DENIED: 'ERR_1303',

  // Resource Errors (1400-1499)
  NOT_FOUND: 'ERR_1400',
  USER_NOT_FOUND: 'ERR_1401',
  ROLE_NOT_FOUND: 'ERR_1402',
  PERMISSION_NOT_FOUND: 'ERR_1403',
  RESOURCE_NOT_FOUND: 'ERR_1404',

  // Conflict Errors (1500-1599)
  CONFLICT: 'ERR_1500',
  DUPLICATE_ENTRY: 'ERR_1501',
  EMAIL_ALREADY_EXISTS: 'ERR_1502',
  USERNAME_ALREADY_EXISTS: 'ERR_1503',
  RESOURCE_ALREADY_EXISTS: 'ERR_1504',
  CONCURRENT_MODIFICATION: 'ERR_1505',

  // Database Errors (1600-1699)
  DATABASE_ERROR: 'ERR_1600',
  CONNECTION_FAILED: 'ERR_1601',
  QUERY_FAILED: 'ERR_1602',
  TRANSACTION_FAILED: 'ERR_1603',
  CONSTRAINT_VIOLATION: 'ERR_1604',

  // Network Errors (1700-1799)
  NETWORK_ERROR: 'ERR_1700',
  CONNECTION_TIMEOUT: 'ERR_1701',
  REQUEST_FAILED: 'ERR_1702',
  EXTERNAL_SERVICE_ERROR: 'ERR_1703',

  // File Errors (1800-1899)
  FILE_ERROR: 'ERR_1800',
  FILE_NOT_FOUND: 'ERR_1801',
  FILE_TOO_LARGE: 'ERR_1802',
  INVALID_FILE_TYPE: 'ERR_1803',
  UPLOAD_FAILED: 'ERR_1804',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * HTTP Status code mapping for error codes
 */
export const ErrorHttpStatus: Record<string, number> = {
  // General
  [ErrorCodes.UNKNOWN]: 500,
  [ErrorCodes.INTERNAL_SERVER]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.TIMEOUT]: 504,
  [ErrorCodes.RATE_LIMITED]: 429,

  // Validation
  [ErrorCodes.VALIDATION_FAILED]: 400,
  [ErrorCodes.INVALID_INPUT]: 400,
  [ErrorCodes.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCodes.INVALID_FORMAT]: 400,
  [ErrorCodes.VALUE_OUT_OF_RANGE]: 400,
  [ErrorCodes.INVALID_EMAIL]: 400,
  [ErrorCodes.INVALID_PHONE]: 400,
  [ErrorCodes.INVALID_DATE]: 400,
  [ErrorCodes.INVALID_UUID]: 400,

  // Authentication
  [ErrorCodes.AUTHENTICATION_FAILED]: 401,
  [ErrorCodes.INVALID_CREDENTIALS]: 401,
  [ErrorCodes.TOKEN_EXPIRED]: 401,
  [ErrorCodes.TOKEN_INVALID]: 401,
  [ErrorCodes.SESSION_EXPIRED]: 401,
  [ErrorCodes.ACCOUNT_LOCKED]: 403,
  [ErrorCodes.ACCOUNT_DISABLED]: 403,
  [ErrorCodes.EMAIL_NOT_VERIFIED]: 403,
  [ErrorCodes.PASSWORD_RESET_REQUIRED]: 403,

  // Authorization
  [ErrorCodes.AUTHORIZATION_FAILED]: 403,
  [ErrorCodes.PERMISSION_DENIED]: 403,
  [ErrorCodes.INSUFFICIENT_ROLE]: 403,
  [ErrorCodes.RESOURCE_ACCESS_DENIED]: 403,

  // Resource
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.USER_NOT_FOUND]: 404,
  [ErrorCodes.ROLE_NOT_FOUND]: 404,
  [ErrorCodes.PERMISSION_NOT_FOUND]: 404,
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,

  // Conflict
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.DUPLICATE_ENTRY]: 409,
  [ErrorCodes.EMAIL_ALREADY_EXISTS]: 409,
  [ErrorCodes.USERNAME_ALREADY_EXISTS]: 409,
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCodes.CONCURRENT_MODIFICATION]: 409,

  // Database
  [ErrorCodes.DATABASE_ERROR]: 500,
  [ErrorCodes.CONNECTION_FAILED]: 500,
  [ErrorCodes.QUERY_FAILED]: 500,
  [ErrorCodes.TRANSACTION_FAILED]: 500,
  [ErrorCodes.CONSTRAINT_VIOLATION]: 400,

  // Network
  [ErrorCodes.NETWORK_ERROR]: 502,
  [ErrorCodes.CONNECTION_TIMEOUT]: 504,
  [ErrorCodes.REQUEST_FAILED]: 502,
  [ErrorCodes.EXTERNAL_SERVICE_ERROR]: 502,

  // File
  [ErrorCodes.FILE_ERROR]: 500,
  [ErrorCodes.FILE_NOT_FOUND]: 404,
  [ErrorCodes.FILE_TOO_LARGE]: 413,
  [ErrorCodes.INVALID_FILE_TYPE]: 415,
  [ErrorCodes.UPLOAD_FAILED]: 500,
};

/**
 * Get HTTP status code for an error code
 */
export function getHttpStatus(code: string): number {
  return ErrorHttpStatus[code] ?? 500;
}
