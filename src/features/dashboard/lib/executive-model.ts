/**
 * Executive dashboard view model (Ankur's spec, 11 tables).
 *
 * Combines the ERP figures (executive-erp.service) and the latest QuickBooks
 * snapshot (qbo-financials.service). Every cell is a value or null with the
 * reason it is unavailable — no sample numbers.
 */

import type { ErpExecutiveFigures, SupplyCycle } from '../services/executive-erp.service';
import type { QboBalances, QboFinancials } from '@/modules/integrations/quickbooks/services/qbo-financials.service';
import type { PeriodKey } from './periods';

export interface Cell {
  value: number | null;
  /** Why the value is missing, or a short qualifier */
  note?: string;
}

export const REASON = {
  noCost: 'Needs purchase cost',
  noQuickBooks: 'Sync QuickBooks',
  noProjection: 'Needs cash projection inputs',
  noHistory: 'No history yet',
  noForecast: 'Forecast method pending',
  noSales: 'No sales in period',
  noContainers: 'Needs container data',
  noUnits: 'No tires on hand',
} as const;

type Cols4 = 'mtd' | 't90' | 'ytd' | 'py';
type EffCols = 'pm' | 't90' | 'ytd' | 'py';
type AvgCols = 'current' | 't90Avg' | 'ytdAvg' | 'py';

export interface ExecutiveDashboardModel {
  asOf: string;
  quickBooks: { connected: boolean; asOf: string | null; environment: string | null; hasPeriods: boolean };
  liquidity: { cashToday: Cell; cashDate: string | null; cashPy: Cell; lowCash: Cell; highCash: Cell; projectedCash: Cell };
  workingCapital: Record<'ar' | 'ap' | 'inventory', Record<'current' | 'timing' | 't90Avg' | 'ytdAvg' | 'py', Cell>>;
  efficiency: Record<'dso' | 'dpo' | 'dio' | 'ccc', Record<EffCols, Cell>>;
  cashGeneration: Record<'ocf' | 'capex' | 'fcf', Record<Cols4, Cell>>;
  profitability: Record<'revenue' | 'cogs' | 'grossProfit' | 'opex' | 'operatingProfit', Record<Cols4, Cell & { pct?: number | null }>>;
  perTire: Record<'tiresSold' | 'revenue' | 'cogs' | 'grossProfit' | 'opex' | 'operatingProfit', Record<Cols4, Cell>>;
  opexRunRate: Record<'monthly' | 'annualized', Record<'current' | 't90' | 'py', Cell>>;
  backlog: Record<'tires' | 'revenue' | 'revenuePerTire' | 'grossProfit' | 'gpPerTire' | 'gpPct', Record<AvgCols, Cell>>;
  supply: Array<SupplyCycle & { containers: Cell }>;
  inventory: Record<'atCost' | 'tiresOnHand' | 'costPerTire' | 'uncommitted' | 'monthsOfSupply', Record<AvgCols, Cell>>;
}

const v = (value: number | null | undefined, note?: string): Cell =>
  value === null || value === undefined || !Number.isFinite(value) ? { value: null, note } : { value, ...(note ? { note } : {}) };
const none = (note: string): Cell => ({ value: null, note });
const div = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined || b === 0 ? null : a / b;
const avg = (values: number[]) => (values.length ? values.reduce((s, x) => s + x, 0) / values.length : null);

