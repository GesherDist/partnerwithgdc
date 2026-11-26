'use client';

/**
 * MarkShippedDialog
 *
 * Manual "Mark as Shipped" on a customer sales order (Ankur, Nov 24 2026
 * call). Outgoing loads go with whatever carrier the broker picks, so there is
 * no carrier integration. The user picks the ship date; the dialog first shows
 * which tires will leave which warehouse / dealer location, then the reserved
 * stock goes down (on hand and allocated) and the order becomes Shipped.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Truck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

import { getManualShipPlan, markSalesOrderShipped } from '../actions';
import type { ManualShipPlan } from '../services/fulfillment-orchestration.service';

interface MarkShippedDialogProps {
  order: { id: string; orderNumber: string } | null;
  /** Order already shipped / delivered / invoiced: only take its reserved tires out of stock */
  stockOnly?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function MarkShippedDialog({ order, stockOnly = false, open, onOpenChange, onDone }: MarkShippedDialogProps) {
  const [shippedAt, setShippedAt] = useState(today());
  const [plan, setPlan] = useState<ManualShipPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const orderId = order?.id;

  useEffect(() => {
    if (!open || !orderId) {
      return;
    }
    let cancelled = false;
    setShippedAt(today());
    setPlan(null);
    setPlanError(null);
    setIsLoadingPlan(true);
    getManualShipPlan(orderId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success && result.data) {
          setPlan(result.data);
        } else {
          setPlanError(result.error || 'Could not check the order');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlanError('Could not check the order');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPlan(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  if (!order) {
    return null;
  }

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(shippedAt) && shippedAt <= today();
  const nothingToTakeOut = !!plan && !plan.lines.some((line) => !line.alreadyShippedBy);
  const blocked = !plan || plan.blockers.length > 0 || !!planError || (stockOnly && nothingToTakeOut);
  // const actionLabel = stockOnly ? 'Take Out of Stock' : 'Mark as Shipped';
  // Nov 25 2026: one name for both (user); the description explains the difference
  const actionLabel = 'Mark as Shipped';

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const result = await markSalesOrderShipped(order.id, { shippedAt });
      if (result.success) {
        const units = result.data?.shippedUnits ?? 0;
        toast.success(
          stockOnly
            ? `${order.orderNumber}: ${units} tires taken out of stock`
            : units > 0
              ? `${order.orderNumber} marked as shipped. ${units} tires taken out of stock.`
              : `${order.orderNumber} marked as shipped`
        );
        if (result.warning) {
          toast.warning(result.warning);
        }
        onOpenChange(false);
        onDone();
      } else {
        toast.error(result.error || 'Could not mark the order shipped');
      }
    } catch {
      toast.error('Could not mark the order shipped');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSaving && onOpenChange(value)}>
      <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {actionLabel} – {order.orderNumber}
          </DialogTitle>
          <DialogDescription>
            {stockOnly
              ? 'This order already has a later status, but its tires are still reserved in warehouse stock. Marking it shipped takes them out of stock. The order status stays as it is.'
              : 'Use this when the order has left with the carrier. The reserved tires are taken out of their warehouse stock and the order becomes Shipped.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="shipped-at">Ship date</Label>
            <Input
              id="shipped-at"
              type="date"
              max={today()}
              value={shippedAt}
              onChange={(e) => setShippedAt(e.target.value)}
              disabled={isSaving}
            />
            {!dateValid && <p className="text-xs text-red-600">Enter a date that is not in the future</p>}
          </div>

          {isLoadingPlan && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking stock…
            </div>
          )}

          {planError && <p className="text-sm text-red-600">{planError}</p>}

          {plan && (
            <div className="space-y-3 text-sm">
              {plan.lines.length > 0 ? (
                <div className="rounded-md border">
                  <div className="border-b bg-muted/40 px-3 py-2 font-medium">Leaves stock</div>
                  <ul className="divide-y">
                    {plan.lines.map((line) => (
                      <li key={line.allocationId} className="flex items-start justify-between gap-3 px-3 py-2">
                        <div>
                          <div className="font-medium">{line.sku}</div>
                          <div className="text-xs text-muted-foreground">
                            {line.locationName}
                            {line.alreadyShippedBy && ` · already shipped by pick ticket ${line.alreadyShippedBy}, stock not changed again`}
                            {line.openPickTickets.length > 0 &&
                              ` · comes off pick ticket ${line.openPickTickets.map((pt) => pt.number).join(', ')}`}
                          </div>
                        </div>
                        <div className="whitespace-nowrap font-medium">
                          {line.alreadyShippedBy ? '–' : `−${line.quantity}`}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                plan.blockers.length === 0 && (
                  <p className="text-muted-foreground">
                    {stockOnly
                      ? 'No warehouse stock is reserved for this order. Nothing to take out.'
                      : 'No warehouse stock is reserved for this order. Only the status changes.'}
                  </p>
                )
              )}

              {plan.notTouched.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <div className="mb-1 font-medium">Stock not changed:</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {plan.notTouched.map((line, index) => (
                      <li key={`${line.sku}-${index}`}>
                        {line.sku} × {line.quantity}: {line.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.blockers.length > 0 && (
                <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <ul className="space-y-1">
                    {plan.blockers.map((blocker, index) => (
                      <li key={index}>{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || isLoadingPlan || blocked || !dateValid}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
