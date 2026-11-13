/**
 * Executive dashboard view model (Ankur's spec, 11 tables).
 *
 * Combines the ERP figures (executive-erp.service) and the latest QuickBooks
 * snapshot (qbo-financials.service). Every cell is a value or null with the
 * reason it is unavailable — no sample numbers.
 */

// import type { BacklogOrder, ErpExecutiveFigures, SupplyCycle } from '../services/executive-erp.service';
import type { BacklogOrder, ErpExecutiveFigures, SupplierPayable, SupplyCycle } from '../services/executive-erp.service';
import type { DailySnapshot } from '../services/executive-history.service';
import type { QboBalances, QboFinancials, QboOpenBills, QboOpenInvoices } from '@/modules/integrations/quickbooks/services/qbo-financials.service';
// import { addYears } from './periods';
// import { addYears, trailingMonths } from './periods';
// import { addYears, completedMonthsYtd, trailingMonths } from './periods';
import { addDays, addYears, completedMonthsYtd, trailingMonths } from './periods';
import { qboCommission } from './commission';
// PeriodKey: used by the commented ERP rows -- import { type PeriodKey } from './periods';

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
  /** QuickBooks open invoices due in the quarter (overdue / no due date → current quarter) */
  receivables: number;
  /** Number of those invoices */
  invoices: number;
  /** QuickBooks open bills due in the quarter, paid out (overdue / no due date → current quarter) */
  payables: number;
  /** Number of those bills */
  bills: number;
  /**
   * Nov 12 2026 (Ankur, Nov 11 email): OPEX paid out in the quarter at the YTD run
   * rate, ((YTD OPEX / months) x 12) / 4. Current quarter: only the days left
   * after today. 0 without QuickBooks OPEX.
   */
  opex: number;
  /**
   * Nov 13 2026 (Ankur, Nov 12 email: net 45 after delivery): supplier POs not delivered
   * yet (bill not in QuickBooks yet), paid out at expected delivery + 45 days. 0 when none.
   */
  supplierPayables: number;
  /** Number of those POs */
  supplierPos: number;
  closing: number;
  orders: number;
  tires: number;
}

/** Nov 12 2026: OPEX run rate used by Projected Cash (null = not in the snapshot) */
export interface ProjectionOpex {
  /** YTD OPEX / months: one month of OPEX */
  monthly: number;
  ytd: number;
  // Before Nov 13 2026: Current month number of the QuickBooks as-of date (Nov = 11)
  /** Nov 13 2026: completed months of the year (Nov 12 → 10, Jan–Oct); 1 in January (month to date) */
  months: number;
  /** Nov 13 2026: the months behind `ytd`, e.g. "Jan–Oct" (missing in older code paths) */
  period?: string;
  /** Basis of the YTD OPEX (Cash whenever the snapshot has it) */
  basis: 'Cash' | 'Accrual';
}

export interface CashProjection {
  quarters: CashQuarter[];
  throughDate: string;
  /** QuickBooks open sales orders included, or 'missing' when the snapshot has none (Nov 7 2026) */
  // Before Nov 9 2026: ordersSource: 'quickbooks' | 'missing';
  // Nov 9 2026: 'erp' = QuickBooks open sales orders not available, ERP orders on the books used for now
  ordersSource: 'quickbooks' | 'erp' | 'missing';
  /** Backlog orders placed in the current quarter: no expected date / date already passed */
  undatedOrders: number;
  overdueOrders: number;
  /** QuickBooks open invoices included (null: not in this snapshot, sync QuickBooks again) */
  openInvoices: { total: number; overdue: number; count: number; asOf: string | null } | null;
  /** QuickBooks open bills included (null: not in this snapshot) */
  openBills: { total: number; overdue: number; count: number } | null;
  /**
   * Lowest / highest projected daily cash from today to the Through Date: cash
   * moves on each invoice / bill due date and each order's expected delivery
   * date (overdue or no date → today). Null until the snapshot has open invoices and bills.
   */
  lowCash: { value: number; date: string } | null;
  highCash: { value: number; date: string } | null;
  /** The day-by-day cash movements behind Low / High Cash */
  movements: CashMovement[];
  /** Nov 12 2026: OPEX run rate taken off each quarter (null = not included) */
  opex?: ProjectionOpex | null;
  /** Nov 13 2026: days after delivery the orders are paid (ERP orders: net 30; 0 = on the expected date) */
  orderPaymentDays?: number;
  /**
   * Nov 13 2026: supplier POs (net 45 after delivery). included = paid out in the
   * projection; billed = left out because a QuickBooks open bill shows the PO number
   * (already in the open bills). Null = the ERP figures had no supplier POs list.
   */
  supplierPayables?: {
    termsDays: number;
    total: number;
    included: Array<SupplierPayable & { payDate: string }>;
    billed: Array<SupplierPayable & { bill: string }>;
  } | null;
}

export interface CashMovement {
  date: string;
  // kind: 'Invoice' | 'Bill' | 'Order';
  // Nov 12 2026: 'OPEX' = one month of OPEX at the YTD run rate, on the month-end
  // kind: 'Invoice' | 'Bill' | 'Order' | 'OPEX';
  // Nov 13 2026: 'Supplier PO' = supplier PO not billed yet, paid at delivery + 45
  kind: 'Invoice' | 'Bill' | 'Order' | 'OPEX' | 'Supplier PO';
  ref: string;
  party: string;
  amount: number;
  /** Cash at the end of that day */
  balance: number;
}
type EffCols = 'pm' | 't90' | 'ytd' | 'py';
type AvgCols = 'current' | 't90Avg' | 'ytdAvg' | 'py';
/** Nov 12 2026 (Ankur, Nov 11 email): Backlog columns Current / T3M / T12M, no PY */
type BacklogCols = 'current' | 't3m' | 't12m';
type BacklogKey = 'tires' | 'revenue' | 'revenuePerTire' | 'grossProfit' | 'gpPerTire' | 'gpPct';

