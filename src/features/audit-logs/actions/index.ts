/**
 * Audit Logs Server Actions
 *
 * Next.js server actions for Audit Logs feature.
 * Read-only operations - audit logs cannot be modified.
 */

'use server';

import { auditLogService } from '../services/audit-log.service';
import type { AuditLogListParams } from '../types';

// ============================================
// LIST AUDIT LOGS
// ============================================

export async function getAuditLogs(params: AuditLogListParams = {}) {
  const result = await auditLogService.list(params);
  return result;
}

// ============================================
// GET SINGLE AUDIT LOG
// ============================================

export async function getAuditLog(id: string) {
  const result = await auditLogService.getById(id);
  return result;
}

// ============================================
// GET AUDIT LOGS BY ENTITY
// ============================================

export async function getAuditLogsByEntity(entityType: string, entityId: string) {
  const result = await auditLogService.getByEntity(entityType, entityId);
  return result;
}

// ============================================
// GET AVAILABLE MODULES
// ============================================

export async function getAuditLogModules() {
  const result = await auditLogService.getModules();
  return result;
}
