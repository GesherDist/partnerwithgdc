'use client';

/**
 * QuickBooks Financials — live figures from QuickBooks (two-way sync)
 *
 * Oct 12 call: cash, AR + aging, AP + aging, inventory, operating cash flow
 * and OPEX come from QuickBooks. Shows the latest daily snapshot; "Sync now"
 * reads the QuickBooks reports again (e.g. right after reconciling).
 * Accounts are grouped using Settings > QuickBooks > Chart of Accounts.
 */

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Landmark, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useAuthStore } from '@/shared/stores';

import {
  ensureFreshQuickBooksFinancials,
  getQuickBooksFinancials,
  syncQuickBooksFinancialsNow,
  type QuickBooksFinancialsView,
} from '@/features/integrations/actions/qbo-financials.actions';

/** Fired after QuickBooks figures change so the executive tables reload */
export const QBO_FINANCIALS_UPDATED_EVENT = 'qbo-financials-updated';

let freshPending: ReturnType<typeof ensureFreshQuickBooksFinancials> | null = null;

/**
 * Daily auto-refresh shared by the card and the executive tables (whichever
 * tab opens first): one request per page; the server syncs at most once a day.
 * Fires QBO_FINANCIALS_UPDATED_EVENT when new figures were loaded.
 */
export function ensureFreshOnce(): ReturnType<typeof ensureFreshQuickBooksFinancials> {
  if (!freshPending) {
    freshPending = ensureFreshQuickBooksFinancials()
      .then((r) => {
        if (r.success && r.data) {
          window.dispatchEvent(new Event(QBO_FINANCIALS_UPDATED_EVENT));
        }
        return r;
      })
      .catch(() => ({ success: false as const, error: 'QuickBooks sync failed' }));
  }
  return freshPending;
}
import type { AgingBuckets, QboFinancials } from '@/modules/integrations/quickbooks/services/qbo-financials.service';

const money = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

