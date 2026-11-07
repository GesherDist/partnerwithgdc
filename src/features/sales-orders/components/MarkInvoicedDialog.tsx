'use client';

/**
 * MarkInvoicedDialog
 *
 * Close out a sales order once it is invoiced in QuickBooks (Ankur, Nov 5
 * 2026: invoices are raised in QuickBooks, not in the ERP). Asks for the
 * invoice date and, optionally, the QuickBooks invoice number. In "reopen"
 * mode it undoes the close-out (order goes back to its previous status).
 */

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

import { markSalesOrderInvoiced, reopenInvoicedSalesOrder } from '../actions';
import { ORDER_STATUS_LABELS, type OrderStatus } from '../types';

export interface MarkInvoicedOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  invoicedAt?: string | null;
  qboInvoiceNumber?: string | null;
  statusBeforeInvoiced?: OrderStatus | null;
}

interface MarkInvoicedDialogProps {
  order: MarkInvoicedOrder | null;
  mode: 'invoice' | 'reopen';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Statuses that can be marked invoiced (same as ORDER_STATUS_TRANSITIONS) */
export const INVOICEABLE_ORDER_STATUSES: OrderStatus[] = ['confirmed', 'processing', 'shipped', 'delivered'];

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function MarkInvoicedDialog({ order, mode, open, onOpenChange, onDone }: MarkInvoicedDialogProps) {
  const [invoicedAt, setInvoicedAt] = useState(today());
  const [qboInvoiceNumber, setQboInvoiceNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setInvoicedAt(today());
      setQboInvoiceNumber('');
    }
  }, [open]);

  if (!order) {
    return null;
  }

  // Unknown in the list (not loaded): the server returns the order's status
  const reopenTo: OrderStatus | null =
    order.statusBeforeInvoiced === undefined
      ? null
      : order.statusBeforeInvoiced && order.statusBeforeInvoiced !== 'invoiced'
        ? order.statusBeforeInvoiced
        : 'confirmed';
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(invoicedAt) && invoicedAt <= today();

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const result =
        mode === 'invoice'
          ? await markSalesOrderInvoiced(order.id, { invoicedAt, qboInvoiceNumber: qboInvoiceNumber.trim() || null })
          : await reopenInvoicedSalesOrder(order.id);
      if (result.success) {
        toast.success(
          mode === 'invoice'
            ? `${order.orderNumber} marked as invoiced`
            : `${order.orderNumber} reopened (${ORDER_STATUS_LABELS[result.data?.status ?? reopenTo ?? 'confirmed']})`
        );
        onOpenChange(false);
        onDone();
      } else {
        toast.error(result.error || 'Could not update the order');
      }
    } catch {
      toast.error('Could not update the order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSaving && onOpenChange(value)}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {mode === 'invoice' ? `Mark as Invoiced – ${order.orderNumber}` : `Reopen ${order.orderNumber}`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'invoice'
              ? 'Use this once the order is invoiced in QuickBooks. The order is closed out: it can no longer be edited or cancelled. You can reopen it if this was a mistake.'
              : `The order goes back to ${reopenTo ? ORDER_STATUS_LABELS[reopenTo] : 'the status it had before it was invoiced'} and the invoice details are cleared.`}
          </DialogDescription>
        </DialogHeader>

        {mode === 'invoice' ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="invoiced-at">Invoice date</Label>
              <Input
                id="invoiced-at"
                type="date"
                max={today()}
                value={invoicedAt}
                onChange={(e) => setInvoicedAt(e.target.value)}
                disabled={isSaving}
              />
              {!dateValid && <p className="text-xs text-red-600">Enter a date that is not in the future</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="qbo-invoice-number">QuickBooks invoice number (optional)</Label>
              <Input
                id="qbo-invoice-number"
                value={qboInvoiceNumber}
                maxLength={50}
                placeholder="e.g. 2600061"
                onChange={(e) => setQboInvoiceNumber(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>
        ) : (
          (order.invoicedAt || order.qboInvoiceNumber) && (
            <p className="text-sm text-muted-foreground">
              Invoiced{order.invoicedAt ? ` on ${order.invoicedAt}` : ''}
              {order.qboInvoiceNumber ? ` · QuickBooks invoice ${order.qboInvoiceNumber}` : ''}
            </p>
          )
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || (mode === 'invoice' && !dateValid)}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'invoice' ? 'Mark as Invoiced' : 'Reopen Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
