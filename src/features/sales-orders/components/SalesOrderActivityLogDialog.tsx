'use client';

/**
 * SalesOrderActivityLogDialog
 *
 * "View Log" on a customer sales order (Nov 26 2026): the whole chain from the
 * audit log, oldest first – quote, order, allocations, stock moves, pick
 * tickets / packing lists, shipments, linked POs, shipped and invoiced.
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

import { getSalesOrderActivityLog, type SalesOrderActivityEntry } from '../actions';

interface SalesOrderActivityLogDialogProps {
  order: { id: string; orderNumber: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Which part of the chain a log row belongs to */
function areaOf(entry: SalesOrderActivityEntry): string {
  switch (entry.entityType) {
    case 'Quote':
      return 'Quote';
    case 'SalesOrder':
      return 'Sales Order';
    case 'FulfillmentAllocation':
      return 'Allocation';
    case 'Inventory':
      return 'Inventory';
    case 'PickTicket':
      return 'Pick Ticket';
    case 'PackingList':
      return 'Packing List';
    case 'Shipment':
      return 'Shipment';
    case 'PurchaseOrder':
      return 'Purchase Order';
    case 'Invoice':
      return 'Invoice';
  }
  const fromModule: Record<string, string> = {
    quotes: 'Quote',
    sales_orders: 'Sales Order',
    inventory: 'Inventory',
    pick_tickets: 'Pick Ticket',
    purchase_orders: 'Purchase Order',
    shipments: 'Shipment',
    operations_dashboard: 'Operations',
    invoices: 'Invoice',
  };
  return fromModule[entry.module] ?? entry.entityType ?? entry.module;
}

const AREA_COLORS: Record<string, string> = {
  Quote: 'bg-sky-100 text-sky-700 border-sky-200',
  'Sales Order': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Allocation: 'bg-amber-100 text-amber-700 border-amber-200',
  Inventory: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Pick Ticket': 'bg-orange-100 text-orange-700 border-orange-200',
  'Packing List': 'bg-orange-100 text-orange-700 border-orange-200',
  Shipment: 'bg-teal-100 text-teal-700 border-teal-200',
  'Purchase Order': 'bg-violet-100 text-violet-700 border-violet-200',
  Invoice: 'bg-purple-100 text-purple-700 border-purple-200',
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SalesOrderActivityLogDialog({ order, open, onOpenChange }: SalesOrderActivityLogDialogProps) {
  const [entries, setEntries] = useState<SalesOrderActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const orderId = order?.id;

  useEffect(() => {
    if (!open || !orderId) {
      return;
    }
    let cancelled = false;
    setEntries(null);
    setError(null);
    setIsLoading(true);
    getSalesOrderActivityLog(orderId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success && result.data) {
          setEntries(result.data);
        } else {
          setError(result.error || 'Could not load the activity log');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load the activity log');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  if (!order) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Activity Log – {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Everything recorded for this order, oldest first: quote, order, allocations, stock, pick tickets,
            shipping and invoicing.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {error && <p className="py-4 text-sm text-red-600">{error}</p>}

          {entries && entries.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">No activity recorded for this order yet.</p>
          )}

          {entries && entries.length > 0 && (
            <ol className="relative space-y-4 border-l pl-5">
              {entries.map((entry) => {
                const area = areaOf(entry);
                return (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatWhen(entry.createdAt)}</span>
                      <Badge variant="outline" className={AREA_COLORS[area] ?? 'bg-gray-100 text-gray-700'}>
                        {area}
                      </Badge>
                      {entry.userName && <span>by {entry.userName}</span>}
                    </div>
                    <p className="mt-1 text-sm">{entry.description || `${entry.action} ${area}`}</p>
                    {entry.changes.length > 0 && (
                      <details className="mt-1 text-xs text-muted-foreground">
                        <summary className="cursor-pointer select-none">
                          {entry.changes.length} field{entry.changes.length === 1 ? '' : 's'} changed
                        </summary>
                        <ul className="mt-1 space-y-0.5 pl-3">
                          {entry.changes.map((change) => (
                            <li key={change.field}>
                              <span className="font-medium">{change.field}</span>: {change.from} → {change.to}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