export interface ExecutiveDashboardModel {
  asOf: string;
  quickBooks: { connected: boolean; asOf: string | null; environment: string | null; hasPeriods: boolean; hasPnl: boolean; pnlBasis: 'Cash' | 'Accrual'; hasOpenInvoices: boolean };
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
      creditSales: number | null;
      avgAp: number | null;
      creditPurchases: number | null;
      avgInventory: number | null;
      cogs: number | null;
    }
  >;
  cashGeneration: Record<'ocf' | 'capex' | 'fcf', Record<Cols4, Cell>>;
  profitability: Record<'revenue' | 'cogs' | 'grossProfit' | 'opex' | 'operatingProfit' | 'netIncome', Record<Cols4, Cell & { pct?: number | null }>>;
  perTire: Record<'tiresSold' | 'revenue' | 'cogs' | 'grossProfit' | 'opex' | 'operatingProfit', Record<Cols4, Cell>>;
  // opexRunRate: Record<'monthly' | 'annualized', Record<'current' | 't90' | 'py', Cell>>;
  // Nov 12 2026 (Ankur, Nov 11 email): Previous Month / T90 Average / YTD, no PY
  opexRunRate: Record<'monthly' | 'annualized', Record<'pm' | 't90' | 'ytd', Cell>>;
  // backlog: Record<'tires' | 'revenue' | 'revenuePerTire' | 'grossProfit' | 'gpPerTire' | 'gpPct', Record<AvgCols, Cell>>;
  backlog: Record<BacklogKey, Record<BacklogCols, Cell>>;
  /** Commission from Galileo, reported apart from tire revenue and gross profit */
  commission: { billed: Record<Cols4, Cell>; unbilled: Cell; unbilledOrders: number };
  supply: Array<SupplyCycle & { containers: Cell }>;
  inventory: Record<'atCost' | 'tiresOnHand' | 'costPerTire' | 'uncommitted' | 'monthsOfSupply', Record<AvgCols, Cell>>;
}

const v = (value: number | null | undefined, note?: string): Cell =>
  value === null || value === undefined || !Number.isFinite(value) ? { value: null, note } : { value, ...(note ? { note } : {}) };
const none = (note: string): Cell => ({ value: null, note });
// Nov 7 2026: unused since Backlog GP moved to QuickBooks revenue (kept for reference)
// const div = (a: number | null | undefined, b: number | null | undefined) =>
//   a === null || a === undefined || b === null || b === undefined || b === 0 ? null : a / b;
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

/**
 * Orders used by Projected Cash (Nov 7 2026, Ankur Nov 5 call: open sales orders
 * come from QuickBooks). QuickBooks open sales orders only: when the snapshot
 * has none, no orders are added and the dashboard says "Sync QuickBooks".
 * Before Nov 7 2026 the ERP orders on the books (erp.backlogOrders) were used.
 */
// Before Nov 9 2026 (QuickBooks only):
// export function projectionOrdersOf(
//   qbo: QboFinancials | null
// ): { orders: BacklogOrder[]; source: 'quickbooks' | 'missing' } {
//   const qso = qbo?.periods?.openSalesOrders;
//   if (!qso) {
//     // Before Nov 7 2026: return { orders: erp.backlogOrders, source: 'erp' };
//     return { orders: [], source: 'missing' };
//   }
// Nov 9 2026 (Ankur, Nov 7 email: "If we cannot find it from there we can temporarily use from ERP
// although I prefer QuickBooks"): QuickBooks open sales orders first; when the snapshot has none,
// the ERP orders on the books (erp.backlogOrders) for now. Pass no erpOrders to get 'missing' as before.
export function projectionOrdersOf(
  qbo: QboFinancials | null,
  erpOrders?: BacklogOrder[]
): { orders: BacklogOrder[]; source: 'quickbooks' | 'erp' | 'missing' } {
  const qso = qbo?.periods?.openSalesOrders;
  if (!qso) {
    // return erpOrders ? { orders: erpOrders, source: 'erp' } : { orders: [], source: 'missing' };
    // Nov 13 2026 (Ankur, Nov 12 email: "Payment terms are typically net 30 after delivery"):
    // ERP orders are paid 30 days after their expected delivery. QuickBooks open sales orders
    // keep their ship / due date as it is (a due date already includes the terms).
    return erpOrders
      ? { orders: erpOrders.map((o) => ({ ...o, paymentTermsDays: CUSTOMER_PAYMENT_TERMS_DAYS })), source: 'erp' }
      : { orders: [], source: 'missing' };
  }
  return {
    source: 'quickbooks',
    orders: qso.orders.map((o) => ({
      order: o.doc,
      orderDate: o.txnDate,
      status: o.status,
      expectedDate: o.expectedDate,
      dateSource: o.expectedDate ? ('QuickBooks ship / due date' as const) : null,
      tires: o.quantity,
      revenue: o.amount,
    })),
  };
}

/** Nov 13 2026 (Ankur, Nov 12 email): customers pay net 30 after delivery */
export const CUSTOMER_PAYMENT_TERMS_DAYS = 30;

/**
 * Nov 13 2026: day an order's cash comes in = expected delivery date (no date /
 * date passed → today) + the order's payment terms (none → the delivery day, as before).
 */
export function orderCashDate(order: BacklogOrder, asOf: string): string {
  const delivery = order.expectedDate && order.expectedDate > asOf ? order.expectedDate : asOf;
  return order.paymentTermsDays && order.paymentTermsDays > 0 ? addDays(delivery, order.paymentTermsDays) : delivery;
}

/** Nov 13 2026 (Ankur, Nov 12 email: "After the container is delivered we pay on net 45 terms") */
export const SUPPLIER_PAYMENT_TERMS_DAYS = 45;

/** Nov 13 2026: day a supplier PO is paid = expected delivery (no date / passed → today) + 45 days */
export function supplierPayDate(po: SupplierPayable, asOf: string): string {
  const delivery = po.expectedDate && po.expectedDate > asOf ? po.expectedDate : asOf;
  return addDays(delivery, SUPPLIER_PAYMENT_TERMS_DAYS);
}

/**
 * Nov 13 2026: the QuickBooks open bill that carries this PO's number (digits of the
 * PO number, e.g. "PO-2600038" → "2600038", found in the bill no.), or null. Such a
 * PO is already paid out through the open bills, so it is not counted twice.
 */
export function billOfSupplierPo(po: SupplierPayable, openBills: QboOpenBills | null | undefined): string | null {
  const digits = po.po.replace(/\D/g, '');
  if (digits.length < 5) {
    return null;
  }
  const bill = (openBills?.bills ?? []).find((b) => b.doc.replace(/\D/g, '').includes(digits));
  return bill ? bill.doc : null;
}

