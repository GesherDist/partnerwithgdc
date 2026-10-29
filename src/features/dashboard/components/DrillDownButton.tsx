'use client';

/**
 * Drill-down next to an eye icon: the rows behind a KPI card, chart or table
 * (same data and date range as the figure). + menu to show them in a modal or
 * download them as CSV (Overview cards/charts and Executive tables alike).
 */

import { useMemo, useState } from 'react';
import { Download, Loader2, Plus, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { getOverviewDrillDownCsv } from '../actions';
import { getTableDrillDownCsv } from '../actions/executive-dashboard.actions';
import { parseCsvSections, type CsvExport, type CsvSection, type OverviewDrillDown, type TableDrillDown } from '../lib/drilldown';
import type { DateRange } from '../types';

interface DrillDownButtonProps {
  /** Overview card/chart (uses the date filter) or executive table */
  kind: OverviewDrillDown | TableDrillDown;
  dateRange?: DateRange;
  /** For the tooltip and modal title, e.g. "Revenue (YTD)" */
  label: string;
}

async function fetchCsv(kind: DrillDownButtonProps['kind'], dateRange?: DateRange): Promise<CsvExport | null> {
  const result: { success: boolean; data?: CsvExport; error?: string } = kind.startsWith('table-')
    ? await getTableDrillDownCsv(kind as TableDrillDown)
    : await getOverviewDrillDownCsv(kind as OverviewDrillDown, dateRange);
  if (!result.success || !result.data) {
    toast.error(result.error || 'Failed to load the data');
    return null;
  }
  return result.data;
}

function saveCsv(data: CsvExport) {
  // BOM so Excel opens the file as UTF-8
  const blob = new Blob(['﻿' + data.csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = data.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DrillDownButton({ kind, dateRange, label }: DrillDownButtonProps) {
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<CsvExport | null>(null);

  const run = async (then: (data: CsvExport) => void) => {
    setLoading(true);
    try {
      const data = await fetchCsv(kind, dateRange);
      if (data) {
        then(data);
      }
    } catch {
      toast.error('Failed to load the data');
    } finally {
      setLoading(false);
    }
  };

  const triggerClass = 'rounded p-0.5 text-muted-foreground transition-colors hover:text-primary disabled:opacity-50';
  const icon = (idle: React.ReactNode) => (loading ? <Loader2 className="h-4 w-4 animate-spin" /> : idle);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            disabled={loading}
            className={triggerClass}
            title={`Data behind ${label}`}
            aria-label={`Data behind ${label}`}
          >
            {icon(<Plus className="h-4 w-4" />)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => void run(setView)}>
            <Table2 className="mr-2 h-4 w-4" />
            Show in modal
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void run(saveCsv)}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DrillDownModal label={label} data={view} onClose={() => setView(null)} />
    </>
  );
}

// ---------- modal ----------

/** Money columns are shown as $; counts, days and percentages as plain numbers */
const MONEY_COLUMN = /price|revenue|amount|cost|cogs|profit|total|balance|commission|opex|cash|value|rate|invoice amt/i;
const NOT_MONEY_COLUMN = /qty|tires|units|days|%|count|date|#|source|series|sku|status|type|period/i;
const isMoney = (column: string) => MONEY_COLUMN.test(column) && !NOT_MONEY_COLUMN.test(column);
const isNumeric = (value: string) => value.trim() !== '' && !Number.isNaN(Number(value));
/** TOTAL / AVERAGE / Dashboard rows (the label may follow a period column) */
const SUMMARY_ROW = /^(TOTAL|AVERAGE|Dashboard)\b/;

function formatCell(value: string, column: string): string {
  if (!isNumeric(value)) {
    return value;
  }
  const n = Number(value);
  return isMoney(column)
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })
    : n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function SectionTable({ section }: { section: CsvSection }) {
  return (
    <div className="space-y-2">
      {section.title && <h3 className="text-sm font-semibold">{section.title}</h3>}
      <div className="max-h-[60vh] overflow-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {section.columns.map((column, i) => (
                <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-medium text-muted-foreground">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, r) => {
              const summary = row.slice(0, 2).some((c) => SUMMARY_ROW.test(c));
              return (
                <tr key={r} className={summary ? 'border-t bg-muted/50 font-semibold' : 'border-t'}>
                  {section.columns.map((column, c) => {
                    const value = row[c] ?? '';
                    const numeric = isNumeric(value);
                    return (
                      <td
                        key={c}
                        className={`whitespace-nowrap px-3 py-1.5 ${numeric ? 'text-right tabular-nums' : ''} ${numeric && Number(value) < 0 ? 'text-red-600' : ''}`}
                      >
                        {formatCell(value, column)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {section.rows.length === 0 && (
              <tr>
                <td colSpan={section.columns.length || 1} className="px-3 py-6 text-center text-muted-foreground">
                  No rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DrillDownModal({ label, data, onClose }: { label: string; data: CsvExport | null; onClose: () => void }) {
  const sections = useMemo(() => (data ? parseCsvSections(data.csv) : []), [data]);
  const rowCount = sections.reduce((s, sec) => s + sec.rows.length, 0);
  return (
    <Dialog open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-6xl flex-col p-0" onClick={(e) => e.stopPropagation()}>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{label}: data behind the figure</DialogTitle>
          <DialogDescription>
            {rowCount} rows. TOTAL / AVERAGE rows are calculated from the rows; the Dashboard row is the figure shown on the dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {sections.map((section, i) => (
            <SectionTable key={i} section={section} />
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => data && saveCsv(data)}>
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
