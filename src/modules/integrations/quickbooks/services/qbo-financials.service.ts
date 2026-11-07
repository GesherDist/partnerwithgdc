/**
 * QuickBooks Financials (two-way sync, QuickBooks → ERP)
 *
 * Oct 12 call: these management-dashboard figures come from QuickBooks:
 *   1 Cash today            → Balance Sheet, accounts mapped to "cash"
 *   2 Accounts Receivable   → Balance Sheet, "accounts_receivable"
 *   3 AR aging 30/60/90     → A/R Aging Summary
 *   4 Accounts Payable      → Balance Sheet, "accounts_payable"
 *   5 AP aging              → A/P Aging Summary
 *   6 Inventory (at cost)   → Balance Sheet, "inventory"
 *   7 Operating cash flow   → Statement of Cash Flows (month to date, last month)
 *   8 OPEX                  → Profit and Loss by month, accounts mapped to
 *                             "opex", grouped by OPEX group
 * Accounts are classified with the chart-of-accounts mapping (Settings >
 * QuickBooks > Chart of Accounts; saved choice or suggestion from the type).
 *
 * buildFinancials() only reads QuickBooks (GET reports). saveSnapshot() stores
 * one row per company per day (migration 162).
 */

import { db } from '@/shared/lib/supabase/database';
import { getConnectionByProvider } from '@/modules/integrations/core';
import { quickBooksProvider } from '@/modules/integrations/providers/accounting/quickbooks/quickbooks.provider';
import { QBO_API_MINOR_VERSION } from '@/modules/integrations/providers/accounting/quickbooks/constants';
import { getApiBaseUrl } from '../lib/oauth';
import type { QuickBooksEnvironment } from '../types';
import {
  isDashboardCategory,
  suggestCategory,
  suggestOpexGroup,
  type DashboardCategory,
} from '@/features/integrations/lib/account-mapping';
import {
  addYears,
  daysBetween,
  getPeriods,
  monthEndsBetween,
  type PeriodKey,
} from '@/features/dashboard/lib/periods';

// ============================================
// TYPES
// ============================================

export interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days91plus: number;
  total: number;
}

export interface AgingParty {
  name: string;
  total: number;
  /** Everything past due (1–30 and older) */
  overdue: number;
}

export interface OpexMonth {
  label: string;
  total: number;
  groups: Array<{ group: string; amount: number }>;
}

/** Revenue of one calendar month from the P&L (accounts mapped to Revenue) */
export interface QboRevenueMonth {
  /** YYYY-MM */
  month: string;
  revenue: number;
  /** COGS of the month (accounts mapped to COGS). Missing in snapshots before Nov 6, 2026 */
  cogs?: number;
}

/**
 * Basis of every Profit and Loss read for the dashboard (Ankur, Nov 5 2026 call:
 * he compares with the QuickBooks P&L on cash basis, YTD net income $132,996).
 * Balance Sheet (AR / AP / inventory) stays Accrual; DSO / DIO use an Accrual
 * P&L (accrualPnl) because they need sales and COGS when invoiced, not paid.
 */
export const PNL_ACCOUNTING_METHOD = 'Cash' as const;

/** Months of P&L revenue history kept in the snapshot (Revenue Trend before ERP data) */
const REVENUE_HISTORY_MONTHS = 24;

/** Tire sales of one calendar month by customer (Channel Performance chart, Nov 7 2026) */
export interface QboCustomerSalesMonth {
  /** YYYY-MM */
  month: string;
  customers: Array<{
    customer: string;
    /** QuickBooks Customer Type name, null when the customer has none */
    customerType: string | null;
    /** Product lines (tires), excl. tax: invoices + sales receipts − credit memos */
    amount: number;
    units: number;
  }>;
}

/** Tires sold in one calendar month by product (Units by SKU chart, Nov 7 2026) */
export interface QboUnitsMonth {
  /** YYYY-MM */
  month: string;
  /** Last day read: month end, or the sync date for the current month */
  to: string;
  total: number;
  items: Array<{ name: string; quantity: number; amount: number; size: string }>;
}

export interface QboFinancials {
  realmId: string;
  environment: string;
  /** Business date the figures are for (YYYY-MM-DD, America/New_York) */
  asOf: string;
  fetchedAt: string;
  cash: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventory: number;
  arAging: AgingBuckets;
  apAging: AgingBuckets;
  topReceivables: AgingParty[];
  topPayables: AgingParty[];
  operatingCashFlow: {
    monthToDate: number;
    lastMonth: number;
    lastMonthLabel: string;
  };
  opex: {
    months: OpexMonth[];
  };
  /** Accounts in the reports that are not in the synced chart of accounts */
  unmappedAccounts: string[];
  /**
   * Executive dashboard periods (Ankur's spec): OPEX, cash flow, balances at
   * month-ends / prior year, weighted settlement days. Null when it could not
   * be built (the main figures above are still valid).
   */
  periods?: QboPeriodFigures | null;
  periodsError?: string;
  /**
   * Revenue per month for the last 24 complete months (P&L, Accrual, accounts
   * mapped to Revenue). Used by the Revenue Trend for months before the ERP
   * has sales data. Null / missing when it could not be read.
   */
  revenueHistory?: QboRevenueMonth[] | null;
  /**
   * Tires sold per month by product for the last 24 complete months and the
   * current month to date (Sales by Product/Service Summary, Accrual, product
   * items only — same rule as Units Sold). Used by the Units by SKU chart.
   * Missing in snapshots taken before Nov 7, 2026.
   */
  unitsByMonth?: QboUnitsMonth[] | null;
  /**
   * Tire sales per month by customer (with the QuickBooks Customer Type) for the
   * last 24 complete months and the current month to date. Used by the Channel
   * Performance chart. Missing in snapshots taken before Nov 7, 2026.
   */
  salesByCustomerMonth?: QboCustomerSalesMonth[] | null;
}

export interface QboBalances {
  date: string;
  cash: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventory: number;
}

export interface QboPeriodFigures {
  /** OPEX per period, plus the prior-year T90 for the run-rate PY column */
  opex: Record<PeriodKey | 't90py', number>;
  /** Net cash from operating activities per period */
  operatingCashFlow: Record<'mtd' | 't90' | 'ytd' | 'py', number>;
  /** Net cash from investing activities per period (negative = money spent, e.g. CapEx) */
  investingCashFlow: Record<'mtd' | 't90' | 'ytd' | 'py', number>;
  /** Balances at each month-end this year and the last 3 months, the prior-year date, and today */
  balances: QboBalances[];
  priorYearDate: string;
  /** Dollar-weighted days until open invoices are due (overdue counts as 0) */
  arWeightedDays: number | null;
  /** Dollar-weighted days until open bills are due (overdue counts as 0) */
  apWeightedDays: number | null;
  /**
   * Credit purchases per period (DPO denominator): vendor bills less vendor
   * credits, by transaction date. Missing in snapshots taken before Oct 20, 2026.
   */
  creditPurchases?: Record<'pm' | 't90' | 'ytd' | 'py', number>;
  /**
   * Profit and Loss totals per period, as QuickBooks shows them, on the basis
   * in pnlBasis (Cash since Nov 7, 2026; Accrual before). Missing in snapshots
   * taken before Nov 6, 2026 (sync QuickBooks again).
   */
  pnl?: Record<'mtd' | 't90' | 'ytd' | 'py' | 'pm', QboPnlFigures>;
  /** Basis of pnl, opex and revenueHistory. Missing = Accrual (snapshots before Nov 7, 2026) */
  pnlBasis?: 'Cash' | 'Accrual';
  /**
   * Accrual P&L income and COGS per period, for DSO and DIO (sales / COGS when
   * invoiced). Missing in snapshots taken before Nov 7, 2026 (pnl was Accrual then).
   */
  accrualPnl?: Record<'pm' | 't90' | 'ytd' | 'py', { income: number; cogs: number }>;
  /**
   * Units sold per period: Sales by Product/Service Summary (Accrual), product
   * items only (QuickBooks item type Inventory / Non-inventory; Service items
   * such as commission and fees are not units). Missing in snapshots taken
   * before Nov 6, 2026.
   */
  units?: Record<'mtd' | 't90' | 'ytd' | 'py' | 'pm', QboUnitsSold>;
  /**
   * Open invoices (Balance > 0) by due date, for Projected Cash. Missing in
   * snapshots taken before Nov 6, 2026.
   */
  openInvoices?: QboOpenInvoices;
  /**
   * Open vendor bills (Balance > 0) by due date, for Projected / Low / High
   * Cash. Missing in snapshots taken before Nov 6, 2026.
   */
  openBills?: QboOpenBills;
  /**
   * Open sales orders in QuickBooks (Ankur, Nov 5 call: "on QuickBooks under
   * invoices, the open sales orders"), for the Open Orders card and Projected
   * Cash. Missing when QuickBooks did not return sales orders: the dashboard
   * then keeps using the ERP sales orders.
   */
  openSalesOrders?: QboOpenSalesOrders;
  /** Why open sales orders could not be read from QuickBooks (ERP is used instead) */
  openSalesOrdersError?: string;
}

