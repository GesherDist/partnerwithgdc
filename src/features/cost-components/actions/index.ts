/**
 * Cost Components Server Actions
 *
 * Next.js server actions for Cost Components feature.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { costComponentService } from '../services/cost-component.service';
import { createClient } from '@/shared/lib/supabase/server';
import type {
  CostComponentListParams,
  CreateCostComponentDTO,
  UpdateCostComponentDTO,
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
// LIST COST COMPONENTS
// ============================================

export async function listCostComponents(params: CostComponentListParams = {}) {
  const result = await costComponentService.list(params);
  return result;
}

// ============================================
// GET COST COMPONENT
// ============================================

export async function getCostComponent(id: string) {
  const result = await costComponentService.getById(id);
  return result;
}

// ============================================
// CREATE COST COMPONENT
// ============================================

export async function createCostComponent(data: CreateCostComponentDTO) {
  const userId = await getCurrentUserId();
  const result = await costComponentService.create(data, userId);

  if (result.success && data.purchaseOrderId) {
    revalidatePath('/purchase-orders');
    revalidatePath(`/purchase-orders/${data.purchaseOrderId}`);
  }

  return result;
}

// ============================================
// UPDATE COST COMPONENT
// ============================================

export async function updateCostComponent(id: string, data: UpdateCostComponentDTO) {
  const userId = await getCurrentUserId();
  const result = await costComponentService.update(id, data, userId);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// DELETE COST COMPONENT
// ============================================

export async function deleteCostComponent(id: string) {
  const result = await costComponentService.delete(id);

  if (result.success) {
    revalidatePath('/purchase-orders');
  }

  return result;
}

// ============================================
// LANDED COST
// ============================================

export async function getLandedCostSummary(purchaseOrderId: string) {
  const result = await costComponentService.getLandedCostSummary(purchaseOrderId);
  return result;
}
