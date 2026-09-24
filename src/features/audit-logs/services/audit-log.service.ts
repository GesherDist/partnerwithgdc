/**
 * Audit Logs Service
 *
 * Business logic layer for Audit Logs module.
 * Audit logs are read-only - they cannot be modified or deleted.
 */

import { auditLogRepository } from '../repositories/audit-log.repository';
import type { AuditLog, AuditLogListParams, AuditLogListResponse } from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// SERVICE
// ============================================

export const auditLogService = {
  /**
   * Get paginated list of audit logs
   */
  async list(params: AuditLogListParams = {}): Promise<ServiceResult<AuditLogListResponse>> {
    try {
      const result = await auditLogRepository.findMany(params);

      return {
        success: true,
        data: {
          data: result.data,
          meta: result.meta,
        },
      };
    } catch (error) {
      console.error('Failed to list audit logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list audit logs',
      };
    }
  },

  /**
   * Get a single audit log by ID
   */
  async getById(id: string): Promise<ServiceResult<AuditLog>> {
    try {
      const auditLog = await auditLogRepository.findById(id);

      if (!auditLog) {
        return {
          success: false,
          error: 'Audit log not found',
        };
      }

      return {
        success: true,
        data: auditLog,
      };
    } catch (error) {
      console.error('Failed to get audit log:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get audit log',
      };
    }
  },

  /**
   * Get audit logs for a specific entity
   */
  async getByEntity(
    entityType: string,
    entityId: string
  ): Promise<ServiceResult<AuditLog[]>> {
    try {
      const auditLogs = await auditLogRepository.findByEntity(entityType, entityId);

      return {
        success: true,
        data: auditLogs,
      };
    } catch (error) {
      console.error('Failed to get entity audit logs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get entity audit logs',
      };
    }
  },

  /**
   * Get distinct modules for filter dropdown
   */
  async getModules(): Promise<ServiceResult<string[]>> {
    try {
      const modules = await auditLogRepository.getDistinctModules();

      return {
        success: true,
        data: modules,
      };
    } catch (error) {
      console.error('Failed to get modules:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get modules',
      };
    }
  },
};

export type AuditLogService = typeof auditLogService;
