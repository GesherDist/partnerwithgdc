/**
 * Audit Logs Module - TypeScript Types
 */

/**
 * Audit action enum (matches database)
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

// ============================================
// BASE TYPES
// ============================================

/**
 * Audit log entity type (from database)
 */
export interface AuditLog {
  id: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  action: AuditAction;
  module: string;
  description: string | null;
  entityType: string | null;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ============================================
// QUERY TYPES
// ============================================

/**
 * Audit log list query parameters
 */
export interface AuditLogListParams {
  page?: number;
  limit?: number;
  search?: string;
  action?: AuditAction;
  module?: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Audit log list response
 */
export interface AuditLogListResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Action options for select inputs
 */
export const AUDIT_ACTION_OPTIONS = [
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'restore', label: 'Restore' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'password_change', label: 'Password Change' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'role_assign', label: 'Role Assign' },
  { value: 'permission_grant', label: 'Permission Grant' },
  { value: 'permission_revoke', label: 'Permission Revoke' },
  { value: 'export', label: 'Export' },
  { value: 'import', label: 'Import' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
] as const;

/**
 * Module options for filtering
 */
export const AUDIT_MODULE_OPTIONS = [
  { value: 'users', label: 'Users' },
  { value: 'roles', label: 'Roles' },
  { value: 'customers', label: 'Customers' },
  { value: 'products', label: 'Products' },
  { value: 'sales_orders', label: 'Sales Orders' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'integrations', label: 'Integrations' },
  { value: 'auth', label: 'Authentication' },
] as const;

/**
 * Get display label for action
 */
export function getActionLabel(action: AuditAction): string {
  const option = AUDIT_ACTION_OPTIONS.find((opt) => opt.value === action);
  return option?.label || action;
}

/**
 * Get display label for module
 */
export function getModuleLabel(module: string): string {
  const option = AUDIT_MODULE_OPTIONS.find((opt) => opt.value === module);
  return option?.label || module;
}
