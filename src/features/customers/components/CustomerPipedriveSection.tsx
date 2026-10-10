'use client';

/**
 * CustomerPipedriveSection
 *
 * Pipedrive block for the customer detail page:
 * - link status (organization / person / deal IDs)
 * - "Sync to Pipedrive": create or link the customer's Pipedrive organization
 *   (and its contacts) using the GDC matching rules
 * - "Publish purchase history": pinned tire purchase-history note on the org
 * - "Sync LTV to Pipedrive": existing lifetime-value push
 *
 * Server actions enforce permissions (customers.edit for sync/publish).
 */

import { useTransition } from 'react';
import { Link2, Loader2, RefreshCw, Unlink, History } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { pushCustomerLTVToPipedrive } from '@/features/pipedrive/actions';
import { syncCustomerToPipedriveAction, publishPurchaseHistoryAction } from '@/features/pipedrive/gdc/actions';
import { getCustomer } from '../actions';
import type { Customer } from '../types';

interface CustomerPipedriveSectionProps {
  customer: Customer;
  /** Show the write actions (customers.edit) */
  canEdit: boolean;
  /** Called with the reloaded customer after a successful sync */
  onCustomerUpdated: (customer: Customer) => void;
}

const HISTORY_MESSAGES: Record<string, string> = {
  created: 'Purchase history added to the Pipedrive organization',
  updated: 'Purchase history updated in Pipedrive',
  unchanged: 'Purchase history is already up to date',
  not_linked: 'Sync the customer to Pipedrive first',
  not_connected: 'Pipedrive is not connected',
};

export function CustomerPipedriveSection({ customer, canEdit, onCustomerUpdated }: CustomerPipedriveSectionProps) {
  const [isSyncing, startSync] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const [isPushingLTV, startPushLTV] = useTransition();

  const isLinked = Boolean(customer.pipedriveOrgId || customer.pipedrivePersonId || customer.pipedriveDealId);
  const linkedIds = [
    customer.pipedriveOrgId && `Org ID: ${customer.pipedriveOrgId}`,
    customer.pipedrivePersonId && `Person ID: ${customer.pipedrivePersonId}`,
    customer.pipedriveDealId && `Deal ID: ${customer.pipedriveDealId}`,
  ].filter(Boolean);

  const handleSync = () => {
    startSync(async () => {
      const result = await syncCustomerToPipedriveAction(customer.id);
      if (!result.success || !result.data) {
        toast.error('Failed to sync to Pipedrive', { description: result.error || 'Unknown error' });
        return;
      }
      const { organization, people, warnings } = result.data;
      const review = [organization, ...people.map((p) => p.result)].filter((r) => r.status === 'needs_review');
      if (review.length > 0) {
        toast.warning('Pipedrive needs review', {
          description: review.map((r) => r.reason).filter(Boolean).join('; '),
        });
      } else {
        const orgText: Record<string, string> = {
          created: 'created in Pipedrive',
          matched: 'found in Pipedrive and linked',
          linked: 'already linked',
        };
        const contactsText =
          people.length === 0 ? 'no contacts in Gesher to sync' : `${people.length} contact(s) synced as Pipedrive people`;
        toast.success(`Organization (ID ${organization.id}) ${orgText[organization.status] ?? organization.status}`, {
          description: [contactsText, ...warnings].join('. '),
        });
      }
      // Show the new link without a full page reload
      const reloaded = await getCustomer(customer.id);
      if (reloaded.success && reloaded.data) {
        onCustomerUpdated(reloaded.data);
      }
    });
  };

  const handlePublish = () => {
    startPublish(async () => {
      const result = await publishPurchaseHistoryAction(customer.id);
      if (result.success && result.data) {
        toast.info(HISTORY_MESSAGES[result.data.status] ?? result.data.status);
      } else {
        toast.error('Failed to publish purchase history', { description: result.error || 'Unknown error' });
      }
    });
  };

  const handlePushLTV = () => {
    startPushLTV(async () => {
      const result = await pushCustomerLTVToPipedrive(customer.id);
      if (result.success && result.data) {
        toast.success('LTV synced to Pipedrive', {
          description: `Revenue: $${result.data.ltv.totalRevenue.toLocaleString()} | Orders: ${result.data.ltv.orderCount}`,
        });
      } else {
        toast.error('Failed to sync LTV', { description: result.error || 'Unknown error' });
      }
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        Pipedrive CRM
      </h3>

      <div className="flex items-start gap-3">
        {isLinked ? (
          <Link2 className="mt-0.5 h-4 w-4 text-emerald-600" />
        ) : (
          <Unlink className="mt-0.5 h-4 w-4 text-muted-foreground" />
        )}
        <div>
          <p className={isLinked ? 'text-sm font-medium text-emerald-700' : 'text-sm font-medium text-muted-foreground'}>
            {isLinked ? 'Linked to Pipedrive' : 'Not linked to Pipedrive'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isLinked ? linkedIds.join(' · ') : 'Sync to Pipedrive to create or link its organization and contacts.'}
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Sync to Pipedrive
          </Button>
          {customer.pipedriveOrgId && (
            <Button variant="outline" size="sm" onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <History className="mr-2 h-4 w-4" />}
              Publish purchase history
            </Button>
          )}
          {isLinked && (
            <Button variant="outline" size="sm" onClick={handlePushLTV} disabled={isPushingLTV}>
              {isPushingLTV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync LTV to Pipedrive
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
