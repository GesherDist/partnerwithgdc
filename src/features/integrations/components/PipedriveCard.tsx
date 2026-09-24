'use client';

/**
 * Pipedrive — OAuth connection panel
 *
 * Uses OAuth 2.0 flow for authentication:
 * - Connect: Redirects to /api/pipedrive/auth to initiate OAuth
 * - Status: Fetches from /api/pipedrive/status
 * - Disconnect: Calls /api/pipedrive/disconnect
 *
 * No API token or domain input needed - OAuth handles everything.
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { Handshake, Loader2, RefreshCw, Unplug, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
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

// ============================================
// TYPES
// ============================================

interface PipedriveStatus {
  connected: boolean;
  accountId?: string;
  accountName?: string;
  companyDomain?: string;
  connectedAs?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
  expiresAt?: string;
  error?: string;
}

interface PipedriveSettings {
  pipelineId: string;
  pushQuotes: boolean;
  pullWonDeals: boolean;
}

// ============================================
// CONSTANTS
// ============================================

/** Placeholder — replace once the client confirms their pipeline structure. */
const PIPELINE_OPTIONS = [
  { id: 'sales', label: 'Sales Pipeline' },
  { id: 'oem', label: 'OEM Pipeline' },
  { id: 'dealer', label: 'Dealer Pipeline' },
] as const;

const DEFAULT_PIPELINE_ID = PIPELINE_OPTIONS[0].id;

const formatStamp = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : 'Never';

// ============================================
// COMPONENT
// ============================================

function PipedriveCardComponent() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<PipedriveStatus | null>(null);
  const [settings, setSettings] = useState<PipedriveSettings>({
    pipelineId: DEFAULT_PIPELINE_ID,
    pushQuotes: true,
    pullWonDeals: true,
  });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  // Fetch connection status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle OAuth callback result from URL params
  useEffect(() => {
    const pipedriveParam = searchParams.get('pipedrive');
    if (pipedriveParam) {
      switch (pipedriveParam) {
        case 'connected':
          toast.success('Pipedrive connected successfully!');
          fetchStatus();
          break;
        case 'cancelled':
          toast.info('Pipedrive connection cancelled');
          break;
        case 'invalid_state':
          toast.error('Connection failed: Invalid state. Please try again.');
          break;
        case 'token_error':
          toast.error('Connection failed: Could not get access token.');
          break;
        case 'network_error':
          toast.error('Connection failed: Network error. Please try again.');
          break;
      }
      // Clear the URL param
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pipedrive/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch Pipedrive status:', error);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = useCallback(() => {
    setConnecting(true);
    // Open OAuth in popup window (like QuickBooks)
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      '/api/pipedrive/auth',
      'pipedrive_oauth',
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
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/pipedrive/status');
      const data = await response.json();
      if (data.connected) {
        toast.success('Connection healthy');
        setStatus(data);
      } else {
        toast.error('Connection lost. Please reconnect.');
        setStatus(data);
      }
    } catch (error) {
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      const response = await fetch('/api/pipedrive/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setStatus({ connected: false });
        toast.success('Pipedrive disconnected');
      } else {
        toast.error('Failed to disconnect');
      }
    } catch (error) {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
      setDisconnectOpen(false);
    }
  }, []);

  const handlePipelineChange = useCallback((value: string) => {
    setSettings((prev) => ({ ...prev, pipelineId: value }));
  }, []);

  const handlePushQuotesChange = useCallback((checked: boolean) => {
    setSettings((prev) => ({ ...prev, pushQuotes: checked }));
  }, []);

  const handlePullWonDealsChange = useCallback((checked: boolean) => {
    setSettings((prev) => ({ ...prev, pullWonDeals: checked }));
  }, []);

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <IntegrationCard
        name="Pipedrive"
        description="Two-way CRM sync. A sent quote creates or updates a deal; a won deal reflects back onto the quote."
        icon={Handshake}
        iconClassName="bg-sky-50 text-sky-700"
        status="disconnected"
      >
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </IntegrationCard>
    );
  }

  // ============================================
  // DISCONNECTED STATE
  // ============================================

  if (!status?.connected) {
    return (
      <IntegrationCard
        name="Pipedrive"
        description="Two-way CRM sync. A sent quote creates or updates a deal; a won deal reflects back onto the quote."
        icon={Handshake}
        iconClassName="bg-sky-50 text-sky-700"
        status="disconnected"
        footer={
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Connect with Pipedrive
          </Button>
        }
      >
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">
            Click the button below to connect your Pipedrive account using secure OAuth authentication.
            You&apos;ll be redirected to Pipedrive to authorize access.
          </p>
        </div>
      </IntegrationCard>
    );
  }

  // ============================================
  // CONNECTED STATE
  // ============================================

  return (
    <>
      <IntegrationCard
        name="Pipedrive"
        description="Two-way CRM sync. A sent quote creates or updates a deal; a won deal reflects back onto the quote."
        icon={Handshake}
        iconClassName="bg-sky-50 text-sky-700"
        status="connected"
        footer={
          <>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Test connection
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
            { label: 'Account', value: status.accountName || status.companyDomain || 'Unknown' },
            { label: 'Connected as', value: status.connectedAs || 'Unknown' },
            { label: 'Connected', value: formatStamp(status.connectedAt) },
            { label: 'Last sync', value: formatStamp(status.lastSyncAt) },
          ]}
        />

        <Separator />

        <div className="max-w-xs space-y-2">
          <label htmlFor="pipedrive-pipeline" className="text-sm font-medium">
            Target pipeline
          </label>
          <Select
            value={settings.pipelineId}
            onValueChange={handlePipelineChange}
          >
            <SelectTrigger id="pipedrive-pipeline">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Where deals created from quotes land.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">What syncs</p>

          <IntegrationToggle
            label="Quote sent creates or updates a deal"
            description="Sending a quote pushes it to Pipedrive as a deal on the pipeline above."
            checked={settings.pushQuotes}
            onCheckedChange={handlePushQuotesChange}
          />

          <Separator />

          <IntegrationToggle
            label="Deal won updates the quote"
            description="Marking a deal won in Pipedrive reflects onto the linked quote and sales order."
            checked={settings.pullWonDeals}
            onCheckedChange={handlePullWonDealsChange}
          />
        </div>
      </IntegrationCard>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Pipedrive?</AlertDialogTitle>
            <AlertDialogDescription>
              Quotes will stop creating deals and won deals will stop updating quotes.
              You&apos;ll need to reconnect via OAuth to restore sync. Deals already
              in Pipedrive are not affected.
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
export const PipedriveCard = memo(PipedriveCardComponent);
