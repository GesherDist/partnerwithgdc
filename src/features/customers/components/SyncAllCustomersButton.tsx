'use client';

/**
 * SyncAllCustomersButton
 *
 * Customers list: "Sync all with Pipedrive" runs the same two-way sync as the
 * customer detail button for every active customer (ERP wins when both sides
 * changed). Runs in batches with progress and ends with a summary toast.
 * The server action enforces customers.edit.
 */

import { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { syncAllCustomersWithPipedriveAction, type SyncAllBatchResult } from '@/features/pipedrive/gdc/actions';

interface SyncAllCustomersButtonProps {
  /** Called once the sync has finished (e.g. to reload the list) */
  onFinished?: () => void;
}

export function SyncAllCustomersButton({ onFinished }: SyncAllCustomersButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const isSyncing = progress !== null;

  const runSync = async () => {
    setConfirmOpen(false);
    setProgress({ done: 0, total: 0 });

    const totals: SyncAllBatchResult['totals'] = {
      updatedInErp: 0,
      updatedInPipedrive: 0,
      contactsCreatedInErp: 0,
      contactsCreatedInPipedrive: 0,
    };
    const problems: SyncAllBatchResult['problems'] = [];
    let done = 0;
    let total = 0;
    let cursor: string | null = null;

    try {
      do {
        const result = await syncAllCustomersWithPipedriveAction(cursor);
        if (!result.success || !result.data) {
          toast.error('Sync with Pipedrive stopped', {
            description: `${result.error || 'Unknown error'}${done > 0 ? ` (${done} customer(s) were synced)` : ''}`,
          });
          return;
        }
        const batch = result.data;
        if (batch.total !== null) {total = batch.total;}
        done += batch.processed;
        totals.updatedInErp += batch.totals.updatedInErp;
        totals.updatedInPipedrive += batch.totals.updatedInPipedrive;
        totals.contactsCreatedInErp += batch.totals.contactsCreatedInErp;
        totals.contactsCreatedInPipedrive += batch.totals.contactsCreatedInPipedrive;
        problems.push(...batch.problems);
        setProgress({ done, total: Math.max(total, done) });
        cursor = batch.nextCursor;
      } while (cursor);

      const summary = [
        `${done} customer(s) synced`,
        totals.updatedInErp && `${totals.updatedInErp} updated in Gesher`,
        totals.updatedInPipedrive && `${totals.updatedInPipedrive} updated in Pipedrive`,
        totals.contactsCreatedInErp && `${totals.contactsCreatedInErp} contact(s) added to Gesher`,
        totals.contactsCreatedInPipedrive && `${totals.contactsCreatedInPipedrive} contact(s) added to Pipedrive`,
      ].filter(Boolean);

      if (problems.length > 0) {
        const shown = problems.slice(0, 5).map((p) => `${p.customerCode} ${p.name}: ${p.message}`);
        if (problems.length > 5) {shown.push(`…and ${problems.length - 5} more (full list in the browser console)`);}
        problems.forEach((p) => console.warn(`[Sync all with Pipedrive] ${p.customerCode} ${p.name}: ${p.message}`));
        toast.warning(`${summary.join(' · ')} · ${problems.length} need a look`, {
          description: shown.join('\n'),
          duration: 15000,
        });
      } else {
        toast.success('Customers synced with Pipedrive', { description: summary.join(' · ') });
      }
    } finally {
      setProgress(null);
      onFinished?.();
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setConfirmOpen(true)} disabled={isSyncing}>
        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
        {isSyncing
          ? progress.total > 0
            ? `Syncing ${progress.done} / ${progress.total}…`
            : 'Syncing…'
          : 'Sync all with Pipedrive'}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sync all customers with Pipedrive?</AlertDialogTitle>
            <AlertDialogDescription>
              Every active customer and its contacts are synced both ways with Pipedrive. When a field was changed
              on both sides, the Gesher value is kept. Customers not yet in Pipedrive are added there. This can
              take a few minutes; keep this page open until it finishes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runSync}>Sync all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