// Before Nov 13 2026 (cash on the expected delivery date):
// /** Quarter an order is expected to be invoiced in: no date / date passed → current quarter */
// export function cashQuarterOf(order: BacklogOrder, asOf: string): string {
//   const current = quarterStart(asOf);
//   return order.expectedDate && order.expectedDate >= current ? quarterStart(order.expectedDate) : current;
// }
/** Quarter an order's cash comes in: expected delivery (no date / passed → today) + payment terms */
export function cashQuarterOf(order: BacklogOrder, asOf: string): string {
  return quarterStart(orderCashDate(order, asOf));
}

/** Quarter an open invoice is expected to be paid in: due date; no date / overdue → current quarter */
export function invoiceQuarterOf(dueDate: string | null, asOf: string): string {
  const current = quarterStart(asOf);
  return dueDate && dueDate >= current ? quarterStart(dueDate) : current;
}

/**
 * Projected Cash (Ankur, Oct 27 + Nov 5 calls): Cash Today + QuickBooks open
 * invoices (by due date) + orders on the books still to be invoiced (by expected
 * delivery date), going forward, quarter by quarter. At least 4 quarters,
 * through the quarter of the last expected order / invoice due date.
 * Without open invoices (older snapshot) it is Cash Today + orders, as before.
 */
/**
 * Nov 12 2026: OPEX at the run rate, one amount per month-end from the day after
 * `asOf` through `through` (a quarter end). The current month is prorated by the
 * days left after today (e.g. Nov 12: 18 of 30 days); later months are whole.
 */
export function opexByMonthEnd(monthly: number, asOf: string, through: string): Array<{ date: string; amount: number; ref: string }> {
  const out: Array<{ date: string; amount: number; ref: string }> = [];
  if (!(monthly > 0)) {
    return out;
  }
  const [y0, m0] = asOf.split('-').map(Number) as [number, number];
  for (let i = 0; i < 120; i++) {
    const start = new Date(Date.UTC(y0, m0 - 1 + i, 1));
    const end = new Date(Date.UTC(y0, m0 + i, 0));
    const endIso = end.toISOString().slice(0, 10);
    if (start.toISOString().slice(0, 10) > through) {
      break;
    }
    const daysInMonth = end.getUTCDate();
    const daysLeft = i === 0 ? daysInMonth - Number(asOf.slice(8, 10)) : daysInMonth;
    if (daysLeft <= 0) {
      continue;
    }
    const amount = Math.round(monthly * (daysLeft / daysInMonth) * 100) / 100;
    const label = endIso.slice(0, 7);
    out.push({ date: endIso, amount, ref: i === 0 ? `${label} (${daysLeft} of ${daysInMonth} days)` : label });
  }
  return out;
}

