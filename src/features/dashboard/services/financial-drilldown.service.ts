/**
 * Executive drill-downs (Financial Metrics 1.1–1.4, Profitability 2.1–3.1, Supply Chain 4.1–4.2): the
 * rows behind each table as CSV, for checking against QuickBooks and the ERP
 * (Ankur, Oct 27 call).
 *
 * The dashboard shows the latest QuickBooks snapshot; these exports read the
 * same QuickBooks reports again (read-only) for that snapshot's date, with the
 * same account mapping. Each total is followed by the dashboard value, so a
 * difference means QuickBooks changed after the last sync.
 * Money is in dollars.
 */

import { getConnectionByProvider } from '@/modules/integrations/core';
import { db } from '@/shared/lib/supabase/database';
import { productCycleCostRepository } from '@/features/products/repositories/product-cycle-cost.repository';
import {
  fetchAccountBalances,
  fetchAccountBalancesOn,
  fetchCashFlowLines,
  fetchOpenItems,
  fetchOpexAccounts,
  fetchPurchaseDocs,
  getLatestSnapshot,
  getQboAccess,
  type QboAccountBalance,
  type QboBalances,
  type QboFinancials,
} from '@/modules/integrations/quickbooks/services/qbo-financials.service';
import { buildErpExecutiveFigures, type ErpExecutiveFigures } from './executive-erp.service';
import { loadDailyHistory, type DailySnapshot } from './executive-history.service';
import { loadRecognizedSales, type RecognizedSaleLine, type RecognizedSales } from './recognized-sales.service';
import { dollars, toCsv, type Cell } from './overview-drilldown.service';
import { buildExecutiveModel, cashQuarterOf, type ExecutiveDashboardModel } from '../lib/executive-model';
import { addDays, addYears, getPeriods, monthEnd, monthStart } from '../lib/periods';
import type { CsvExport, TableDrillDown } from '../lib/drilldown';

interface Section {
  title: string;
  columns: string[];
  rows: Cell[][];
}

