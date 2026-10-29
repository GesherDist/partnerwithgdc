/**
 * Executive dashboard view model (Ankur's spec, 11 tables).
 *
 * Combines the ERP figures (executive-erp.service) and the latest QuickBooks
 * snapshot (qbo-financials.service). Every cell is a value or null with the
 * reason it is unavailable — no sample numbers.
 */

import type { BacklogOrder, ErpExecutiveFigures, SupplyCycle } from '../services/executive-erp.service';
import type { DailySnapshot } from '../services/executive-history.service';
import type { QboBalances, QboFinancials } from '@/modules/integrations/quickbooks/services/qbo-financials.service';
import { addYears, type PeriodKey } from './periods';

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
  noPurchases: 'No purchases in period',
  sinceGoLive: 'Since go-live: no prior-year ERP data',
  partialCost: 'Some tires have no ERP cost',
} as const;

type Cols4 = 'mtd' | 't90' | 'ytd' | 'py';

/** One quarter of the Projected Cash (Ankur, Oct 27 call: quarterly, orders on the books) */
export interface CashQuarter {
  label: string;
  start: string;
  end: string;
  opening: number;
  /** Backlog revenue expected to be invoiced (delivered) in the quarter */
  inflow: number;
  closing: number;
  orders: number;
  tires: number;
}

export interface CashProjection {
  quarters: CashQuarter[];
  throughDate: string;
  /** Backlog orders placed in the current quarter: no expected date / date already passed */
  undatedOrders: number;
  overdueOrders: number;
}
type EffCols = 'pm' | 't90' | 'ytd' | 'py';
type AvgCols = 'current' | 't90Avg' | 'ytdAvg' | 'py';

export interface ExecutiveDashboardModel {
  asOf: string;
  quickBooks: { connected: boolean; asOf: string | null; environment: string | null; hasPeriods: boolean };
  liquidity: {
    cashToday: Cell;
    cashDate: string | null;
    cashPy: Cell;
    lowCash: Cell;
    highCash: Cell;
    projectedCash: Cell;
    /** null without a QuickBooks cash balance */
    projection: CashProjection | null;
  };
  workingCapital: Record<'ar' | 'ap' | 'inventory', Record<'current' | 'timing' | 't90Avg' | 'ytdAvg' | 'py', Cell>>;
  efficiency: Record<'dso' | 'dpo' | 'dio' | 'ccc', Record<EffCols, Cell>>;
  /** Inputs behind table 1.3 per column (drill-down export); null = not available */
  efficiencyInputs: Record<
    EffCols,
    {
      days: number;
      avgAr: number | null;
      creditSales: number;
      avgAp: number | null;
      creditPurchases: number | null;
      avgInventory: number | null;
      cogs: number | null;
    }
  >;
  cashGeneration: Record<'ocf' | 'capex' | 'fcf', Record<Cols4, Cell>>;
  profitability: Record<'revenue' | 'cogs' | 'grossProfit' | 'opex' | 'operatingProfit', Record<Cols4, Cell & { pct?: number | null }>>;
  perTire: Record<'tiresSold' | 'revenue' | 'cogs' | 'grossProfit' | 'opex' | 'operatingProfit', Record<Cols4, Cell>>;
  opexRunRate: Record<'monthly' | 'annualized', Record<'current' | 't90' | 'py', Cell>>;
  backlog: Record<'tires' | 'revenue' | 'revenuePerTire' | 'grossProfit' | 'gpPerTire' | 'gpPct', Record<AvgCols, Cell>>;
  /** Commission from Galileo, reported apart from tire revenue and gross profit */
  commission: { billed: Record<Cols4, Cell>; unbilled: Cell; unbilledOrders: number };
  supply: Array<SupplyCycle & { containers: Cell }>;
  inventory: Record<'atCost' | 'tiresOnHand' | 'costPerTire' | 'uncommitted' | 'monthsOfSupply', Record<AvgCols, Cell>>;
}

const v = (value: number | null | undefined, note?: string): Cell =>
  value === null || value === undefined || !Number.isFinite(value) ? { value: null, note } : { value, ...(note ? { note } : {}) };
const none = (note: string): Cell => ({ value: null, note });
const div = (a: number | null | undefined, b: number | null | undefined) =>
  a === null || a === undefined || b === null || b === undefined || b === 0 ? null : a / b;
const avg = (values: number[]) => (values.length ? values.reduce((s, x) => s + x, 0) / values.length : null);

