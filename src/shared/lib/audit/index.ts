/**
 * Audit Module
 *
 * Provides audit logging and tracking for all entity changes.
 */

// Types
export type {
  AuditAction,
  AuditEntry,
  CreateAuditEntry,
  AuditQueryOptions,
  PaginatedAuditResult,
  AuditContext,
  AuditServiceConfig,
} from './types';

// Service
export {
  auditService,
  AuditServiceImpl,
} from './audit-service';
