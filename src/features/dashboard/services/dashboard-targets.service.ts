/**
 * Dashboard targets (Nov 7 2026)
 *
 * Monthly revenue target and margin target, set in Settings > Dashboard Targets
 * (QuickBooks has no budget for Gesher). Stored in app_settings
 * (migration 175, key 'dashboard_targets').
 *
 * Reading never fails: when the table is missing (migration not run yet) or the
 * row is empty, the default values are used ($400,000 / 18%, Ankur Nov 7; were $220,000 / 30%).
 */

import { db } from '@/shared/lib/supabase/database';

export interface DashboardTargets {
  /** Dollars per month */
  monthlyRevenueTarget: number;
  /** Gross margin %, e.g. 30 */
  marginTargetPct: number;
  /** When / by whom they were last saved; null = defaults (never saved) */
  updatedAt: string | null;
  updatedByName: string | null;
}

const SETTINGS_KEY = 'dashboard_targets';

/** Values used before the targets were editable */
// Before Nov 9 2026 (the old hardcoded values):
// export const DEFAULT_DASHBOARD_TARGETS = { monthlyRevenueTarget: 220000, marginTargetPct: 30 } as const;
// Ankur, Nov 7 email: "Monthly revenue target we can put at $400,000 and margin target at 18% although this could change"
export const DEFAULT_DASHBOARD_TARGETS = { monthlyRevenueTarget: 400000, marginTargetPct: 18 } as const;

const validNumber = (value: unknown, min: number, max: number): number | null => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

export async function getDashboardTargets(): Promise<DashboardTargets> {
  try {
    const { data, error } = await db
      .from('app_settings')
      .select('value, updated_at, updated_by')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    if (error) {
      // Missing table (migration 175 not run yet) or any read error: keep the defaults
      console.error('[DashboardTargets] Read failed, using defaults:', error.message);
      return { ...DEFAULT_DASHBOARD_TARGETS, updatedAt: null, updatedByName: null };
    }
    const value = (data?.value ?? {}) as Record<string, unknown>;
    // Who saved them (display only; a failed lookup never hides the targets)
    let updatedByName: string | null = null;
    if (data?.updated_by) {
      const { data: user } = await db.from('users').select('first_name, last_name, email').eq('id', data.updated_by).maybeSingle();
      updatedByName = user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email || null : null;
    }
    return {
      monthlyRevenueTarget: validNumber(value.monthlyRevenueTarget, 0, 1_000_000_000) ?? DEFAULT_DASHBOARD_TARGETS.monthlyRevenueTarget,
      marginTargetPct: validNumber(value.marginTargetPct, 0, 100) ?? DEFAULT_DASHBOARD_TARGETS.marginTargetPct,
      updatedAt: data?.updated_at ?? null,
      updatedByName,
    };
  } catch (error) {
    console.error('[DashboardTargets] Read failed, using defaults:', error);
    return { ...DEFAULT_DASHBOARD_TARGETS, updatedAt: null, updatedByName: null };
  }
}

export async function saveDashboardTargets(
  input: { monthlyRevenueTarget: number; marginTargetPct: number },
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const monthlyRevenueTarget = validNumber(input.monthlyRevenueTarget, 0, 1_000_000_000);
  const marginTargetPct = validNumber(input.marginTargetPct, 0, 100);
  if (monthlyRevenueTarget === null) {
    return { success: false, error: 'Monthly revenue target must be a number between 0 and 1,000,000,000' };
  }
  if (marginTargetPct === null) {
    return { success: false, error: 'Margin target must be a percentage between 0 and 100' };
  }
  const { error } = await db.from('app_settings').upsert(
    {
      key: SETTINGS_KEY,
      value: { monthlyRevenueTarget: Math.round(monthlyRevenueTarget), marginTargetPct: Math.round(marginTargetPct * 10) / 10 },
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'key' }
  );
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205';
    return { success: false, error: missing ? 'Settings table missing: run migration 175 first' : error.message };
  }
  return { success: true };
}
