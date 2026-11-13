'use client';

/**
 * Executive dashboard tables (Ankur's spec: 1.1–1.4, 2.1–2.3, 3.1, 4.1, 4.2)
 *
 * Every value is live (ERP or the latest QuickBooks snapshot). A cell without
 * data shows "—" and the reason; no sample numbers.
 */

import { useEffect, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';

import { getExecutiveDashboard } from '../../actions/executive-dashboard.actions';
import { usePnlBasis } from '../PnlBasisToggle';
import type { PnlBasis } from '../../lib/pnl-basis';
import type { CashProjection, Cell, ExecutiveDashboardModel } from '../../lib/executive-model';
import { executiveTabModel, type ExecutiveDashboardView, type ExecutiveTab } from '../../lib/dashboard-tabs';
import { CALCULATIONS, type CalcStatus } from './calculations';
import { TABLE_DRILLDOWN } from '../../lib/drilldown';
import { DrillDownButton } from '../DrillDownButton';
import { QBO_FINANCIALS_UPDATED_EVENT, ensureFreshOnce } from '../financial-metrics/QuickBooksFinancials';

// ============================================
// CALCULATION METHOD (eye icon)
// ============================================

const STATUS_STYLE: Record<CalcStatus, { box: string; title: string; text: string; label: string }> = {
  live: { box: 'bg-green-50', title: 'text-green-900', text: 'text-green-700', label: 'Live' },
  partial: { box: 'bg-amber-50', title: 'text-amber-900', text: 'text-amber-700', label: 'Partial' },
  pending: { box: 'bg-gray-50', title: 'text-gray-900', text: 'text-gray-600', label: 'Pending' },
};

function CalculationMethod({ tableId }: { tableId: string }) {
  const items = CALCULATIONS[tableId] ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-full p-1 transition-colors hover:bg-gray-100"
          aria-label="How is this calculated?"
          title="How is this calculated?"
        >
          <Eye className="h-4 w-4 text-gray-500 hover:text-blue-600" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[70vh] w-96 overflow-y-auto" align="start">
        <div className="space-y-3">
          <h4 className="border-b pb-2 text-sm font-semibold">Calculation Method</h4>
          <div className="space-y-2 text-xs">
            {items.map((item) => {
              const style = STATUS_STYLE[item.status];
              return (
                <div key={item.kpi} className={`rounded p-2 ${style.box}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-semibold ${style.title}`}>{item.kpi}</p>
                    <span className={`text-[10px] font-medium uppercase ${style.text}`}>{style.label}</span>
                  </div>
                  <p className={`mt-1 ${style.text}`}>{item.formula}</p>
                  <p className={`mt-1 text-[10px] ${style.text}`}>Source: {item.source}</p>
                </div>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// DATA (one request shared by the three tabs)
// ============================================

// let pending: Promise<ExecutiveDashboardView | string> | null = null;
//
// function loadOnce(): Promise<ExecutiveDashboardView | string> {
//   if (!pending) {
//     pending = getExecutiveDashboard()
//       .then((r) => (r.success ? r.data : r.error))
//       .catch(() => 'Failed to load the executive dashboard');
//     // Fresh data on the next visit
//     setTimeout(() => {
//       pending = null;
//     }, 60_000);
//   }
//   return pending;
// }
// Nov 12 2026: one request per P&L basis (Cash / Accrual toggle)
const pendingByBasis = new Map<PnlBasis, Promise<ExecutiveDashboardView | string>>();

function loadOnce(basis: PnlBasis): Promise<ExecutiveDashboardView | string> {
  let pending = pendingByBasis.get(basis);
  if (!pending) {
    pending = getExecutiveDashboard(basis)
      .then((r) => (r.success ? r.data : r.error))
      .catch(() => 'Failed to load the executive dashboard');
    pendingByBasis.set(basis, pending);
    // Fresh data on the next visit
    setTimeout(() => {
      pendingByBasis.delete(basis);
    }, 60_000);
  }
  return pending;
}

function useExecutiveDashboard() {
  const basis = usePnlBasis();
  const [state, setState] = useState<ExecutiveDashboardView | string | null>(null);
  useEffect(() => {
    let active = true;
    // Loading state while the other basis is fetched
    setState(null);
    loadOnce(basis).then((r) => {
      if (!active) {
        return;
      }
      setState(r);
      // QuickBooks figures not from today yet: trigger the daily refresh
      // (the update event below reloads the tables when it finishes)
      if (typeof r !== 'string' && r.quickBooks.connected && (!r.quickBooks.hasPeriods || !r.quickBooks.hasPnl || !r.quickBooks.hasOpenInvoices ||(r.quickBooks.asOf ?? '') < r.asOf)) {
        void ensureFreshOnce();
      }
    });
    // QuickBooks figures were refreshed (automatic or "Sync now"): reload
    const onUpdated = () => {
      // pending = null;
      // loadOnce().then((r) => active && setState(r));
      pendingByBasis.clear();
      loadOnce(basis).then((r) => active && setState(r));
    };
    window.addEventListener(QBO_FINANCIALS_UPDATED_EVENT, onUpdated);
    return () => {
      active = false;
      window.removeEventListener(QBO_FINANCIALS_UPDATED_EVENT, onUpdated);
    };
  // }, []);
  }, [basis]);
  return state;
}

// ============================================
// FORMATTING
// ============================================

type Format = 'money' | 'cost' | 'money2' | 'count' | 'days' | 'pct' | 'months';

function formatValue(value: number, format: Format): string {
  switch (format) {
    case 'money':
    case 'money2': {
      const s = Math.abs(value).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: format === 'money2' ? 2 : 0,
        minimumFractionDigits: format === 'money2' ? 2 : 0,
      });
      return value < 0 ? `(${s})` : s;
    }
    case 'cost':
      return `(${Math.abs(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })})`;
    case 'count':
      return value.toLocaleString('en-US');
    case 'days':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} days`;
    case 'pct':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
    case 'months':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} months`;
  }
}

function CellView({ cell, format, pct }: { cell: Cell; format: Format; pct?: number | null }) {
  if (cell.value === null) {
    return (
      <div className="text-right">
        <span className="text-muted-foreground">—</span>
        {cell.note && cell.note !== '—' && <p className="text-[10px] leading-tight text-muted-foreground">{cell.note}</p>}
      </div>
    );
  }
  return (
    <div className="text-right tabular-nums">
      {formatValue(cell.value, format)}
      {pct !== undefined && pct !== null && <span className="ml-1 text-xs text-muted-foreground">{pct}%</span>}
      {cell.note && <p className="text-[10px] leading-tight text-muted-foreground">{cell.note}</p>}
    </div>
  );
}

interface Row {
  label: string;
  format: Format;
  cells: Record<string, Cell & { pct?: number | null }>;
  showPct?: boolean;
  /** Per-column format override (e.g. weighted timing in days on a money row) */
  formats?: Record<string, Format>;
}

function SpecTable({
  id,
  title,
  description,
  columns,
  rows,
}: {
  id: string;
  title: string;
  description?: string;
  columns: Array<{ key: string; label: string }>;
  rows: Row[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">
            Table {id} – {title}
          </CardTitle>
          <CalculationMethod tableId={id} />
          {TABLE_DRILLDOWN[id] && <DrillDownButton kind={TABLE_DRILLDOWN[id]!} label={`Table ${id} – ${title}`} />}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              {columns.map((c) => (
                <TableHead key={c.key} className="text-right">
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="font-medium">{row.label}</TableCell>
                {columns.map((c) => (
                  <TableCell key={c.key}>
                    <CellView
                      cell={row.cells[c.key]!}
                      format={row.formats?.[c.key] ?? row.format}
                      pct={row.showPct ? row.cells[c.key]!.pct : undefined}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Status({ model }: { model: ExecutiveDashboardView }) {
  const qb = model.quickBooks;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>As of {model.asOf} (ERP)</span>
      <span>·</span>
      {qb.asOf ? (
        <span>QuickBooks figures as of {qb.asOf}</span>
      ) : (
        <span>{qb.connected ? 'No QuickBooks snapshot yet — use "Sync now" on the QuickBooks Financials card' : 'QuickBooks not connected'}</span>
      )}
      {qb.environment === 'sandbox' && (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
          QuickBooks sandbox
        </Badge>
      )}
      <span>· PY = same period last year · averages use month-end balances · revenue and tires = tires on delivered orders</span>
    </div>
  );
}

function Wrapper({ tab, children }: { tab: ExecutiveTab; children: (model: ExecutiveDashboardModel) => React.ReactNode }) {
  const state = useExecutiveDashboard();
  if (state === null) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }
  if (typeof state === 'string') {
    return <p className="text-sm text-destructive">{state}</p>;
  }
  const model = executiveTabModel(state, tab);
  if (!model) {
    return <p className="text-sm text-muted-foreground">You do not have access to this tab.</p>;
  }
  return (
    <div className="grid gap-6">
      <Status model={state} />
      {children(model)}
    </div>
  );
}

const C4 = [
  { key: 'mtd', label: 'MTD' },
  { key: 't90', label: 'T90' },
  { key: 'ytd', label: 'YTD' },
  { key: 'py', label: 'PY' },
];
const AVG = [
  { key: 'current', label: 'Current' },
  { key: 't90Avg', label: 'T90 Avg' },
  { key: 'ytdAvg', label: 'YTD Avg' },
  { key: 'py', label: 'PY' },
];
// Nov 12 2026 (Ankur, Nov 11 email): Backlog columns Current / T3M / T12M, no PY (Inventory keeps AVG)
const BACKLOG_COLS = [
  { key: 'current', label: 'Current' },
  { key: 't3m', label: 'T3M' },
  { key: 't12m', label: 'T12M' },
];

// ============================================
// PROJECTED CASH BY QUARTER (Ankur, Oct 27 call)
// ============================================

function ProjectedCashByQuarter({ projection }: { projection: CashProjection | null }) {
  if (!projection) {
    return null;
  }
  const money = (n: number) => formatValue(n, 'money');
  const rows: Array<{ label: string; value: (q: CashProjection['quarters'][number]) => string; bold?: boolean }> = [
    { label: 'Opening Cash', value: (q) => money(q.opening) },
    // Nov 6 2026: QuickBooks open invoices, by due date
    ...(projection.openInvoices
      ? [
          { label: '+ Open invoices (QuickBooks)', value: (q: CashProjection['quarters'][number]) => money(q.receivables) },
          { label: 'Invoices', value: (q: CashProjection['quarters'][number]) => String(q.invoices) },
        ]
      : []),
    ...(projection.openBills
      ? [
          { label: '− Open bills (QuickBooks)', value: (q: CashProjection['quarters'][number]) => money(-q.payables) },
          { label: 'Bills', value: (q: CashProjection['quarters'][number]) => String(q.bills) },
        ]
      : []),
    // Before Nov 7 2026: { label: '+ Orders on the books', value: (q) => money(q.inflow) },
    {
      // Before Nov 9 2026: label: projection.ordersSource === 'quickbooks' ? '+ Open sales orders (QuickBooks)' : '+ Open sales orders (sync QuickBooks)',
      label:
        projection.ordersSource === 'quickbooks'
          ? '+ Open sales orders (QuickBooks)'
          : projection.ordersSource === 'erp'
            ? '+ Open orders (ERP, for now)'
            : '+ Open sales orders (sync QuickBooks)',
      value: (q) => money(q.inflow),
    },
    { label: 'Orders / Tires', value: (q) => `${q.orders} / ${q.tires.toLocaleString('en-US')}` },
    // Nov 12 2026 (Ankur, Nov 11 email): OPEX at the YTD run rate
    ...(projection.opex
      ? [{ label: '− OPEX (YTD run rate)', value: (q: CashProjection['quarters'][number]) => money(-q.opex) }]
      : []),
    // Nov 13 2026 (Ankur, Nov 12 email): supplier POs not billed yet, paid at delivery + 45
    ...(projection.supplierPayables?.included.length
      ? [
          {
            label: `− Supplier POs not billed (delivery + ${projection.supplierPayables.termsDays})`,
            value: (q: CashProjection['quarters'][number]) => money(-(q.supplierPayables ?? 0)),
          },
          { label: 'POs', value: (q: CashProjection['quarters'][number]) => String(q.supplierPos ?? 0) },
        ]
      : []),
    { label: 'Projected Cash (quarter end)', value: (q) => money(q.closing), bold: true },
  ];
  const placed = projection.undatedOrders + projection.overdueOrders;
  const inv = projection.openInvoices;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Projected Cash by Quarter</CardTitle>
        <CardDescription>
          {/* Before Nov 6 2026: Cash Today + firm orders still to be invoiced, by expected delivery date */}
          {inv
            ? // Before Nov 7 2026: `Cash Today + QuickBooks open invoices (by due date) + firm orders still to be invoiced (by expected delivery date)${...}`
              // Before Nov 9 2026: `... + QuickBooks open sales orders (by ship / due date${projection.ordersSource === 'quickbooks' ? '' : '; not in this snapshot, sync QuickBooks'})...`
              `Cash Today + QuickBooks open invoices (by due date) + ${
                projection.ordersSource === 'erp'
                  ? // Before Nov 13 2026: 'ERP open orders for now (QuickBooks sales orders not available; by expected delivery date)'
                    `ERP open orders for now (QuickBooks sales orders not available; by expected delivery date${projection.orderPaymentDays ? ` + ${projection.orderPaymentDays} days, customers pay net ${projection.orderPaymentDays}` : ''})`
                  : `QuickBooks open sales orders (by ship / due date${projection.ordersSource === 'quickbooks' ? '' : '; not in this snapshot, sync QuickBooks'})`
              }${projection.openBills ? ' − QuickBooks open bills (by due date)' : ''}`
            : 'Cash Today + firm orders still to be invoiced, by expected delivery date (sync QuickBooks to add open invoices)'}{' '}
          · through {projection.throughDate}
          {inv && inv.overdue > 0 && ` · ${money(inv.overdue)} overdue invoices are in the current quarter`}
          {projection.openBills && projection.openBills.overdue > 0 && ` · ${money(projection.openBills.overdue)} overdue bills are in the current quarter`}
          {/* {placed > 0 && ` · ${placed} order(s) with no or a past delivery date are in the current quarter`} */}
          {/* Nov 13 2026: with payment terms they are paid that many days from today */}
          {placed > 0 &&
            (projection.orderPaymentDays
              ? ` · ${placed} order(s) with no or a past delivery date are counted as delivered today (paid in ${projection.orderPaymentDays} days)`
              : ` · ${placed} order(s) with no or a past delivery date are in the current quarter`)}
          {/* Nov 12 2026 */}
          {/* {projection.opex &&
            ` · OPEX: YTD ${money(projection.opex.ytd)} ÷ ${projection.opex.months} months = ...`} */}
          {/* Nov 13 2026: completed months (Ankur, Nov 12 email) */}
          {projection.opex &&
            ` · OPEX: ${projection.opex.period ?? 'YTD'} ${money(projection.opex.ytd)} ÷ ${projection.opex.months} ${projection.opex.months === 1 ? 'month' : 'months'} = ${money(projection.opex.monthly)} a month (${projection.opex.basis} basis), ${money(projection.opex.monthly * 3)} a full quarter; the current quarter counts only the days left`}
          {/* Nov 13 2026 (Ankur, Nov 12 email: Galileo is paid net 45 after the container is delivered) */}
          {projection.supplierPayables &&
            projection.supplierPayables.included.length > 0 &&
            ` · Supplier POs not delivered yet (no bill in QuickBooks yet): ${projection.supplierPayables.included.length} PO(s), ${money(projection.supplierPayables.total)}, paid ${projection.supplierPayables.termsDays} days after the expected delivery (no or a past date → today + ${projection.supplierPayables.termsDays})`}
          {projection.supplierPayables &&
            projection.supplierPayables.billed.length > 0 &&
            ` · ${projection.supplierPayables.billed.length} PO(s) left out: already on a QuickBooks open bill`}
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              {projection.quarters.map((q) => (
                <TableHead key={q.start} className="text-right">
                  {q.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className={row.bold ? 'font-semibold' : 'font-medium'}>{row.label}</TableCell>
                {projection.quarters.map((q) => (
                  <TableCell key={q.start} className={`text-right tabular-nums ${row.bold ? 'font-semibold' : ''}`}>
                    {row.value(q)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================
// TAB: FINANCIAL METRICS (Chapter 1)
// ============================================

export function FinancialMetricsTables() {
  return (
    <Wrapper tab="financial">
      {(m) => (
        <>
          <SpecTable
            id="1.1"
            title="Liquidity"
            description={m.liquidity.cashDate ? `Cash today as of ${m.liquidity.cashDate}` : undefined}
            columns={[
              { key: 'amount', label: 'Amount' },
              { key: 'py', label: 'PY' },
            ]}
            rows={[
              { label: 'Cash Today', format: 'money', cells: { amount: m.liquidity.cashToday, py: m.liquidity.cashPy } },
              // Hidden Nov 4 (Ankur: "Let's remove for now the low cash and high cash");
              // shown again Nov 9 (Ankur's email reply Nov 7: "Display please").
              { label: 'Low Cash', format: 'money', cells: { amount: m.liquidity.lowCash, py: { value: null } } },
              { label: 'High Cash', format: 'money', cells: { amount: m.liquidity.highCash, py: { value: null } } },
              { label: 'Projected Cash', format: 'money', cells: { amount: m.liquidity.projectedCash, py: { value: null } } },
            ]}
          />
          <ProjectedCashByQuarter projection={m.liquidity.projection} />
          <SpecTable
            id="1.2"
            title="Working Capital Position"
            columns={[
              { key: 'current', label: 'Current' },
              { key: 'timing', label: 'Weighted Timing' },
              { key: 't90Avg', label: 'T90 Avg' },
              { key: 'ytdAvg', label: 'YTD Avg' },
              { key: 'py', label: 'PY' },
            ]}
            rows={[
              { label: 'Accounts Receivable', format: 'money', formats: { timing: 'days' }, cells: m.workingCapital.ar },
              { label: 'Accounts Payable', format: 'money', formats: { timing: 'days' }, cells: m.workingCapital.ap },
              { label: 'Inventory', format: 'money', formats: { timing: 'days' }, cells: m.workingCapital.inventory },
            ]}
          />
          <TimingNote />
          <SpecTable
            id="1.3"
            title="Working Capital Efficiency"
            columns={[
              { key: 'pm', label: 'PM' },
              { key: 't90', label: 'T90' },
              { key: 'ytd', label: 'YTD' },
              { key: 'py', label: 'PY' },
            ]}
            rows={[
              { label: 'DSO', format: 'days', cells: m.efficiency.dso },
              { label: 'DPO', format: 'days', cells: m.efficiency.dpo },
              { label: 'DIO', format: 'days', cells: m.efficiency.dio },
              { label: 'CCC', format: 'days', cells: m.efficiency.ccc },
            ]}
          />
          <SpecTable
            id="1.4"
            title="Cash Generation"
            columns={C4}
            rows={[
              { label: 'Operating Cash Flow', format: 'money', cells: m.cashGeneration.ocf },
              { label: 'CapEx', format: 'cost', cells: m.cashGeneration.capex },
              { label: 'Free Cash Flow', format: 'money', cells: m.cashGeneration.fcf },
            ]}
          />
        </>
      )}
    </Wrapper>
  );
}

function TimingNote() {
  return (
    <p className="-mt-4 text-xs text-muted-foreground">
      Weighted Timing = dollar-weighted days until open QuickBooks invoices (AR) and bills (AP) are due; overdue counts as 0 days.
    </p>
  );
}

// ============================================
// TAB: PROFITABILITY (Chapters 2 and 3)
// ============================================

export function ProfitabilityTables() {
  return (
    <Wrapper tab="profitability">
      {(m) => (
        <>
          <SpecTable
            id="2.1"
            title="Profitability"
            description={`From the QuickBooks Profit and Loss (${m.quickBooks.pnlBasis} basis) at the last sync: Revenue = Total Income (incl. commission), OPEX = Total Expenses, Operating Profit = Net Operating Income, Net Income = QuickBooks Net Income.`}
            columns={C4}
            rows={[
              { label: 'Revenue', format: 'money', cells: m.profitability.revenue },
              { label: 'COGS', format: 'cost', cells: m.profitability.cogs, showPct: true },
              { label: 'Gross Profit', format: 'money', cells: m.profitability.grossProfit, showPct: true },
              { label: 'OPEX', format: 'cost', cells: m.profitability.opex, showPct: true },
              { label: 'Operating Profit', format: 'money', cells: m.profitability.operatingProfit, showPct: true },
              { label: 'Net Income', format: 'money', cells: m.profitability.netIncome, showPct: true },
            ]}
          />
          <SpecTable
            id="2.1b"
            title="Commission Revenue"
            // description={`Commission Billed = QuickBooks income accounts named "commission" (P&L, last sync). Delivered, not billed yet (ERP): ${
            description={`Commission Billed = QuickBooks income accounts named "commission" (P&L, Accrual: counted when invoiced, last sync). Delivered, not billed yet (ERP): ${
              m.commission.unbilled.value === null ? '—' : formatValue(m.commission.unbilled.value, 'money')
            } on ${m.commission.unbilledOrders} order${m.commission.unbilledOrders === 1 ? '' : 's'}.`}
            columns={C4}
            rows={[{ label: 'Commission Billed', format: 'money', cells: m.commission.billed }]}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <SpecTable
              id="2.3"
              title="OPEX Run Rate"
              // columns={[
              //   { key: 'current', label: 'Current Month Est.' },
              //   { key: 't90', label: 'T90 Avg' },
              //   { key: 'py', label: 'PY' },
              // ]}
              // Nov 12 2026 (Ankur, Nov 11 email): Previous Month / T90 Average / YTD, no PY
              // Before Nov 13 2026: "... YTD = YTD OPEX ÷ current month number. ..."
              description="QuickBooks Profit and Loss, accounts mapped to OPEX (last sync). Previous Month = last full month; T90 Average = last 90 days ÷ 3; YTD = OPEX of the completed months this year ÷ number of completed months (e.g. Jan–Oct ÷ 10). Annualized = monthly × 12."
              columns={[
                { key: 'pm', label: 'Previous Month' },
                { key: 't90', label: 'T90 Average' },
                { key: 'ytd', label: 'YTD' },
              ]}
              rows={[
                { label: 'OPEX / Month', format: 'money', cells: m.opexRunRate.monthly },
                { label: 'Annualized OPEX', format: 'money', cells: m.opexRunRate.annualized },
              ]}
            />
            <SpecTable
              id="3.1"
              title="Backlog Summary"
              // description="Firm sales orders (confirmed or processing), tires not delivered yet. Commission-only orders excluded."
              // columns={AVG}
              description="Firm sales orders (confirmed or processing), tires not delivered yet. Commission-only orders excluded. T3M / T12M = average of the daily backlog over the last 3 / 12 months."
              columns={BACKLOG_COLS}
              rows={[
                { label: 'Backlog Tires', format: 'count', cells: m.backlog.tires },
                { label: 'Backlog Revenue', format: 'money', cells: m.backlog.revenue },
                { label: 'Revenue / Tire', format: 'money2', cells: m.backlog.revenuePerTire },
                { label: 'Backlog Gross Profit', format: 'money', cells: m.backlog.grossProfit },
                { label: 'GP / Tire', format: 'money2', cells: m.backlog.gpPerTire },
                { label: 'GP %', format: 'pct', cells: m.backlog.gpPct },
              ]}
            />
          </div>
        </>
      )}
    </Wrapper>
  );
}

// ============================================
// TAB: SUPPLY CHAIN (Chapter 4)
// ============================================

const num = (n: number | null, suffix = '') => (n === null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}${suffix}`);
/** $ per tire, 2 decimals (table 4.1 average prices) */
const price = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Table 4.1 columns (Ankur, Nov 11 2026: velocity columns out, average prices in) */
const SUPPLY_COLUMNS = ['Order Cycle', 'Tires Ordered', 'Containers', 'Arrival Window', 'Weeks Left', 'Sold', 'Unsold', 'Forward Commit %', 'Average Purchase Price', 'Average Sold Price'];

export function SupplyChainTables() {
  return (
    <Wrapper tab="supply">
      {(m) => (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Table 4.1 – Incoming Supply</CardTitle>
                <CalculationMethod tableId="4.1" />
                <DrillDownButton kind="table-4.1" label="Table 4.1 – Incoming Supply" />
              </div>
              <CardDescription>
                {/* (before Nov 12 2026) ... sold = tires on sales orders of the same cycle, velocity over the last 4 weeks. */}
                {/* (before Nov 13 2026) ... sold = tires on sales orders of the same cycle, average purchase / sold price per tire from purchase and sales order lines. */}
                Per order cycle: tires ordered on purchase orders, arrival window from shipment ETAs, sold = tires of the
                cycle allocated to firm customer orders (from its purchase orders or GDC warehouse stock), average purchase /
                sold price per tire from purchase and sales order lines.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* (before Nov 12 2026) ..., 'Forward Commit %', 'Actual Weekly Velocity', 'Required Weekly Velocity', 'Velocity Gap', 'Projected Uncommitted at Arrival' */}
                    {/* Ankur, Nov 11 2026: velocity columns removed, Average Purchase / Sold Price added */}
                    {SUPPLY_COLUMNS.map((h) => (
                      <TableHead key={h} className={h === 'Order Cycle' ? '' : 'text-right'}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.supply.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={SUPPLY_COLUMNS.length} className="py-6 text-center text-muted-foreground">
                        No purchase orders with tires.
                      </TableCell>
                    </TableRow>
                  ) : (
                    m.supply.map((s) => (
                      <TableRow key={s.cycle}>
                        <TableCell className="font-medium">{s.cycle}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.tiresOrdered)}</TableCell>
                        <TableCell>
                          <CellView cell={s.containers} format="count" />
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {s.arrivalStart ? `${s.arrivalStart} – ${s.arrivalEnd}` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.weeksLeft)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.sold)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.unsold)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.forwardCommitPct, '%')}</TableCell>
                        {/* (before Nov 12 2026: velocity columns, removed per Ankur Nov 11 2026)
                        <TableCell className="text-right tabular-nums">{num(s.actualWeeklyVelocity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.requiredWeeklyVelocity)}</TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${s.velocityGap !== null && s.velocityGap < 0 ? 'text-red-600' : ''}`}
                        >
                          {s.velocityGap === null ? '—' : `${s.velocityGap > 0 ? '+' : ''}${num(s.velocityGap)}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.projectedUncommitted)}</TableCell>
                        */}
                        <TableCell className="text-right tabular-nums">{price(s.avgPurchasePrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{price(s.avgSoldPrice)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {/* (before Nov 12 2026) Weeks Left is 0 once the arrival window has started; required velocity is then not applicable. */}
              <p className="mt-2 text-xs text-muted-foreground">
                Weeks Left is 0 once the arrival window has started. Average prices are weighted by tires; lines without a
                price and commission-only loads are left out.
              </p>
            </CardContent>
          </Card>
          <SpecTable
            id="4.2"
            title="Current Inventory"
            description="Inventory at cost from QuickBooks; tire units from ERP inventory (on hand − allocated = uncommitted)."
            columns={AVG}
            rows={[
              { label: 'Inventory at Cost', format: 'money', cells: m.inventory.atCost },
              { label: 'Tires On Hand', format: 'count', cells: m.inventory.tiresOnHand },
              { label: 'Cost / Tire', format: 'money2', cells: m.inventory.costPerTire },
              { label: 'Uncommitted Inventory', format: 'count', cells: m.inventory.uncommitted },
              { label: 'Uncommitted Months of Supply', format: 'months', cells: m.inventory.monthsOfSupply },
            ]}
          />
        </>
      )}
    </Wrapper>
  );
}
