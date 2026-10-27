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
import type { Cell, ExecutiveDashboardModel } from '../../lib/executive-model';
import { CALCULATIONS, type CalcStatus } from './calculations';
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

let pending: Promise<ExecutiveDashboardModel | string> | null = null;

function loadOnce(): Promise<ExecutiveDashboardModel | string> {
  if (!pending) {
    pending = getExecutiveDashboard()
      .then((r) => (r.success ? r.data : r.error))
      .catch(() => 'Failed to load the executive dashboard');
    // Fresh data on the next visit
    setTimeout(() => {
      pending = null;
    }, 60_000);
  }
  return pending;
}

function useExecutiveDashboard() {
  const [state, setState] = useState<ExecutiveDashboardModel | string | null>(null);
  useEffect(() => {
    let active = true;
    loadOnce().then((r) => {
      if (!active) {
        return;
      }
      setState(r);
      // QuickBooks figures not from today yet: trigger the daily refresh
      // (the update event below reloads the tables when it finishes)
      if (typeof r !== 'string' && r.quickBooks.connected && (!r.quickBooks.hasPeriods || (r.quickBooks.asOf ?? '') < r.asOf)) {
        void ensureFreshOnce();
      }
    });
    // QuickBooks figures were refreshed (automatic or "Sync now"): reload
    const onUpdated = () => {
      pending = null;
      loadOnce().then((r) => active && setState(r));
    };
    window.addEventListener(QBO_FINANCIALS_UPDATED_EVENT, onUpdated);
    return () => {
      active = false;
      window.removeEventListener(QBO_FINANCIALS_UPDATED_EVENT, onUpdated);
    };
  }, []);
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

function Status({ model }: { model: ExecutiveDashboardModel }) {
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

function Wrapper({ children }: { children: (model: ExecutiveDashboardModel) => React.ReactNode }) {
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
  return (
    <div className="grid gap-6">
      <Status model={state} />
      {children(state)}
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

// ============================================
// TAB: FINANCIAL METRICS (Chapter 1)
// ============================================

export function FinancialMetricsTables() {
  return (
    <Wrapper>
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
              { label: 'Low Cash', format: 'money', cells: { amount: m.liquidity.lowCash, py: { value: null } } },
              { label: 'High Cash', format: 'money', cells: { amount: m.liquidity.highCash, py: { value: null } } },
              { label: 'Projected Cash', format: 'money', cells: { amount: m.liquidity.projectedCash, py: { value: null } } },
            ]}
          />
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
    <Wrapper>
      {(m) => (
        <>
          <SpecTable
            id="2.1"
            title="Profitability"
            description="Revenue = tire sales on orders delivered in the period, net of discounts and credit notes (excl. tax). OPEX from QuickBooks (chart of accounts)."
            columns={C4}
            rows={[
              { label: 'Revenue', format: 'money', cells: m.profitability.revenue },
              { label: 'COGS', format: 'cost', cells: m.profitability.cogs, showPct: true },
              { label: 'Gross Profit', format: 'money', cells: m.profitability.grossProfit, showPct: true },
              { label: 'OPEX', format: 'cost', cells: m.profitability.opex, showPct: true },
              { label: 'Operating Profit', format: 'money', cells: m.profitability.operatingProfit, showPct: true },
            ]}
          />
          <SpecTable
            id="2.1b"
            title="Commission Revenue"
            description={`Commission from Galileo on commission-only orders, kept separate from tire revenue and gross profit. Not billed yet: ${
              m.commission.unbilled.value === null ? '—' : formatValue(m.commission.unbilled.value, 'money')
            } on ${m.commission.unbilledOrders} order${m.commission.unbilledOrders === 1 ? '' : 's'}.`}
            columns={C4}
            rows={[{ label: 'Commission Billed', format: 'money', cells: m.commission.billed }]}
          />
          <SpecTable
            id="2.2"
            title="Per Tire Economics"
            columns={C4}
            rows={[
              { label: 'Tires Sold', format: 'count', cells: m.perTire.tiresSold },
              { label: 'Revenue / Tire', format: 'money2', cells: m.perTire.revenue },
              { label: 'COGS / Tire', format: 'cost', cells: m.perTire.cogs },
              { label: 'GP / Tire', format: 'money2', cells: m.perTire.grossProfit },
              { label: 'OPEX / Tire', format: 'cost', cells: m.perTire.opex },
              { label: 'OP / Tire', format: 'money2', cells: m.perTire.operatingProfit },
            ]}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <SpecTable
              id="2.3"
              title="OPEX Run Rate"
              columns={[
                { key: 'current', label: 'Current Month Est.' },
                { key: 't90', label: 'T90 Avg' },
                { key: 'py', label: 'PY' },
              ]}
              rows={[
                { label: 'OPEX / Month', format: 'money', cells: m.opexRunRate.monthly },
                { label: 'Annualized OPEX', format: 'money', cells: m.opexRunRate.annualized },
              ]}
            />
            <SpecTable
              id="3.1"
              title="Backlog Summary"
              description="Firm sales orders (confirmed or processing), tires not delivered yet. Commission-only orders excluded."
              columns={AVG}
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

export function SupplyChainTables() {
  return (
    <Wrapper>
      {(m) => (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Table 4.1 – Incoming Supply</CardTitle>
                <CalculationMethod tableId="4.1" />
              </div>
              <CardDescription>
                Per order cycle: tires ordered on purchase orders, arrival window from shipment ETAs, sold = tires on sales
                orders of the same cycle, velocity over the last 4 weeks.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {['Order Cycle', 'Tires Ordered', 'Containers', 'Arrival Window', 'Weeks Left', 'Sold', 'Unsold', 'Forward Commit %', 'Actual Weekly Velocity', 'Required Weekly Velocity', 'Velocity Gap', 'Projected Uncommitted at Arrival'].map((h) => (
                      <TableHead key={h} className={h === 'Order Cycle' ? '' : 'text-right'}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.supply.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="py-6 text-center text-muted-foreground">
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
                        <TableCell className="text-right tabular-nums">{num(s.actualWeeklyVelocity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.requiredWeeklyVelocity)}</TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${s.velocityGap !== null && s.velocityGap < 0 ? 'text-red-600' : ''}`}
                        >
                          {s.velocityGap === null ? '—' : `${s.velocityGap > 0 ? '+' : ''}${num(s.velocityGap)}`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num(s.projectedUncommitted)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">
                Weeks Left is 0 once the arrival window has started; required velocity is then not applicable.
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
