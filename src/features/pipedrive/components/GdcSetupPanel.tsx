'use client';

/**
 * GdcSetupPanel
 *
 * Admin tools for the GDC Pipedrive CRM (shown on the connected Pipedrive card):
 * - check / apply the GDC Sales pipeline, stages, custom fields and activity types
 * - import existing customers from CSV (keyed by ERP customer ID), with dry run
 * - publish customer purchase history to Pipedrive organizations
 */

import { useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Upload, Wrench, History } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import {
  runGdcPipedriveSetup,
  importCustomersCsv,
  backfillPurchaseHistory,
} from '@/features/pipedrive/gdc/actions';
import type { SetupReport } from '@/features/pipedrive/gdc/setup.service';
import type { CustomerImportRowResult } from '@/features/pipedrive/gdc/customer-sync.service';

const ACTION_LABELS: Record<string, string> = {
  existing: 'OK',
  created: 'Created',
  would_create: 'Missing',
  conflict: 'Conflict',
  warning: 'Check',
};

export function GdcSetupPanel() {
  const [setupReport, setSetupReport] = useState<SetupReport | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvName, setCsvName] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResults, setImportResults] = useState<{ dryRun: boolean; rows: CustomerImportRowResult[] } | null>(null);

  const [backfillBusy, setBackfillBusy] = useState(false);

  // ---------------- Setup ----------------
  const runSetup = async (dryRun: boolean) => {
    setSetupBusy(true);
    try {
      const result = await runGdcPipedriveSetup(dryRun);
      if (result.success && result.data) {
        setSetupReport(result.data);
        toast[result.data.ready ? 'success' : 'warning'](
          result.data.ready ? 'GDC Pipedrive setup is complete' : 'GDC Pipedrive setup needs attention'
        );
      } else {
        toast.error(result.error || 'Setup failed');
      }
    } finally {
      setSetupBusy(false);
    }
  };

  // ---------------- CSV import ----------------
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImportResults(null);
    if (!file) {return;}
    setCsvName(file.name);
    setCsvText(await file.text());
  };

  const runImport = async (dryRun: boolean) => {
    if (!csvText) {return;}
    setImportBusy(true);
    const rows: CustomerImportRowResult[] = [];
    try {
      let startRow: number | null = 0;
      // The server processes the file in batches; continue until done
      while (startRow !== null) {
        const result = await importCustomersCsv(csvText, { dryRun, startRow });
        if (!result.success || !result.data) {
          toast.error(result.error || 'Import failed');
          break;
        }
        rows.push(...result.data.results);
        startRow = result.data.nextRow;
      }
      setImportResults({ dryRun, rows });
      const failed = rows.filter((r) => r.errors.length > 0).length;
      const review = rows.filter((r) => r.warnings.length > 0).length;
      toast[failed > 0 ? 'warning' : 'success'](
        `${dryRun ? 'Dry run' : 'Import'}: ${rows.length} rows, ${failed} with errors, ${review} need review`
      );
    } finally {
      setImportBusy(false);
    }
  };

  // ---------------- Purchase history ----------------
  const runBackfill = async () => {
    setBackfillBusy(true);
    let processed = 0;
    let failed = 0;
    try {
      let cursor: string | null = null;
      do {
        const result = await backfillPurchaseHistory(cursor);
        if (!result.success || !result.data) {
          toast.error(result.error || 'Backfill failed');
          return;
        }
        processed += result.data.processed;
        failed += result.data.failed.length;
        cursor = result.data.nextCursor;
      } while (cursor);
      toast[failed > 0 ? 'warning' : 'success'](`Purchase history published for ${processed - failed} of ${processed} linked customers`);
    } finally {
      setBackfillBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Setup */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">GDC CRM setup</p>
          <p className="text-xs text-muted-foreground">
            GDC Sales pipeline (6 stages), custom fields and activity types. Existing records are reused, never renamed or deleted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => runSetup(true)} disabled={setupBusy}>
            {setupBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Check setup
          </Button>
          <Button size="sm" onClick={() => runSetup(false)} disabled={setupBusy}>
            <Wrench className="mr-2 h-4 w-4" />
            Apply setup
          </Button>
        </div>

        {setupReport && (
          <div className="space-y-3 rounded-lg border p-3 text-sm">
            <ul className="space-y-1">
              {setupReport.steps.map((step, index) => (
                <li key={`${step.entity}-${step.name}-${index}`} className="flex gap-2">
                  <span
                    className={
                      step.action === 'existing' || step.action === 'created'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }
                  >
                    {ACTION_LABELS[step.action] ?? step.action}
                  </span>
                  <span>
                    {step.name}
                    {step.detail ? ` — ${step.detail}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <Separator />
            <div>
              <p className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Manual steps in Pipedrive
              </p>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                {setupReport.manualSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* CSV import */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Import existing customers (CSV)</p>
          <p className="text-xs text-muted-foreground">
            Columns: erp_customer_id (required), account_type, rep_email, county, contact_name, contact_role,
            contact_email, contact_phone. Name and address come from the ERP. County and rep_email are not stored in
            the ERP, so they are taken from the CSV only. Safe to re-run; an existing account type is never downgraded.
          </p>
        </div>
        <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={importBusy}>
            <Upload className="mr-2 h-4 w-4" />
            {csvName || 'Choose CSV'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => runImport(true)} disabled={!csvText || importBusy}>
            {importBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Dry run
          </Button>
          <Button size="sm" onClick={() => runImport(false)} disabled={!csvText || importBusy}>
            Import
          </Button>
        </div>

        {importResults && (
          <div className="max-h-64 overflow-auto rounded-lg border p-3 text-xs">
            <p className="mb-2 font-medium">{importResults.dryRun ? 'Dry run — nothing was changed' : 'Import results'}</p>
            <ul className="space-y-1">
              {importResults.rows
                .filter((row) => row.errors.length > 0 || row.warnings.length > 0)
                .map((row) => (
                  <li key={row.rowNumber}>
                    Row {row.rowNumber} ({row.erpCustomerId}): {[...row.errors, ...row.warnings].join('; ')}
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-muted-foreground">
              Organizations: {countStatuses(importResults.rows.map((r) => r.organization?.status))}
              {' · '}People: {countStatuses(importResults.rows.map((r) => r.person?.status))}
            </p>
          </div>
        )}
      </div>

      <Separator />

      {/* Purchase history */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Purchase history</p>
          <p className="text-xs text-muted-foreground">
            Publishes tire purchase history (by order and year, 24s/38s, prices) as a pinned note on each linked
            organization. It also refreshes automatically when an order changes status.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runBackfill} disabled={backfillBusy}>
          {backfillBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
          Publish for all linked customers
        </Button>
      </div>
    </div>
  );
}

function countStatuses(statuses: Array<string | undefined>): string {
  const counts = new Map<string, number>();
  for (const status of statuses) {
    if (status) {counts.set(status, (counts.get(status) ?? 0) + 1);}
  }
  return counts.size === 0 ? 'none' : [...counts.entries()].map(([status, count]) => `${status} ${count}`).join(', ');
}
