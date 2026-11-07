'use server';

/**
 * Dashboard targets actions (Settings > Dashboard Targets, Nov 7 2026)
 *
 * View: settings.view_module. Save: settings.edit (audit logged).
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth';
import { getDashboardTargets, saveDashboardTargets, type DashboardTargets } from '../services/dashboard-targets.service';

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export async function getDashboardTargetsSettings(): Promise<ActionResult<DashboardTargets & { canEdit: boolean }>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, 'settings.view_module')) {
    return { success: false, error: 'Permission denied: settings.view_module' };
  }
  const targets = await getDashboardTargets();
  return { success: true, data: { ...targets, canEdit: hasPermission(user, 'settings.edit') } };
}

export async function updateDashboardTargets(input: {
  monthlyRevenueTarget: number;
  marginTargetPct: number;
}): Promise<ActionResult<DashboardTargets>> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Authentication required' };
  }
  if (!hasPermission(user, 'settings.edit')) {
    return { success: false, error: 'Permission denied: settings.edit' };
  }

  const before = await getDashboardTargets();
  const saved = await saveDashboardTargets(input, user.id);
  if (!saved.success) {
    return saved;
  }
  const after = await getDashboardTargets();

  // Event log (fire and forget)
  const { auditService } = await import('@/shared/lib/audit');
  auditService.log({
    action: 'update',
    module: 'settings',
    entityType: 'DashboardTargets',
    userId: user.id,
    description: `Dashboard targets changed: revenue $${before.monthlyRevenueTarget.toLocaleString('en-US')} → $${after.monthlyRevenueTarget.toLocaleString('en-US')} / month, margin ${before.marginTargetPct}% → ${after.marginTargetPct}%`,
    metadata: {
      before: { monthlyRevenueTarget: before.monthlyRevenueTarget, marginTargetPct: before.marginTargetPct },
      after: { monthlyRevenueTarget: after.monthlyRevenueTarget, marginTargetPct: after.marginTargetPct },
    },
  });

  revalidatePath('/dashboard');
  revalidatePath('/settings');
  return { success: true, data: after };
}
