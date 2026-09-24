/**
 * Credit Notes Server Actions
 *
 * Next.js server actions for Credit Notes feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { creditNoteService } from '../services/credit-note.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  CreditNoteListParams,
  CreateCreditNoteDTO,
  UpdateCreditNoteDTO,
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
// LIST CREDIT NOTES
// ============================================

export async function listCreditNotes(params: CreditNoteListParams = {}) {
  const result = await creditNoteService.list(params);
  return result;
}

// ============================================
// GET CREDIT NOTE
// ============================================

export async function getCreditNote(id: string) {
  const result = await creditNoteService.getById(id);
  return result;
}

// ============================================
// CREATE CREDIT NOTE
// ============================================

export async function createCreditNote(data: CreateCreditNoteDTO) {
  const userId = await getCurrentUserId();
  const result = await creditNoteService.create(data, userId);

  if (result.success) {
    revalidatePath('/credit-notes');
  }

  return result;
}

// ============================================
// UPDATE CREDIT NOTE
// ============================================

export async function updateCreditNote(id: string, data: UpdateCreditNoteDTO) {
  const userId = await getCurrentUserId();
  const result = await creditNoteService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/credit-notes');
    revalidatePath(`/credit-notes/${id}`);
  }

  return result;
}

// ============================================
// DELETE CREDIT NOTE
// ============================================

export async function deleteCreditNote(id: string) {
  const userId = await getCurrentUserId();
  const result = await creditNoteService.delete(id, userId);

  if (result.success) {
    revalidatePath('/credit-notes');
  }

  return result;
}

// ============================================
// STATUS TRANSITIONS
// ============================================

export async function issueCreditNote(id: string) {
  const userId = await getCurrentUserId();
  const result = await creditNoteService.issue(id, userId);

  if (result.success) {
    revalidatePath('/credit-notes');
    revalidatePath(`/credit-notes/${id}`);
  }

  return result;
}

export async function applyCreditNote(id: string) {
  const userId = await getCurrentUserId();
  const result = await creditNoteService.apply(id, userId);

  if (result.success) {
    revalidatePath('/credit-notes');
    revalidatePath(`/credit-notes/${id}`);
  }

  return result;
}

export async function cancelCreditNote(id: string) {
  const userId = await getCurrentUserId();
  const result = await creditNoteService.cancel(id, userId);

  if (result.success) {
    revalidatePath('/credit-notes');
    revalidatePath(`/credit-notes/${id}`);
  }

  return result;
}