/** Open customer sales orders (confirmed, not invoiced yet), as read on the snapshot date */
export interface QboOpenSalesOrders {
  total: number;
  count: number;
  tires: number;
  /** Status values QuickBooks returned for all sales orders, with counts (for checking what "open" means) */
  statuses: Record<string, number>;
  orders: Array<{
    doc: string;
    customer: string;
    txnDate: string;
    /** Ship date, else due date; null when the order has neither */
    expectedDate: string | null;
    status: string;
    /** Product / service line quantities (tires) */
    quantity: number;
    /** Sum of the product / service lines (excl. tax) */
    amount: number;
  }>;
}

/** Open vendor bills (money still to be paid), as read on the snapshot date */
export interface QboOpenBills {
  total: number;
  /** Balance already past due (or with no due date) on the snapshot date */
  overdue: number;
  count: number;
  bills: Array<{ doc: string; vendor: string; txnDate: string; dueDate: string | null; balance: number }>;
}

/** Open customer invoices (money still to be received), as read on the snapshot date */
export interface QboOpenInvoices {
  total: number;
  /** Balance already past due (or with no due date) on the snapshot date */
  overdue: number;
  count: number;
  invoices: Array<{ doc: string; customer: string; txnDate: string; dueDate: string | null; balance: number }>;
}

/** Units sold in one period, any product (new QuickBooks products are counted automatically) */
export interface QboUnitsSold {
  total: number;
  /** Units per size read from the product name, e.g. { '38': 484, '24': 204 }; 'other' = no size in the name */
  bySize: Record<string, number>;
  /** Sales amount of the same lines */
  amount: number;
  items: Array<{ name: string; type: string; quantity: number; amount: number; size: string }>;
  /** Report columns as read (title / type / key) and the indexes used: for checking the parsing */
  columns?: { keys: string[]; quantity: number; amount: number };
}

/** One P&L column: QuickBooks section totals (fallback: mapped account categories) */
export interface QboPnlFigures {
  /** Total Income (tire sales + commission) */
  income: number;
  /** Income accounts named "commission" */
  commission: number;
  /** Total Income less commission (tire sales) */
  salesRevenue: number;
  cogs: number;
  grossProfit: number;
  /** Total Expenses */
  opex: number;
  netOperatingIncome: number;
  netIncome: number;
}

interface ReportRow {
  type?: string;
  group?: string;
  ColData?: Array<{ value?: string; id?: string }>;
  Header?: { ColData?: Array<{ value?: string; id?: string }> };
  Summary?: { ColData?: Array<{ value?: string }> };
  Rows?: { Row?: ReportRow[] };
}

interface Report {
  Columns?: { Column?: Array<{ ColTitle?: string; ColType?: string }> };
  Rows?: { Row?: ReportRow[] };
}

// ============================================
// DATES
// ============================================

const BUSINESS_TZ = process.env.GDC_TIMEZONE || 'America/New_York';

function businessToday(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date());
}

function monthStart(date: string, monthsBack = 0): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return d.toISOString().slice(0, 10);
}

