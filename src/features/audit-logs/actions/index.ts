/**
 * Audit Logs Server Actions
 *
 * Next.js server actions for Audit Logs feature.
 * Read-only operations - audit logs cannot be modified.
 */

'use server';

import { auditLogService } from '../services/audit-log.service';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import type { AuditLogListParams } from '../types';

// ============================================
// AUTHORIZATION
// ============================================

/** Same permission as the Audit Logs page and sidebar link */
const AUDIT_VIEW_PERMISSION = 'audit.view_module';

/** Error result when the caller may not read audit logs, otherwise null */
async function denyUnlessAuditViewer(): Promise<{ success: false; error: string; data?: undefined } | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, AUDIT_VIEW_PERMISSION)) {
    return { success: false, error: `Permission denied: ${AUDIT_VIEW_PERMISSION}` };
  }
  return null;
}

// ============================================
// LIST AUDIT LOGS
// ============================================

export async function getAuditLogs(params: AuditLogListParams = {}) {
  const denied = await denyUnlessAuditViewer();
  if (denied) {
    return denied;
  }

  const result = await auditLogService.list(params);
  return result;
}

// ============================================
// GET SINGLE AUDIT LOG
// ============================================

export async function getAuditLog(id: string) {
  const denied = await denyUnlessAuditViewer();
  if (denied) {
    return denied;
  }

  const result = await auditLogService.getById(id);
  return result;
}

// ============================================
// GET AUDIT LOGS BY ENTITY
// ============================================

export async function getAuditLogsByEntity(entityType: string, entityId: string) {
  const denied = await denyUnlessAuditViewer();
  if (denied) {
    return denied;
  }

  const result = await auditLogService.getByEntity(entityType, entityId);
  return result;
}

// ============================================
// GET AVAILABLE MODULES
// ============================================

export async function getAuditLogModules() {
  const denied = await denyUnlessAuditViewer();
  if (denied) {
    return denied;
  }

  const result = await auditLogService.getModules();
  return result;
}
