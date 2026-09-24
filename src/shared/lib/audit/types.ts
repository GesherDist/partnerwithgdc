/**
 * Audit Module Types
 *
 * Types for audit logging and tracking entity changes.
 */

/**
 * Audit action types - matches Prisma AuditAction enum
 */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'login'
  | 'logout'
  | 'password_change'
  | 'password_reset'
  | 'role_assign'
  | 'permission_grant'
  | 'permission_revoke'
  | 'export'
  | 'import'
  | 'approve'
  | 'reject';

/**
 * Audit entry for tracking entity changes
 */
export interface AuditEntry {
  /** Unique identifier */
  id: string;
  /** User ID who performed the action */
  userId?: string;
  /** User email for reference */
  userEmail?: string;
  /** User name for display */
  userName?: string;
  /** Action performed */
  action: AuditAction;
  /** Module where action occurred */
  module: string;
  /** Description of the action */
  description?: string;
  /** Entity type (e.g., 'User', 'Product', 'Order') */
  entityType?: string;
  /** Entity ID being audited */
  entityId?: string;
  /** Previous values (for updates/deletes) */
  oldData?: Record<string, unknown>;
  /** New values (for creates/updates) */
  newData?: Record<string, unknown>;
  /** Change details */
  changes?: Record<string, unknown>;
  /** IP address of the request */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp of the action */
  createdAt: Date;
}

/**
 * Audit entry creation data
 */
export interface CreateAuditEntry {
  userId?: string;
  userEmail?: string;
  userName?: string;
  action: AuditAction;
  module: string;
  description?: string;
  entityType?: string;
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  /** Filter by entity type */
  entityType?: string;
  /** Filter by entity ID */
  entityId?: string;
  /** Filter by module */
  module?: string;
  /** Filter by action */
  action?: AuditAction;
  /** Filter by user ID */
  userId?: string;
  /** Filter by date range start */
  fromDate?: Date;
  /** Filter by date range end */
  toDate?: Date;
  /** Page number */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated audit results
 */
export interface PaginatedAuditResult {
  data: AuditEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Audit context for tracking
 */
export interface AuditContext {
  userId?: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Configuration for audit service
 */
export interface AuditServiceConfig {
  /** Enable audit logging */
  enabled?: boolean;
  /** Fields to exclude from logging (sensitive data) */
  excludeFields?: string[];
  /** Log to console (development) */
  logToConsole?: boolean;
}