function monthEnd(start: string): string {
  const [y, m] = start.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function monthLabel(start: string): string {
  const [y, m] = start.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ============================================
// REPORT PARSING
// ============================================

const num = (value: string | undefined) => {
  const n = Number(value ?? '');
  return Number.isFinite(n) ? n : 0;
};

/**
 * Every account amount, at any depth: Data rows with an account id, plus a
 * parent account's own postings, which QuickBooks puts on the section Header
 * (e.g. "Automobile#55 | 113.96" above its "Fuel" sub-account).
 */
function accountRows(rows: ReportRow[] | undefined, out: Array<{ id: string; name: string; values: number[] }> = []) {
  for (const row of rows ?? []) {
    const first = row.ColData?.[0];
    if (row.ColData && first?.id) {
      out.push({ id: first.id, name: first.value ?? '', values: row.ColData.slice(1).map((c) => num(c.value)) });
    }
    const header = row.Header?.ColData as Array<{ value?: string; id?: string }> | undefined;
    if (header?.[0]?.id && header.slice(1).some((c) => (c.value ?? '') !== '')) {
      out.push({ id: header[0].id, name: header[0].value ?? '', values: header.slice(1).map((c) => num(c.value)) });
    }
    if (row.Rows?.Row) {
      accountRows(row.Rows.Row, out);
    }
  }
  return out;
}

/** Summary values of the section with this group (e.g. "OperatingActivities"), at any depth */
function sectionSummary(rows: ReportRow[] | undefined, group: string): number[] | null {
  for (const row of rows ?? []) {
    if (row.group === group && row.Summary?.ColData) {
      return row.Summary.ColData.slice(1).map((c) => num(c.value));
    }
    const nested = sectionSummary(row.Rows?.Row, group);
    if (nested) {
      return nested;
    }
  }
  return null;
}

/** A/R or A/P Aging Summary: grand total buckets + largest balances */
export function parseAging(report: Report): { buckets: AgingBuckets; parties: AgingParty[] } {
  const titles = (report.Columns?.Column ?? []).map((c) => (c.ColTitle ?? '').toLowerCase().replace(/\s+/g, ''));
  const index = (title: string) => titles.indexOf(title) - 1; // values exclude the name column
  const pick = (values: number[], title: string) => {
    const i = index(title);
    return i >= 0 ? values[i] ?? 0 : 0;
  };
  const toBuckets = (values: number[]): AgingBuckets => ({
    current: pick(values, 'current'),
    days1to30: pick(values, '1-30'),
    days31to60: pick(values, '31-60'),
    days61to90: pick(values, '61-90'),
    days91plus: pick(values, '91andover'),
    total: pick(values, 'total'),
  });

  const totals = sectionSummary(report.Rows?.Row, 'GrandTotal') ?? [];
  const parties = (report.Rows?.Row ?? [])
    .filter((r) => r.ColData && r.ColData.length > 1)
    .map((r) => {
      const b = toBuckets(r.ColData!.slice(1).map((c) => num(c.value)));
      return { name: r.ColData![0]?.value ?? '', total: b.total, overdue: b.days1to30 + b.days31to60 + b.days61to90 + b.days91plus };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return { buckets: toBuckets(totals), parties };
}

/**
 * OPEX per P&L column and OPEX group (accounts mapped to "opex"). The last
 * column of a P&L summarized by month is the Total and is skipped.
 */
export function opexByMonth(
  pnl: Report,
  mappingOf: (accountId: string, name: string) => { category: DashboardCategory; opexGroup: string } | undefined
): OpexMonth[] {
  const columns = (pnl.Columns?.Column ?? []).slice(1).map((c) => c.ColTitle ?? '');
  const monthCount = Math.max(0, columns.length - 1);
  const months: OpexMonth[] = Array.from({ length: monthCount }, (_, i) => ({ label: columns[i] ?? '', total: 0, groups: [] }));
  const byGroup = months.map(() => new Map<string, number>());
  for (const row of accountRows(pnl.Rows?.Row)) {
    const m = mappingOf(row.id, row.name);
    if (m?.category !== 'opex') {
      continue;
    }
    for (let i = 0; i < monthCount; i++) {
      const amount = row.values[i] ?? 0;
      if (amount !== 0) {
        byGroup[i]!.set(m.opexGroup, (byGroup[i]!.get(m.opexGroup) ?? 0) + amount);
        months[i]!.total += amount;
      }
    }
  }
  months.forEach((month, i) => {
    month.groups = [...byGroup[i]!.entries()]
      .map(([group, amount]) => ({ group, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
    month.total = Math.round(month.total * 100) / 100;
  });
  return months;
}

/**
 * Commission income accounts (e.g. "Commission Revenue - Manufacturer").
 * The Revenue Trend tracks tire sales only (Ankur, Nov 4 2026): commission
 * is tracked separately and ends this year.
 */
const COMMISSION_ACCOUNT = /commission/i;

/**
 * Sales revenue per month of a P&L summarized by month (accounts mapped to
 * "revenue", commission accounts excluded). Columns are consecutive months from
 * `fromMonth` (YYYY-MM); the last column is the Total and is skipped.
 */
export function revenueByMonth(
  pnl: Report,
  fromMonth: string,
  mappingOf: (accountId: string, name: string) => { category: DashboardCategory } | undefined
): QboRevenueMonth[] {
  const columns = (pnl.Columns?.Column ?? []).slice(1);
  const monthCount = Math.max(0, columns.length - 1);
  const [y, m] = fromMonth.split('-').map(Number) as [number, number];
  const months = Array.from({ length: monthCount }, (_, i) => ({
    month: new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 7),
    revenue: 0,
    cogs: 0,
  }));
  for (const row of accountRows(pnl.Rows?.Row)) {
    const category = mappingOf(row.id, row.name)?.category;
    const field = category === 'revenue' && !COMMISSION_ACCOUNT.test(row.name) ? 'revenue' : category === 'cogs' ? 'cogs' : null;
    if (!field) {
      continue;
    }
    for (let i = 0; i < monthCount; i++) {
      months[i]![field] += row.values[i] ?? 0;
    }
  }
  return months.map((month) => ({
    ...month,
    revenue: Math.round(month.revenue * 100) / 100,
    cogs: Math.round(month.cogs * 100) / 100,
  }));
}

// ============================================
// QUICKBOOKS ACCESS
// ============================================

interface QboAccess {
  connectionId: string;
  realmId: string;
  environment: string;
  accessToken: string;
}

export async function getQboAccess(): Promise<QboAccess | null> {
  const connection = await getConnectionByProvider('quickbooks');
  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    return null;
  }
  const token = await quickBooksProvider.getAccessToken(connection.id);
  if (!token) {
    return null;
  }
  return {
    connectionId: connection.id,
    realmId: token.externalAccountId,
    environment: token.environment,
    accessToken: token.accessToken,
  };
}

export async function fetchReport(access: QboAccess, name: string, params: Record<string, string>): Promise<Report> {
  const query = new URLSearchParams({ ...params, minorversion: QBO_API_MINOR_VERSION });
  const url = `${getApiBaseUrl(access.environment as QuickBooksEnvironment)}/v3/company/${access.realmId}/reports/${name}?${query}`;
  let response: Response | null = null;
  // QuickBooks throttles bursts (429 ThrottleExceeded): back off and retry
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${access.accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 429) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  if (!response || !response.ok) {
    if (!response) {
      throw new Error(`QuickBooks ${name} report failed`);
    }
    const body = await response.text();
    throw new Error(`QuickBooks ${name} report failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return (await response.json()) as Report;
}

// ============================================
// ACCOUNT MAPPING
// ============================================

interface AccountMapping {
  category: DashboardCategory;
  opexGroup: string;
}

export async function loadAccountMapping(realmId: string): Promise<Map<string, AccountMapping>> {
  const base = 'qbo_account_id, name, fully_qualified_name, account_type, account_sub_type';
  const load = (columns: string) => db.from('chart_of_accounts').select(columns).eq('qbo_realm_id', realmId);
  let result = await load(`${base}, dashboard_category, opex_group`);
  if (result.error && /dashboard_category|opex_group/.test(result.error.message ?? '')) {
    // Migration 161 not applied: suggestions only
    result = await load(base);
  }
  if (result.error) {
    throw new Error(`Failed to load the chart of accounts: ${result.error.message}`);
  }

  const map = new Map<string, AccountMapping>();
  for (const row of (result.data ?? []) as unknown as Array<Record<string, string | null>>) {
    const like = {
      accountType: row.account_type ?? '',
      accountSubType: row.account_sub_type ?? null,
      name: row.name ?? '',
      fullyQualifiedName: row.fully_qualified_name ?? null,
    };
    map.set(String(row.qbo_account_id), {
      category: isDashboardCategory(row.dashboard_category) ? row.dashboard_category : suggestCategory(like),
      opexGroup: row.opex_group?.trim() || suggestOpexGroup(like),
    });
  }
  return map;
}

// ============================================
// PERIOD FIGURES (executive dashboard)
// ============================================

/** Sum of a single-column report (P&L / Balance Sheet) per dashboard category */
function totalsByCategory(
  report: Report,
  mappingOf: (id: string, name: string) => AccountMapping | undefined
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of accountRows(report.Rows?.Row)) {
    const m = mappingOf(row.id, row.name);
    if (m) {
      totals[m.category] = (totals[m.category] ?? 0) + (row.values[0] ?? 0);
    }
  }
  return totals;
}

const round2 = (n: number | undefined) => Math.round((n ?? 0) * 100) / 100;

/** P&L totals of a single-column report: QuickBooks section summaries, mapped categories as fallback */
export function pnlFigures(
  report: Report,
  mappingOf: (id: string, name: string) => AccountMapping | undefined
): QboPnlFigures {
  const rows = report.Rows?.Row;
  const section = (group: string) => sectionSummary(rows, group)?.[0];
  const t = totalsByCategory(report, mappingOf);
  let commission = 0;
  for (const row of accountRows(rows)) {
    if (mappingOf(row.id, row.name)?.category === 'revenue' && COMMISSION_ACCOUNT.test(row.name)) {
      commission += row.values[0] ?? 0;
    }
  }
  const income = section('Income') ?? t.revenue ?? 0;
  const cogs = section('COGS') ?? t.cogs ?? 0;
  const grossProfit = section('GrossProfit') ?? income - cogs;
  const opex = section('Expenses') ?? t.opex ?? 0;
  const netOperatingIncome = section('NetOperatingIncome') ?? grossProfit - opex;
  return {
    income: round2(income),
    commission: round2(commission),
    salesRevenue: round2(income - commission),
    cogs: round2(cogs),
    grossProfit: round2(grossProfit),
    opex: round2(opex),
    netOperatingIncome: round2(netOperatingIncome),
    netIncome: round2(section('NetIncome') ?? netOperatingIncome),
  };
}

/** QuickBooks item types that are physical units; Service items (commission, fees) are not */
const UNIT_ITEM_TYPES = new Set(['Inventory', 'NonInventory']);
/** Fallback when the item type is unknown (item deleted / not readable): name says tire */
const UNIT_ITEM_NAME = /tire/i;

/** Size from the product name: '(38")', 'R38' or '42"' → '38' / '42'; none → 'other' */
export function sizeOfProduct(name: string): string {
  return (
    name.match(/\((\d{2})"?\)/)?.[1] ??
    name.match(/R(\d{2})(?!\d)/i)?.[1] ??
    name.match(/(?<!\d)(\d{2})"/)?.[1] ??
    'other'
  );
}

/** QuickBooks item id → item type (Inventory, NonInventory, Service, ...) */
export async function fetchItemTypes(access: QboAccess): Promise<Map<string, string>> {
  const types = new Map<string, string>();
  for (let start = 1; start < 10_000; start += 1000) {
    const page = await fetchQuery(access, `SELECT Id, Type FROM Item STARTPOSITION ${start} MAXRESULTS 1000`);
    const items = (page.Item ?? []) as Array<{ Id?: string; Type?: string }>;
    for (const item of items) {
      if (item.Id) {
        types.set(String(item.Id), item.Type ?? '');
      }
    }
    if (items.length < 1000) {
      break;
    }
  }
  return types;
}

/** Units sold from a Sales by Product/Service Summary report (Quantity and Amount columns) */
export function unitsFromItemSales(report: Report, itemTypes: Map<string, string>): QboUnitsSold {
  // The API names the columns differently from the web report (e.g. "Qty" or only a
  // ColType / MetaData key), and may nest them under a "Total" group: flatten, match
  // loosely, else use the standard order (name, quantity, amount, ...)
  type Col = { ColTitle?: string; ColType?: string; MetaData?: Array<{ Name?: string; Value?: string }>; Columns?: { Column?: Col[] } };
  const flatten = (cols: Col[]): Col[] => cols.flatMap((c) => (c.Columns?.Column?.length ? flatten(c.Columns.Column) : [c]));
  const keys = flatten((report.Columns?.Column ?? []) as Col[]).map((c) =>
    [c.ColTitle, c.ColType, ...(c.MetaData ?? []).map((m) => m.Value)].filter(Boolean).join(' ').toLowerCase()
  );
  const find = (pattern: RegExp) => keys.findIndex((k, i) => i > 0 && pattern.test(k));
  const qtyFound = find(/\bqty\b|quantity/);
  const amountFound = find(/^(amount|income|sales|subt_nat_amount)\b|\bamount$/);
  const qtyCol = qtyFound > 0 ? qtyFound : 1;
  const amountCol = amountFound > 0 && amountFound !== qtyCol ? amountFound : 2;
  const items: QboUnitsSold['items'] = [];
  const walk = (rows: ReportRow[] | undefined) => {
    for (const row of rows ?? []) {
      const cols = row.ColData;
      const first = cols?.[0] as { value?: string; id?: string } | undefined;
      const name = first?.value ?? '';
      const type = first?.id ? itemTypes.get(String(first.id)) : undefined;
      const isUnit = type !== undefined ? UNIT_ITEM_TYPES.has(type) : UNIT_ITEM_NAME.test(name);
      if (cols && name && isUnit) {
        items.push({
          name,
          type: type ?? 'unknown',
          quantity: qtyCol > 0 ? num(cols[qtyCol]?.value) : 0,
          amount: amountCol > 0 ? round2(num(cols[amountCol]?.value)) : 0,
          size: sizeOfProduct(name),
        });
      }
      if (row.Rows?.Row) {
        walk(row.Rows.Row);
      }
    }
  };
  walk(report.Rows?.Row);
  const bySize: Record<string, number> = {};
  for (const item of items) {
    bySize[item.size] = (bySize[item.size] ?? 0) + item.quantity;
  }
  return {
    total: items.reduce((s, i) => s + i.quantity, 0),
    bySize,
    amount: round2(items.reduce((s, i) => s + i.amount, 0)),
    items,
    columns: { keys, quantity: qtyCol, amount: amountCol },
  };
}

async function fetchQuery(access: QboAccess, sql: string): Promise<Record<string, unknown>> {
  const url = `${getApiBaseUrl(access.environment as QuickBooksEnvironment)}/v3/company/${access.realmId}/query?query=${encodeURIComponent(sql)}&minorversion=${QBO_API_MINOR_VERSION}`;
  let response: Response | null = null;
  // Same throttling back-off as fetchReport
  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${access.accessToken}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 429) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
  }
  if (!response || !response.ok) {
    throw new Error(`QuickBooks query failed (${response?.status ?? 'no response'})`);
  }
  const json = (await response.json()) as { QueryResponse?: Record<string, unknown> };
  return json.QueryResponse ?? {};
}

/** All rows of a query, 1,000 per page (QuickBooks maximum) */
async function fetchQueryAll<T>(access: QboAccess, entity: string, select: string, where: string): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 1; start < 100_000; start += 1000) {
    const page = await fetchQuery(access, `SELECT ${select} FROM ${entity} WHERE ${where} STARTPOSITION ${start} MAXRESULTS 1000`);
    const batch = (page[entity] ?? []) as T[];
    rows.push(...batch);
    if (batch.length < 1000) {
      break;
    }
  }
  return rows;
}

/** Dollar-weighted days until due for open invoices or bills (overdue = 0 days) */
async function weightedDaysUntilDue(access: QboAccess, entity: 'Invoice' | 'Bill', today: string): Promise<number | null> {
  const rows = await fetchQueryAll<{ DueDate?: string; Balance?: number }>(access, entity, 'Id, DueDate, Balance', "Balance > '0'");
  let weighted = 0;
  let total = 0;
  for (const row of rows) {
    const balance = Number(row.Balance ?? 0);
    if (balance <= 0) {
      continue;
    }
    const days = row.DueDate ? Math.max(0, daysBetween(today, row.DueDate)) : 0;
    weighted += balance * days;
    total += balance;
  }
  return total > 0 ? Math.round((weighted / total) * 10) / 10 : null;
}

/** Open invoices with their due dates (Projected Cash, Nov 6 2026) */
async function fetchOpenInvoices(access: QboAccess, today: string): Promise<QboOpenInvoices> {
  type Row = { DocNumber?: string; TxnDate?: string; DueDate?: string; Balance?: number; CustomerRef?: { name?: string } };
  const rows = await fetchQueryAll<Row>(access, 'Invoice', 'Id, DocNumber, TxnDate, DueDate, Balance, CustomerRef', "Balance > '0'");
  const invoices = rows
    .map((r) => ({
      doc: r.DocNumber ?? '',
      customer: r.CustomerRef?.name ?? '',
      txnDate: r.TxnDate ?? '',
      dueDate: r.DueDate ?? null,
      balance: round2(Number(r.Balance ?? 0)),
    }))
    .filter((i) => i.balance > 0)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  return {
    total: round2(invoices.reduce((n, i) => n + i.balance, 0)),
    overdue: round2(invoices.filter((i) => !i.dueDate || i.dueDate < today).reduce((n, i) => n + i.balance, 0)),
    count: invoices.length,
    invoices,
  };
}

/** Open vendor bills with their due dates (Projected / Low / High Cash, Nov 6 2026) */
async function fetchOpenBills(access: QboAccess, today: string): Promise<QboOpenBills> {
  type Row = { DocNumber?: string; TxnDate?: string; DueDate?: string; Balance?: number; VendorRef?: { name?: string } };
  const rows = await fetchQueryAll<Row>(access, 'Bill', 'Id, DocNumber, TxnDate, DueDate, Balance, VendorRef', "Balance > '0'");
  const bills = rows
    .map((r) => ({
      doc: r.DocNumber ?? '',
      vendor: r.VendorRef?.name ?? '',
      txnDate: r.TxnDate ?? '',
      dueDate: r.DueDate ?? null,
      balance: round2(Number(r.Balance ?? 0)),
    }))
    .filter((b) => b.balance > 0)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  return {
    total: round2(bills.reduce((n, b) => n + b.balance, 0)),
    overdue: round2(bills.filter((b) => !b.dueDate || b.dueDate < today).reduce((n, b) => n + b.balance, 0)),
    count: bills.length,
    bills,
  };
}

/** Sales order statuses that mean the order is no longer open */
const CLOSED_SALES_ORDER_STATUSES = new Set(['closed', 'converted', 'invoiced', 'rejected', 'cancelled', 'canceled', 'voided', 'void']);

/**
 * Open sales orders (Ankur, Nov 5 call: open sales orders that have not been
 * invoiced yet). Reads the QuickBooks SalesOrder entity (GET query only).
 * Open = status not closed / converted / cancelled and not linked to an invoice.
 * Throws when QuickBooks does not return sales orders (the caller falls back to ERP).
 */
async function fetchOpenSalesOrders(access: QboAccess): Promise<QboOpenSalesOrders> {
  type Line = { Amount?: number; DetailType?: string; SalesItemLineDetail?: { Qty?: number } };
  type Row = {
    DocNumber?: string;
    TxnDate?: string;
    ShipDate?: string;
    DueDate?: string;
    TxnStatus?: string;
    Status?: string;
    CustomerRef?: { name?: string };
    LinkedTxn?: Array<{ TxnType?: string }>;
    Line?: Line[];
  };
  const rows = await fetchQueryAll<Row>(access, 'SalesOrder', '*', "TxnDate > '1900-01-01'");
  const statuses: Record<string, number> = {};
  const orders: QboOpenSalesOrders['orders'] = [];
  for (const r of rows) {
    const status = r.TxnStatus ?? r.Status ?? '';
    statuses[status || '(none)'] = (statuses[status || '(none)'] ?? 0) + 1;
    const invoiced = (r.LinkedTxn ?? []).some((t) => t.TxnType === 'Invoice');
    if (CLOSED_SALES_ORDER_STATUSES.has(status.toLowerCase()) || invoiced) {
      continue;
    }
    const lines = (r.Line ?? []).filter((l) => l.DetailType === 'SalesItemLineDetail');
    orders.push({
      doc: r.DocNumber ?? '',
      customer: r.CustomerRef?.name ?? '',
      txnDate: r.TxnDate ?? '',
      expectedDate: r.ShipDate ?? r.DueDate ?? null,
      status,
      quantity: lines.reduce((n, l) => n + Number(l.SalesItemLineDetail?.Qty ?? 0), 0),
      amount: round2(lines.reduce((n, l) => n + Number(l.Amount ?? 0), 0)),
    });
  }
  orders.sort((a, b) => a.txnDate.localeCompare(b.txnDate));
  return {
    total: round2(orders.reduce((n, o) => n + o.amount, 0)),
    count: orders.length,
    tires: orders.reduce((n, o) => n + o.quantity, 0),
    statuses,
    orders,
  };
}

/**
 * Credit purchases per period (spec 2.8, DPO): vendor bills less vendor
 * credits, by transaction date.
 */
async function creditPurchasesByPeriod(
  access: QboAccess,
  ranges: Array<['pm' | 't90' | 'ytd' | 'py', { from: string; to: string }]>
): Promise<Record<'pm' | 't90' | 'ytd' | 'py', number>> {
  const from = ranges.reduce((min, [, r]) => (r.from < min ? r.from : min), ranges[0]![1].from);
  const to = ranges.reduce((max, [, r]) => (r.to > max ? r.to : max), ranges[0]![1].to);
  const where = `TxnDate >= '${from}' AND TxnDate <= '${to}'`;
  type Txn = { TxnDate?: string; TotalAmt?: number };
  const bills = await fetchQueryAll<Txn>(access, 'Bill', 'TxnDate, TotalAmt', where);
  const credits = await fetchQueryAll<Txn>(access, 'VendorCredit', 'TxnDate, TotalAmt', where);
  const totals = {} as Record<'pm' | 't90' | 'ytd' | 'py', number>;
  for (const [key, r] of ranges) {
    const sum = (list: Txn[]) =>
      list.filter((t) => t.TxnDate && t.TxnDate >= r.from && t.TxnDate <= r.to).reduce((s, t) => s + Number(t.TotalAmt ?? 0), 0);
    totals[key] = round2(sum(bills) - sum(credits));
  }
  return totals;
}

/** Run async jobs with a small concurrency limit (QuickBooks allows ~10 parallel calls) */
async function limited<T>(jobs: Array<() => Promise<T>>, limit = 4): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        results[i] = await jobs[i]!();
      }
    })
  );
  return results;
}

async function buildPeriodFigures(
  access: QboAccess,
  today: string,
  mappingOf: (id: string, name: string) => AccountMapping | undefined
): Promise<QboPeriodFigures> {
  const periods = getPeriods(today);
  const t90py = { from: addYears(periods.t90.from, -1), to: addYears(periods.t90.to, -1) };
  const pnlRanges: Array<[PeriodKey | 't90py', { from: string; to: string }]> = [
    ['mtd', periods.mtd],
    ['t90', periods.t90],
    ['ytd', periods.ytd],
    ['py', periods.py],
    ['pm', periods.pm],
    ['t90py', t90py],
  ];
  const cashRanges: Array<['mtd' | 't90' | 'ytd' | 'py', { from: string; to: string }]> = [
    ['mtd', periods.mtd],
    ['t90', periods.t90],
    ['ytd', periods.ytd],
    ['py', periods.py],
  ];
  const priorYearDate = addYears(today, -1);
  // Month-ends for the T90 and YTD averages, the prior-year YTD month-ends
  // (PY averages for DSO/DPO) and the prior-year date
  const balanceDates = [
    ...new Set([
      ...monthEndsBetween(periods.t90.from, today),
      ...monthEndsBetween(periods.ytd.from, today),
      ...monthEndsBetween(periods.py.from, priorYearDate),
      priorYearDate,
    ]),
  ].sort();

  const pnlJobs = pnlRanges.map(([, r]) => () =>
    fetchReport(access, 'ProfitAndLoss', { start_date: r.from, end_date: r.to, accounting_method: PNL_ACCOUNTING_METHOD })
  );
  // DSO / DIO: sales and COGS when invoiced (Accrual), whatever the P&L basis shown
  const accrualRanges: Array<['pm' | 't90' | 'ytd' | 'py', { from: string; to: string }]> = [
    ['pm', periods.pm],
    ['t90', periods.t90],
    ['ytd', periods.ytd],
    ['py', periods.py],
  ];
  const accrualJobs = accrualRanges.map(([, r]) => () =>
    fetchReport(access, 'ProfitAndLoss', { start_date: r.from, end_date: r.to, accounting_method: 'Accrual' }).catch((error) => {
      console.error('[QboFinancials] Accrual P&L failed:', error);
      return null as unknown as Report;
    })
  );
  const cashJobs = cashRanges.map(([, r]) => () =>
    fetchReport(access, 'CashFlow', { start_date: r.from, end_date: r.to })
  );
  const balanceJobs = balanceDates.map((date) => () =>
    // QuickBooks ignores end_date alone (it returns this year to date): pass both
    fetchReport(access, 'BalanceSheet', { start_date: date, end_date: date, accounting_method: 'Accrual' })
  );
  // Tires sold per period (Sales by Product/Service Summary); optional
  const unitRanges = pnlRanges.filter(([key]) => key !== 't90py') as Array<['mtd' | 't90' | 'ytd' | 'py' | 'pm', { from: string; to: string }]>;
  const unitJobs = unitRanges.map(([, r]) => () =>
    fetchReport(access, 'ItemSales', { start_date: r.from, end_date: r.to, accounting_method: 'Accrual' }).catch((error) => {
      console.error('[QboFinancials] Sales by product failed:', error);
      return null as unknown as Report;
    })
  );

  // One queue for every report so QuickBooks never sees more than 3 parallel calls
  const all = await limited<Report>([...pnlJobs, ...cashJobs, ...balanceJobs, ...unitJobs, ...accrualJobs], 3);
  const pnls = all.slice(0, pnlJobs.length);
  const cashFlows = all.slice(pnlJobs.length, pnlJobs.length + cashJobs.length);
  const balanceSheets = all.slice(pnlJobs.length + cashJobs.length, pnlJobs.length + cashJobs.length + balanceJobs.length);
  const unitsStart = pnlJobs.length + cashJobs.length + balanceJobs.length;
  const itemSales = all.slice(unitsStart, unitsStart + unitJobs.length);
  const accrualPnls = all.slice(unitsStart + unitJobs.length);
  const accrualPnl = accrualPnls.every(Boolean)
    ? (Object.fromEntries(
        accrualRanges.map(([key], i) => {
          const f = pnlFigures(accrualPnls[i]!, mappingOf);
          return [key, { income: f.income, cogs: f.cogs }];
        })
      ) as Record<'pm' | 't90' | 'ytd' | 'py', { income: number; cogs: number }>)
    : undefined;
  const itemTypes = await fetchItemTypes(access).catch((error) => {
    console.error('[QboFinancials] Item types failed:', error);
    return new Map<string, string>();
  });
  const units = itemSales.every(Boolean)
    ? (Object.fromEntries(unitRanges.map(([key], i) => [key, unitsFromItemSales(itemSales[i]!, itemTypes)])) as Record<'mtd' | 't90' | 'ytd' | 'py' | 'pm', QboUnitsSold>)
    : undefined;
  const arDays = await weightedDaysUntilDue(access, 'Invoice', today).catch(() => null);
  const apDays = await weightedDaysUntilDue(access, 'Bill', today).catch(() => null);
  const openInvoices = await fetchOpenInvoices(access, today).catch((error) => {
    console.error('[QboFinancials] Open invoices failed:', error);
    return undefined;
  });
  const openBills = await fetchOpenBills(access, today).catch((error) => {
    console.error('[QboFinancials] Open bills failed:', error);
    return undefined;
  });
  // Optional (Nov 7 2026): when QuickBooks has no sales orders the dashboard keeps the ERP sales orders
  let openSalesOrdersError: string | undefined;
  const openSalesOrders = await fetchOpenSalesOrders(access).catch((error) => {
    openSalesOrdersError = error instanceof Error ? error.message : 'Failed to read sales orders';
    console.error('[QboFinancials] Open sales orders failed:', error);
    return undefined;
  });
  const creditPurchases = await creditPurchasesByPeriod(access, [
    ['pm', periods.pm],
    ['t90', periods.t90],
    ['ytd', periods.ytd],
    ['py', periods.py],
  ]).catch((error) => {
    console.error('[QboFinancials] Credit purchases failed:', error);
    return undefined;
  });

  const opex = {} as Record<PeriodKey | 't90py', number>;
  const pnl = {} as Record<'mtd' | 't90' | 'ytd' | 'py' | 'pm', QboPnlFigures>;
  pnlRanges.forEach(([key], i) => {
    opex[key] = round2(totalsByCategory(pnls[i]!, mappingOf).opex);
    if (key !== 't90py') {
      pnl[key] = pnlFigures(pnls[i]!, mappingOf);
    }
  });

  const operatingCashFlow = {} as Record<'mtd' | 't90' | 'ytd' | 'py', number>;
  const investingCashFlow = {} as Record<'mtd' | 't90' | 'ytd' | 'py', number>;
  cashRanges.forEach(([key], i) => {
    operatingCashFlow[key] = round2(sectionSummary(cashFlows[i]!.Rows?.Row, 'OperatingActivities')?.[0]);
    investingCashFlow[key] = round2(sectionSummary(cashFlows[i]!.Rows?.Row, 'InvestingActivities')?.[0]);
  });

  const balances: QboBalances[] = balanceDates.map((date, i) => {
    const t = totalsByCategory(balanceSheets[i]!, mappingOf);
    return {
      date,
      cash: round2(t.cash),
      accountsReceivable: round2(t.accounts_receivable),
      accountsPayable: round2(t.accounts_payable),
      inventory: round2(t.inventory),
    };
  });

  return {
    opex,
    operatingCashFlow,
    investingCashFlow,
    balances,
    priorYearDate,
    arWeightedDays: arDays,
    apWeightedDays: apDays,
    ...(creditPurchases ? { creditPurchases } : {}),
    pnl,
    pnlBasis: PNL_ACCOUNTING_METHOD,
    ...(accrualPnl ? { accrualPnl } : {}),
    ...(units ? { units } : {}),
    ...(openInvoices ? { openInvoices } : {}),
    ...(openBills ? { openBills } : {}),
    ...(openSalesOrders ? { openSalesOrders } : {}),
    ...(openSalesOrdersError ? { openSalesOrdersError } : {}),
  };
}

/**
 * Tires sold per month by product (Units by SKU chart, Nov 7 2026): one Sales by
 * Product/Service Summary report per month (same parser and product rule as Units
 * Sold), for the last 24 complete months and the current month to date. A month
 * whose report fails is left out (the chart shows it as 0).
 */
async function fetchUnitsByMonth(access: QboAccess, today: string): Promise<QboUnitsMonth[]> {
  const itemTypes = await fetchItemTypes(access).catch(() => new Map<string, string>());
  const starts = Array.from({ length: REVENUE_HISTORY_MONTHS + 1 }, (_, i) => monthStart(today, REVENUE_HISTORY_MONTHS - i));
  const reports = await limited<Report | null>(
    starts.map((from) => () => {
      const end = monthEnd(from);
      return fetchReport(access, 'ItemSales', { start_date: from, end_date: end < today ? end : today, accounting_method: 'Accrual' }).catch((error) => {
        console.error(`[QboFinancials] Sales by product for ${from} failed:`, error);
        return null;
      });
    }),
    3
  );
  const months: QboUnitsMonth[] = [];
  starts.forEach((from, i) => {
    const report = reports[i];
    if (!report) {
      return;
    }
    const units = unitsFromItemSales(report, itemTypes);
    const end = monthEnd(from);
    months.push({
      month: from.slice(0, 7),
      to: end < today ? end : today,
      total: units.total,
      items: units.items.map(({ name, quantity, amount, size }) => ({ name, quantity, amount, size })),
    });
  });
  return months;
}

/**
 * Tire sales per month by customer (Channel Performance chart, Nov 7 2026).
 * Reads invoices, sales receipts and credit memos (GET queries only) and keeps the
 * product lines (QuickBooks item type Inventory / Non-inventory, same rule as Units
 * Sold; service items such as commission are left out). Credit memos subtract.
 */
async function fetchSalesByCustomerMonth(access: QboAccess, today: string): Promise<QboCustomerSalesMonth[]> {
  const from = monthStart(today, REVENUE_HISTORY_MONTHS);
  const itemTypes = await fetchItemTypes(access).catch(() => new Map<string, string>());

  // Customer → Customer Type name (optional: an empty map when QuickBooks has no customer types)
  type CustomerRow = { Id?: string; DisplayName?: string; CustomerTypeRef?: { value?: string; name?: string } };
  const typeNames = new Map<string, string>();
  try {
    const page = await fetchQuery(access, 'SELECT * FROM CustomerType MAXRESULTS 1000');
    for (const t of (page.CustomerType ?? []) as Array<{ Id?: string; Name?: string }>) {
      if (t.Id) {
        typeNames.set(String(t.Id), t.Name ?? '');
      }
    }
  } catch (error) {
    console.error('[QboFinancials] Customer types failed:', error);
  }
  const customerType = new Map<string, string | null>();
  const customers = await fetchQueryAll<CustomerRow>(access, 'Customer', '*', 'Active IN (true, false)').catch(() => [] as CustomerRow[]);
  for (const c of customers) {
    const ref = c.CustomerTypeRef;
    if (c.Id) {
      customerType.set(String(c.Id), ref?.value ? typeNames.get(String(ref.value)) ?? ref.name ?? null : null);
    }
  }

  type Line = {
    Amount?: number;
    DetailType?: string;
    SalesItemLineDetail?: { Qty?: number; ItemRef?: { value?: string; name?: string } };
    GroupLineDetail?: { Line?: Line[] };
  };
  type Txn = { TxnDate?: string; CustomerRef?: { value?: string; name?: string }; Line?: Line[] };
  const where = `TxnDate >= '${from}' AND TxnDate <= '${today}'`;
  const [invoices, receipts, credits] = await Promise.all([
    fetchQueryAll<Txn>(access, 'Invoice', '*', where),
    fetchQueryAll<Txn>(access, 'SalesReceipt', '*', where).catch(() => [] as Txn[]),
    fetchQueryAll<Txn>(access, 'CreditMemo', '*', where).catch(() => [] as Txn[]),
  ]);

  const isProduct = (item?: { value?: string; name?: string }) => {
    const type = item?.value ? itemTypes.get(String(item.value)) : undefined;
    return type !== undefined ? UNIT_ITEM_TYPES.has(type) : UNIT_ITEM_NAME.test(item?.name ?? '');
  };
  const productLines = (lines: Line[] = []): Line[] =>
    lines.flatMap((l) =>
      l.DetailType === 'GroupLineDetail'
        ? productLines(l.GroupLineDetail?.Line)
        : l.DetailType === 'SalesItemLineDetail' && isProduct(l.SalesItemLineDetail?.ItemRef)
          ? [l]
          : []
    );

  // month → customer id → totals
  const byMonth = new Map<string, Map<string, { customer: string; customerType: string | null; amount: number; units: number }>>();
  const add = (txns: Txn[], sign: 1 | -1) => {
    for (const t of txns) {
      const month = (t.TxnDate ?? '').slice(0, 7);
      const id = String(t.CustomerRef?.value ?? t.CustomerRef?.name ?? '');
      if (!month || !id) {
        continue;
      }
      const lines = productLines(t.Line);
      if (!lines.length) {
        continue;
      }
      const customersOfMonth = byMonth.get(month) ?? new Map();
      const row = customersOfMonth.get(id) ?? { customer: t.CustomerRef?.name ?? id, customerType: customerType.get(id) ?? null, amount: 0, units: 0 };
      for (const l of lines) {
        row.amount += sign * Number(l.Amount ?? 0);
        row.units += sign * Number(l.SalesItemLineDetail?.Qty ?? 0);
      }
      customersOfMonth.set(id, row);
      byMonth.set(month, customersOfMonth);
    }
  };
  add(invoices, 1);
  add(receipts, 1);
  add(credits, -1);

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, rows]) => ({
      month,
      customers: [...rows.values()]
        .map((r) => ({ ...r, amount: round2(r.amount) }))
        .sort((a, b) => b.amount - a.amount),
    }));
}

// ============================================
// BUILD
// ============================================

/**
 * Read the QuickBooks reports and build the dashboard figures. GET only:
 * nothing is written to QuickBooks or the database.
 */
export async function buildFinancials(access: QboAccess): Promise<QboFinancials> {
  const today = businessToday();
  const thisMonth = monthStart(today);
  const lastMonth = monthStart(today, 1);
  const opexFrom = monthStart(today, 3); // 3 full months + this month

  const [mapping, balanceSheet, arAging, apAging, cashMtd, cashLastMonth, pnl] = await Promise.all([
    loadAccountMapping(access.realmId),
    fetchReport(access, 'BalanceSheet', { start_date: today, end_date: today, accounting_method: 'Accrual' }),
    fetchReport(access, 'AgedReceivables', { report_date: today }),
    fetchReport(access, 'AgedPayables', { report_date: today }),
    fetchReport(access, 'CashFlow', { start_date: thisMonth, end_date: today }),
    fetchReport(access, 'CashFlow', { start_date: lastMonth, end_date: monthEnd(lastMonth) }),
    fetchReport(access, 'ProfitAndLoss', {
      start_date: opexFrom,
      end_date: today,
      summarize_column_by: 'Month',
      accounting_method: PNL_ACCOUNTING_METHOD,
    }),
  ]);

  const unmapped = new Set<string>();
  const categoryOf = (id: string, name: string) => {
    const m = mapping.get(id);
    if (!m) {
      unmapped.add(name);
    }
    return m;
  };

  // 1, 2, 4, 6: balance sheet totals per category (liabilities are positive here)
  const balances: Record<string, number> = {};
  for (const row of accountRows(balanceSheet.Rows?.Row)) {
    const m = categoryOf(row.id, row.name);
    if (m) {
      balances[m.category] = (balances[m.category] ?? 0) + (row.values[0] ?? 0);
    }
  }

  // 3, 5: aging
  const ar = parseAging(arAging);
  const ap = parseAging(apAging);

  // 7: operating cash flow
  const operating = (report: Report) => sectionSummary(report.Rows?.Row, 'OperatingActivities')?.[0] ?? 0;

  // 8: OPEX by month and group
  const months = opexByMonth(pnl, (id, name) => categoryOf(id, name));

  // Executive dashboard periods: optional, never breaks the main figures
  let periodFigures: QboPeriodFigures | null = null;
  let periodsError: string | undefined;
  try {
    periodFigures = await buildPeriodFigures(access, today, (id) => mapping.get(id));
  } catch (error) {
    periodsError = error instanceof Error ? error.message : 'Failed to build period figures';
    console.error('[QboFinancials] Period figures failed:', error);
  }

  // Revenue history for the Revenue Trend: optional, never breaks the main figures
  let revenueHistory: QboRevenueMonth[] | null = null;
  try {
    const historyFrom = monthStart(today, REVENUE_HISTORY_MONTHS);
    const historyPnl = await fetchReport(access, 'ProfitAndLoss', {
      start_date: historyFrom,
      end_date: monthEnd(lastMonth),
      summarize_column_by: 'Month',
      accounting_method: PNL_ACCOUNTING_METHOD,
    });
    revenueHistory = revenueByMonth(historyPnl, historyFrom.slice(0, 7), (id) => mapping.get(id));
  } catch (error) {
    console.error('[QboFinancials] Revenue history failed:', error);
  }

  // Tires sold per month by product (Units by SKU chart, Nov 7 2026): optional, never breaks the main figures
  let unitsByMonth: QboUnitsMonth[] | null = null;
  try {
    unitsByMonth = await fetchUnitsByMonth(access, today);
  } catch (error) {
    console.error('[QboFinancials] Units by month failed:', error);
  }

  // Tire sales per month by customer (Channel Performance chart, Nov 7 2026): optional, never breaks the main figures
  let salesByCustomerMonth: QboCustomerSalesMonth[] | null = null;
  try {
    salesByCustomerMonth = await fetchSalesByCustomerMonth(access, today);
  } catch (error) {
    console.error('[QboFinancials] Sales by customer failed:', error);
  }

  const round = (n: number | undefined) => Math.round((n ?? 0) * 100) / 100;
  return {
    realmId: access.realmId,
    environment: access.environment,
    asOf: today,
    fetchedAt: new Date().toISOString(),
    cash: round(balances.cash),
    accountsReceivable: round(balances.accounts_receivable),
    accountsPayable: round(balances.accounts_payable),
    inventory: round(balances.inventory),
    arAging: ar.buckets,
    apAging: ap.buckets,
    topReceivables: ar.parties,
    topPayables: ap.parties,
    operatingCashFlow: {
      monthToDate: round(operating(cashMtd)),
      lastMonth: round(operating(cashLastMonth)),
      lastMonthLabel: monthLabel(lastMonth),
    },
    opex: { months },
    unmappedAccounts: [...unmapped].sort(),
    periods: periodFigures,
    ...(periodsError ? { periodsError } : {}),
    revenueHistory,
    ...(unitsByMonth ? { unitsByMonth } : {}),
    ...(salesByCustomerMonth ? { salesByCustomerMonth } : {}),
  };
}

// ============================================
// STORAGE (migration 162)
// ============================================

const isMissingSnapshotTable = (error: { code?: string; message?: string } | null) =>
  Boolean(error && (error.code === '42P01' || error.code === 'PGRST205') && /qbo_financial_snapshots/.test(error.message ?? ''));

/** Store today's snapshot. Returns false when migration 162 is not applied. */
export async function saveSnapshot(financials: QboFinancials): Promise<boolean> {
  const { error } = await db.from('qbo_financial_snapshots').upsert(
    {
      qbo_realm_id: financials.realmId,
      snapshot_date: financials.asOf,
      data: financials,
      fetched_at: financials.fetchedAt,
    },
    { onConflict: 'qbo_realm_id,snapshot_date' }
  );
  if (error) {
    if (isMissingSnapshotTable(error)) {
      return false;
    }
    throw new Error(`Failed to save the QuickBooks snapshot: ${error.message}`);
  }
  return true;
}

/** Latest stored snapshot for the company, or null (none yet / migration 162 missing) */
export async function getLatestSnapshot(realmId: string): Promise<{ financials: QboFinancials | null; storageAvailable: boolean }> {
  const { data, error } = await db
    .from('qbo_financial_snapshots')
    .select('data')
    .eq('qbo_realm_id', realmId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingSnapshotTable(error)) {
      return { financials: null, storageAvailable: false };
    }
    throw new Error(`Failed to load the QuickBooks snapshot: ${error.message}`);
  }
  return { financials: (data?.data as QboFinancials | undefined) ?? null, storageAvailable: true };
}

/**
 * Full sync used by the daily cron and "Sync now": refresh the chart of
 * accounts (new accounts get a category), read the reports, store the
 * snapshot.
 */
export async function syncFinancials(): Promise<{ financials: QboFinancials; stored: boolean }> {
  const access = await getQboAccess();
  if (!access) {
    throw new Error('QuickBooks is not connected');
  }
  const { qboAccountSyncService } = await import('./qbo-account-sync.service');
  await qboAccountSyncService.syncAccounts(access.connectionId);

  const financials = await buildFinancials(access);
  const stored = await saveSnapshot(financials);
  return { financials, stored };
}

// ============================================
// DRILL-DOWN ROWS (executive dashboard downloads)
// Read-only: the same reports, parsing and account mapping as the figures
// ============================================

export interface QboAccountBalance {
  id: string;
  name: string;
  category: DashboardCategory | null;
  amount: number;
}

/** Balance Sheet accounts on a date, each with its dashboard category */
export async function fetchAccountBalances(access: QboAccess, date: string): Promise<QboAccountBalance[]> {
  const [mapping, report] = await Promise.all([
    loadAccountMapping(access.realmId),
    fetchReport(access, 'BalanceSheet', { start_date: date, end_date: date, accounting_method: 'Accrual' }),
  ]);
  return accountRows(report.Rows?.Row).map((row) => ({
    id: row.id,
    name: row.name,
    category: mapping.get(row.id)?.category ?? null,
    amount: round2(row.values[0]),
  }));
}

/** Balance Sheet accounts on several dates (one mapping load, max 3 parallel calls) */
export async function fetchAccountBalancesOn(access: QboAccess, dates: string[]): Promise<Map<string, QboAccountBalance[]>> {
  const mapping = await loadAccountMapping(access.realmId);
  const reports = await limited(
    dates.map((date) => () => fetchReport(access, 'BalanceSheet', { start_date: date, end_date: date, accounting_method: 'Accrual' })),
    3
  );
  return new Map(
    dates.map((date, i) => [
      date,
      accountRows(reports[i]!.Rows?.Row).map((row) => ({
        id: row.id,
        name: row.name,
        category: mapping.get(row.id)?.category ?? null,
        amount: round2(row.values[0]),
      })),
    ])
  );
}

export interface QboPurchaseDoc {
  type: 'Bill' | 'VendorCredit';
  number: string | null;
  vendor: string | null;
  txnDate: string;
  amount: number;
}

/** Vendor bills and vendor credits by transaction date (credit purchases, DPO) */
export async function fetchPurchaseDocs(access: QboAccess, from: string, to: string): Promise<QboPurchaseDoc[]> {
  type Row = { DocNumber?: string; TxnDate?: string; TotalAmt?: number; VendorRef?: { name?: string } };
  const where = `TxnDate >= '${from}' AND TxnDate <= '${to}'`;
  const select = 'Id, DocNumber, TxnDate, TotalAmt, VendorRef';
  const bills = await fetchQueryAll<Row>(access, 'Bill', select, where);
  const credits = await fetchQueryAll<Row>(access, 'VendorCredit', select, where);
  const map = (type: QboPurchaseDoc['type']) => (r: Row): QboPurchaseDoc => ({
    type,
    number: r.DocNumber ?? null,
    vendor: r.VendorRef?.name ?? null,
    txnDate: r.TxnDate ?? '',
    amount: round2(Number(r.TotalAmt ?? 0)),
  });
  return [...bills.map(map('Bill')), ...credits.map(map('VendorCredit'))].sort((a, b) => a.txnDate.localeCompare(b.txnDate));
}

export interface QboOpenItem {
  number: string | null;
  party: string | null;
  txnDate: string | null;
  dueDate: string | null;
  balance: number;
  /** Days until due on the given date; overdue counts as 0 (weighted timing rule) */
  daysUntilDue: number;
}

/** Open invoices (AR) or bills (AP) behind the weighted timing */
export async function fetchOpenItems(access: QboAccess, entity: 'Invoice' | 'Bill', today: string): Promise<QboOpenItem[]> {
  type Row = { DocNumber?: string; TxnDate?: string; DueDate?: string; Balance?: number; CustomerRef?: { name?: string }; VendorRef?: { name?: string } };
  const ref = entity === 'Invoice' ? 'CustomerRef' : 'VendorRef';
  const rows = await fetchQueryAll<Row>(access, entity, `Id, DocNumber, TxnDate, DueDate, Balance, ${ref}`, "Balance > '0'");
  return rows
    .filter((r) => Number(r.Balance ?? 0) > 0)
    .map((r) => ({
      number: r.DocNumber ?? null,
      party: (entity === 'Invoice' ? r.CustomerRef?.name : r.VendorRef?.name) ?? null,
      txnDate: r.TxnDate ?? null,
      dueDate: r.DueDate ?? null,
      balance: round2(Number(r.Balance ?? 0)),
      daysUntilDue: r.DueDate ? Math.max(0, daysBetween(today, r.DueDate)) : 0,
    }))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
}

export interface QboCashFlowLine {
  /** OperatingActivities, InvestingActivities, FinancingActivities */
  section: string;
  line: string;
  amount: number;
}

const CASH_FLOW_SECTIONS = ['OperatingActivities', 'InvestingActivities', 'FinancingActivities'];

/** Statement of Cash Flows lines for a period, with the operating and investing totals */
export async function fetchCashFlowLines(
  access: QboAccess,
  from: string,
  to: string
): Promise<{ lines: QboCashFlowLine[]; operating: number; investing: number }> {
  const report = await fetchReport(access, 'CashFlow', { start_date: from, end_date: to });
  const lines: QboCashFlowLine[] = [];
  const walk = (rows: ReportRow[] | undefined, section: string | null) => {
    for (const row of rows ?? []) {
      const current = row.group && CASH_FLOW_SECTIONS.includes(row.group) ? row.group : section;
      if (current && row.ColData && row.ColData[0]?.value) {
        lines.push({ section: current, line: row.ColData[0].value, amount: round2(num(row.ColData[1]?.value)) });
      }
      walk(row.Rows?.Row, current);
    }
  };
  walk(report.Rows?.Row, null);
  return {
    lines,
    operating: round2(sectionSummary(report.Rows?.Row, 'OperatingActivities')?.[0]),
    investing: round2(sectionSummary(report.Rows?.Row, 'InvestingActivities')?.[0]),
  };
}

export interface QboOpexAccount {
  id: string;
  name: string;
  group: string;
  amount: number;
}

/** Profit and Loss accounts mapped to OPEX for a period (same as the OPEX figures) */
export async function fetchOpexAccounts(access: QboAccess, from: string, to: string): Promise<QboOpexAccount[]> {
  const [mapping, report] = await Promise.all([
    loadAccountMapping(access.realmId),
    fetchReport(access, 'ProfitAndLoss', { start_date: from, end_date: to, accounting_method: PNL_ACCOUNTING_METHOD }),
  ]);
  const out: QboOpexAccount[] = [];
  for (const row of accountRows(report.Rows?.Row)) {
    const m = mapping.get(row.id);
    if (m?.category === 'opex' && (row.values[0] ?? 0) !== 0) {
      out.push({ id: row.id, name: row.name, group: m.opexGroup, amount: round2(row.values[0]) });
    }
  }
  return out;
}
