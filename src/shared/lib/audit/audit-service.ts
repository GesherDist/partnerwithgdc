/**
 * Audit Service
 *
 * Service for logging and querying audit entries.
 * Tracks all entity changes for compliance and debugging.
 */

import { db } from '@/shared/lib/supabase/database';
import { logger } from '@/shared/lib/logger';
import type {
  AuditAction,
  AuditEntry,
  CreateAuditEntry,
  AuditQueryOptions,
  PaginatedAuditResult,
  AuditContext,
  AuditServiceConfig,
} from './types';

/**
 * Database row type
 */
interface DbAuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  module: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  old_data: unknown;
  new_data: unknown;
  changes: unknown;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: unknown;
  created_at: string;
}

/**
 * Default fields to exclude from audit logs (sensitive data)
 */
const DEFAULT_EXCLUDE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'refreshToken',
  'secret',
  'apiKey',
  'privateKey',
];

/**
 * AuditService class for logging and querying audits
 */
class AuditServiceImpl {
  private config: Required<AuditServiceConfig>;

  constructor(config: AuditServiceConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      excludeFields: config.excludeFields ?? DEFAULT_EXCLUDE_FIELDS,
      logToConsole: config.logToConsole ?? process.env.NODE_ENV === 'development',
    };
  }

  /**
   * Configure the audit service
   */
  configure(config: Partial<AuditServiceConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Sanitize values by removing sensitive fields
   */
  private sanitizeValues(values?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!values) {return undefined;}

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (this.config.excludeFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeValues(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Get changed fields between two objects
   */
  private getChanges(
    previous?: Record<string, unknown>,
    current?: Record<string, unknown>
  ): Record<string, { from: unknown; to: unknown }> | undefined {
    if (!previous || !current) {return undefined;}

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);

    for (const key of allKeys) {
      const prevValue = previous[key];
      const currValue = current[key];
      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        changes[key] = { from: prevValue, to: currValue };
      }
    }

    return Object.keys(changes).length > 0 ? changes : undefined;
  }

  /**
   * Log an audit entry
   */
  async log(entry: CreateAuditEntry): Promise<AuditEntry | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const sanitizedEntry = {
        ...entry,
        oldData: this.sanitizeValues(entry.oldData),
        newData: this.sanitizeValues(entry.newData),
      };

      // Calculate changes if not provided
      if (!sanitizedEntry.changes && entry.action === 'update') {
        sanitizedEntry.changes = this.getChanges(entry.oldData, entry.newData);
      }

      // Log to console in development
      if (this.config.logToConsole) {
        logger.debug('Audit entry', {
          module: sanitizedEntry.module,
          entityType: sanitizedEntry.entityType,
          entityId: sanitizedEntry.entityId,
          action: sanitizedEntry.action,
          userId: sanitizedEntry.userId,
        });
      }

      // Store in database
      const { data: auditLog, error } = await db
        .from('audit_logs')
        .insert({
          user_id: sanitizedEntry.userId ?? null,
          user_email: sanitizedEntry.userEmail ?? null,
          user_name: sanitizedEntry.userName ?? null,
          action: sanitizedEntry.action,
          module: sanitizedEntry.module,
          description: sanitizedEntry.description ?? null,
          entity_type: sanitizedEntry.entityType ?? null,
          entity_id: sanitizedEntry.entityId ?? null,
          old_data: sanitizedEntry.oldData ?? null,
          new_data: sanitizedEntry.newData ?? null,
          changes: sanitizedEntry.changes ?? null,
          ip_address: sanitizedEntry.ipAddress ?? null,
          user_agent: sanitizedEntry.userAgent ?? null,
          request_id: sanitizedEntry.requestId ?? null,
          metadata: sanitizedEntry.metadata ?? null,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapAuditLog(auditLog as DbAuditLog);
    } catch (error) {
      // Don't fail operations due to audit logging failures
      logger.error('Failed to create audit log', error as Error, {
        module: entry.module,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
      });
      return null;
    }
  }

  /**
   * Map database row to AuditEntry
   */
  private mapAuditLog(log: DbAuditLog): AuditEntry {
    return {
      id: log.id,
      userId: log.user_id ?? undefined,
      userEmail: log.user_email ?? undefined,
      userName: log.user_name ?? undefined,
      action: log.action as AuditAction,
      module: log.module,
      description: log.description ?? undefined,
      entityType: log.entity_type ?? undefined,
      entityId: log.entity_id ?? undefined,
      oldData: log.old_data as Record<string, unknown> | undefined,
      newData: log.new_data as Record<string, unknown> | undefined,
      changes: log.changes as Record<string, unknown> | undefined,
      ipAddress: log.ip_address ?? undefined,
      userAgent: log.user_agent ?? undefined,
      requestId: log.request_id ?? undefined,
      metadata: log.metadata as Record<string, unknown> | undefined,
      createdAt: new Date(log.created_at),
    };
  }

  /**
   * Log entity creation
   */
  async logCreate(
    module: string,
    entityType: string,
    entityId: string,
    newData: Record<string, unknown>,
    context?: AuditContext,
    description?: string
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'create',
      module,
      entityType,
      entityId,
      newData,
      description: description ?? `Created ${entityType}`,
      ...context,
    });
  }

  /**
   * Log entity update
   */
  async logUpdate(
    module: string,
    entityType: string,
    entityId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    context?: AuditContext,
    description?: string
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'update',
      module,
      entityType,
      entityId,
      oldData,
      newData,
      description: description ?? `Updated ${entityType}`,
      ...context,
    });
  }

  /**
   * Log entity deletion
   */
  async logDelete(
    module: string,
    entityType: string,
    entityId: string,
    oldData: Record<string, unknown>,
    context?: AuditContext,
    description?: string
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'delete',
      module,
      entityType,
      entityId,
      oldData,
      description: description ?? `Deleted ${entityType}`,
      ...context,
    });
  }

  /**
   * Log entity restoration
   */
  async logRestore(
    module: string,
    entityType: string,
    entityId: string,
    context?: AuditContext,
    description?: string
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'restore',
      module,
      entityType,
      entityId,
      description: description ?? `Restored ${entityType}`,
      ...context,
    });
  }

  /**
   * Log user login
   */
  async logLogin(
    userId: string,
    context?: AuditContext
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'login',
      module: 'auth',
      entityType: 'User',
      entityId: userId,
      userId,
      description: 'User logged in',
      ...context,
    });
  }

  /**
   * Log user logout
   */
  async logLogout(
    userId: string,
    context?: AuditContext
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'logout',
      module: 'auth',
      entityType: 'User',
      entityId: userId,
      userId,
      description: 'User logged out',
      ...context,
    });
  }

  /**
   * Log password change
   */
  async logPasswordChange(
    userId: string,
    context?: AuditContext
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'password_change',
      module: 'auth',
      entityType: 'User',
      entityId: userId,
      userId,
      description: 'Password changed',
      ...context,
    });
  }

  /**
   * Log role assignment
   */
  async logRoleAssign(
    userId: string,
    roleId: string,
    roleName: string,
    context?: AuditContext
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'role_assign',
      module: 'auth',
      entityType: 'User',
      entityId: userId,
      newData: { roleId, roleName },
      description: `Assigned role: ${roleName}`,
      ...context,
    });
  }

  /**
   * Log data export
   */
  async logExport(
    module: string,
    entityType: string,
    metadata: Record<string, unknown>,
    context?: AuditContext
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'export',
      module,
      entityType,
      metadata,
      description: `Exported ${entityType} data`,
      ...context,
    });
  }

  /**
   * Log data import
   */
  async logImport(
    module: string,
    entityType: string,
    metadata: Record<string, unknown>,
    context?: AuditContext
  ): Promise<AuditEntry | null> {
    return this.log({
      action: 'import',
      module,
      entityType,
      metadata,
      description: `Imported ${entityType} data`,
      ...context,
    });
  }

  /**
   * Query audit entries
   */
  async query(options: AuditQueryOptions = {}): Promise<PaginatedAuditResult> {
    const {
      entityType,
      entityId,
      module,
      action,
      userId,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
      sortOrder = 'desc',
    } = options;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('audit_logs')
      .select('*', { count: 'exact' });

    // Apply filters
    if (entityType) {query = query.eq('entity_type', entityType);}
    if (entityId) {query = query.eq('entity_id', entityId);}
    if (module) {query = query.eq('module', module);}
    if (action) {query = query.eq('action', action);}
    if (userId) {query = query.eq('user_id', userId);}
    if (fromDate) {query = query.gte('created_at', fromDate.toISOString());}
    if (toDate) {query = query.lte('created_at', toDate.toISOString());}

    // Apply sorting and pagination
    query = query
      .order('created_at', { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to query audit logs: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((log) => this.mapAuditLog(log as DbAuditLog)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get audit history for an entity
   */
  async getEntityHistory(
    entityType: string,
    entityId: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedAuditResult> {
    return this.query({
      entityType,
      entityId,
      ...options,
    });
  }

  /**
   * Get audit history for a user
   */
  async getUserHistory(
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedAuditResult> {
    return this.query({
      userId,
      ...options,
    });
  }

  /**
   * Get audit history for a module
   */
  async getModuleHistory(
    module: string,
    options?: { page?: number; limit?: number }
  ): Promise<PaginatedAuditResult> {
    return this.query({
      module,
      ...options,
    });
  }
}

// Export singleton instance
export const auditService = new AuditServiceImpl();

// Export class for custom instances
export { AuditServiceImpl };
