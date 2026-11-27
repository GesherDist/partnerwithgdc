'use client';

/**
 * CMA CGM API log (Nov 27 2026)
 *
 * Eye icon next to the container number. Opens every CMA CGM Track & Trace
 * call made for the shipment (daily sync, Track now, after the container number
 * was saved) with what the system did and CMA's full reply.
 */

import { useState } from 'react';
import { Eye, ChevronDown, ChevronRight, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { CmaCgmApiLog, CmaJourneySummary } from '@/features/shipping/types';
import { getShipmentCmaApiLogs } from '../actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { CmaJourneySummaryView } from './CmaJourneySummaryView';

const SOURCE_LABELS: Record<CmaCgmApiLog['source'], string> = {
  daily_sync: 'Daily sync',
  track_now: 'Track now',
  auto: 'Container saved',
};

const OUTCOME_LABELS: Record<CmaCgmApiLog['outcome'], string> = {
  updated: 'Status updated',
  no_events: 'No movement yet',
  other_trip: 'Container reused',
  error: 'Error',
};

const OUTCOME_COLORS: Record<CmaCgmApiLog['outcome'], string> = {
  updated: 'bg-green-100 text-green-800 border-green-200',
  no_events: 'bg-gray-100 text-gray-700 border-gray-200',
  other_trip: 'bg-amber-100 text-amber-800 border-amber-200',
  error: 'bg-red-100 text-red-800 border-red-200',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Nov 27 2026: why there is no CMA call for this shipment */
function NoLogReasonBox({ reason }: { reason: { title: string; detail: string } }) {
  return (
    <div className="my-4 rounded-md border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{reason.title}</p>
      <p className="mt-1 text-muted-foreground">{reason.detail}</p>
    </div>
  );
}

interface CmaApiLogsButtonProps {
  shipmentId: string;
  containerNumber: string;
  /** Nov 27 2026: false = no call logged yet - icon shown faded, dialog explains why */
  hasLogs?: boolean;
}

export function CmaApiLogsButton({ shipmentId, containerNumber, hasLogs = true }: CmaApiLogsButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<CmaCgmApiLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Nov 27 2026: readable summary of the newest reply
  const [summary, setSummary] = useState<CmaJourneySummary | null>(null);
  const [summaryFrom, setSummaryFrom] = useState<string | null>(null);
  const [noLogReason, setNoLogReason] = useState<{ title: string; detail: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getShipmentCmaApiLogs(shipmentId);
      if (result.success) {
        setLogs(result.data);
        setSummary(result.summary);
        setSummaryFrom(result.summaryFrom);
        setNoLogReason(result.noLogReason ?? null);
        setExpanded(result.data[0]?.id ?? null); // newest call open
      } else {
        setError(result.error);
      }
    } catch {
      setError('Could not load the API log');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation(); // the table row opens the drawer on click
    setOpen(true);
    void load();
  };

  const copyJson = async (log: CmaCgmApiLog) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log.response, null, 2));
      toast.success('Response copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    // Nov 27 2026: clicks in the dialog portal (incl. the overlay used to close it)
    // bubble through React to the table row and opened the drawer - stop them here
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        // className="h-6 w-6 text-muted-foreground hover:text-primary"
        className={cn('h-6 w-6 hover:text-primary', hasLogs ? 'text-muted-foreground' : 'text-muted-foreground/40')}
        onClick={handleOpen}
        // title="View CMA CGM API responses"
        title={hasLogs ? 'View CMA CGM API responses' : 'No CMA CGM call yet - click to see why'}
        aria-label={`View CMA CGM API responses for ${containerNumber}`}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Clicks inside the dialog must not reach the table row (React portal bubbling) */}
        <DialogContent
          className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>CMA CGM API responses</DialogTitle>
            <DialogDescription>
              Container <span className="font-mono">{containerNumber}</span> · every call, newest first (kept 90 days)
            </DialogDescription>
          </DialogHeader>

          {/* Nov 27 2026: Summary tab (readable) + Raw responses tab (every call) */}
          <Tabs defaultValue="summary" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="raw">Raw responses{logs ? ` (${logs.length})` : ''}</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="flex-1 overflow-y-auto pr-1">
              {loading && (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              )}
              {!loading && error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
              {!loading && !error && summary && <CmaJourneySummaryView summary={summary} summaryFrom={summaryFrom} />}
              {!loading && !error && logs && logs.length === 0 && noLogReason && (
                <NoLogReasonBox reason={noLogReason} />
              )}
              {!loading && !error && logs && logs.length > 0 && !summary && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No CMA events yet for this container - the summary shows once CMA reports a movement.
                </p>
              )}
            </TabsContent>

            <TabsContent value="raw" className="flex-1 overflow-y-auto pr-1">
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            )}

            {!loading && error && (
              <p className="py-6 text-center text-sm text-destructive">{error}</p>
            )}

            {/* {!loading && !error && logs && logs.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No CMA CGM calls logged yet for this shipment. Calls are logged from the daily sync,
                Track now, and when a container number is saved.
              </p>
            )} */}
            {!loading && !error && logs && logs.length === 0 && (
              noLogReason ? (
                <NoLogReasonBox reason={noLogReason} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No CMA CGM calls logged yet for this shipment. Calls are logged from the daily sync,
                  Track now, and when a container number is saved.
                </p>
              )
            )}

            {!loading &&
              !error &&
              logs?.map((log) => {
                const isOpen = expanded === log.id;
                return (
                  <div key={log.id} className="rounded-md border">
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 p-3 text-left hover:bg-muted/50"
                      onClick={() => setExpanded(isOpen ? null : log.id)}
                    >
                      {isOpen ? (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{formatDateTime(log.createdAt)}</span>
                          <Badge variant="outline" className="text-xs">
                            {SOURCE_LABELS[log.source] ?? log.source}
                          </Badge>
                          <Badge variant="outline" className={cn('text-xs', OUTCOME_COLORS[log.outcome])}>
                            {OUTCOME_LABELS[log.outcome] ?? log.outcome}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            HTTP {log.httpStatus ?? '-'}
                            {log.eventCount !== null ? ` · ${log.eventCount} events` : ''}
                          </span>
                        </div>
                        {log.message && (
                          <p className="text-xs text-muted-foreground break-words">{log.message}</p>
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t bg-muted/30 p-3">
                        <div className="mb-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => copyJson(log)}
                          >
                            <Copy className="mr-1 h-3 w-3" /> Copy JSON
                          </Button>
                        </div>
                        <pre className="max-h-[45vh] overflow-auto rounded bg-background p-3 text-xs leading-relaxed">
                          {log.response === null || log.response === undefined
                            ? 'No response body'
                            : JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </span>
  );
}
