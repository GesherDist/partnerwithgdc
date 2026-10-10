'use client';

/**
 * RepMonthlyReportView
 *
 * GDC monthly rep dashboard: new leads contacted, completed follow-ups by
 * activity type, and won deal value / tire count, per sales rep.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { getRepMonthlyReportAction } from '@/features/pipedrive/gdc/actions';
import { MonthPicker } from './MonthPicker';
import type { ActivityDateBasis, RepMonthlyReport } from '@/features/pipedrive/gdc/rep-report.service';
import { GDC_FOLLOW_UP_ACTIVITY_TYPES, GDC_ACTIVITY_TYPES } from '@/features/pipedrive/gdc/config';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const TYPE_NAMES = Object.fromEntries(GDC_ACTIVITY_TYPES.map((t) => [t.key, t.name])) as Record<string, string>;

export function RepMonthlyReportView() {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<RepMonthlyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateBasis, setDateBasis] = useState<ActivityDateBasis>('completed');
  const [includeLeadsInbox, setIncludeLeadsInbox] = useState(true);
  // Expected states explained on the page instead of an error toast
  const [blocked, setBlocked] = useState<{ code: 'setup_required' | 'not_connected'; message: string } | null>(null);

  const load = useCallback(async (value: string, basis: ActivityDateBasis = 'completed', leadsInbox = true) => {
    setLoading(true);
    try {
      const result = await getRepMonthlyReportAction(value, { dateBasis: basis, includeLeadsInbox: leadsInbox });
      if (result.success && result.data) {
        setReport(result.data);
        setBlocked(null);
      } else if (result.code) {
        setReport(null);
        setBlocked({ code: result.code, message: result.error ?? '' });
      } else {
        setReport(null);
        setBlocked(null);
        toast.error(result.error || 'Failed to load the report');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
    // Load once on mount; later loads are explicit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = report?.rows.reduce(
    (sum, row) => ({
      newLeadsContacted: sum.newLeadsContacted + row.newLeadsContacted,
      followUps: sum.followUps + row.followUpsTotal,
      wonDeals: sum.wonDeals + row.wonDeals,
      wonValue: sum.wonValue + row.wonValue,
      tireCount: sum.tireCount + row.tireCount,
    }),
    { newLeadsContacted: 0, followUps: 0, wonDeals: 0, wonValue: 0, tireCount: 0 }
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Header with filters (same layout as the Deals and Dashboard pages) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rep monthly report</h1>
          <p className="text-muted-foreground">
            From Pipedrive (GDC Sales pipeline){report ? ` · ${report.timeZone} month boundaries` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} max={currentMonth()} />
          <Select value={dateBasis} onValueChange={(value) => setDateBasis(value as ActivityDateBasis)}>
            <SelectTrigger className="w-[190px]" aria-label="Count activities by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="completed">By completion date</SelectItem>
              <SelectItem value="due">By due date</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={includeLeadsInbox ? 'deals_and_leads' : 'deals_only'}
            onValueChange={(value) => setIncludeLeadsInbox(value === 'deals_and_leads')}
          >
            <SelectTrigger className="w-[190px]" aria-label="New leads contacted counts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deals_and_leads">Deals + Leads inbox</SelectItem>
              <SelectItem value="deals_only">Deals only</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => load(month, dateBasis, includeLeadsInbox)}
            disabled={loading || !month}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Run report
          </Button>
        </div>
      </div>

      {blocked && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="font-medium">
              {blocked.code === 'setup_required' ? 'GDC Pipedrive setup is needed first' : 'Pipedrive is not connected'}
            </p>
            <p className="text-sm text-muted-foreground">
              {blocked.code === 'setup_required'
                ? 'The report reads the GDC Sales pipeline, its stages and activity types, which do not exist yet in the connected Pipedrive account. An admin can review what is missing with "Check setup" (changes nothing) before applying it.'
                : 'Connect Pipedrive in Settings to run this report.'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings">Open Settings &gt; Integrations</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {report && totals && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <SummaryCard title="New leads contacted" value={String(totals.newLeadsContacted)} />
            <SummaryCard title="Follow-ups completed" value={String(totals.followUps)} />
            <SummaryCard title="Won deal value" value={currency.format(totals.wonValue)} />
            <SummaryCard title="Tires sold (won)" value={String(totals.tireCount)} />
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Rep</th>
                    <th className="px-4 py-2 font-medium">New leads contacted</th>
                    {GDC_FOLLOW_UP_ACTIVITY_TYPES.map((type) => (
                      <th key={type} className="px-4 py-2 font-medium">
                        {TYPE_NAMES[type]}
                      </th>
                    ))}
                    <th className="px-4 py-2 font-medium">Follow-ups</th>
                    <th className="px-4 py-2 font-medium">Won deals</th>
                    <th className="px-4 py-2 font-medium">Won value</th>
                    <th className="px-4 py-2 font-medium">Tires</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7 + GDC_FOLLOW_UP_ACTIVITY_TYPES.length} className="px-4 py-6 text-center text-muted-foreground">
                        No activity or won deals in this month.
                      </td>
                    </tr>
                  ) : (
                    report.rows.map((row) => (
                      <tr key={row.userId} className="border-b last:border-0">
                        <td className="px-4 py-2 font-medium">{row.name}</td>
                        <td className="px-4 py-2">{row.newLeadsContacted}</td>
                        {GDC_FOLLOW_UP_ACTIVITY_TYPES.map((type) => (
                          <td key={type} className="px-4 py-2">
                            {row.followUpsByType[type] ?? 0}
                          </td>
                        ))}
                        <td className="px-4 py-2">{row.followUpsTotal}</td>
                        <td className="px-4 py-2">{row.wonDeals}</td>
                        <td className="px-4 py-2">{currency.format(row.wonValue)}</td>
                        <td className="px-4 py-2">{row.tireCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {report.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {report.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