export function buildCashProjection(
  cashToday: number,
  orders: BacklogOrder[],
  asOf: string,
  openInvoices?: QboOpenInvoices | null,
  invoicesAsOf: string | null = null,
  openBills?: QboOpenBills | null,
  // Before Nov 9 2026: ordersSource: 'quickbooks' | 'missing' = 'missing'
  ordersSource: 'quickbooks' | 'erp' | 'missing' = 'missing',
  // Nov 12 2026 (Ankur, Nov 11 email): OPEX at the YTD run rate; null = not included (as before)
  opexRunRate: ProjectionOpex | null = null,
  // Nov 13 2026 (Ankur, Nov 12 email): supplier POs not delivered yet, paid at delivery + 45;
  // null / missing = not included (as before)
  supplierPos: SupplierPayable[] | null = null
): CashProjection {
  const current = quarterStart(asOf);
  const byQuarter = new Map<string, { inflow: number; receivables: number; invoices: number; payables: number; bills: number; orders: number; tires: number }>();
  const rowOf = (q: string) => byQuarter.get(q) ?? { inflow: 0, receivables: 0, invoices: 0, payables: 0, bills: 0, orders: 0, tires: 0 };
  let last = current;
  for (const o of orders) {
    const q = cashQuarterOf(o, asOf);
    const row = rowOf(q);
    row.inflow += o.revenue;
    row.orders += 1;
    row.tires += o.tires;
    byQuarter.set(q, row);
    last = q > last ? q : last;
  }
  for (const inv of openInvoices?.invoices ?? []) {
    const q = invoiceQuarterOf(inv.dueDate, asOf);
    const row = rowOf(q);
    row.receivables += inv.balance;
    row.invoices += 1;
    byQuarter.set(q, row);
    last = q > last ? q : last;
  }
  for (const bill of openBills?.bills ?? []) {
    const q = invoiceQuarterOf(bill.dueDate, asOf);
    const row = rowOf(q);
    row.payables += bill.balance;
    row.bills += 1;
    byQuarter.set(q, row);
    last = q > last ? q : last;
  }

  // Nov 13 2026: supplier POs not billed yet, in the quarter of delivery + 45 days. A PO whose
  // number is on a QuickBooks open bill is already in the open bills above (not counted twice).
  const poIncluded: Array<SupplierPayable & { payDate: string }> = [];
  const poBilled: Array<SupplierPayable & { bill: string }> = [];
  for (const po of supplierPos ?? []) {
    const bill = billOfSupplierPo(po, openBills);
    if (bill) {
      poBilled.push({ ...po, bill });
    } else {
      poIncluded.push({ ...po, payDate: supplierPayDate(po, asOf) });
    }
  }
  const poByQuarter = new Map<string, { amount: number; count: number }>();
  for (const po of poIncluded) {
    const q = quarterStart(po.payDate);
    const r = poByQuarter.get(q) ?? { amount: 0, count: 0 };
    r.amount += po.amount;
    r.count += 1;
    poByQuarter.set(q, r);
    last = q > last ? q : last;
  }

  // Nov 12 2026: OPEX per month-end from tomorrow (Ankur: ((YTD OPEX / months) x 12) / 4 a quarter,
  // i.e. one month x 3). The current month counts only its days after today.
  const quarterStarts: string[] = [];
  for (let q = current, i = 0; i < 4 || q <= last; q = nextQuarter(q), i++) {
    quarterStarts.push(q);
  }
  const opexMonths = opexRunRate ? opexByMonthEnd(opexRunRate.monthly, asOf, quarterEnd(quarterStarts[quarterStarts.length - 1]!)) : [];
  const opexIn = (start: string, end: string) => opexMonths.filter((m) => m.date >= start && m.date <= end).reduce((n, m) => n + m.amount, 0);

  const quarters: CashQuarter[] = [];
  let opening = cashToday;
  // for (let q = current, i = 0; i < 4 || q <= last; q = nextQuarter(q), i++) {
  for (const q of quarterStarts) {
    const row = rowOf(q);
    const inflow = Math.round(row.inflow * 100) / 100;
    const receivables = Math.round(row.receivables * 100) / 100;
    const payables = Math.round(row.payables * 100) / 100;
    // const closing = Math.round((opening + receivables + inflow - payables) * 100) / 100;
    const opex = Math.round(opexIn(q, quarterEnd(q)) * 100) / 100;
    // const closing = Math.round((opening + receivables + inflow - payables - opex) * 100) / 100;
    // Nov 13 2026: minus supplier POs not billed yet (delivery + 45)
    const supplierPayables = Math.round((poByQuarter.get(q)?.amount ?? 0) * 100) / 100;
    const closing = Math.round((opening + receivables + inflow - payables - opex - supplierPayables) * 100) / 100;
    quarters.push({
      label: quarterLabel(q),
      start: q,
      end: quarterEnd(q),
      opening,
      inflow,
      receivables,
      invoices: row.invoices,
      payables,
      bills: row.bills,
      opex,
      supplierPayables,
      supplierPos: poByQuarter.get(q)?.count ?? 0,
      closing,
      orders: row.orders,
      tires: row.tires,
    });
    opening = closing;
  }

  // Day by day (Low / High Cash): every movement on its date, overdue / undated → today
  const throughDate = quarters[quarters.length - 1]!.end;
  const onDate = (d: string | null | undefined) => (d && d > asOf ? d : asOf);
  const moves: Array<Omit<CashMovement, 'balance'>> = [
    ...(openInvoices?.invoices ?? []).map((i) => ({ date: onDate(i.dueDate), kind: 'Invoice' as const, ref: i.doc, party: i.customer, amount: i.balance })),
    ...(openBills?.bills ?? []).map((b) => ({ date: onDate(b.dueDate), kind: 'Bill' as const, ref: b.doc, party: b.vendor, amount: -b.balance })),
    // ...orders.map((o) => ({ date: onDate(o.expectedDate), kind: 'Order' as const, ref: o.order, party: '', amount: o.revenue })),
    // Nov 13 2026: on the day the order is paid (ERP orders: delivery + 30)
    ...orders.map((o) => ({ date: orderCashDate(o, asOf), kind: 'Order' as const, ref: o.order, party: '', amount: o.revenue })),
    // Nov 12 2026: OPEX at the YTD run rate, one movement per month-end
    ...opexMonths.map((m) => ({ date: m.date, kind: 'OPEX' as const, ref: m.ref, party: '', amount: -m.amount })),
    // Nov 13 2026: supplier POs not billed yet, on delivery + 45
    ...poIncluded.map((po) => ({ date: po.payDate, kind: 'Supplier PO' as const, ref: po.po, party: '', amount: -po.amount })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  const movements: CashMovement[] = [];
  let balance = cashToday;
  let low = { value: cashToday, date: asOf };
  let high = { value: cashToday, date: asOf };
  moves.forEach((m, i) => {
    balance = Math.round((balance + m.amount) * 100) / 100;
    movements.push({ ...m, balance });
    // Compare once per day, after all of that day's movements
    if (moves[i + 1]?.date !== m.date) {
      if (balance < low.value) {
        low = { value: balance, date: m.date };
      }
      if (balance > high.value) {
        high = { value: balance, date: m.date };
      }
    }
  });
  const daily = Boolean(openInvoices && openBills);

  return {
    quarters,
    throughDate,
    ordersSource,
    undatedOrders: orders.filter((o) => !o.expectedDate).length,
    overdueOrders: orders.filter((o) => o.expectedDate && o.expectedDate < current).length,
    orderPaymentDays: orders.reduce((n, o) => Math.max(n, o.paymentTermsDays ?? 0), 0),
    openInvoices: openInvoices
      ? { total: openInvoices.total, overdue: openInvoices.overdue, count: openInvoices.count, asOf: invoicesAsOf }
      : null,
    openBills: openBills ? { total: openBills.total, overdue: openBills.overdue, count: openBills.count } : null,
    lowCash: daily ? low : null,
    highCash: daily ? high : null,
    movements: daily ? movements : [],
    opex: opexRunRate,
    supplierPayables: supplierPos
      ? {
          termsDays: SUPPLIER_PAYMENT_TERMS_DAYS,
          total: Math.round(poIncluded.reduce((n, po) => n + po.amount, 0) * 100) / 100,
          included: poIncluded,
          billed: poBilled,
        }
      : null,
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
    // QuickBooks P&L (Nov 6 2026): credit sales = Total Income, COGS = P&L COGS.
    // Accrual (when invoiced) since Nov 7 2026, as the shown P&L is cash basis;
    // older snapshots have an Accrual pnl and no accrualPnl.
    const pl = q?.accrualPnl?.[c] ?? (q?.pnlBasis === 'Cash' ? undefined : q?.pnl?.[c]);
    // ERP credit sales (replaced by QuickBooks): const sales = erp.creditSales[c];
    const sales = pl ? pl.income : null;
    const plCogs = pl ? pl.cogs : null;
    efficiencyInputs[c] = {
      days: p[c].days,
      avgAr: ar,
      creditSales: sales,
      avgAp: avgFor('accountsPayable', c),
      creditPurchases: q?.creditPurchases?.[c] ?? null,
      avgInventory: avgFor('inventory', c),
      // ERP COGS (replaced by QuickBooks): cogs: erp.sales[c].cogs,
      cogs: plCogs,
    };
    dso[c] = !q || sales === null
      ? none(qNote)
      : ar === null
        ? none(REASON.noHistory)
        : sales === 0
          ? none(REASON.noSales)
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
    // DIO = average inventory at cost ÷ COGS × days (2.9), both from QuickBooks
    const inv = avgFor('inventory', c);
    // ERP DIO (replaced by the QuickBooks P&L COGS, Nov 6 2026):
    // const sold = erp.sales[c];
    // dio[c] = !q
    //   ? none(qNote)
    //   : sold.cogs === null
    //     ? none(REASON.noCost)
    //     : sold.cogs === 0
    //       ? none(c === 'py' ? REASON.sinceGoLive : REASON.noSales)
    //       : inv === null
    //         ? none(REASON.noHistory)
    //         : v(Math.round(((inv / sold.cogs) * p[c].days) * 10) / 10, sold.cogsComplete ? undefined : REASON.partialCost);
    dio[c] = !q || plCogs === null
      ? none(qNote)
      : plCogs === 0
        ? none(REASON.noSales)
        : inv === null
          ? none(REASON.noHistory)
          : v(Math.round(((inv / plCogs) * p[c].days) * 10) / 10);
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
    netIncome: {},
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
    // ERP inputs of the old profitability / per tire rows (replaced by QuickBooks, Nov 6 2026):
    // const s = erp.sales[c as PeriodKey];
    // const opexValue = q ? q.opex[c as PeriodKey] : null;

    // Profitability (2.1) from the QuickBooks P&L (Ankur, Nov 5 call: all
    // financials from QuickBooks). Older snapshots have no P&L totals: sync again.
    const pl = q?.pnl?.[c];
    if (pl) {
      const plPct = (x: number) => (pl.income === 0 ? null : Math.round((x / pl.income) * 1000) / 10);
      prof.revenue[c] = v(pl.income);
      prof.cogs[c] = { ...v(pl.cogs), pct: plPct(pl.cogs) };
      prof.grossProfit[c] = { ...v(pl.grossProfit), pct: plPct(pl.grossProfit) };
      prof.opex[c] = { ...v(pl.opex), pct: plPct(pl.opex) };
      prof.operatingProfit[c] = { ...v(pl.netOperatingIncome), pct: plPct(pl.netOperatingIncome) };
      // Ankur compares with QuickBooks Net Income (Nov 5 2026 call)
      prof.netIncome[c] = { ...v(pl.netIncome), pct: plPct(pl.netIncome) };
    } else {
      const missing = { ...none(qNote), pct: null };
      prof.revenue[c] = none(qNote);
      prof.cogs[c] = missing;
      prof.grossProfit[c] = missing;
      prof.opex[c] = missing;
      prof.operatingProfit[c] = missing;
      prof.netIncome[c] = missing;
    }

    // Per tire (2.2) from QuickBooks (Nov 6 2026): tires = Sales by Product/Service
    // tire quantity; revenue = P&L tire sales (commission excluded); COGS and
    // OPEX from the P&L. Operating profit per tire = tire gross profit − OPEX.
    const units = q?.units?.[c];
    if (pl && units) {
      const each = (x: number) => (units.total === 0 ? none(REASON.noSales) : v(Math.round((x / units.total) * 100) / 100));
      tire.tiresSold[c] = v(units.total);
      tire.revenue[c] = each(pl.salesRevenue);
      tire.cogs[c] = each(pl.cogs);
      tire.grossProfit[c] = each(pl.salesRevenue - pl.cogs);
      tire.opex[c] = each(pl.opex);
      tire.operatingProfit[c] = each(pl.salesRevenue - pl.cogs - pl.opex);
    } else {
      for (const key of ['tiresSold', 'revenue', 'cogs', 'grossProfit', 'opex', 'operatingProfit'] as const) {
        tire[key][c] = none(qNote);
      }
    }
    //// ERP per tire (replaced by QuickBooks above, Nov 6 2026):
    //// Client: PY "since go-live" — no prior-year sales in the ERP is not a $0 year
    // if (c === 'py' && s.units === 0 && s.revenue === 0) {
    //   const since = none(REASON.sinceGoLive);
    //  // ERP profitability (replaced by the QuickBooks P&L above, Nov 6 2026):
    //  // prof.revenue[c] = since;
    //  // prof.cogs[c] = { ...since, pct: null };
    //  // prof.grossProfit[c] = { ...since, pct: null };
    //  // prof.opex[c] = { ...(opexValue === null ? none(qNote) : v(opexValue)), pct: null };
    //  // prof.operatingProfit[c] = { ...since, pct: null };
    //   tire.tiresSold[c] = since;
    //   tire.revenue[c] = since;
    //   tire.cogs[c] = since;
    //   tire.grossProfit[c] = since;
    //   tire.opex[c] = since;
    //   tire.operatingProfit[c] = since;
    //   continue;
    // }
    //// ERP-only inputs of the old profitability rows:
    //// const costNote = s.cogsComplete ? undefined : REASON.partialCost;
    //// const cogsCell = s.cogs === null ? none(REASON.noCost) : v(s.cogs, costNote);
    // const gp = s.cogs === null ? null : s.revenue - s.cogs;
    // const op = gp === null || opexValue === null ? null : gp - opexValue;
    //// ERP profitability (replaced by the QuickBooks P&L above, Nov 6 2026):
    //// const pct = (x: number | null) => (x === null || s.revenue === 0 ? null : Math.round((x / s.revenue) * 1000) / 10);
    //// prof.revenue[c] = v(s.revenue);
    //// prof.cogs[c] = { ...cogsCell, pct: pct(s.cogs) };
    //// prof.grossProfit[c] = { ...(gp === null ? none(REASON.noCost) : v(gp, costNote)), pct: pct(gp) };
    //// prof.opex[c] = { ...(opexValue === null ? none(qNote) : v(opexValue)), pct: pct(opexValue) };
    //// prof.operatingProfit[c] = { ...(op === null ? none(gp === null ? REASON.noCost : qNote) : v(op)), pct: pct(op) };

    // const perUnit = (x: number | null, missing: string) => (s.units === 0 ? none(REASON.noSales) : x === null ? none(missing) : v(Math.round((x / s.units) * 100) / 100));
    // tire.tiresSold[c] = v(s.units);
    // tire.revenue[c] = perUnit(s.revenue, '');
    // tire.cogs[c] = perUnit(s.cogs, REASON.noCost);
    // tire.grossProfit[c] = perUnit(gp, REASON.noCost);
    // tire.opex[c] = perUnit(opexValue, qNote);
    // tire.operatingProfit[c] = perUnit(op, gp === null ? REASON.noCost : qNote);
  }

  // ---------- commission (separate from tire revenue and gross profit) ----------
  const commissionBilled = {} as Record<Cols4, Cell>;
  for (const c of cols4) {
    // Commission billed = QuickBooks commission income accounts (Nov 6 2026)
    // const pl = q?.pnl?.[c];
    // commissionBilled[c] = pl ? v(pl.commission) : none(qNote);
    // Nov 10 2026: Accrual basis (counted when invoiced, paid or not); Cash
    // figure for snapshots synced before Nov 10
    const billed = qboCommission(q, c);
    commissionBilled[c] = billed ? v(billed.amount) : none(qNote);
    // ERP commission invoices (replaced by QuickBooks):
    // const amount = erp.commission[c as PeriodKey];
    // const s = erp.sales[c as PeriodKey];
    // // Same "since go-live" rule as revenue: no ERP activity in the prior year is not a $0 year
    // commissionBilled[c] =
    //   c === 'py' && amount === 0 && s.units === 0 && s.revenue === 0 ? none(REASON.sinceGoLive) : v(amount);
  }
  const commission: ExecutiveDashboardModel['commission'] = {
    billed: commissionBilled,
    unbilled: v(erp.commissionUnbilled.amount),
    unbilledOrders: erp.commissionUnbilled.orders,
  };

  // ---------- OPEX run rate ----------
  // Before Nov 12 2026 (Current Month Est. / T90 Avg / PY):
  // const monthlyT90 = q ? q.opex.t90 / 3 : null;
  // const monthlyPy = q ? q.opex.t90py / 3 : null;
  // const opexRunRate: ExecutiveDashboardModel['opexRunRate'] = {
  //   monthly: {
  //     current: q ? none(`${REASON.noForecast} · MTD actual ${Math.round(q.opex.mtd).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`) : none(qNote),
  //     t90: q ? v(Math.round(monthlyT90! * 100) / 100) : none(qNote),
  //     py: q ? v(Math.round(monthlyPy! * 100) / 100) : none(qNote),
  //   },
  //   annualized: {
  //     current: q ? none(REASON.noForecast) : none(qNote),
  //     t90: q ? v(Math.round(monthlyT90! * 12 * 100) / 100) : none(qNote),
  //     py: q ? v(Math.round(monthlyPy! * 12 * 100) / 100) : none(qNote),
  //   },
  // };
  // Nov 12 2026, Ankur's Nov 11 email:
  //   Previous Month = last full calendar month's OPEX
  //   T90 Average    = T90 OPEX ÷ 3
  //   YTD            = YTD OPEX ÷ current month number (Nov = 11)
  //   Annualized     = monthly × 12
  // const opexYtdMonths = qbo ? Number(qbo.asOf.slice(5, 7)) : 0;
  // const opexMonthly = q
  //   ? { pm: q.opex.pm, t90: q.opex.t90 / 3, ytd: opexYtdMonths > 0 ? q.opex.ytd / opexYtdMonths : null }
  //   : null;
  // Nov 13 2026 (Ankur, Nov 12 email: "The months that closed so Jan-October"):
  //   YTD = OPEX of the completed months (Jan 1 → end of last month = YTD − MTD)
  //         ÷ number of completed months (Nov 12: Jan–Oct ÷ 10)
  //   January (no completed month yet): no value, with a note
  const opexClosed = qbo ? completedMonthsYtd(qbo.asOf) : null;
  const opexClosedTotal = (o: { ytd: number; mtd: number } | null | undefined) =>
    o && Number.isFinite(o.ytd) && Number.isFinite(o.mtd) ? Math.round((o.ytd - o.mtd) * 100) / 100 : null;
  const opexYtdClosed = q ? opexClosedTotal(q.opex) : null;
  const opexMonthly = q
    ? {
        pm: q.opex.pm,
        t90: q.opex.t90 / 3,
        ytd: opexClosed && opexClosed.months > 0 && opexYtdClosed !== null ? opexYtdClosed / opexClosed.months : null,
      }
    : null;
  const rr = (x: number | null | undefined, times = 1): Cell =>
    !q ? none(qNote) : x === null || x === undefined || !Number.isFinite(x) ? none(REASON.noQuickBooks) : v(Math.round(x * times * 100) / 100);
  const noClosedMonth = 'No completed month this year yet (January)';
  const rrYtd = (times: number): Cell =>
    q && opexClosed && opexClosed.months === 0
      ? none(noClosedMonth)
      : opexMonthly?.ytd !== null && opexMonthly?.ytd !== undefined && Number.isFinite(opexMonthly.ytd)
        ? v(Math.round(opexMonthly.ytd * times * 100) / 100, opexClosed?.label ? `${opexClosed.label} ÷ ${opexClosed.months}` : undefined)
        : rr(opexMonthly?.ytd, times);
  const opexRunRate: ExecutiveDashboardModel['opexRunRate'] = {
    // monthly: { pm: rr(opexMonthly?.pm), t90: rr(opexMonthly?.t90), ytd: rr(opexMonthly?.ytd) },
    // annualized: { pm: rr(opexMonthly?.pm, 12), t90: rr(opexMonthly?.t90, 12), ytd: rr(opexMonthly?.ytd, 12) },
    monthly: { pm: rr(opexMonthly?.pm), t90: rr(opexMonthly?.t90), ytd: rrYtd(1) },
    annualized: { pm: rr(opexMonthly?.pm, 12), t90: rr(opexMonthly?.t90, 12), ytd: rrYtd(12) },
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
  // const bGp = b.cogs === null ? null : b.revenue - b.cogs;
  const bCostNote = b.cogsComplete ? undefined : REASON.partialCost;
  const histNone = { t90Avg: none(REASON.noHistory), ytdAvg: none(REASON.noHistory), py: none(REASON.noHistory) };
  // const costNone = { t90Avg: none(REASON.noCost), ytdAvg: none(REASON.noCost), py: none(REASON.noCost) };
  // Nov 7 2026: Backlog Tires / Revenue / Revenue per Tire from the QuickBooks open sales
  // orders (not invoiced yet; product lines excl. tax), QuickBooks only like Open Orders.
  // Gross Profit, GP / Tire and GP %: QuickBooks revenue/tires minus ERP cost per tire (below).
  // Before Nov 7 2026 (ERP):
  //   tires: { current: v(b.tires), ...histRow((d) => d.backlogTires) },
  //   revenue: { current: v(b.revenue), ...histRow((d) => d.backlogRevenue) },
  //   revenuePerTire: { current: b.tires ? v(Math.round((b.revenue / b.tires) * 100) / 100) : none(REASON.noSales), ... },
  const qsoBacklog = q?.openSalesOrders ?? null;
  // Before Nov 9 2026: const noQboOrders = none('Sync QuickBooks (open sales orders)');
  // Nov 9 2026 (Ankur, Nov 7 email: "temporarily use from ERP"): without QuickBooks open sales
  // orders, Backlog uses the ERP firm orders not delivered yet (erp.backlog), as before Nov 7
  const erpNote = 'ERP open orders (QuickBooks sales orders not available)';
  const bGpErp = b.cogs === null ? null : Math.round((b.revenue - b.cogs) * 100) / 100;
  const erpGpCell = (value: number | null) => (bGpErp === null ? none(REASON.noCost) : v(value, bCostNote ?? erpNote));
  const erpGpHist = bGpErp === null ? { t90Avg: none(REASON.noCost), ytdAvg: none(REASON.noCost), py: none(REASON.noCost) } : histNone;
  // Nov 7 2026: Backlog GP = QuickBooks backlog revenue − QuickBooks backlog tires × ERP cost per
  // tire (ERP backlog cost ÷ ERP backlog tires: the average order-cycle cost of the open orders)
  const erpCostPerTire = b.cogs !== null && b.tires > 0 ? b.cogs / b.tires : null;
  const qGp = qsoBacklog && erpCostPerTire !== null ? Math.round((qsoBacklog.total - qsoBacklog.tires * erpCostPerTire) * 100) / 100 : null;
  const qGpReason = !qsoBacklog ? 'Sync QuickBooks (open sales orders)' : b.tires > 0 ? REASON.noCost : 'No ERP backlog tires to take the cost per tire from';
  const qGpCell = (value: number | null) => (qGp === null ? none(qGpReason) : v(value, bCostNote));
  const gpHistNone = { t90Avg: none(qGpReason), ytdAvg: none(qGpReason), py: none(qGpReason) };
  // Before Nov 9 2026: tires / revenue / revenuePerTire showed noQboOrders ("Sync QuickBooks") without QuickBooks
  // Before Nov 12 2026 this object was the table (Current / T90 Avg / YTD Avg / PY); now its
  // Current column and its "no history" notes are reused below for Current / T3M / T12M
  // const backlog: ExecutiveDashboardModel['backlog'] = {
  const backlogAvg: Record<BacklogKey, Record<AvgCols, Cell>> = {
    tires: { current: qsoBacklog ? v(qsoBacklog.tires) : v(b.tires, erpNote), ...histRow((d) => d.backlogTires) },
    revenue: { current: qsoBacklog ? v(qsoBacklog.total) : v(b.revenue, erpNote), ...histRow((d) => d.backlogRevenue) },
    revenuePerTire: {
      current: !qsoBacklog
        ? b.tires
          ? v(Math.round((b.revenue / b.tires) * 100) / 100, erpNote)
          : none(REASON.noSales)
        : qsoBacklog.tires
          ? v(Math.round((qsoBacklog.total / qsoBacklog.tires) * 100) / 100)
          : none(REASON.noSales),
      ...histRow(perTireOf((d) => d.backlogRevenue, (d) => d.backlogTires)),
    },
    // Before Nov 7 2026 (all ERP: ERP backlog revenue − ERP backlog cost):
    // grossProfit: { current: bGp === null ? none(REASON.noCost) : v(bGp, bCostNote), ...(bGp === null ? costNone : histNone) },
    // gpPerTire: { current: bGp === null ? none(REASON.noCost) : v(div(bGp, b.tires) === null ? null : Math.round((bGp / b.tires) * 100) / 100, bCostNote), ... },
    // gpPct: { current: bGp === null ? none(REASON.noCost) : v(div(bGp, b.revenue) === null ? null : Math.round((bGp / b.revenue) * 1000) / 10, bCostNote), ... },
    // Before Nov 9 2026 (QuickBooks only; "Sync QuickBooks" without it):
    // grossProfit: { current: qGpCell(qGp), ...(qGp === null ? gpHistNone : histNone) },
    // gpPerTire: { current: qGpCell(qGp === null || !qsoBacklog?.tires ? qGp : Math.round((qGp / qsoBacklog.tires) * 100) / 100), ...(qGp === null ? gpHistNone : histNone) },
    // gpPct: { current: qGpCell(qGp === null || !qsoBacklog?.total ? qGp : Math.round((qGp / qsoBacklog.total) * 1000) / 10), ...(qGp === null ? gpHistNone : histNone) },
    // Nov 9 2026: without QuickBooks open sales orders, GP = ERP backlog revenue − ERP backlog cost (as before Nov 7)
    grossProfit: qsoBacklog
      ? { current: qGpCell(qGp), ...(qGp === null ? gpHistNone : histNone) }
      : { current: erpGpCell(bGpErp), ...erpGpHist },
    gpPerTire: qsoBacklog
      ? { current: qGpCell(qGp === null || !qsoBacklog.tires ? qGp : Math.round((qGp / qsoBacklog.tires) * 100) / 100), ...(qGp === null ? gpHistNone : histNone) }
      : { current: erpGpCell(bGpErp === null || !b.tires ? bGpErp : Math.round((bGpErp / b.tires) * 100) / 100), ...erpGpHist },
    gpPct: qsoBacklog
      ? { current: qGpCell(qGp === null || !qsoBacklog.total ? qGp : Math.round((qGp / qsoBacklog.total) * 1000) / 10), ...(qGp === null ? gpHistNone : histNone) }
      : { current: erpGpCell(bGpErp === null || !b.revenue ? bGpErp : Math.round((bGpErp / b.revenue) * 1000) / 10), ...erpGpHist },
  };
  // Nov 12 2026 (Ankur, Nov 11 email): Current / T3M / T12M, no PY.
  // T3M / T12M = average of the daily backlog snapshots over the last 3 / 12 months
  // (same method as the T90 / YTD averages before). Gross profit rows have no daily
  // history, so they keep the note the T90 column showed.
  const t3m = trailingMonths(erp.asOf, 3);
  const t12m = trailingMonths(erp.asOf, 12);
  const backlogHist = (pick: (d: DailySnapshot) => number | null) => ({
    t3m: histAvg(pick, t3m.from, t3m.days),
    t12m: histAvg(pick, t12m.from, t12m.days),
  });
  const noBacklogHist = (row: Record<AvgCols, Cell>) => ({ t3m: row.t90Avg, t12m: row.t90Avg });
  const backlog: ExecutiveDashboardModel['backlog'] = {
    tires: { current: backlogAvg.tires.current, ...backlogHist((d) => d.backlogTires) },
    revenue: { current: backlogAvg.revenue.current, ...backlogHist((d) => d.backlogRevenue) },
    revenuePerTire: { current: backlogAvg.revenuePerTire.current, ...backlogHist(perTireOf((d) => d.backlogRevenue, (d) => d.backlogTires)) },
    grossProfit: { current: backlogAvg.grossProfit.current, ...noBacklogHist(backlogAvg.grossProfit) },
    gpPerTire: { current: backlogAvg.gpPerTire.current, ...noBacklogHist(backlogAvg.gpPerTire) },
    gpPct: { current: backlogAvg.gpPct.current, ...noBacklogHist(backlogAvg.gpPct) },
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

  // Before Nov 6 2026: buildCashProjection(current.cash, erp.backlogOrders, erp.asOf) — orders only
  // Before Nov 7 2026: buildCashProjection(current.cash, erp.backlogOrders, ...) — ERP orders only
  // Before Nov 9 2026: const projectionOrders = projectionOrdersOf(qbo);
  // Nov 9 2026: ERP orders on the books while QuickBooks open sales orders are not available (Ankur, Nov 7 email)
  const projectionOrders = projectionOrdersOf(qbo, erp.backlogOrders);
  // const projection = current ? buildCashProjection(current.cash, projectionOrders.orders, erp.asOf, q?.openInvoices ?? null, qbo?.asOf ?? null, q?.openBills ?? null, projectionOrders.source) : null;
  // Nov 12 2026 (Ankur, Nov 11 email): minus OPEX at the YTD run rate, YTD OPEX / current month number
  // (same as OPEX Run Rate > YTD). Cash basis whatever the P&L toggle shows (cash projection).
  // const projectionOpexYtd = q ? q.opexCash?.ytd ?? q.opex.ytd : null;
  // const projectionOpexMonths = qbo ? Number(qbo.asOf.slice(5, 7)) : 0;
  // Nov 13 2026 (Ankur, Nov 12 email): completed months only, same as OPEX Run Rate > YTD
  // (Nov 12: Jan–Oct OPEX ÷ 10). January has no completed month: the month to date ÷ 1
  // as before, so Projected Cash keeps taking OPEX off.
  const projectionOpexSource = q ? q.opexCash ?? q.opex : null;
  const projectionClosed = opexClosed && opexClosed.months > 0 ? opexClosed : null;
  const projectionOpexYtd = projectionOpexSource
    ? projectionClosed
      ? opexClosedTotal(projectionOpexSource)
      : projectionOpexSource.ytd
    : null;
  const projectionOpexMonths = projectionClosed ? projectionClosed.months : qbo ? 1 : 0;
  const projectionOpex: ProjectionOpex | null =
    q && projectionOpexYtd !== null && Number.isFinite(projectionOpexYtd) && projectionOpexMonths > 0
      ? {
          monthly: Math.round((projectionOpexYtd / projectionOpexMonths) * 100) / 100,
          ytd: projectionOpexYtd,
          months: projectionOpexMonths,
          basis: q.opexCash ? 'Cash' : q.pnlBasis ?? 'Accrual',
          period: projectionClosed?.label ?? 'Jan month to date',
        }
      : null;
  const projection = current
    ? // buildCashProjection(current.cash, projectionOrders.orders, erp.asOf, q?.openInvoices ?? null, qbo?.asOf ?? null, q?.openBills ?? null, projectionOrders.source, projectionOpex)
      // Nov 13 2026: + supplier POs not billed yet (net 45 after delivery)
      buildCashProjection(
        current.cash,
        projectionOrders.orders,
        erp.asOf,
        q?.openInvoices ?? null,
        qbo?.asOf ?? null,
        q?.openBills ?? null,
        projectionOrders.source,
        projectionOpex,
        erp.supplierPayables ?? null
      )
    : null;

  return {
    asOf: erp.asOf,
    quickBooks: { connected: qboConnected, asOf: qbo?.asOf ?? null, environment: qbo?.environment ?? null, hasPeriods: Boolean(q), hasPnl: Boolean(q?.pnl), pnlBasis: q?.pnlBasis ?? 'Accrual', hasOpenInvoices: Boolean(q?.openInvoices && q?.openBills) },
    liquidity: {
      cashToday: current ? v(current.cash) : none(qNote),
      cashDate: current?.date ?? null,
      cashPy: pyBal ? v(pyBal.cash) : none(q ? REASON.noHistory : qNote),
      // Before Nov 6 2026: none(REASON.noProjection) for both
      lowCash: projection?.lowCash
        ? v(projection.lowCash.value, `on ${projection.lowCash.date}`)
        : none(current && q ? 'Sync QuickBooks (open invoices / bills)' : qNote),
      highCash: projection?.highCash
        ? v(projection.highCash.value, `on ${projection.highCash.date}`)
        : none(current && q ? 'Sync QuickBooks (open invoices / bills)' : qNote),
      projectedCash: projection
        ? v(
            projection.quarters[projection.quarters.length - 1]!.closing,
            // Before Nov 9 2026: ${projection.ordersSource === 'quickbooks' ? 'open sales orders' : 'open sales orders not synced'}
            // `Through ${projection.throughDate} · ${projection.openInvoices ? 'open invoices + ' : ''}${projection.ordersSource === 'quickbooks' ? 'open sales orders' : projection.ordersSource === 'erp' ? 'ERP open orders (QuickBooks sales orders not available)' : 'open sales orders not synced'}${projection.openBills ? ' − open bills' : ''}`
            // Before Nov 13 2026:
            // `Through ${projection.throughDate} · ${projection.openInvoices ? 'open invoices + ' : ''}${projection.ordersSource === 'quickbooks' ? 'open sales orders' : projection.ordersSource === 'erp' ? 'ERP open orders (QuickBooks sales orders not available)' : 'open sales orders not synced'}${projection.openBills ? ' − open bills' : ''}${projection.opex ? ' − OPEX (YTD run rate)' : ''}`
            `Through ${projection.throughDate} · ${projection.openInvoices ? 'open invoices + ' : ''}${projection.ordersSource === 'quickbooks' ? 'open sales orders' : projection.ordersSource === 'erp' ? 'ERP open orders (QuickBooks sales orders not available)' : 'open sales orders not synced'}${projection.openBills ? ' − open bills' : ''}${projection.opex ? ' − OPEX (YTD run rate)' : ''}${projection.supplierPayables?.included.length ? ' − supplier POs not billed (delivery + 45)' : ''}`
          )
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