const AGING_COLUMNS: Array<{ key: keyof AgingBuckets; label: string }> = [
  { key: 'current', label: 'Current' },
  { key: 'days1to30', label: '1–30' },
  { key: 'days31to60', label: '31–60' },
  { key: 'days61to90', label: '61–90' },
  { key: 'days91plus', label: '91+' },
  { key: 'total', label: 'Total' },
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function AgingTable({ f }: { f: QboFinancials }) {
  const rows: Array<{ label: string; buckets: AgingBuckets }> = [
    { label: 'Receivable (AR)', buckets: f.arAging },
    { label: 'Payable (AP)', buckets: f.apAging },
  ];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Aging (days)</TableHead>
          {AGING_COLUMNS.map((c) => (
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
            {AGING_COLUMNS.map((c) => (
              <TableCell
                key={c.key}
                className={`text-right tabular-nums ${c.key === 'total' ? 'font-semibold' : ''} ${
                  ['days61to90', 'days91plus'].includes(c.key) && row.buckets[c.key] > 0 ? 'text-red-600' : ''
                }`}
              >
                {money(row.buckets[c.key])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OpexTable({ f }: { f: QboFinancials }) {
  const months = f.opex.months;
  const groups = [...new Set(months.flatMap((m) => m.groups.map((g) => g.group)))];
  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">No operating expenses in QuickBooks for these months.</p>;
  }
  const amount = (monthIndex: number, group: string) =>
    months[monthIndex]?.groups.find((g) => g.group === group)?.amount ?? 0;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>OPEX group</TableHead>
          {months.map((m) => (
            <TableHead key={m.label} className="text-right">
              {m.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group}>
            <TableCell>{group}</TableCell>
            {months.map((m, i) => (
              <TableCell key={m.label} className="text-right tabular-nums">
                {money(amount(i, group))}
              </TableCell>
            ))}
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="font-semibold">Total OPEX</TableCell>
          {months.map((m) => (
            <TableCell key={m.label} className="text-right font-semibold tabular-nums">
              {money(m.total)}
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function QuickBooksFinancials() {
  const { hasPermission } = useAuthStore();
  const canSync = hasPermission('settings.edit') || hasPermission('integrations.manage');

  const [view, setView] = useState<QuickBooksFinancialsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await getQuickBooksFinancials();
      if (result.success) {
        setView(result.data);
        if (result.data.connected) {
          // No figures from today yet: refresh from QuickBooks automatically
          // (the server does it at most once per day)
          setAutoSyncing(true);
          const fresh = await ensureFreshOnce();
          if (fresh.success && fresh.data) {
            setView((v) => (v ? { ...v, financials: fresh.data!.financials ?? v.financials } : v));
            setUnsaved(!fresh.data.stored);
          }
          setAutoSyncing(false);
        }
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to load QuickBooks figures');
      setAutoSyncing(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncQuickBooksFinancialsNow();
      if (result.success) {
        setView((v) => ({
          connected: true,
          environment: result.data.financials.environment,
          financials: result.data.financials,
          storageAvailable: v?.storageAvailable ?? true,
        }));
        setUnsaved(!result.data.stored);
        window.dispatchEvent(new Event(QBO_FINANCIALS_UPDATED_EVENT));
        toast.success('QuickBooks figures updated');
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('QuickBooks sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const f = view?.financials ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-emerald-700" />
              <CardTitle className="text-lg">QuickBooks Financials</CardTitle>
              {view?.environment === 'sandbox' && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                  Sandbox
                </Badge>
              )}
            </div>
            <CardDescription>
              Cash, AR/AP with aging, inventory, operating cash flow and OPEX from QuickBooks
              {f ? ` · as of ${f.asOf}, synced ${format(new Date(f.fetchedAt), 'MMM d, h:mm a')}` : ''}
            </CardDescription>
          </div>
          {autoSyncing && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Updating from QuickBooks...
            </span>
          )}
          {view?.connected && canSync && (
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || autoSyncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {syncing ? 'Syncing...' : 'Sync now'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : !view?.connected ? (
          <p className="text-sm text-muted-foreground">Connect QuickBooks in Settings to see these figures.</p>
        ) : !f ? (
          <p className="text-sm text-muted-foreground">
            {autoSyncing ? 'Loading figures from QuickBooks...' : `No QuickBooks figures yet. ${canSync ? 'Use "Sync now".' : 'They appear after the daily sync.'}`}
          </p>
        ) : (
          <>
            {(unsaved || !view.storageAvailable) && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Showing fresh QuickBooks figures, but they are not stored: database migration 162 is required.
              </div>
            )}
            {f.unmappedAccounts.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {f.unmappedAccounts.length} QuickBooks account(s) are not in the chart of accounts yet and were left
                out: {f.unmappedAccounts.slice(0, 5).join(', ')}
                {f.unmappedAccounts.length > 5 ? ', ...' : ''}. Sync the accounts in Settings &gt; QuickBooks.
              </div>
            )}

            {/* Items 1, 2, 4, 6, 7 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Cash today" value={money(f.cash)} />
              <Kpi label="Accounts Receivable" value={money(f.accountsReceivable)} />
              <Kpi label="Accounts Payable" value={money(f.accountsPayable)} />
              <Kpi label="Inventory (at cost)" value={money(f.inventory)} />
              <Kpi
                label="Operating cash flow (MTD)"
                value={money(f.operatingCashFlow.monthToDate)}
                hint={`${f.operatingCashFlow.lastMonthLabel}: ${money(f.operatingCashFlow.lastMonth)}`}
              />
            </div>

            {/* Items 3, 5 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">AR / AP aging</p>
              <AgingTable f={f} />
              {f.topReceivables.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Largest receivables:{' '}
                  {f.topReceivables
                    .slice(0, 5)
                    .map((p) => `${p.name} ${money(p.total)}${p.overdue > 0 ? ` (${money(p.overdue)} overdue)` : ''}`)
                    .join(' · ')}
                </p>
              )}
            </div>

            {/* Item 8 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">OPEX by month (groups from the chart of accounts)</p>
              <OpexTable f={f} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
