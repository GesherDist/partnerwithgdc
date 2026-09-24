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
  const result = await approvalEventService.list(params);
  return result;
}

export async function getPendingApprovals() {
  const result = await approvalEventService.getPending();
  return result;
}

// ============================================
// GET APPROVAL EVENT
// ============================================

export async function getApprovalEvent(id: string) {
  const result = await approvalEventService.getById(id);
  return result;
}

export async function getApprovalEventsBySubject(subjectType: string, subjectId: string) {
  const result = await approvalEventService.getBySubject(subjectType, subjectId);
  return result;
}

// ============================================
// CREATE APPROVAL REQUEST
// ============================================

export async function requestApproval(data: CreateApprovalEventDTO) {
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
  const userId = await getCurrentUserId();
  const result = await approvalEventService.approve(id, decisionNote, userId);

  if (result.success) {
    revalidatePath('/approvals');
  }

  return result;
}

export async function rejectApprovalEvent(id: string, decisionNote?: string | null) {
  const userId = await getCurrentUserId();
  const result = await approvalEventService.reject(id, decisionNote, userId);

  if (result.success) {
    revalidatePath('/approvals');
  }

  return result;
}
