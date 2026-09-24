'use client';

/**
 * QuickBooks Online — connection panel
 *
 * Handles OAuth connection to QuickBooks Online.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 */

import { memo, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
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
import {
  IntegrationCard,
  IntegrationDetails,
  IntegrationToggle,
} from './IntegrationCard';
import type { QuickBooksConnection } from '../types';

// ============================================
// TYPES
// ============================================

interface QuickBooksStatusResponse {
  connected: boolean;
  companyName?: string;
  realmId?: string;
  environment?: 'sandbox' | 'production';
  connectedAt?: string;
  tokenExpiresAt?: string;
  status?: string;
  errorMessage?: string;
}

// ============================================
// HELPERS
// ============================================

const formatStamp = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : 'Never';

// ============================================
// COMPONENT
// ============================================

function QuickBooksCardComponent() {
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<QuickBooksConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  // Fetch connection status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/quickbooks/status');
      const data: QuickBooksStatusResponse = await response.json();

      if (data.connected && data.companyName && data.realmId) {
        setConnection({
          companyName: data.companyName,
          realmId: data.realmId,
          environment: data.environment || 'sandbox',
          connectedAt: data.connectedAt || new Date().toISOString(),
          tokenExpiresAt: data.tokenExpiresAt || new Date().toISOString(),
          lastSyncAt: null,
          pushInvoices: true,
          pullPayments: true,
        });
      } else {
        setConnection(null);
      }
    } catch (error) {
      console.error('Failed to fetch QuickBooks status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle URL query params for OAuth result
  useEffect(() => {
    const qbStatus = searchParams.get('qb');

    if (qbStatus === 'connected') {
      toast.success('QuickBooks connected successfully');
      fetchStatus();
    } else if (qbStatus === 'cancelled') {
      toast.info('QuickBooks connection cancelled');
    } else if (qbStatus === 'invalid_state') {
      toast.error('Connection failed: Invalid state. Please try again.');
    } else if (qbStatus === 'token_error') {
      toast.error('Connection failed: Could not complete authorization.');
    } else if (qbStatus === 'network_error') {
      toast.error('Connection failed: Network error. Please try again.');
    }

    // Clean up URL params
    if (qbStatus) {
      const url = new URL(window.location.href);
      url.searchParams.delete('qb');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, fetchStatus]);

  // Initial status fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleConnect = useCallback(() => {
    setConnecting(true);
    // Open OAuth in popup window
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '/api/quickbooks/auth',
      'quickbooks_oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Poll for popup closure and refresh status
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        setConnecting(false);
        fetchStatus();
      }
    }, 500);

    // Cleanup after 5 minutes max
    setTimeout(() => {
      clearInterval(pollTimer);
      setConnecting(false);
    }, 5 * 60 * 1000);
  }, [fetchStatus]);

  const handleReconnect = useCallback(() => {
    setConnecting(true);
    // Open OAuth in popup window
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '/api/quickbooks/auth',
      'quickbooks_oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Poll for popup closure and refresh status
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        setConnecting(false);
        fetchStatus();
      }
    }, 500);

    // Cleanup after 5 minutes max
    setTimeout(() => {
      clearInterval(pollTimer);
      setConnecting(false);
    }, 5 * 60 * 1000);
  }, [fetchStatus]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const response = await fetch('/api/quickbooks/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setConnection(null);
        toast.success('QuickBooks disconnected');
      } else {
        toast.error('Failed to disconnect QuickBooks');
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
      toast.error('Failed to disconnect QuickBooks');
    } finally {
      setDisconnecting(false);
      setDisconnectOpen(false);
    }
  }, []);

  const handlePushInvoicesChange = useCallback(
    (checked: boolean) => setConnection((prev) => prev ? { ...prev, pushInvoices: checked } : null),
    []
  );

  const handlePullPaymentsChange = useCallback(
    (checked: boolean) => setConnection((prev) => prev ? { ...prev, pullPayments: checked } : null),
    []
  );

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <IntegrationCard
        name="QuickBooks Online"
        description="Financial system of record. Invoices and supplier bills go out; payments and AR aging come back."
        icon={Landmark}
        iconClassName="bg-emerald-50 text-emerald-700"
        status="disconnected"
      >
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </IntegrationCard>
    );
  }

  // ============================================
  // DISCONNECTED
  // ============================================

  if (!connection) {
    return (
      <IntegrationCard
        name="QuickBooks Online"
        description="Financial system of record. Invoices and supplier bills go out; payments and AR aging come back."
        icon={Landmark}
        iconClassName="bg-emerald-50 text-emerald-700"
        status="disconnected"
        footer={
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Connect to QuickBooks
          </Button>
        }
      >
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-sm text-amber-900">
            You&apos;ll be redirected to Intuit to authorize access. Your data will sync
            automatically once connected.
          </p>
        </div>
      </IntegrationCard>
    );
  }

  // ============================================
  // CONNECTED
  // ============================================

  return (
    <>
      <IntegrationCard
        name="QuickBooks Online"
        description="Financial system of record. Invoices and supplier bills go out; payments and AR aging come back."
        icon={Landmark}
        iconClassName="bg-emerald-50 text-emerald-700"
        status="connected"
        footer={
          <>
            <Button variant="outline" onClick={handleReconnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Reconnect
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDisconnectOpen(true)}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </Button>
          </>
        }
      >
        <IntegrationDetails
          items={[
            { label: 'Company', value: connection.companyName },
            {
              label: 'Realm ID',
              value: <span className="font-mono text-xs">{connection.realmId}</span>,
            },
            {
              label: 'Environment',
              value: (
                <span className="capitalize">{connection.environment}</span>
              ),
            },
            { label: 'Connected', value: formatStamp(connection.connectedAt) },
            { label: 'Token expires', value: formatStamp(connection.tokenExpiresAt) },
            { label: 'Last sync', value: formatStamp(connection.lastSyncAt) },
          ]}
        />

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">What syncs</p>

          <IntegrationToggle
            label="Push invoices and supplier bills"
            description="Raised in Gesher, posted to QuickBooks with the QBO id stored back on the record."
            checked={connection.pushInvoices}
            onCheckedChange={handlePushInvoicesChange}
          />

          <Separator />

          <IntegrationToggle
            label="Pull payments and AR aging"
            description="Payment and AR status flow back from QuickBooks onto the sales order."
            checked={connection.pullPayments}
            onCheckedChange={handlePullPaymentsChange}
          />
        </div>
      </IntegrationCard>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect QuickBooks?</AlertDialogTitle>
            <AlertDialogDescription>
              Invoices and bills will stop posting, and payments will stop flowing back.
              Records already pushed to QuickBooks are not affected. You can reconnect at
              any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Export memoized component
export const QuickBooksCard = memo(QuickBooksCardComponent);