/** Several tables in one CSV: a title row, a header row, the rows, a blank row */
function sectionsCsv(sections: Section[]): string {
  return sections
    .map((s) => toCsv([s.title], []) + '\r\n' + toCsv(s.columns, s.rows))
    .join('\r\n\r\n');
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const cellValue = (cell: { value: number | null; note?: string }) => (cell.value === null ? cell.note ?? '' : cell.value);

async function loadContext(): Promise<{ qbo: QboFinancials; model: ExecutiveDashboardModel; erp: ErpExecutiveFigures; history: DailySnapshot[] }> {
  const connection = await getConnectionByProvider('quickbooks');
  if (!connection || connection.status !== 'connected' || !connection.external_account_id) {
    throw new Error('QuickBooks is not connected');
  }
  const [erp, snapshot] = await Promise.all([buildErpExecutiveFigures(), getLatestSnapshot(connection.external_account_id)]);
  if (!snapshot.financials) {
    throw new Error('No QuickBooks snapshot yet: press "Sync now" first');
  }
  // Same daily history as the dashboard (T90 / YTD averages of backlog and inventory units)
  const history = await loadDailyHistory(erp.asOf).catch(() => [] as DailySnapshot[]);
  return { qbo: snapshot.financials, model: buildExecutiveModel(erp, snapshot.financials, true, history), erp, history };
}

/** Daily snapshot values behind a T90 / YTD average or the PY value (executive-model histRow) */
function historySection(title: string, history: DailySnapshot[], asOf: string, column: 't90' | 'ytd' | 'py', pick: (d: DailySnapshot) => number | null, dashboard: Cell): Section {
  const p = getPeriods(asOf);
  const pyDate = addYears(asOf, -1);
  const days = column === 'py' ? history.filter((d) => d.date === pyDate) : history.filter((d) => d.date >= p[column].from && d.date <= asOf);
  const values = days.map((d) => ({ date: d.date, value: pick(d) })).filter((x): x is { date: string; value: number } => x.value !== null && Number.isFinite(x.value));
  const rows: Cell[][] = values.map((x) => [x.date, round2(x.value)]);
  if (rows.length === 0) {
    rows.push([column === 'py' ? `No snapshot on ${pyDate}` : 'No daily snapshots in this period']);
  } else if (column !== 'py') {
    rows.push([`AVERAGE = sum ÷ ${values.length} days (of ${p[column].days})`, round2(values.reduce((s, x) => s + x.value, 0) / values.length)]);
  }
  rows.push(['Dashboard', dashboard]);
  return { title, columns: ['Snapshot Date', 'Value'], rows };
}

async function access() {
  const qbo = await getQboAccess();
  if (!qbo) {
    throw new Error('QuickBooks is not connected');
  }
  return qbo;
}

const CATEGORY_LABEL: Record<string, string> = {
  cash: 'Cash',
  accounts_receivable: 'Accounts Receivable',
  accounts_payable: 'Accounts Payable',
  inventory: 'Inventory',
};

function accountSection(title: string, date: string, accounts: QboAccountBalance[], category: string, dashboardValue: Cell): Section {
  const mine = accounts.filter((a) => a.category === category);
  const total = round2(mine.reduce((s, a) => s + a.amount, 0));
  return {
    title,
    columns: ['Date', 'Account', 'Category', 'Balance'],
    rows: [
      ...mine.map((a) => [date, a.name, CATEGORY_LABEL[category] ?? category, a.amount]),
      ['', 'TOTAL (QuickBooks now)', '', total],
      ['', 'Dashboard (last sync)', '', dashboardValue],
    ],
  };
}

// ---------- balances behind the averages (same points as executive-model) ----------

type BalKey = 'cash' | 'accountsReceivable' | 'accountsPayable' | 'inventory';
const BAL_CATEGORY: Record<BalKey, string> = {
  cash: 'cash',
  accountsReceivable: 'accounts_receivable',
  accountsPayable: 'accounts_payable',
  inventory: 'inventory',
};
const BAL_LABEL: Record<BalKey, string> = {
  cash: 'Cash',
  accountsReceivable: 'Accounts Receivable',
  accountsPayable: 'Accounts Payable',
  inventory: 'Inventory',
};

interface BalancePoint {
  date: string;
  source: string;
  balances: QboBalances;
}

function currentPoint(qbo: QboFinancials): BalancePoint {
  return {
    date: qbo.asOf,
    source: 'Current (last sync)',
    balances: { date: qbo.asOf, cash: qbo.cash, accountsReceivable: qbo.accountsReceivable, accountsPayable: qbo.accountsPayable, inventory: qbo.inventory },
  };
}

/** The balances the dashboard averages for a column (executive-model avgOver / avgFor) */
function balancePoints(qbo: QboFinancials, asOf: string, column: 't90' | 'ytd' | 'pm' | 'py' | 'pyDate'): BalancePoint[] {
  const q = qbo.periods;
  if (!q) {
    return [];
  }
  const p = getPeriods(asOf);
  const monthEnds = q.balances.filter((b) => b.date !== q.priorYearDate);
  const pyBal = q.balances.find((b) => b.date === q.priorYearDate);
  const point = (b: QboBalances, source = 'Month-end'): BalancePoint => ({ date: b.date, source, balances: b });
  if (column === 'pyDate') {
    return pyBal ? [point(pyBal, 'Prior-year date')] : [];
  }
  if (column === 'pm') {
    const before = monthEnds.filter((b) => b.date < p.pm.from).pop();
    const end = monthEnds.find((b) => b.date === p.pm.to);
    return end ? [...(before ? [point(before, 'Opening (month-end before)')] : []), point(end, 'Closing month-end')] : [];
  }
  if (column === 'py') {
    const pts = q.balances.filter((b) => b.date >= p.py.from && b.date < p.py.to).map((b) => point(b));
    return pyBal ? [...pts, point(pyBal, 'Prior-year date (closing)')] : [];
  }
  return [...monthEnds.filter((b) => b.date >= p[column].from && b.date <= p[column].to).map((b) => point(b)), currentPoint(qbo)];
}

/** Balances used for one average: one row per date, AVERAGE, then the dashboard value */
function averageSection(title: string, points: BalancePoint[], key: BalKey, dashboard: Cell): Section {
  const rows: Cell[][] = points.map((pt) => [pt.date, pt.source, pt.balances[key]]);
  if (points.length === 0) {
    rows.push(['No balances for this period in the last sync']);
  }
  const average = points.length ? round2(points.reduce((s, pt) => s + pt.balances[key], 0) / points.length) : '';
  rows.push([`AVERAGE = sum ÷ ${points.length}`, '', average]);
  rows.push(['Dashboard', '', dashboard]);
  return { title, columns: ['Date', 'Balance Type', BAL_LABEL[key]], rows };
}

/** Accounts behind every balance used: one row per account, one column per date */
async function accountsByDate(qboAccess: Awaited<ReturnType<typeof access>>, points: BalancePoint[], keys: BalKey[]): Promise<Section> {
  const synced = new Map(points.map((pt) => [pt.date, pt.balances]));
  const dates = [...synced.keys()].sort();
  const byDate = await fetchAccountBalancesOn(qboAccess, dates);
  const categories = new Set(keys.map((k) => BAL_CATEGORY[k]));
  const accounts = new Map<string, { name: string; category: string; values: Record<string, number> }>();
  for (const [date, list] of byDate) {
    for (const a of list) {
      if (!a.category || !categories.has(a.category)) {
        continue;
      }
      const row = accounts.get(a.id) ?? { name: a.name, category: a.category, values: {} };
      row.values[date] = a.amount;
      accounts.set(a.id, row);
    }
  }
  const rows: Cell[][] = [...accounts.values()]
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .map((a) => [CATEGORY_LABEL[a.category] ?? a.category, a.name, ...dates.map((d) => a.values[d] ?? '')]);
  for (const k of keys) {
    rows.push([
      `TOTAL ${BAL_LABEL[k]} (QuickBooks now)`,
      '',
      ...dates.map((d) => round2((byDate.get(d) ?? []).filter((a) => a.category === BAL_CATEGORY[k]).reduce((s, a) => s + a.amount, 0))),
    ]);
    rows.push([`${BAL_LABEL[k]} used by the dashboard (last sync)`, '', ...dates.map((d) => synced.get(d)?.[k] ?? '')]);
  }
  return { title: 'Accounts behind each balance above (QuickBooks Balance Sheet on each date)', columns: ['Category', 'Account', ...dates], rows };
}

// ---------- 1.1 Liquidity ----------

async function liquidityCsv(): Promise<string> {
  const { qbo, model, erp } = await loadContext();
  const qboAccess = await access();
  const pyDate = qbo.periods?.priorYearDate ?? addYears(qbo.asOf, -1);
  const [today, py] = await Promise.all([fetchAccountBalances(qboAccess, qbo.asOf), fetchAccountBalances(qboAccess, pyDate)]);

  // Cash history this year (month-ends from the last sync): what Low / High Cash will be read against
  const history = [...balancePoints(qbo, model.asOf, 'ytd')];
  const historySections: Section[] = history.length
    ? [
        {
          title: 'Cash balance at each month-end this year (last sync)',
          columns: ['Date', 'Balance Type', 'Cash'],
          rows: history.map((pt) => [pt.date, pt.source, pt.balances.cash]),
        },
        await accountsByDate(qboAccess, history, ['cash']),
      ]
    : [];

  // Projected Cash (Ankur, Oct 27 call): Cash Today + orders on the books, quarter by quarter
  const projection = model.liquidity.projection;
  const projectionSections: Section[] = projection
    ? [
        {
          title: `Projected Cash by quarter: Cash Today + orders on the books still to be invoiced (through ${projection.throughDate})`,
          columns: ['Quarter', 'From', 'To', 'Opening Cash', 'Orders on the books', 'Orders', 'Tires', 'Projected Cash (quarter end)'],
          rows: [
            ...projection.quarters.map((q) => [q.label, q.start, q.end, q.opening, q.inflow, q.orders, q.tires, q.closing]),
            ['Dashboard (Projected Cash)', '', '', '', '', '', '', cellValue(model.liquidity.projectedCash)],
          ],
        },
        ...projection.quarters
          .filter((q) => q.orders > 0)
          .map((q): Section => {
            const orders = erp.backlogOrders.filter((o) => cashQuarterOf(o, model.asOf) === q.start);
            return {
              title: `${q.label}: orders on the books (${q.start} to ${q.end})`,
              columns: ['Sales Order', 'Order Date', 'Status', 'Expected Delivery', 'Date Source', 'Tires', 'Revenue (tire lines, excl. tax)'],
              rows: [
                ...orders.map((o) => [
                  o.order,
                  o.orderDate,
                  o.status,
                  o.expectedDate ?? '',
                  o.expectedDate ? (o.expectedDate < q.start ? `${o.dateSource} (passed, current quarter)` : o.dateSource ?? '') : 'No date (current quarter)',
                  o.tires,
                  o.revenue,
                ]),
                ['TOTAL', '', '', '', '', orders.reduce((n, o) => n + o.tires, 0), round2(orders.reduce((n, o) => n + o.revenue, 0))],
                ['Dashboard', '', '', '', '', q.tires, q.inflow],
              ],
            };
          }),
      ]
    : [];

  return sectionsCsv([
    accountSection(`Cash Today: accounts mapped to Cash on ${qbo.asOf}`, qbo.asOf, today, 'cash', cellValue(model.liquidity.cashToday)),
    accountSection(`PY: the same on ${pyDate}`, pyDate, py, 'cash', cellValue(model.liquidity.cashPy)),
    ...projectionSections,
    {
      title: 'Low Cash / High Cash: not calculated yet, so there are no rows behind them',
      columns: ['KPI', 'Dashboard', 'What it needs'],
      rows: [
        ['Low Cash', cellValue(model.liquidity.lowCash), 'Lowest cash in the projection period (needs outflows: not discussed yet)'],
        ['High Cash', cellValue(model.liquidity.highCash), 'Highest cash in the projection period (needs outflows: not discussed yet)'],
      ],
    },
    ...historySections,
  ]);
}

// ---------- 1.2 Working Capital Position ----------

async function workingCapitalCsv(): Promise<string> {
  const { qbo, model } = await loadContext();
  const qboAccess = await access();
  const [accounts, invoices, bills] = await Promise.all([
    fetchAccountBalances(qboAccess, qbo.asOf),
    fetchOpenItems(qboAccess, 'Invoice', qbo.asOf),
    fetchOpenItems(qboAccess, 'Bill', qbo.asOf),
  ]);
  const wc = model.workingCapital;

  const openSection = (title: string, items: typeof invoices, dashboardDays: Cell): Section => {
    const total = round2(items.reduce((s, i) => s + i.balance, 0));
    const weighted = items.reduce((s, i) => s + i.balance * i.daysUntilDue, 0);
    return {
      title,
      columns: ['Party', 'Document #', 'Date', 'Due Date', 'Open Balance', 'Days Until Due', 'Balance × Days'],
      rows: [
        ...items.map((i) => [i.party, i.number, i.txnDate, i.dueDate, i.balance, i.daysUntilDue, round2(i.balance * i.daysUntilDue)]),
        ['TOTAL (QuickBooks now)', '', '', '', total, '', round2(weighted)],
        ['Weighted timing = Balance × Days ÷ Open Balance', '', '', '', '', total > 0 ? Math.round((weighted / total) * 10) / 10 : '', ''],
        ['Dashboard (days)', '', '', '', '', dashboardDays, ''],
      ],
    };
  };

  // T90 / YTD averages and PY for each balance
  const keys = [
    ['accountsReceivable', wc.ar],
    ['accountsPayable', wc.ap],
    ['inventory', wc.inventory],
  ] as const;
  const p = getPeriods(model.asOf);
  const t90 = balancePoints(qbo, model.asOf, 't90');
  const ytd = balancePoints(qbo, model.asOf, 'ytd');
  const pyPoint = balancePoints(qbo, model.asOf, 'pyDate');
  const averageSections = keys.flatMap(([key, row]) => [
    averageSection(`${BAL_LABEL[key]} – T90 Avg (${p.t90.from} to ${p.t90.to}): month-ends + current`, t90, key, cellValue(row.t90Avg)),
    averageSection(`${BAL_LABEL[key]} – YTD Avg (${p.ytd.from} to ${p.ytd.to}): month-ends + current`, ytd, key, cellValue(row.ytdAvg)),
    averageSection(`${BAL_LABEL[key]} – PY: balance on the prior-year date`, pyPoint, key, cellValue(row.py)),
  ]);

  return sectionsCsv([
    accountSection(`Accounts Receivable – Current: accounts on ${qbo.asOf}`, qbo.asOf, accounts, 'accounts_receivable', cellValue(wc.ar.current)),
    accountSection(`Accounts Payable – Current: accounts on ${qbo.asOf}`, qbo.asOf, accounts, 'accounts_payable', cellValue(wc.ap.current)),
    accountSection(`Inventory – Current: accounts on ${qbo.asOf}`, qbo.asOf, accounts, 'inventory', cellValue(wc.inventory.current)),
    openSection('Weighted Timing AR: open invoices (overdue = 0 days)', invoices, cellValue(wc.ar.timing)),
    openSection('Weighted Timing AP: open bills (overdue = 0 days)', bills, cellValue(wc.ap.timing)),
    ...averageSections,
    await accountsByDate(qboAccess, [...ytd, ...t90, ...pyPoint], ['accountsReceivable', 'accountsPayable', 'inventory']),
  ]);
}

// ---------- 1.3 Working Capital Efficiency ----------

async function efficiencyCsv(): Promise<string> {
  const { qbo, model } = await loadContext();
  const qboAccess = await access();
  const periods = getPeriods(model.asOf);
  // Credit purchases are summed by QuickBooks for the sync date's periods
  const qp = getPeriods(qbo.asOf);
  const cols = ['pm', 't90', 'ytd', 'py'] as const;
  const label = { pm: 'PM', t90: 'T90', ytd: 'YTD', py: 'PY' } as const;

  const purchaseFrom = cols.map((c) => qp[c].from).sort()[0]!;
  const purchaseTo = cols.map((c) => qp[c].to).sort().pop()!;
  const [sales, purchases] = await Promise.all([loadRecognizedSales(), fetchPurchaseDocs(qboAccess, purchaseFrom, purchaseTo)]);

  // How each result is built
  const calc: Cell[][] = [];
  for (const c of cols) {
    const i = model.efficiencyInputs[c];
    const r = periods[c];
    calc.push(['DSO', label[c], r.from, r.to, i.avgAr, 'Credit sales', i.creditSales, i.days, 'Avg AR ÷ Credit sales × Days', cellValue(model.efficiency.dso[c])]);
    calc.push(['DPO', label[c], r.from, r.to, i.avgAp, 'Credit purchases', i.creditPurchases, i.days, 'Avg AP ÷ Credit purchases × Days', cellValue(model.efficiency.dpo[c])]);
    calc.push(['DIO', label[c], r.from, r.to, i.avgInventory, 'COGS', i.cogs, i.days, 'Avg Inventory ÷ COGS × Days', cellValue(model.efficiency.dio[c])]);
    calc.push(['CCC', label[c], r.from, r.to, '', '', '', '', 'DIO + DSO − DPO', cellValue(model.efficiency.ccc[c])]);
  }

  const sections: Section[] = [
    {
      title: 'Table 1.3: how each result is built (the sections below list the rows behind every input)',
      columns: ['Metric', 'Column', 'From', 'To', 'Average Balance', 'Denominator', 'Denominator Amount', 'Days', 'Formula', 'Dashboard (days)'],
      rows: calc,
    },
  ];
  const allPoints: BalancePoint[] = [];

  for (const c of cols) {
    const i = model.efficiencyInputs[c];
    const r = periods[c];
    const points = balancePoints(qbo, model.asOf, c);
    allPoints.push(...points);
    const head = `${label[c]} (${r.from} to ${r.to})`;

    // DSO: average AR + credit sales lines
    sections.push(averageSection(`DSO ${head} – Average AR`, points, 'accountsReceivable', i.avgAr));
    const saleLines = sales.lines.filter((l) => l.date >= r.from && l.date <= r.to).sort((a, b) => a.date.localeCompare(b.date));
    const saleCredits = sales.credits.filter((x) => x.date >= r.from && x.date <= r.to);
    const saleRows: Cell[][] = saleLines.map((l) => ['Sale', l.date, l.orderNumber, l.customerName, l.sku, dollars(l.lineTotal)]);
    for (const x of saleCredits) {
      saleRows.push(['Credit note', x.date, x.number, x.customerName, '', -dollars(x.amount)]);
    }
    if (saleRows.length === 0) {
      saleRows.push(['No delivered sales in this period']);
    }
    const saleTotal = dollars(saleLines.reduce((s, l) => s + l.lineTotal, 0) - saleCredits.reduce((s, x) => s + x.amount, 0));
    saleRows.push(['TOTAL', '', '', '', '', round2(saleTotal)], ['Dashboard', '', '', '', '', i.creditSales]);
    sections.push({
      title: `DSO ${head} – Credit sales: delivered sales orders (all lines) − credit notes`,
      columns: ['Type', 'Delivery Date', 'SO / Credit #', 'Customer', 'SKU', 'Amount'],
      rows: saleRows,
    });

    // DPO: average AP + bills less vendor credits
    sections.push(averageSection(`DPO ${head} – Average AP`, points, 'accountsPayable', i.avgAp));
    const docs = purchases.filter((d) => d.txnDate >= qp[c].from && d.txnDate <= qp[c].to);
    const docRows: Cell[][] = docs.map((d) => [d.type === 'Bill' ? 'Bill' : 'Vendor credit', d.txnDate, d.number, d.vendor, d.type === 'Bill' ? d.amount : -d.amount]);
    if (docRows.length === 0) {
      docRows.push(['No bills in this period']);
    }
    docRows.push(
      ['TOTAL (QuickBooks now)', '', '', '', round2(docs.reduce((s, d) => s + (d.type === 'Bill' ? d.amount : -d.amount), 0))],
      ['Dashboard (last sync)', '', '', '', i.creditPurchases]
    );
    sections.push({
      title: `DPO ${head} – Credit purchases: QuickBooks bills − vendor credits (${qp[c].from} to ${qp[c].to})`,
      columns: ['Type', 'Date', 'Document #', 'Vendor', 'Amount'],
      rows: docRows,
    });

    // DIO: average inventory + cost of tires delivered
    sections.push(averageSection(`DIO ${head} – Average Inventory`, points, 'inventory', i.avgInventory));
    const tireLines = saleLines.filter((l) => l.isTire);
    const cogsRows: Cell[][] = tireLines.map((l) => [l.date, l.orderNumber, l.customerName, l.orderSeries, l.sku, l.quantity, dollars(l.unitCost), COST_SOURCE_LABEL[l.costSource], dollars(l.cost ?? 0)]);
    if (cogsRows.length === 0) {
      cogsRows.push(['No delivered tires in this period']);
    }
    cogsRows.push(
      ['TOTAL', '', '', '', '', tireLines.reduce((s, l) => s + l.quantity, 0), '', '', round2(dollars(tireLines.reduce((s, l) => s + (l.cost ?? 0), 0)))],
      ['Dashboard', '', '', '', '', '', '', '', i.cogs]
    );
    sections.push({
      title: `DIO ${head} – COGS: ERP cost of tires delivered`,
      columns: ['Delivery Date', 'SO #', 'Customer', 'Order Series', 'SKU', 'Tires', 'Cost per Tire', 'Cost Source', 'COGS'],
      rows: cogsRows,
    });
  }

  sections.push(await accountsByDate(qboAccess, allPoints, ['accountsReceivable', 'accountsPayable', 'inventory']));
  return sectionsCsv(sections);
}

// ---------- 1.4 Cash Generation ----------

async function cashGenerationCsv(): Promise<string> {
  const { qbo, model } = await loadContext();
  const qboAccess = await access();
  const p = getPeriods(qbo.asOf);
  const keys = ['mtd', 't90', 'ytd', 'py'] as const;
  const reports = await Promise.all(keys.map((k) => fetchCashFlowLines(qboAccess, p[k].from, p[k].to)));

  // One row per section + line, one column per period
  const byLine = new Map<string, { section: string; line: string; values: Record<string, number> }>();
  reports.forEach((report, i) => {
    for (const l of report.lines) {
      const key = `${l.section}|${l.line}`;
      const row = byLine.get(key) ?? { section: l.section, line: l.line, values: {} };
      row.values[keys[i]!] = l.amount;
      byLine.set(key, row);
    }
  });
  const sectionLabel = (s: string) => s.replace('Activities', ' activities');
  const rows: Cell[][] = [...byLine.values()].map((r) => [sectionLabel(r.section), r.line, ...keys.map((k) => r.values[k] ?? '')]);
  const cg = model.cashGeneration;
  rows.push(['', 'Operating Cash Flow (QuickBooks now)', ...reports.map((r) => r.operating)]);
  rows.push(['', 'Operating Cash Flow (dashboard)', ...keys.map((k) => cellValue(cg.ocf[k]))]);
  rows.push(['', 'Net investing activities (QuickBooks now)', ...reports.map((r) => r.investing)]);
  rows.push(['', 'CapEx (dashboard: net investing outflow)', ...keys.map((k) => cellValue(cg.capex[k]))]);
  rows.push(['', 'Free Cash Flow (dashboard)', ...keys.map((k) => cellValue(cg.fcf[k]))]);

  return sectionsCsv([
    {
      title: `Statement of Cash Flows (QuickBooks): MTD ${p.mtd.from}–${p.mtd.to} · T90 ${p.t90.from}–${p.t90.to} · YTD ${p.ytd.from}–${p.ytd.to} · PY ${p.py.from}–${p.py.to}`,
      columns: ['Section', 'Line', 'MTD', 'T90', 'YTD', 'PY'],
      rows,
    },
  ]);
}

// ---------- Profitability tab: shared helpers ----------

const PERIOD_KEYS = ['mtd', 't90', 'ytd', 'py'] as const;
type PeriodCol = (typeof PERIOD_KEYS)[number];
const PERIOD_LABEL: Record<PeriodCol, string> = { mtd: 'MTD', t90: 'T90', ytd: 'YTD', py: 'PY' };

const COST_SOURCE_LABEL: Record<RecognizedSaleLine['costSource'], string> = {
  saved: 'Saved on line (first allocation)',
  cycle: 'Order cycle cost',
  base: 'Base cost',
  none: 'No cost entered',
};

/** The four periods and the earliest date among them */
function periodFlags(asOf: string) {
  const p = getPeriods(asOf);
  const from = PERIOD_KEYS.map((k) => p[k].from).sort()[0]!;
  return { p, from };
}

type Range = { from: string; to: string };
const rangeTitle = (label: string, r: Range) => `${label} (${r.from} to ${r.to})`;

interface PeriodSales {
  lines: RecognizedSaleLine[];
  credits: RecognizedSales['credits'];
  tires: number;
  /** dollars */
  revenue: number;
  cogs: number;
}

/** Delivered tire lines and credit notes of one period, with the totals the dashboard uses */
function salesInRange(sales: RecognizedSales, r: Range): PeriodSales {
  const lines = sales.lines
    .filter((l) => l.isTire && l.date >= r.from && l.date <= r.to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.orderNumber.localeCompare(b.orderNumber));
  const credits = sales.credits.filter((c) => c.date >= r.from && c.date <= r.to);
  const gross = lines.reduce((s, l) => s + l.lineTotal, 0);
  const credit = credits.reduce((s, c) => s + c.amount, 0);
  return {
    lines,
    credits,
    tires: lines.reduce((s, l) => s + l.quantity, 0),
    revenue: dollars(gross - credit),
    cogs: dollars(lines.reduce((s, l) => s + (l.cost ?? 0), 0)),
  };
}

/** One section per period: its own lines, then TOTAL, then the dashboard value to compare */
function salesSection(label: string, r: Range, s: PeriodSales, dashboard: { revenue: Cell; cogs: Cell; grossProfit: Cell }): Section {
  const rows: Cell[][] = s.lines.map((l) => [
    'Sale', l.date, l.orderNumber, l.customerName, l.orderSeries, l.sku, l.quantity, dollars(l.unitPrice), dollars(l.lineTotal),
    dollars(l.unitCost), COST_SOURCE_LABEL[l.costSource], dollars(l.cost ?? 0), dollars(l.lineTotal - (l.cost ?? 0)),
  ]);
  for (const c of s.credits) {
    rows.push(['Credit note', c.date, c.number, c.customerName, '', '', '', '', -dollars(c.amount), '', '', '', -dollars(c.amount)]);
  }
  if (rows.length === 0) {
    rows.push(['No delivered tires in this period']);
  }
  rows.push(['TOTAL', '', '', '', '', '', s.tires, '', round2(s.revenue), '', '', round2(s.cogs), round2(s.revenue - s.cogs)]);
  rows.push(['Dashboard', '', '', '', '', '', '', '', dashboard.revenue, '', '', dashboard.cogs, dashboard.grossProfit]);
  return {
    title: `Revenue / COGS – ${rangeTitle(label, r)}: delivered tire lines (ERP)`,
    columns: ['Type', 'Delivery Date', 'SO / Credit #', 'Customer', 'Order Series', 'SKU', 'Qty', 'Unit Price', 'Revenue', 'Cost per Tire', 'Cost Source', 'COGS', 'Gross Profit'],
    rows,
  };
}

/** One section per range: QuickBooks OPEX accounts, TOTAL, then the dashboard value */
async function opexSections(ranges: Array<{ label: string; range: Range; dashboard: Cell }>): Promise<{ sections: Section[]; totals: number[] }> {
  const qboAccess = await access();
  const reports = await Promise.all(ranges.map((r) => fetchOpexAccounts(qboAccess, r.range.from, r.range.to)));
  const totals = reports.map((accounts) => round2(accounts.reduce((s, a) => s + a.amount, 0)));
  const sections = ranges.map((r, i): Section => {
    const accounts = [...reports[i]!].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
    const rows: Cell[][] = accounts.map((a) => [a.name, a.group, a.amount]);
    if (rows.length === 0) {
      rows.push(['No OPEX posted in QuickBooks for this period']);
    }
    rows.push(['TOTAL (QuickBooks now)', '', totals[i]]);
    rows.push(['Dashboard (last sync)', '', r.dashboard]);
    return { title: `OPEX – ${rangeTitle(r.label, r.range)}: QuickBooks Profit and Loss, accounts mapped to OPEX`, columns: ['Account', 'OPEX Group', 'Amount'], rows };
  });
  return { sections, totals };
}

// ---------- 2.1 Profitability ----------

async function profitabilityCsv(): Promise<string> {
  const { qbo, model } = await loadContext();
  const p = getPeriods(model.asOf);
  const qp = getPeriods(qbo.asOf);
  const pf = model.profitability;
  const sales = await loadRecognizedSales();
  const perPeriod = PERIOD_KEYS.map((k) => salesInRange(sales, p[k]));
  const opex = await opexSections(PERIOD_KEYS.map((k) => ({ label: PERIOD_LABEL[k], range: qp[k], dashboard: cellValue(pf.opex[k]) })));

  // How each number in the table is built: Revenue − COGS = GP, GP − OPEX = OP
  const build: Cell[][] = PERIOD_KEYS.map((k, i) => {
    const s = perPeriod[i]!;
    const gp = round2(s.revenue - s.cogs);
    return [PERIOD_LABEL[k], `${p[k].from} to ${p[k].to}`, round2(s.revenue), round2(s.cogs), gp, opex.totals[i], round2(gp - opex.totals[i]!)];
  });

  const kpis = [['Revenue', pf.revenue], ['COGS', pf.cogs], ['Gross Profit', pf.grossProfit], ['OPEX', pf.opex], ['Operating Profit', pf.operatingProfit]] as const;
  return sectionsCsv([
    {
      title: 'Table 2.1 as shown (value, % of revenue)',
      columns: ['KPI', ...PERIOD_KEYS.flatMap((k) => [PERIOD_LABEL[k], `${PERIOD_LABEL[k]} %`])],
      rows: kpis.map(([label, cells]) => [label, ...PERIOD_KEYS.flatMap((k) => [cellValue(cells[k]), cells[k].pct ?? ''])]),
    },
    {
      title: 'Calculation per period (totals of the sections below)',
      columns: ['Period', 'Dates', 'Revenue', 'COGS', 'Gross Profit = Revenue − COGS', 'OPEX (QuickBooks)', 'Operating Profit = GP − OPEX'],
      rows: build,
    },
    ...PERIOD_KEYS.map((k, i) =>
      salesSection(PERIOD_LABEL[k], p[k], perPeriod[i]!, { revenue: cellValue(pf.revenue[k]), cogs: cellValue(pf.cogs[k]), grossProfit: cellValue(pf.grossProfit[k]) })
    ),
    ...opex.sections,
  ]);
}

// ---------- 2.1b Commission Revenue ----------

async function commissionTableCsv(): Promise<string> {
  const { model } = await loadContext();
  const { p, from } = periodFlags(model.asOf);
  const [invoicesRes, unbilledRes] = await Promise.all([
    db
      .from('invoices')
      .select('invoice_number, invoice_date, status, invoice_items (description, line_total)')
      .eq('invoice_type', 'commission')
      .not('status', 'in', '(draft,cancelled)')
      .is('deleted_at', null)
      .gte('invoice_date', from)
      .lte('invoice_date', model.asOf)
      .order('invoice_date', { ascending: true }),
    db
      .from('sales_orders')
      .select('order_number, customer_po_number, order_series, status, commission_rate, commission_amount, customers (name)')
      .eq('is_commission_only', true)
      .is('commission_invoice_id', null)
      .is('deleted_at', null)
      .not('status', 'in', '(draft,cancelled)')
      .gt('commission_amount', 0)
      .order('order_number', { ascending: true }),
  ]);
  const error = invoicesRes.error ?? unbilledRes.error;
  if (error) {
    throw new Error(error.message);
  }

  const billedLines = (invoicesRes.data ?? []).flatMap((inv) =>
    ((inv.invoice_items ?? []) as Array<{ description: string | null; line_total: number | null }>).map((item) => ({
      number: inv.invoice_number,
      date: String(inv.invoice_date),
      status: inv.status,
      description: item.description,
      amount: Number(item.line_total ?? 0),
    }))
  );
  // One section per period: its invoice lines, TOTAL, then the dashboard value
  const billedSections: Section[] = PERIOD_KEYS.map((k) => {
    const mine = billedLines.filter((l) => l.date >= p[k].from && l.date <= p[k].to);
    const rows: Cell[][] = mine.map((l) => [l.number, l.date, l.status, l.description, dollars(l.amount)]);
    if (rows.length === 0) {
      rows.push(['No commission invoices in this period']);
    }
    rows.push(['TOTAL', '', '', '', dollars(mine.reduce((s, l) => s + l.amount, 0))]);
    rows.push(['Dashboard', '', '', '', cellValue(model.commission.billed[k])]);
    return {
      title: `Commission Billed – ${rangeTitle(PERIOD_LABEL[k], p[k])}: commission invoices to Galileo (not draft / cancelled), by invoice date`,
      columns: ['Invoice #', 'Invoice Date', 'Status', 'Description', 'Amount'],
      rows,
    };
  });

  type UnbilledOrder = { order_number: string; customer_po_number: string | null; order_series: string | null; status: string; commission_rate: number | null; commission_amount: number | null; customers: { name: string | null } | { name: string | null }[] | null };
  let unbilledTotal = 0;
  const unbilledRows: Cell[][] = ((unbilledRes.data ?? []) as unknown as UnbilledOrder[]).map((so) => {
    const customer = Array.isArray(so.customers) ? so.customers[0] : so.customers;
    const amount = Number(so.commission_amount ?? 0);
    const rate = Number(so.commission_rate ?? 0);
    unbilledTotal += amount;
    return [so.order_number, customer?.name ?? '', so.customer_po_number, so.order_series, so.status, rate > 0 ? Math.round(amount / rate) : '', dollars(rate), dollars(amount)];
  });
  unbilledRows.push(['TOTAL', '', '', '', '', '', '', dollars(unbilledTotal)]);
  unbilledRows.push(['Not Billed Yet (dashboard)', '', '', '', '', '', '', cellValue(model.commission.unbilled)]);

  return sectionsCsv([
    ...billedSections,
    {
      title: 'Commission not billed yet: commission-only orders without a commission invoice',
      columns: ['SO #', 'Customer', 'Customer PO', 'Order Series', 'Status', 'Tires', 'Rate', 'Commission'],
      rows: unbilledRows,
    },
  ]);
}

// ---------- 2.3 OPEX Run Rate ----------

async function opexRunRateCsv(): Promise<string> {
  const { qbo, model } = await loadContext();
  const qp = getPeriods(qbo.asOf);
  const t90py = { from: addYears(qp.t90.from, -1), to: addYears(qp.t90.to, -1) };
  const rr = model.opexRunRate;
  const opex = await opexSections([
    { label: 'MTD actual', range: qp.mtd, dashboard: '' },
    { label: 'T90', range: qp.t90, dashboard: '' },
    { label: 'PY T90 (same 90 days last year)', range: t90py, dashboard: '' },
  ]);
  const [mtd, t90, py] = opex.totals as [number, number, number];
  return sectionsCsv([
    {
      title: 'Table 2.3 as shown',
      columns: ['KPI', 'Current Month Est.', 'T90 Avg', 'PY'],
      rows: [
        ['OPEX / Month', cellValue(rr.monthly.current), cellValue(rr.monthly.t90), cellValue(rr.monthly.py)],
        ['Annualized OPEX', cellValue(rr.annualized.current), cellValue(rr.annualized.t90), cellValue(rr.annualized.py)],
      ],
    },
    {
      title: 'Calculation (totals of the sections below)',
      columns: ['Column', 'OPEX total', 'OPEX / Month', 'Annualized OPEX', 'Formula'],
      rows: [
        ['Current Month Est.', mtd, cellValue(rr.monthly.current), cellValue(rr.annualized.current), 'MTD actual + forecast for the rest of the month (forecast pending)'],
        ['T90 Avg', t90, round2(t90 / 3), round2((t90 / 3) * 12), 'T90 OPEX ÷ 3 months; annualized = monthly × 12'],
        ['PY', py, round2(py / 3), round2((py / 3) * 12), 'Same 90 days last year ÷ 3; annualized = monthly × 12'],
      ],
    },
    ...opex.sections.map((s) => ({ ...s, rows: s.rows.filter((r) => r[0] !== 'Dashboard (last sync)') })),
  ]);
}

// ---------- 3.1 Backlog Summary ----------

type BacklogItem = { id: string; product_id: string | null; sku: string | null; quantity: number | null; customer_qty: number | null; line_total: number | null; unit_cost: number | null; products: { item_type: string | null; base_cost: number | null } | { item_type: string | null; base_cost: number | null }[] | null };
type BacklogOrder = { order_number: string; order_date: string | null; status: string; order_series: string | null; is_commission_only: boolean | null; customer_po_number: string | null; customers: { name: string | null } | { name: string | null }[] | null; sales_order_items: BacklogItem[] | null };

async function backlogCsv(): Promise<string> {
  const { model, history } = await loadContext();
  const [soRes, sales, cycleCost] = await Promise.all([
    db
      .from('sales_orders')
      .select(
        'order_number, order_date, status, order_series, is_commission_only, customer_po_number, customers (name), ' +
          'sales_order_items (id, product_id, sku, quantity, customer_qty, line_total, unit_cost, products (item_type, base_cost))'
      )
      .is('deleted_at', null)
      .in('status', ['confirmed', 'processing'])
      .order('order_date', { ascending: true }),
    loadRecognizedSales(),
    productCycleCostRepository.loadLookup(),
  ]);
  if (soRes.error) {
    throw new Error(soRes.error.message);
  }
  // Same rule as executive-erp.service: a delivered order's tires are recognized, not backlog
  const recognized = new Set(sales.lines.map((l) => l.salesOrderItemId));

  let tires = 0;
  let revenue = 0;
  let cogs = 0;
  const rows: Cell[][] = [];
  for (const so of (soRes.data ?? []) as unknown as BacklogOrder[]) {
    if (so.is_commission_only === true) {
      continue;
    }
    const customer = Array.isArray(so.customers) ? so.customers[0] : so.customers;
    for (const item of so.sales_order_items ?? []) {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const remaining = recognized.has(item.id) ? 0 : Number(item.customer_qty ?? item.quantity ?? 0);
      if (!item.product_id || product?.item_type !== 'inventory' || remaining === 0) {
        continue;
      }
      const qty = Number(item.quantity ?? 0);
      const unitNet = qty > 0 ? Number(item.line_total ?? 0) / qty : 0;
      const saved = Number(item.unit_cost ?? 0);
      const unitCost = saved > 0 ? saved : cycleCost(item.product_id, so.order_series, Number(product?.base_cost ?? 0));
      const source = saved > 0 ? 'Saved on line (first allocation)' : unitCost > 0 ? 'Order cycle / base cost' : 'No cost entered';
      const lineRevenue = remaining * unitNet;
      const lineCost = unitCost > 0 ? remaining * unitCost : 0;
      tires += remaining;
      revenue += lineRevenue;
      cogs += lineCost;
      rows.push([
        so.order_number, customer?.name ?? '', so.customer_po_number, so.status, so.order_date, so.order_series, item.sku, remaining,
        dollars(unitNet), dollars(lineRevenue), dollars(unitCost), source, dollars(lineCost), dollars(lineRevenue - lineCost),
      ]);
    }
  }
  const b = model.backlog;
  rows.push(['TOTAL', '', '', '', '', '', '', tires, '', dollars(revenue), '', '', dollars(cogs), dollars(revenue - cogs)]);
  rows.push(['Dashboard', '', '', '', '', '', '', cellValue(b.tires.current), '', cellValue(b.revenue.current), '', '', '', cellValue(b.grossProfit.current)]);

  const kpis = [['Backlog Tires', b.tires], ['Backlog Revenue', b.revenue], ['Revenue / Tire', b.revenuePerTire], ['Backlog Gross Profit', b.grossProfit], ['GP / Tire', b.gpPerTire], ['GP %', b.gpPct]] as const;
  return sectionsCsv([
    {
      title: 'Table 3.1 as shown (T90 / YTD averages come from the daily snapshots)',
      columns: ['KPI', 'Current', 'T90 Avg', 'YTD Avg', 'PY'],
      rows: kpis.map(([label, c]) => [label, cellValue(c.current), cellValue(c.t90Avg), cellValue(c.ytdAvg), cellValue(c.py)]),
    },
    {
      title: 'Current: firm orders (confirmed / processing) not delivered yet, tire lines, commission-only excluded',
      columns: ['SO #', 'Customer', 'Customer PO', 'Status', 'Order Date', 'Order Series', 'SKU', 'Tires', 'Unit Price (net)', 'Revenue', 'Cost per Tire', 'Cost Source', 'COGS', 'Gross Profit'],
      rows,
    },
    ...historySections(history, model.asOf, [
      ['Backlog Tires', (d) => d.backlogTires, b.tires],
      ['Backlog Revenue', (d) => d.backlogRevenue, b.revenue],
      ['Revenue / Tire', (d) => (d.backlogTires ? d.backlogRevenue / d.backlogTires : null), b.revenuePerTire],
    ]),
  ]);
}

/** T90 Avg, YTD Avg and PY sections for each daily-snapshot KPI */
function historySections(
  history: DailySnapshot[],
  asOf: string,
  kpis: Array<[string, (d: DailySnapshot) => number | null, { t90Avg: { value: number | null; note?: string }; ytdAvg: { value: number | null; note?: string }; py: { value: number | null; note?: string } }]>
): Section[] {
  const p = getPeriods(asOf);
  return kpis.flatMap(([label, pick, cells]) => [
    historySection(`${label} – T90 Avg (${p.t90.from} to ${asOf}): average of daily snapshots`, history, asOf, 't90', pick, cellValue(cells.t90Avg)),
    historySection(`${label} – YTD Avg (${p.ytd.from} to ${asOf}): average of daily snapshots`, history, asOf, 'ytd', pick, cellValue(cells.ytdAvg)),
    historySection(`${label} – PY: snapshot one year earlier`, history, asOf, 'py', pick, cellValue(cells.py)),
  ]);
}

// ---------- 4.1 Incoming Supply ----------

type One<T> = T | T[] | null;
const one = <T,>(x: One<T>): T | null => (Array.isArray(x) ? x[0] ?? null : x);

async function incomingSupplyCsv(): Promise<string> {
  const { model } = await loadContext();
  const asOf = model.asOf;
  const [productsRes, poRes, shipRes, soRes] = await Promise.all([
    db.from('products').select('id, sku, name, item_type'),
    db
      .from('purchase_orders')
      .select('id, po_number, po_date, status, order_series, expected_delivery_date, confirmed_eta, purchase_order_items(product_id, quantity_ordered)')
      .is('deleted_at', null)
      .not('status', 'in', '(draft,cancelled)'),
    db
      .from('shipments')
      .select('purchase_order_id, shipment_number, container_number, eta_port_tracking, confirmed_eta, eta_to_port, estimated_arrival')
      .is('deleted_at', null)
      .not('purchase_order_id', 'is', null),
    db
      .from('sales_orders')
      .select('order_number, order_date, status, order_series, is_commission_only, customers (name), sales_order_items(product_id, quantity, customer_qty)')
      .is('deleted_at', null)
      .not('status', 'in', '(draft,cancelled)')
      .order('order_date', { ascending: true }),
  ]);
  const error = productsRes.error ?? poRes.error ?? shipRes.error ?? soRes.error;
  if (error) {
    throw new Error(error.message);
  }
  const products = new Map((productsRes.data ?? []).map((pr) => [String(pr.id), pr]));
  const isTire = (id: unknown) => Boolean(id && products.get(String(id))?.item_type === 'inventory');
  const sku = (id: unknown) => (id ? products.get(String(id))?.sku ?? '' : '');
  const cycleOf = (series: unknown) => (series ? String(series) : 'Unassigned');
  const velocityFrom = addDays(asOf, -27);

  // Same ETA order as executive-erp.service
  type Ship = { purchase_order_id: string | null; shipment_number: string | null; container_number: string | null; eta_port_tracking: string | null; confirmed_eta: string | null; eta_to_port: string | null; estimated_arrival: string | null };
  const etaOf = (s: Ship) => s.eta_port_tracking ?? s.confirmed_eta ?? s.eta_to_port ?? s.estimated_arrival ?? null;
  const shipsByPo = new Map<string, Ship[]>();
  for (const s of (shipRes.data ?? []) as Ship[]) {
    const list = shipsByPo.get(String(s.purchase_order_id)) ?? [];
    list.push(s);
    shipsByPo.set(String(s.purchase_order_id), list);
  }

  type SupplyOrder = { order_number: string; order_date: string | null; status: string; order_series: string | null; is_commission_only: boolean | null; customers: One<{ name: string | null }>; sales_order_items: Array<{ product_id: string | null; quantity: number | null; customer_qty: number | null }> | null };
  const sos = (soRes.data ?? []) as unknown as SupplyOrder[];
  const pos = (poRes.data ?? []) as unknown as Array<{ id: string; po_number: string; po_date: string | null; status: string; order_series: string | null; expected_delivery_date: string | null; confirmed_eta: string | null; purchase_order_items: Array<{ product_id: string | null; quantity_ordered: number | null }> | null }>;

  const sections: Section[] = [
    {
      title: 'Table 4.1 as shown',
      columns: ['Order Cycle', 'Tires Ordered', 'Containers', 'Arrival Window', 'Weeks Left', 'Sold', 'Unsold', 'Forward Commit %', 'Actual Weekly Velocity', 'Required Weekly Velocity', 'Velocity Gap', 'Projected Uncommitted at Arrival'],
      rows: model.supply.map((s) => [
        s.cycle, s.tiresOrdered, cellValue(s.containers), s.arrivalStart ? `${s.arrivalStart} to ${s.arrivalEnd}` : '', s.weeksLeft, s.sold, s.unsold,
        s.forwardCommitPct, s.actualWeeklyVelocity, s.requiredWeeklyVelocity, s.velocityGap, s.projectedUncommitted,
      ]),
    },
  ];

  for (const s of model.supply) {
    const cyclePos = pos.filter((po) => cycleOf(po.order_series) === s.cycle);

    // Tires ordered
    let ordered = 0;
    const poRows: Cell[][] = [];
    for (const po of cyclePos) {
      for (const item of po.purchase_order_items ?? []) {
        if (!isTire(item.product_id)) {
          continue;
        }
        ordered += Number(item.quantity_ordered ?? 0);
        poRows.push([po.po_number, po.po_date, po.status, sku(item.product_id), Number(item.quantity_ordered ?? 0)]);
      }
    }
    poRows.push(['TOTAL', '', '', '', ordered], ['Dashboard', '', '', '', s.tiresOrdered]);
    sections.push({ title: `${s.cycle} – Tires Ordered: tire lines on purchase orders of this cycle (not draft / cancelled)`, columns: ['PO #', 'PO Date', 'Status', 'SKU', 'Tires Ordered'], rows: poRows });

    // Arrival window and containers
    const etaRows: Cell[][] = [];
    const etas: string[] = [];
    const containers = new Set<string>();
    for (const po of cyclePos) {
      const ships = shipsByPo.get(po.id) ?? [];
      const shipEtas = ships.map(etaOf).filter((d): d is string => Boolean(d));
      for (const sh of ships) {
        const container = String(sh.container_number ?? '').trim().toUpperCase();
        if (container) {
          containers.add(container);
        }
        const eta = etaOf(sh);
        etaRows.push([po.po_number, sh.shipment_number, container, eta ? 'Shipment ETA' : 'No ETA on shipment', eta ? eta.slice(0, 10) : '']);
      }
      if (shipEtas.length) {
        etas.push(...shipEtas.map((d) => d.slice(0, 10)));
      } else {
        const poEta = po.confirmed_eta ?? po.expected_delivery_date;
        etaRows.push([po.po_number, '', '', poEta ? 'PO ETA (no shipment ETA)' : 'No ETA', poEta ? poEta.slice(0, 10) : '']);
        if (poEta) {
          etas.push(poEta.slice(0, 10));
        }
      }
    }
    etas.sort();
    etaRows.push(
      ['Arrival Window = earliest to latest ETA used', '', '', '', etas.length ? `${etas[0]} to ${etas[etas.length - 1]}` : ''],
      ['Containers = distinct container numbers', '', containers.size, '', ''],
      ['Dashboard', '', cellValue(s.containers), '', s.arrivalStart ? `${s.arrivalStart} to ${s.arrivalEnd}` : '']
    );
    sections.push({ title: `${s.cycle} – Arrival Window and Containers: shipment ETAs (else the PO ETA)`, columns: ['PO #', 'Shipment #', 'Container', 'ETA Source', 'ETA'], rows: etaRows });

    // Sold and recent sales
    let sold = 0;
    let recent = 0;
    const soRows: Cell[][] = [];
    for (const so of sos.filter((o) => cycleOf(o.order_series) === s.cycle)) {
      const inWindow = Boolean(so.order_date && so.order_date >= velocityFrom && so.order_date <= asOf);
      for (const item of so.sales_order_items ?? []) {
        if (!isTire(item.product_id)) {
          continue;
        }
        const tires = Number(item.customer_qty ?? item.quantity ?? 0);
        sold += tires;
        if (inWindow) {
          recent += tires;
        }
        soRows.push([so.order_number, so.order_date, so.status, one(so.customers)?.name ?? '', so.is_commission_only ? 'Yes' : 'No', sku(item.product_id), tires, inWindow ? 'Yes' : '']);
      }
    }
    if (soRows.length === 0) {
      soRows.push(['No sales orders in this cycle']);
    }
    soRows.push(['TOTAL Sold', '', '', '', '', '', sold, ''], [`Sold in last 4 weeks (${velocityFrom} to ${asOf})`, '', '', '', '', '', recent, ''], ['Dashboard Sold', '', '', '', '', '', s.sold, '']);
    sections.push({ title: `${s.cycle} – Sold: tire lines on sales orders of this cycle (not draft / cancelled)`, columns: ['SO #', 'Order Date', 'Status', 'Customer', 'Commission Only', 'SKU', 'Tires', 'In Last 4 Weeks'], rows: soRows });

    // Calculation
    sections.push({
      title: `${s.cycle} – Calculation (as of ${asOf})`,
      columns: ['KPI', 'Formula', 'Value'],
      rows: [
        ['Weeks Left', `Days from ${asOf} to arrival start ${s.arrivalStart ?? '—'} ÷ 7 (0 once arrival started)`, s.weeksLeft],
        ['Unsold', `Tires Ordered ${s.tiresOrdered} − Sold ${s.sold} (min 0)`, s.unsold],
        ['Forward Commit %', `Sold ${s.sold} ÷ Tires Ordered ${s.tiresOrdered} × 100`, s.forwardCommitPct],
        ['Actual Weekly Velocity', `Sold in last 4 weeks ${recent} ÷ 4`, s.actualWeeklyVelocity],
        ['Required Weekly Velocity', `Unsold ${s.unsold} ÷ Weeks Left ${s.weeksLeft ?? '—'} (blank when Weeks Left is 0)`, s.requiredWeeklyVelocity],
        ['Velocity Gap', 'Actual − Required', s.velocityGap],
        ['Projected Uncommitted at Arrival', 'Unsold − Actual velocity × Weeks Left (min 0); Unsold once arrival started', s.projectedUncommitted],
      ],
    });
  }
  return sectionsCsv(sections);
}

// ---------- 4.2 Current Inventory ----------

async function currentInventoryCsv(): Promise<string> {
  const { qbo, model, erp, history } = await loadContext();
  const qboAccess = await access();
  const asOf = model.asOf;
  const [accounts, invRes, sales] = await Promise.all([
    fetchAccountBalances(qboAccess, qbo.asOf),
    db.from('inventory').select('on_hand, allocated, products (sku, name, item_type), locations (name)'),
    loadRecognizedSales(),
  ]);
  if (invRes.error) {
    throw new Error(invRes.error.message);
  }
  const inv = model.inventory;

  // Tires on hand / allocated per product and location (ERP)
  type InvRow = { on_hand: number | null; allocated: number | null; products: One<{ sku: string | null; name: string | null; item_type: string | null }>; locations: One<{ name: string | null }> };
  let onHand = 0;
  let allocated = 0;
  const unitRows: Cell[][] = [];
  for (const row of (invRes.data ?? []) as unknown as InvRow[]) {
    const product = one(row.products);
    if (product?.item_type !== 'inventory') {
      continue;
    }
    const oh = Number(row.on_hand ?? 0);
    const al = Number(row.allocated ?? 0);
    if (oh === 0 && al === 0) {
      continue;
    }
    onHand += oh;
    allocated += al;
    unitRows.push([product.sku, product.name, one(row.locations)?.name ?? '', oh, al, oh - al]);
  }
  unitRows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[2]).localeCompare(String(b[2])));
  unitRows.push(
    ['TOTAL', '', '', onHand, allocated, Math.max(0, onHand - allocated)],
    ['Dashboard (Tires On Hand / Uncommitted)', '', '', cellValue(inv.tiresOnHand.current), '', cellValue(inv.uncommitted.current)]
  );

  // Months of supply: tires delivered in the 3 most recent completed months
  const t3m = { from: monthStart(asOf, 3), to: monthEnd(monthStart(asOf, 1)) };
  const t3mLines = sales.lines.filter((l) => l.isTire && l.date >= t3m.from && l.date <= t3m.to).sort((a, b) => a.date.localeCompare(b.date));
  const t3mTires = t3mLines.reduce((s, l) => s + l.quantity, 0);
  const monthly = Math.round((t3mTires / 3) * 10) / 10;
  const supplyRows: Cell[][] = t3mLines.map((l) => [l.date, l.orderNumber, l.customerName, l.sku, l.quantity]);
  if (supplyRows.length === 0) {
    supplyRows.push(['No tires delivered in these 3 months']);
  }
  supplyRows.push(
    ['TOTAL tires delivered', '', '', '', t3mTires],
    ['Monthly tires = TOTAL ÷ 3', '', '', '', monthly],
    [`Months of Supply = Uncommitted ${erp.inventory.uncommitted} ÷ Monthly ${monthly}`, '', '', '', monthly > 0 ? Math.round((erp.inventory.uncommitted / monthly) * 10) / 10 : ''],
    ['Dashboard', '', '', '', cellValue(inv.monthsOfSupply.current)]
  );

  const t90 = balancePoints(qbo, asOf, 't90');
  const ytd = balancePoints(qbo, asOf, 'ytd');
  const pyPoint = balancePoints(qbo, asOf, 'pyDate');
  const p = getPeriods(asOf);

  return sectionsCsv([
    {
      title: 'Table 4.2 as shown',
      columns: ['KPI', 'Current', 'T90 Avg', 'YTD Avg', 'PY'],
      rows: (
        [
          ['Inventory at Cost', inv.atCost],
          ['Tires On Hand', inv.tiresOnHand],
          ['Cost / Tire', inv.costPerTire],
          ['Uncommitted Inventory', inv.uncommitted],
          ['Uncommitted Months of Supply', inv.monthsOfSupply],
        ] as const
      ).map(([label, c]) => [label, cellValue(c.current), cellValue(c.t90Avg), cellValue(c.ytdAvg), cellValue(c.py)]),
    },
    accountSection(`Inventory at Cost – Current: QuickBooks accounts mapped to Inventory on ${qbo.asOf}`, qbo.asOf, accounts, 'inventory', cellValue(inv.atCost.current)),
    {
      title: 'Tires On Hand and Uncommitted – Current: ERP inventory, tire products (uncommitted = on hand − allocated)',
      columns: ['SKU', 'Product', 'Location', 'On Hand', 'Allocated', 'On Hand − Allocated'],
      rows: unitRows,
    },
    {
      title: 'Cost / Tire – Current',
      columns: ['Formula', 'Inventory at Cost', 'Tires On Hand', 'Cost / Tire', 'Dashboard'],
      rows: [['Inventory at Cost ÷ Tires On Hand', qbo.inventory, erp.inventory.tiresOnHand, erp.inventory.tiresOnHand ? round2(qbo.inventory / erp.inventory.tiresOnHand) : '', cellValue(inv.costPerTire.current)]],
    },
    {
      title: `Uncommitted Months of Supply – Current: tires delivered ${t3m.from} to ${t3m.to} (3 most recent completed months)`,
      columns: ['Delivery Date', 'SO #', 'Customer', 'SKU', 'Tires'],
      rows: supplyRows,
    },
    averageSection(`Inventory at Cost – T90 Avg (${p.t90.from} to ${p.t90.to}): month-ends + current`, t90, 'inventory', cellValue(inv.atCost.t90Avg)),
    averageSection(`Inventory at Cost – YTD Avg (${p.ytd.from} to ${p.ytd.to}): month-ends + current`, ytd, 'inventory', cellValue(inv.atCost.ytdAvg)),
    averageSection('Inventory at Cost – PY: balance on the prior-year date', pyPoint, 'inventory', cellValue(inv.atCost.py)),
    await accountsByDate(qboAccess, [...ytd, ...t90, ...pyPoint], ['inventory']),
    ...historySections(history, asOf, [
      ['Tires On Hand', (d) => d.tiresOnHand, inv.tiresOnHand],
      ['Cost / Tire', (d) => (d.inventoryAtCost === null || d.tiresOnHand === 0 ? null : d.inventoryAtCost / d.tiresOnHand), inv.costPerTire],
      ['Uncommitted Inventory', (d) => d.uncommitted, inv.uncommitted],
      ['Uncommitted Months of Supply', (d) => d.monthsOfSupply, inv.monthsOfSupply],
    ]),
  ]);
}

