/**
 * Executive dashboard — daily history of ERP backlog and inventory (migration 163)
 *
 * Spec: T90 Avg / YTD Avg are averages of daily values; PY is the value one
 * year earlier. The ERP only knows today's backlog and stock, so one row per
 * business day is stored (upsert: the latest figures of the day win). Saved
 * when the dashboard is opened and by the daily QuickBooks financials cron.
 * Without migration 163 nothing is stored and the history stays empty.
 */

import { db } from '@/shared/lib/supabase/database';
import { addDays, addYears } from '../lib/periods';
import type { ErpExecutiveFigures } from './executive-erp.service';

export interface DailySnapshot {
  date: string;
  backlogTires: number;
  backlogRevenue: number;
  tiresOnHand: number;
  uncommitted: number;
  monthsOfSupply: number | null;
  inventoryAtCost: number | null;
}

const TABLE = 'executive_daily_snapshots';

const isMissingTable = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === '42P01' || error.code === 'PGRST205') && (error.message ?? '').includes(TABLE));

/** Store today's figures. Returns false when migration 163 is not applied. */
export async function saveDailySnapshot(erp: ErpExecutiveFigures, inventoryAtCost: number | null): Promise<boolean> {
  const { error } = await db.from(TABLE).upsert(
    {
      snapshot_date: erp.asOf,
      backlog_tires: erp.backlog.tires,
      backlog_revenue: erp.backlog.revenue,
      tires_on_hand: erp.inventory.tiresOnHand,
      tires_allocated: erp.inventory.allocated,
      uncommitted_tires: erp.inventory.uncommitted,
      months_of_supply: erp.inventory.monthsOfSupply,
      inventory_at_cost: inventoryAtCost,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'snapshot_date' }
  );
  if (error) {
    if (isMissingTable(error)) {
      return false;
    }
    throw new Error(`Failed to save the executive daily snapshot: ${error.message}`);
  }
  return true;
}

/**
 * Daily rows for the averages (YTD and T90, whichever starts first) plus the
 * prior-year date. Empty when migration 163 is not applied.
 */
export async function loadDailyHistory(asOf: string): Promise<DailySnapshot[]> {
  const from = [`${asOf.slice(0, 4)}-01-01`, addDays(asOf, -89)].sort()[0]!;
  const pyDate = addYears(asOf, -1);
  const { data, error } = await db
    .from(TABLE)
    .select('snapshot_date, backlog_tires, backlog_revenue, tires_on_hand, uncommitted_tires, months_of_supply, inventory_at_cost')
    .or(`and(snapshot_date.gte.${from},snapshot_date.lte.${asOf}),snapshot_date.eq.${pyDate}`)
    .order('snapshot_date');
  if (error) {
    if (isMissingTable(error)) {
      return [];
    }
    throw new Error(`Failed to load the executive daily history: ${error.message}`);
  }
  const num = (x: unknown) => (x === null || x === undefined ? null : Number(x));
  return (data ?? []).map((r) => ({
    date: String(r.snapshot_date),
    backlogTires: Number(r.backlog_tires ?? 0),
    backlogRevenue: Number(r.backlog_revenue ?? 0),
    tiresOnHand: Number(r.tires_on_hand ?? 0),
    uncommitted: Number(r.uncommitted_tires ?? 0),
    monthsOfSupply: num(r.months_of_supply),
    inventoryAtCost: num(r.inventory_at_cost),
  }));
}
