/**
 * Approval Events Server Actions
 *
 * Next.js server actions for Approval Events feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { approvalEventService } from '../services/approval-event.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  ApprovalEventListParams,
  CreateApprovalEventDTO,
} from '../types';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';

// ============================================
// AUTHORIZATION
// ============================================

/** One permission per action; roles get them on the Roles page */
const APPROVAL_PERMISSIONS: Record<'read' | 'request' | 'decide', string> = {
  read: 'approvals.view',
  request: 'approvals.request',
  decide: 'approvals.decide',
};

/** Error result when the caller does not hold the permission, otherwise null */
async function denyUnless(permission: string): Promise<{ success: false; error: string; data?: undefined } | null> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, permission)) {
    return { success: false, error: `Permission denied: ${permission}` };
  }
  return null;
}

// ============================================
// HELPER: Get current user ID
// ============================================

async function getCurrentUserId(): Promise<string | undefined> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {return undefined;}

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    return data?.id;
  } catch {
    return undefined;
  }
}

// ============================================
// LIST APPROVAL EVENTS
// ============================================

export async function listApprovalEvents(params: ApprovalEventListParams = {}) {
  const denied = await denyUnless(APPROVAL_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  const result = await approvalEventService.list(params);
  return result;
}

export async function getPendingApprovals() {
  const denied = await denyUnless(APPROVAL_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  const result = await approvalEventService.getPending();
  return result;
}

// ============================================
// GET APPROVAL EVENT
// ============================================

export async function getApprovalEvent(id: string) {
  const denied = await denyUnless(APPROVAL_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  const result = await approvalEventService.getById(id);
  return result;
}

export async function getApprovalEventsBySubject(subjectType: string, subjectId: string) {
  const denied = await denyUnless(APPROVAL_PERMISSIONS.read);
  if (denied) {
    return denied;
  }
  const result = await approvalEventService.getBySubject(subjectType, subjectId);
  return result;
}

// ============================================
// CREATE APPROVAL REQUEST
// ============================================

export async function requestApproval(data: CreateApprovalEventDTO) {
  const denied = await denyUnless(APPROVAL_PERMISSIONS.request);
  if (denied) {
    return denied;
  }
  const userId = await getCurrentUserId();
  const result = await approvalEventService.requestApproval(data, userId);

  if (result.success) {
    revalidatePath('/approvals');
  }

  return result;
}

// ============================================
// APPROVE / REJECT
// ============================================

export async function approveApprovalEvent(id: string, decisionNote?: string | null) {
  const denied = await denyUnless(APPROVAL_PERMISSIONS.decide);
  if (denied) {
    return denied;
  }
  const userId = await getCurrentUserId();
  const result = await approvalEventService.approve(id, decisionNote, userId);

  if (result.success) {
    revalidatePath('/approvals');
  }

  return result;
}

export async function rejectApprovalEvent(id: string, decisionNote?: string | null) {
  const denied = await denyUnless(APPROVAL_PERMISSIONS.decide);
  if (denied) {
    return denied;
  }
  const userId = await getCurrentUserId();
  const result = await approvalEventService.reject(id, decisionNote, userId);

  if (result.success) {
    revalidatePath('/approvals');
  }

  return result;
}