// ---------- entry point ----------

const FILE: Record<TableDrillDown, string> = {
  'table-1.1': 'liquidity',
  'table-1.2': 'working-capital-position',
  'table-1.3': 'working-capital-efficiency',
  'table-1.4': 'cash-generation',
  'table-2.1': 'profitability',
  'table-2.1b': 'commission-revenue',
  'table-2.3': 'opex-run-rate',
  'table-3.1': 'backlog-summary',
  'table-4.1': 'incoming-supply',
  'table-4.2': 'current-inventory',
};

export async function buildTableDrillDown(kind: TableDrillDown): Promise<CsvExport> {
  const builders: Record<TableDrillDown, () => Promise<string>> = {
    'table-1.1': liquidityCsv,
    'table-1.2': workingCapitalCsv,
    'table-1.3': efficiencyCsv,
    'table-1.4': cashGenerationCsv,
    'table-2.1': profitabilityCsv,
    'table-2.1b': commissionTableCsv,
    'table-2.3': opexRunRateCsv,
    'table-3.1': backlogCsv,
    'table-4.1': incomingSupplyCsv,
    'table-4.2': currentInventoryCsv,
  };
  const csv = await builders[kind]();
  const today = new Date().toISOString().slice(0, 10);
  return { filename: `${FILE[kind]}-${today}.csv`, csv };
}
