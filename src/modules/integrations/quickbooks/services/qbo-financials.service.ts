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

async function fetchQuery(access: QboAccess, sql: string): Promise<Record<string, unknown>> {
  const url = `${getApiBaseUrl(access.environment as QuickBooksEnvironment)}/v3/company/${access.realmId}/query?query=${encodeURIComponent(sql)}&minorversion=${QBO_API_MINOR_VERSION}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${access.accessToken}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`QuickBooks query failed (${response.status})`);
  }
  const json = (await response.json()) as { QueryResponse?: Record<string, unknown> };
  return json.QueryResponse ?? {};
}

/** Dollar-weighted days until due for open invoices or bills (overdue = 0 days) */
async function weightedDaysUntilDue(access: QboAccess, entity: 'Invoice' | 'Bill', today: string): Promise<number | null> {
  const result = await fetchQuery(access, `SELECT Id, DueDate, Balance FROM ${entity} WHERE Balance > '0' MAXRESULTS 1000`);
  const rows = (result[entity] ?? []) as Array<{ DueDate?: string; Balance?: number }>;
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
  // Month-ends for the T90 and YTD averages, plus the prior-year date
  const balanceDates = [
    ...new Set([...monthEndsBetween(periods.t90.from, today), ...monthEndsBetween(periods.ytd.from, today), priorYearDate]),
  ].sort();

  const pnlJobs = pnlRanges.map(([, r]) => () =>
    fetchReport(access, 'ProfitAndLoss', { start_date: r.from, end_date: r.to, accounting_method: 'Accrual' })
  );
  const cashJobs = cashRanges.map(([, r]) => () =>
    fetchReport(access, 'CashFlow', { start_date: r.from, end_date: r.to })
  );
  const balanceJobs = balanceDates.map((date) => () =>
    // QuickBooks ignores end_date alone (it returns this year to date): pass both
    fetchReport(access, 'BalanceSheet', { start_date: date, end_date: date, accounting_method: 'Accrual' })
  );

  // One queue for every report so QuickBooks never sees more than 3 parallel calls
  const all = await limited<Report>([...pnlJobs, ...cashJobs, ...balanceJobs], 3);
  const pnls = all.slice(0, pnlJobs.length);
  const cashFlows = all.slice(pnlJobs.length, pnlJobs.length + cashJobs.length);
  const balanceSheets = all.slice(pnlJobs.length + cashJobs.length);
  const arDays = await weightedDaysUntilDue(access, 'Invoice', today).catch(() => null);
  const apDays = await weightedDaysUntilDue(access, 'Bill', today).catch(() => null);

  const opex = {} as Record<PeriodKey | 't90py', number>;
  pnlRanges.forEach(([key], i) => {
    opex[key] = round2(totalsByCategory(pnls[i]!, mappingOf).opex);
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

  return { opex, operatingCashFlow, investingCashFlow, balances, priorYearDate, arWeightedDays: arDays, apWeightedDays: apDays };
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
      accounting_method: 'Accrual',
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
