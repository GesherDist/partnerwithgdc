'use client';

/**
 * PipedriveAccountNotice (PD18)
 *
 * Plain-language notices on the Pipedrive card about which Pipedrive account
 * Gesher's links belong to (gdc/account-guard.service):
 * - disconnected: connecting a different account clears those links
 * - connected, right after an account change: what was cleared and the three
 *   next steps, until an admin clicks "Got it"
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  acknowledgePipedriveAccountSwitchAction,
  getPipedriveAccountStatusAction,
} from '@/features/pipedrive/gdc/actions';
import type { LinkedPipedriveAccount } from '@/features/pipedrive/gdc/account-guard.service';

const TABLE_LABELS: Record<string, string> = {
  customers: 'customers',
  customer_contacts: 'contacts',
  quotes: 'quotes',
  leads: 'leads',
  deals: 'deals',
};

const accountName = (a: { companyName: string | null; companyId: string }) => a.companyName || `account ${a.companyId}`;

export function PipedriveAccountNotice({ connected }: { connected: boolean }) {
  const [account, setAccount] = useState<LinkedPipedriveAccount | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getPipedriveAccountStatusAction()
      .then((result) => {
        if (active && result.success) {setAccount(result.data ?? null);}
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [connected]);

  if (!account) {
    return null;
  }

  if (!connected) {
    return (
      <div className="mb-3 flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Gesher is linked to the Pipedrive account <strong>{accountName(account)}</strong>. Connecting that account
          again keeps everything as it is. Connecting a <strong>different</strong> account clears Gesher&apos;s old
          Pipedrive links first; you then link the customers again with &quot;Customer mapping&quot;.
        </p>
      </div>
    );
  }

  const change = account.lastSwitch;
  if (!change || change.acknowledged) {
    return null;
  }

  const cleared = Object.entries(change.cleared)
    .filter(([table, count]) => count > 0 && TABLE_LABELS[table])
    .map(([table, count]) => `${count} ${TABLE_LABELS[table]}`)
    .join(', ');

  const dismiss = async () => {
    setSaving(true);
    try {
      const result = await acknowledgePipedriveAccountSwitchAction();
      if (result.success) {
        setAccount({ ...account, lastSwitch: { ...change, acknowledged: true } });
      } else {
        toast.error(result.error || 'Could not save');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="space-y-2">
          <p>
            The Pipedrive account changed from <strong>{accountName(change.from)}</strong> to{' '}
            <strong>{accountName(change.to)}</strong> on {new Date(change.at).toLocaleDateString()}. Gesher&apos;s old
            Pipedrive links were cleared{cleared ? ` (${cleared})` : ''} so nothing is written to the wrong records.
            Your Gesher data itself was not changed.
          </p>
          <p className="font-medium">Next steps:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Below, click <strong>Apply setup</strong> (creates the GDC pipeline, fields and products).</li>
            <li>
              Open <strong>Customer mapping</strong>, check the suggestions and click <strong>Apply mapping</strong>.
            </li>
            <li>
              On the Customers page, click <strong>Sync all with Pipedrive</strong>.
            </li>
          </ol>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={dismiss} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Got it
        </Button>
      </div>
    </div>
  );
}
