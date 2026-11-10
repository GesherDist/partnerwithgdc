/**
 * Commission Actual from the QuickBooks snapshot (Nov 10 2026)
 *
 * Ankur: "Commissions actual YTD is $421,331" = every commission invoice to
 * Galileo, paid or not. The dashboard P&L is on Cash basis (Net Income matches
 * Ankur's cash P&L), which counts a commission invoice only once it is paid.
 * So Commission Actual uses the Accrual P&L commission (counted when
 * invoiced). Snapshots taken before Nov 10 2026 have no Accrual commission:
 * they fall back to the Cash figure, as before.
 */

import type { QboPeriodFigures } from '@/modules/integrations/quickbooks/services/qbo-financials.service';

export type CommissionPeriod = 'mtd' | 'pm' | 't90' | 'ytd' | 'py';

export interface CommissionFigure {
  amount: number;
  basis: 'Accrual' | 'Cash';
}

/** Commission income for a period: Accrual when synced, else Cash; null without a P&L */
export function qboCommission(periods: QboPeriodFigures | null | undefined, key: CommissionPeriod): CommissionFigure | null {
  const accrual = periods?.accrualPnl?.[key as keyof NonNullable<QboPeriodFigures['accrualPnl']>]?.commission;
  if (typeof accrual === 'number') {
    return { amount: accrual, basis: 'Accrual' };
  }
  const cash = periods?.pnl?.[key]?.commission;
  if (typeof cash === 'number') {
    return { amount: cash, basis: periods?.pnlBasis === 'Cash' ? 'Cash' : 'Accrual' };
  }
  return null;
}