export function buildExecutiveModel(erp: ErpExecutiveFigures, qbo: QboFinancials | null, qboConnected: boolean): ExecutiveDashboardModel {
  const p = erp.periods;
  const q = qbo?.periods ?? null;
  const qNote = REASON.noQuickBooks;

  // ---------- QuickBooks balances: current + month-ends ----------
  type BalKey = 'cash' | 'accountsReceivable' | 'accountsPayable' | 'inventory';
  const current: QboBalances | null = qbo
    ? { date: qbo.asOf, cash: qbo.cash, accountsReceivable: qbo.accountsReceivable, accountsPayable: qbo.accountsPayable, inventory: qbo.inventory }
    : null;
  const monthEnds = q ? q.balances.filter((b) => b.date !== q.priorYearDate) : [];
  const pyBal = q?.balances.find((b) => b.date === q.priorYearDate) ?? null;
  const avgOver = (key: BalKey, from: string, to: string) => {
    if (!q || !current) {
      return null;
    }
    const pts = monthEnds.filter((b) => b.date >= from && b.date <= to).map((b) => b[key]);
    return avg([...pts, current[key]]);
  };
  // Average balance over a period: month-ends inside it plus the closing value
  const avgFor = (key: BalKey, period: EffCols): number | null => {
    if (!q || !current) {
      return null;
    }
    if (period === 'pm') {
      const before = monthEnds.filter((b) => b.date < p.pm.from).pop();
      const end = monthEnds.find((b) => b.date === p.pm.to);
      return end ? avg([...(before ? [before[key]] : []), end[key]]) : null;
    }
    if (period === 'py') {
      return null; // prior-year month-end history not fetched yet
    }
    return avgOver(key, p[period].from, p[period].to);
  };

  const wcRow = (key: BalKey, timing: Cell) => ({
    current: current ? v(current[key]) : none(qNote),
    timing,
    t90Avg: q ? v(avgOver(key, p.t90.from, p.t90.to)) : none(qNote),
    ytdAvg: q ? v(avgOver(key, p.ytd.from, p.ytd.to)) : none(qNote),
    py: pyBal ? v(pyBal[key]) : none(q ? REASON.noHistory : qNote),
  });

  // ---------- efficiency ----------
  const effCols: EffCols[] = ['pm', 't90', 'ytd', 'py'];
  const dso = {} as Record<EffCols, Cell>;
  const dpo = {} as Record<EffCols, Cell>;
  const dio = {} as Record<EffCols, Cell>;
  const ccc = {} as Record<EffCols, Cell>;
  for (const c of effCols) {
    const ar = avgFor('accountsReceivable', c);
    const sales = erp.creditSales[c];
    dso[c] = !q ? none(qNote) : ar === null ? none(REASON.noHistory) : sales === 0 ? none(REASON.noSales) : v(Math.round(((ar / sales) * p[c].days) * 10) / 10);
    // Purchases need the real purchase cost (PO prices are sales prices today)
    dpo[c] = none(REASON.noCost);
    dio[c] = none(REASON.noCost);
    ccc[c] = none(REASON.noCost);
  }

  // ---------- cash generation ----------
  const cols4: Cols4[] = ['mtd', 't90', 'ytd', 'py'];
  const ocf = {} as Record<Cols4, Cell>;
  const capex = {} as Record<Cols4, Cell>;
  const fcf = {} as Record<Cols4, Cell>;
  for (const c of cols4) {
    if (!q) {
      ocf[c] = none(qNote);
      capex[c] = none(qNote);
      fcf[c] = none(qNote);
      continue;
    }
    const investing = q.investingCashFlow[c];
    const spent = investing < 0 ? -investing : 0; // cash out for investments
    ocf[c] = v(q.operatingCashFlow[c]);
    capex[c] = v(spent, 'Net investing outflow');
    fcf[c] = v(q.operatingCashFlow[c] - spent);
  }

  // ---------- profitability / per tire ----------
  const prof = {
    revenue: {},
    cogs: {},
    grossProfit: {},
    opex: {},
    operatingProfit: {},
  } as ExecutiveDashboardModel['profitability'];
  const tire = {
    tiresSold: {},
    revenue: {},
    cogs: {},
    grossProfit: {},
    opex: {},
    operatingProfit: {},
  } as ExecutiveDashboardModel['perTire'];
  for (const c of cols4) {
    const s = erp.sales[c as PeriodKey];
    const opexValue = q ? q.opex[c as PeriodKey] : null;
    const cogsCell = s.cogs === null ? none(REASON.noCost) : v(s.cogs);
    const gp = s.cogs === null ? null : s.revenue - s.cogs;
    const op = gp === null || opexValue === null ? null : gp - opexValue;
    const pct = (x: number | null) => (x === null || s.revenue === 0 ? null : Math.round((x / s.revenue) * 1000) / 10);
    prof.revenue[c] = v(s.revenue);
    prof.cogs[c] = { ...cogsCell, pct: pct(s.cogs) };
    prof.grossProfit[c] = { ...(gp === null ? none(REASON.noCost) : v(gp)), pct: pct(gp) };
    prof.opex[c] = { ...(opexValue === null ? none(qNote) : v(opexValue)), pct: pct(opexValue) };
    prof.operatingProfit[c] = { ...(op === null ? none(gp === null ? REASON.noCost : qNote) : v(op)), pct: pct(op) };

    const perUnit = (x: number | null, missing: string) => (s.units === 0 ? none(REASON.noSales) : x === null ? none(missing) : v(Math.round((x / s.units) * 100) / 100));
    tire.tiresSold[c] = v(s.units);
    tire.revenue[c] = perUnit(s.revenue, '');
    tire.cogs[c] = perUnit(s.cogs, REASON.noCost);
    tire.grossProfit[c] = perUnit(gp, REASON.noCost);
    tire.opex[c] = perUnit(opexValue, qNote);
    tire.operatingProfit[c] = perUnit(op, gp === null ? REASON.noCost : qNote);
  }

  // ---------- OPEX run rate ----------
  const monthlyT90 = q ? q.opex.t90 / 3 : null;
  const monthlyPy = q ? q.opex.t90py / 3 : null;
  const opexRunRate: ExecutiveDashboardModel['opexRunRate'] = {
    monthly: {
      current: q ? none(`${REASON.noForecast} · MTD actual ${Math.round(q.opex.mtd).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`) : none(qNote),
      t90: q ? v(Math.round(monthlyT90! * 100) / 100) : none(qNote),
      py: q ? v(Math.round(monthlyPy! * 100) / 100) : none(qNote),
    },
    annualized: {
      current: q ? none(REASON.noForecast) : none(qNote),
      t90: q ? v(Math.round(monthlyT90! * 12 * 100) / 100) : none(qNote),
      py: q ? v(Math.round(monthlyPy! * 12 * 100) / 100) : none(qNote),
    },
  };

  // ---------- backlog ----------
  const b = erp.backlog;
  const bGp = b.cogs === null ? null : b.revenue - b.cogs;
  const histNone = { t90Avg: none(REASON.noHistory), ytdAvg: none(REASON.noHistory), py: none(REASON.noHistory) };
  const backlog: ExecutiveDashboardModel['backlog'] = {
    tires: { current: v(b.tires), ...histNone },
    revenue: { current: v(b.revenue), ...histNone },
    revenuePerTire: { current: b.tires ? v(Math.round((b.revenue / b.tires) * 100) / 100) : none(REASON.noSales), ...histNone },
    grossProfit: { current: bGp === null ? none(REASON.noCost) : v(bGp), ...histNone },
    gpPerTire: { current: bGp === null ? none(REASON.noCost) : v(div(bGp, b.tires)), ...histNone },
    gpPct: { current: bGp === null ? none(REASON.noCost) : v(div(bGp, b.revenue) === null ? null : Math.round((bGp / b.revenue) * 1000) / 10), ...histNone },
  };

  // ---------- inventory ----------
  const inv = erp.inventory;
  const invCost = current ? current.inventory : null;
  const inventory: ExecutiveDashboardModel['inventory'] = {
    atCost: {
      current: current ? v(invCost) : none(qNote),
      t90Avg: q ? v(avgOver('inventory', p.t90.from, p.t90.to)) : none(qNote),
      ytdAvg: q ? v(avgOver('inventory', p.ytd.from, p.ytd.to)) : none(qNote),
      py: pyBal ? v(pyBal.inventory) : none(q ? REASON.noHistory : qNote),
    },
    tiresOnHand: { current: v(inv.tiresOnHand), ...histNone },
    costPerTire: {
      current: !current ? none(qNote) : inv.tiresOnHand === 0 ? none(REASON.noUnits) : v(Math.round((invCost! / inv.tiresOnHand) * 100) / 100),
      ...histNone,
    },
    uncommitted: { current: v(inv.uncommitted), ...histNone },
    monthsOfSupply: {
      current: inv.monthsOfSupply === null ? none('No tires sold in the last 3 completed months') : v(inv.monthsOfSupply),
      ...histNone,
    },
  };

  return {
    asOf: erp.asOf,
    quickBooks: { connected: qboConnected, asOf: qbo?.asOf ?? null, environment: qbo?.environment ?? null, hasPeriods: Boolean(q) },
    liquidity: {
      cashToday: current ? v(current.cash) : none(qNote),
      cashDate: current?.date ?? null,
      cashPy: pyBal ? v(pyBal.cash) : none(q ? REASON.noHistory : qNote),
      lowCash: none(REASON.noProjection),
      highCash: none(REASON.noProjection),
      projectedCash: none(REASON.noProjection),
    },
    workingCapital: {
      ar: wcRow('accountsReceivable', q ? v(q.arWeightedDays, 'days to receipt') : none(qNote)),
      ap: wcRow('accountsPayable', q ? v(q.apWeightedDays, 'days to payment') : none(qNote)),
      inventory: wcRow('inventory', none('—')),
    },
    efficiency: { dso, dpo, dio, ccc },
    cashGeneration: { ocf, capex, fcf },
    profitability: prof,
    perTire: tire,
    opexRunRate,
    backlog,
    supply: erp.supply.map((s) => ({ ...s, containers: none(REASON.noContainers) })),
    inventory,
  };
}
