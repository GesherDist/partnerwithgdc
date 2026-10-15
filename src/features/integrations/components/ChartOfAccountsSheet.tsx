'use client';

/**
 * Chart of Accounts — map QuickBooks accounts to dashboard categories
 *
 * Oct 12 call: "map out the chart of accounts" so cash, AR/AP, inventory and
 * OPEX on the management dashboard come from QuickBooks. Each account shows
 * the suggested category (from its QuickBooks type); changes are saved per
 * account. OPEX accounts are grouped by their parent account by default.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { useAuthStore } from '@/shared/stores';
import { cn } from '@/shared/lib/utils';

import {
  getChartOfAccounts,
  syncChartOfAccounts,
  updateAccountMapping,
  type ChartOfAccountsView,
  type MappedAccount,
} from '../actions/chart-of-accounts.actions';
import {
  DASHBOARD_CATEGORIES,
  DASHBOARD_CATEGORY_LABELS,
  type DashboardCategory,
} from '../lib/account-mapping';

interface ChartOfAccountsSheetProps {
  open: boolean;
  onClose: () => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const SUMMARY: DashboardCategory[] = ['cash', 'accounts_receivable', 'accounts_payable', 'inventory'];

export function ChartOfAccountsSheet({ open, onClose }: ChartOfAccountsSheetProps) {
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('settings.edit');

  const [view, setView] = useState<ChartOfAccountsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DashboardCategory | 'all'>('all');
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getChartOfAccounts();
      if (result.success) {
        setView(result.data);
        setGroupDrafts({});
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to load the chart of accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncChartOfAccounts();
      if (result.success) {
        toast.success(`Synced ${result.data.synced} accounts from QuickBooks`);
        await load();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const save = async (account: MappedAccount, category: DashboardCategory, opexGroup: string | null) => {
    setSavingId(account.qboAccountId);
    try {
      const result = await updateAccountMapping({ qboAccountId: account.qboAccountId, category, opexGroup });
      if (result.success) {
        // Totals change with the category, so reload the whole view
        await load();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  const accounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (view?.accounts ?? []).filter(
      (a) =>
        (filter === 'all' || a.category === filter) &&
        (!term || a.fullName.toLowerCase().includes(term) || a.accountType.toLowerCase().includes(term))
    );
  }, [view, search, filter]);

  const opexGroups = useMemo(
    () => new Set((view?.accounts ?? []).filter((a) => a.category === 'opex').map((a) => a.opexGroup)).size,
    [view]
  );

  const editable = canEdit && Boolean(view?.mappingAvailable);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-5xl overflow-y-auto">
        <SheetHeader className="space-y-1 pb-4">
          <SheetTitle>Chart of Accounts</SheetTitle>
          <SheetDescription>
            Map each QuickBooks account to the dashboard figure it feeds: cash, AR, AP, inventory,
            revenue, COGS or an OPEX group. Suggestions come from the QuickBooks account type; change
            only what differs.
          </SheetDescription>
        </SheetHeader>

        {loading && !view ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts...
          </div>
        ) : !view?.connected ? (
          <p className="py-12 text-center text-muted-foreground">Connect QuickBooks to see its chart of accounts.</p>
        ) : (
          <div className="space-y-4">
            {view.environment === 'sandbox' && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                These are QuickBooks <b>sandbox</b> (test) accounts. Once the company&apos;s real QuickBooks is
                connected, sync and map its accounts.
              </div>
            )}
            {!view.mappingAvailable && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Showing suggested categories only. Database migration 161 is required to save changes.
              </div>
            )}

            {/* Summary: QuickBooks balances per category (as of the last account sync) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {SUMMARY.map((category) => (
                <div key={category} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{DASHBOARD_CATEGORY_LABELS[category]}</p>
                  <p className="text-lg font-semibold">{money(view.totals[category])}</p>
                </div>
              ))}
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">OPEX groups</p>
                <p className="text-lg font-semibold">{opexGroups}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Balances as of the last account sync
              {view.lastSyncedAt ? ` (${format(new Date(view.lastSyncedAt), 'MMM d, yyyy h:mm a')})` : ''}. The
              dashboard will read live figures from QuickBooks reports.
            </p>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Search accounts"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={(value) => setFilter(value as DashboardCategory | 'all')}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {DASHBOARD_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {DASHBOARD_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canEdit && (
                <Button variant="outline" onClick={handleSync} disabled={syncing}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', syncing && 'animate-spin')} />
                  {syncing ? 'Syncing...' : 'Sync accounts'}
                </Button>
              )}
            </div>

            {/* Accounts */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-[200px]">Dashboard category</TableHead>
                    <TableHead className="w-[230px]">OPEX group</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        No accounts{search || filter !== 'all' ? ' match the filter' : '. Use "Sync accounts".'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    accounts.map((account) => {
                      const saving = savingId === account.qboAccountId;
                      const draft = groupDrafts[account.qboAccountId];
                      return (
                        <TableRow key={account.qboAccountId}>
                          <TableCell>
                            <p className="font-medium">{account.fullName}</p>
                            <p className="text-xs text-muted-foreground">
                              {account.accountType}
                              {account.accountSubType ? ` · ${account.accountSubType}` : ''}
                              {account.isCustom && (
                                <Badge variant="outline" className="ml-2 text-[10px]">
                                  Custom
                                </Badge>
                              )}
                            </p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {account.balance === null ? '—' : money(account.balance)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Select
                                value={account.category}
                                disabled={!editable || saving}
                                onValueChange={(value) =>
                                  save(account, value as DashboardCategory, value === 'opex' ? account.suggestedOpexGroup : null)
                                }
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DASHBOARD_CATEGORIES.map((c) => (
                                    <SelectItem key={c} value={c}>
                                      {DASHBOARD_CATEGORY_LABELS[c]}
                                      {c === account.suggestedCategory ? ' (suggested)' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            </div>
                          </TableCell>
                          <TableCell>
                            {account.category === 'opex' ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  className="h-8"
                                  value={draft ?? account.opexGroup ?? ''}
                                  disabled={!editable || saving}
                                  onChange={(e) =>
                                    setGroupDrafts((d) => ({ ...d, [account.qboAccountId]: e.target.value }))
                                  }
                                  onBlur={() => {
                                    if (draft !== undefined && draft.trim() !== (account.opexGroup ?? '')) {
                                      save(account, 'opex', draft.trim() || account.suggestedOpexGroup);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                                {editable && account.isCustom && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Reset to suggestion"
                                    disabled={saving}
                                    onClick={() => save(account, account.suggestedCategory, account.suggestedOpexGroup)}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ) : editable && account.isCustom ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={saving}
                                onClick={() => save(account, account.suggestedCategory, account.suggestedOpexGroup)}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" /> Reset
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