const quarterStart = (iso: string) => {
  const m = Number(iso.slice(5, 7));
  return `${iso.slice(0, 4)}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`;
};
const nextQuarter = (start: string) => {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7)) + 3;
  return m > 12 ? `${y + 1}-${String(m - 12).padStart(2, '0')}-01` : `${y}-${String(m).padStart(2, '0')}-01`;
};
const quarterEnd = (start: string) => {
  const next = nextQuarter(start);
  const d = new Date(`${next}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const quarterLabel = (start: string) => `Q${Math.floor((Number(start.slice(5, 7)) - 1) / 3) + 1} ${start.slice(0, 4)}`;

/** Quarter an order is expected to be invoiced in: no date / date passed → current quarter */
export function cashQuarterOf(order: BacklogOrder, asOf: string): string {
  const current = quarterStart(asOf);
  return order.expectedDate && order.expectedDate >= current ? quarterStart(order.expectedDate) : current;
}

/**
 * Projected Cash (Ankur, Oct 27 call): Cash Today + orders on the books still to
 * be invoiced, going forward, quarter by quarter. At least 4 quarters, through
 * the quarter of the last expected order.
 */
export function buildCashProjection(cashToday: number, orders: BacklogOrder[], asOf: string): CashProjection {
  const current = quarterStart(asOf);
  const byQuarter = new Map<string, { inflow: number; orders: number; tires: number }>();
  let last = current;
  for (const o of orders) {
    const q = cashQuarterOf(o, asOf);
    const row = byQuarter.get(q) ?? { inflow: 0, orders: 0, tires: 0 };
    row.inflow += o.revenue;
    row.orders += 1;
    row.tires += o.tires;
    byQuarter.set(q, row);
    last = q > last ? q : last;
  }

  const quarters: CashQuarter[] = [];
  let opening = cashToday;
  for (let q = current, i = 0; i < 4 || q <= last; q = nextQuarter(q), i++) {
    const row = byQuarter.get(q) ?? { inflow: 0, orders: 0, tires: 0 };
    const inflow = Math.round(row.inflow * 100) / 100;
    const closing = Math.round((opening + inflow) * 100) / 100;
    quarters.push({ label: quarterLabel(q), start: q, end: quarterEnd(q), opening, inflow, closing, orders: row.orders, tires: row.tires });
    opening = closing;
  }

  return {
    quarters,
    throughDate: quarters[quarters.length - 1]!.end,
    undatedOrders: orders.filter((o) => !o.expectedDate).length,
    overdueOrders: orders.filter((o) => o.expectedDate && o.expectedDate < current).length,
  };
}

export function buildExecutiveModel(
  erp: ErpExecutiveFigures,
  qbo: QboFinancials | null,
  qboConnected: boolean,
  history: DailySnapshot[] = []
): ExecutiveDashboardModel {
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
      // Prior-year YTD: its month-ends plus the closing value on the prior-year date
      const pts = q.balances.filter((b) => b.date >= p.py.from && b.date < p.py.to).map((b) => b[key]);
      return pyBal ? avg([...pts, pyBal[key]]) : null;
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
  const efficiencyInputs = {} as ExecutiveDashboardModel['efficiencyInputs'];
  for (const c of effCols) {
    const ar = avgFor('accountsReceivable', c);
    const sales = erp.creditSales[c];
    efficiencyInputs[c] = {
      days: p[c].days,
      avgAr: ar,
      creditSales: sales,
      avgAp: avgFor('accountsPayable', c),
      creditPurchases: q?.creditPurchases?.[c] ?? null,
      avgInventory: avgFor('inventory', c),
      cogs: erp.sales[c].cogs,
    };
    dso[c] = !q
      ? none(qNote)
      : ar === null
        ? none(REASON.noHistory)
        : sales === 0
          ? none(c === 'py' ? REASON.sinceGoLive : REASON.noSales)
          : v(Math.round(((ar / sales) * p[c].days) * 10) / 10);
    // DPO = average trade AP ÷ credit purchases (QuickBooks bills less vendor credits) × days (2.8)
    const ap = avgFor('accountsPayable', c);
    const purchases = q?.creditPurchases?.[c];
    dpo[c] = !q || purchases === undefined
      ? none(qNote)
      : ap === null
        ? none(REASON.noHistory)
        : purchases === 0
          ? none(REASON.noPurchases)
          : v(Math.round(((ap / purchases) * p[c].days) * 10) / 10);
    // DIO = average inventory at cost (QuickBooks) ÷ COGS (ERP cost of tires sold) × days (2.9)
    const inv = avgFor('inventory', c);
    const sold = erp.sales[c];
    dio[c] = !q
      ? none(qNote)
      : sold.cogs === null
        ? none(REASON.noCost)
        : sold.cogs === 0
          ? none(c === 'py' ? REASON.sinceGoLive : REASON.noSales)
          : inv === null
            ? none(REASON.noHistory)
            : v(Math.round(((inv / sold.cogs) * p[c].days) * 10) / 10, sold.cogsComplete ? undefined : REASON.partialCost);
    // CCC = DIO + DSO − DPO (2.10)
    const parts = [dio[c], dso[c], dpo[c]];
    const missing = parts.find((x) => x.value === null);
    ccc[c] = missing
      ? none(missing.note ?? REASON.noHistory)
      : v(Math.round((dio[c].value! + dso[c].value! - dpo[c].value!) * 10) / 10);
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
    // Client: PY "since go-live" — no prior-year sales in the ERP is not a $0 year
    if (c === 'py' && s.units === 0 && s.revenue === 0) {
      const since = none(REASON.sinceGoLive);
      prof.revenue[c] = since;
      prof.cogs[c] = { ...since, pct: null };
      prof.grossProfit[c] = { ...since, pct: null };
      prof.opex[c] = { ...(opexValue === null ? none(qNote) : v(opexValue)), pct: null };
      prof.operatingProfit[c] = { ...since, pct: null };
      tire.tiresSold[c] = since;
      tire.revenue[c] = since;
      tire.cogs[c] = since;
      tire.grossProfit[c] = since;
      tire.opex[c] = since;
      tire.operatingProfit[c] = since;
      continue;
    }
    const costNote = s.cogsComplete ? undefined : REASON.partialCost;
    const cogsCell = s.cogs === null ? none(REASON.noCost) : v(s.cogs, costNote);
    const gp = s.cogs === null ? null : s.revenue - s.cogs;
    const op = gp === null || opexValue === null ? null : gp - opexValue;
    const pct = (x: number | null) => (x === null || s.revenue === 0 ? null : Math.round((x / s.revenue) * 1000) / 10);
    prof.revenue[c] = v(s.revenue);
    prof.cogs[c] = { ...cogsCell, pct: pct(s.cogs) };
    prof.grossProfit[c] = { ...(gp === null ? none(REASON.noCost) : v(gp, costNote)), pct: pct(gp) };
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

  // ---------- commission (separate from tire revenue and gross profit) ----------
  const commissionBilled = {} as Record<Cols4, Cell>;
  for (const c of cols4) {
    const amount = erp.commission[c as PeriodKey];
    const s = erp.sales[c as PeriodKey];
    // Same "since go-live" rule as revenue: no ERP activity in the prior year is not a $0 year
    commissionBilled[c] =
      c === 'py' && amount === 0 && s.units === 0 && s.revenue === 0 ? none(REASON.sinceGoLive) : v(amount);
  }
  const commission: ExecutiveDashboardModel['commission'] = {
    billed: commissionBilled,
    unbilled: v(erp.commissionUnbilled.amount),
    unbilledOrders: erp.commissionUnbilled.orders,
  };

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

  // ---------- daily history (backlog / inventory units, migration 163) ----------
  // Spec: T90 Avg / YTD Avg = average of daily values; PY = value one year earlier
  const pyDate = addYears(erp.asOf, -1);
  const histAvg = (pick: (d: DailySnapshot) => number | null, from: string, days: number): Cell => {
    const values = history
      .filter((d) => d.date >= from && d.date <= erp.asOf)
      .map(pick)
      .filter((x): x is number => x !== null && Number.isFinite(x));
    if (values.length === 0) {
      return none(REASON.noHistory);
    }
    const value = Math.round(avg(values)! * 100) / 100;
    return values.length < days ? v(value, `${values.length} of ${days} days`) : v(value);
  };
  const histRow = (pick: (d: DailySnapshot) => number | null) => {
    const py = history.find((d) => d.date === pyDate);
    const pyValue = py ? pick(py) : null;
    return {
      t90Avg: histAvg(pick, p.t90.from, p.t90.days),
      ytdAvg: histAvg(pick, p.ytd.from, p.ytd.days),
      py: pyValue === null ? none(REASON.noHistory) : v(pyValue),
    };
  };
  const perTireOf = (amount: (d: DailySnapshot) => number | null, units: (d: DailySnapshot) => number) => (d: DailySnapshot) => {
    const a = amount(d);
    const u = units(d);
    return a === null || u === 0 ? null : a / u;
  };

  // ---------- backlog ----------
  const b = erp.backlog;
  const bGp = b.cogs === null ? null : b.revenue - b.cogs;
  const bCostNote = b.cogsComplete ? undefined : REASON.partialCost;
  const histNone = { t90Avg: none(REASON.noHistory), ytdAvg: none(REASON.noHistory), py: none(REASON.noHistory) };
  const costNone = { t90Avg: none(REASON.noCost), ytdAvg: none(REASON.noCost), py: none(REASON.noCost) };
  const backlog: ExecutiveDashboardModel['backlog'] = {
    tires: { current: v(b.tires), ...histRow((d) => d.backlogTires) },
    revenue: { current: v(b.revenue), ...histRow((d) => d.backlogRevenue) },
    revenuePerTire: {
      current: b.tires ? v(Math.round((b.revenue / b.tires) * 100) / 100) : none(REASON.noSales),
      ...histRow(perTireOf((d) => d.backlogRevenue, (d) => d.backlogTires)),
    },
    grossProfit: { current: bGp === null ? none(REASON.noCost) : v(bGp, bCostNote), ...(bGp === null ? costNone : histNone) },
    gpPerTire: {
      current: bGp === null ? none(REASON.noCost) : v(div(bGp, b.tires) === null ? null : Math.round((bGp / b.tires) * 100) / 100, bCostNote),
      ...(bGp === null ? costNone : histNone),
    },
    gpPct: {
      current: bGp === null ? none(REASON.noCost) : v(div(bGp, b.revenue) === null ? null : Math.round((bGp / b.revenue) * 1000) / 10, bCostNote),
      ...(bGp === null ? costNone : histNone),
    },
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
    tiresOnHand: { current: v(inv.tiresOnHand), ...histRow((d) => d.tiresOnHand) },
    costPerTire: {
      current: !current ? none(qNote) : inv.tiresOnHand === 0 ? none(REASON.noUnits) : v(Math.round((invCost! / inv.tiresOnHand) * 100) / 100),
      ...histRow(perTireOf((d) => d.inventoryAtCost, (d) => d.tiresOnHand)),
    },
    uncommitted: { current: v(inv.uncommitted), ...histRow((d) => d.uncommitted) },
    monthsOfSupply: {
      current: inv.monthsOfSupply === null ? none('No tires sold in the last 3 completed months') : v(inv.monthsOfSupply),
      ...histRow((d) => d.monthsOfSupply),
    },
  };

  const projection = current ? buildCashProjection(current.cash, erp.backlogOrders, erp.asOf) : null;

  return {
    asOf: erp.asOf,
    quickBooks: { connected: qboConnected, asOf: qbo?.asOf ?? null, environment: qbo?.environment ?? null, hasPeriods: Boolean(q) },
    liquidity: {
      cashToday: current ? v(current.cash) : none(qNote),
      cashDate: current?.date ?? null,
      cashPy: pyBal ? v(pyBal.cash) : none(q ? REASON.noHistory : qNote),
      lowCash: none(REASON.noProjection),
      highCash: none(REASON.noProjection),
      projectedCash: projection
        ? v(projection.quarters[projection.quarters.length - 1]!.closing, `Through ${projection.throughDate} · orders on the books`)
        : none(qNote),
      projection,
    },
    workingCapital: {
      ar: wcRow('accountsReceivable', q ? v(q.arWeightedDays, 'days to receipt') : none(qNote)),
      ap: wcRow('accountsPayable', q ? v(q.apWeightedDays, 'days to payment') : none(qNote)),
      inventory: wcRow('inventory', none('—')),
    },
    efficiency: { dso, dpo, dio, ccc },
    efficiencyInputs,
    cashGeneration: { ocf, capex, fcf },
    profitability: prof,
    perTire: tire,
    opexRunRate,
    backlog,
    commission,
    supply: erp.supply.map((s) => ({ ...s, containers: s.containerCount > 0 ? v(s.containerCount) : none(REASON.noContainers) })),
    inventory,
  };
}
