/**
 * Cash / Accrual toggle (Ankur, Nov 11 2026 email: "a toggle on every tab to see
 * cash and accrual"). Nov 12 2026.
 *
 * The QuickBooks snapshot keeps the P&L on Cash basis (pnl, opex, revenueHistory,
 * opex.months) and, since Nov 12 2026, the same figures on Accrual basis
 * (accrualPnl[period].pnl / .opex, revenueHistoryAccrual, opexAccrual). This
 * returns the snapshot with the P&L figures of the basis asked for, so every
 * reader (cards, charts, executive tables, drill-downs) works unchanged.
 *
 * Not affected by the toggle: balance sheet (cash, AR, AP, inventory: always
 * Accrual), cash flow statement, units sold (by invoice), DSO / DIO (Accrual
 * sales and COGS) and Commission Actual (Accrual, Ankur Nov 10 2026).
 *
 * Pure function: no database or QuickBooks access.
 */

import type { QboFinancials, QboPnlFigures } from '@/modules/integrations/quickbooks/services/qbo-financials.service';

export type PnlBasis = 'Cash' | 'Accrual';

export const PNL_BASES: PnlBasis[] = ['Cash', 'Accrual'];

export function isPnlBasis(value: unknown): value is PnlBasis {
  return value === 'Cash' || value === 'Accrual';
}

type PnlPeriod = 'mtd' | 't90' | 'ytd' | 'py' | 'pm';
const PNL_PERIODS: PnlPeriod[] = ['mtd', 't90', 'ytd', 'py', 'pm'];

export interface BasisResult {
  financials: QboFinancials;
  /** Basis of the P&L figures in `financials` */
  basis: PnlBasis;
  /** The basis asked for is not in this snapshot (sync QuickBooks again) */
  unavailable: boolean;
}

/** Basis the snapshot's own P&L is on (snapshots before Nov 7 2026 were Accrual) */
export function storedBasis(financials: QboFinancials): PnlBasis {
  return financials.periods?.pnlBasis ?? 'Accrual';
}

/** Which bases this snapshot can show */
export function availableBases(financials: QboFinancials | null | undefined): Record<PnlBasis, boolean> {
  if (!financials) {
    return { Cash: false, Accrual: false };
  }
  const own = storedBasis(financials);
  const accrual = financials.periods?.accrualPnl;
  const hasAccrual = own === 'Accrual' || PNL_PERIODS.every((k) => accrual?.[k as keyof typeof accrual]?.pnl !== undefined);
  return { Cash: own === 'Cash', Accrual: hasAccrual };
}

/**
 * The snapshot with its P&L figures on `basis`. When that basis is not in the
 * snapshot, the snapshot is returned as it is (unavailable = true).
 */
export function withPnlBasis(financials: QboFinancials, basis: PnlBasis = 'Cash'): BasisResult {
  const own = storedBasis(financials);
  if (basis === own) {
    return { financials, basis: own, unavailable: false };
  }
  if (basis === 'Cash' || !availableBases(financials).Accrual) {
    return { financials, basis: own, unavailable: true };
  }

  const periods = financials.periods!;
  const accrual = periods.accrualPnl!;
  const pnl = {} as Record<PnlPeriod, QboPnlFigures>;
  const opex = { ...periods.opex };
  for (const k of PNL_PERIODS) {
    const a = accrual[k as keyof typeof accrual]!;
    pnl[k] = a.pnl!;
    if (a.opex !== undefined) {
      opex[k] = a.opex;
    }
  }
  return {
    financials: {
      ...financials,
      // opexCash: the stored Cash OPEX, for Projected Cash (cash out, whatever the toggle shows)
      periods: { ...periods, pnl, opex, opexCash: periods.opex, pnlBasis: 'Accrual' },
      // Monthly series: Accrual when the sync read them, else the stored ones
      revenueHistory: financials.revenueHistoryAccrual ?? financials.revenueHistory,
      opex: financials.opexAccrual ?? financials.opex,
    },
    basis: 'Accrual',
    unavailable: false,
  };
}
