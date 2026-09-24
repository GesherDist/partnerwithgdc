/**
 * Audit Logs Repository
 *
 * Data access layer for Audit Logs module.
 * Handles all database operations for audit logs using Supabase Client.
 *
 * Note: Audit logs are immutable - only read operations are supported.
 */

import { db } from '@/shared/lib/supabase/database';
import type { AuditLog, AuditLogListParams, AuditAction } from '../types';

// ============================================
// TYPES
// ============================================

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Database row types (what Supabase returns)
 */
interface DbAuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: AuditAction;
  module: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================
// REPOSITORY
// ============================================

export const auditLogRepository = {
  /**
   * Find all audit logs with pagination, search and filtering.
   */
  async findMany(
    params: AuditLogListParams = {}
  ): Promise<PaginatedResult<AuditLog>> {
    const {
      page = 1,
      limit = 25,
      search,
      action,
      module,
      userId,
      entityType,
      entityId,
      dateFrom,
      dateTo,
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build query
    let query = db
      .from('audit_logs')
      .select('*', { count: 'exact' });

    // Apply search filter (searches in description, user_email, user_name)
    if (search) {
      query = query.or(
        `description.ilike.%${search}%,user_email.ilike.%${search}%,user_name.ilike.%${search}%`
      );
    }

    // Apply action filter
    if (action) {
      query = query.eq('action', action);
    }

    // Apply module filter
    if (module) {
      query = query.eq('module', module);
    }

    // Apply user filter
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply entity filters
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    // Apply date range filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      // Add a day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }

    // Apply sorting (always by created_at)
    query = query.order('created_at', { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data: (data || []).map((row) => this.mapToAuditLog(row as DbAuditLog)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  },

  /**
   * Find a single audit log by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    const { data, error } = await db
      .from('audit_logs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {return null;} // Not found
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }

    return data ? this.mapToAuditLog(data as DbAuditLog) : null;
  },

  /**
   * Find audit logs for a specific entity
   */
  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    const { data, error } = await db
      .from('audit_logs')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return (data || []).map((row) => this.mapToAuditLog(row as DbAuditLog));
  },

  /**
   * Get distinct modules from audit logs (for filter dropdown)
   */
  async getDistinctModules(): Promise<string[]> {
    const { data, error } = await db
      .from('audit_logs')
      .select('module')
      .order('module');

    if (error) {
      throw new Error(`Failed to fetch modules: ${error.message}`);
    }

    // Get unique modules
    const modules = new Set<string>();
    (data || []).forEach((row) => {
      if (row.module) {modules.add(row.module);}
    });

    return Array.from(modules);
  },

  /**
   * Map database row to AuditLog type
   */
  mapToAuditLog(data: DbAuditLog): AuditLog {
    return {
      id: data.id,
      userId: data.user_id,
      userEmail: data.user_email,
      userName: data.user_name,
      action: data.action,
      module: data.module,
      description: data.description,
      entityType: data.entity_type,
      entityId: data.entity_id,
      oldData: data.old_data,
      newData: data.new_data,
      changes: data.changes,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      requestId: data.request_id,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
    };
  },
};

export type AuditLogRepository = typeof auditLogRepository;
