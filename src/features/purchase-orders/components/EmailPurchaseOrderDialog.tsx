'use client';

/**
 * Email Purchase Order Dialog (Ankur's email, Nov 6 2026)
 *
 * Lists the supplier emails of the PO (primary contact + supplier contacts),
 * the user ticks who gets it, and the PO PDF is emailed to them.
 * - mode "send": a draft PO ("Send to Supplier"): email, then status → Sent
 * - mode "email": any later PO ("Email PO to Supplier"): email only, status unchanged
 */

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  emailPurchaseOrderToSupplier,
  getPurchaseOrderEmailRecipients,
  type PurchaseOrderEmailRecipientOption,
} from '../actions';

interface EmailPurchaseOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrderId: string;
  poNumber: string;
  mode: 'send' | 'email';
  onDone?: () => void;
}

export function EmailPurchaseOrderDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  poNumber,
  mode,
  onDone,
}: EmailPurchaseOrderDialogProps) {
  const [recipients, setRecipients] = useState<PurchaseOrderEmailRecipientOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getPurchaseOrderEmailRecipients(purchaseOrderId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success && result.data) {
          setRecipients(result.data);
          // Pre-select the primary contacts
          const primary = result.data.filter((r) => r.role === 'Primary contact' || r.role === 'Primary');
          setSelected(new Set((primary.length ? primary : result.data.slice(0, 1)).map((r) => r.email)));
        } else {
          setRecipients([]);
          setSelected(new Set());
          setLoadError(result.error || 'Could not load supplier emails');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load supplier emails');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, purchaseOrderId]);

  const toggle = (email: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(email);
      } else {
        next.delete(email);
      }
      return next;
    });
  };

  const handleSend = () => {
    startTransition(async () => {
      try {
        const result = await emailPurchaseOrderToSupplier(purchaseOrderId, [...selected], {
          markSent: mode === 'send',
        });
        if (!result.success || !result.data) {
          toast.error(result.error || 'Failed to email the PO');
          return;
        }
        const { sentTo, errors } = result.data;
        toast.success(`PO ${poNumber} emailed to ${sentTo.join(', ')}`);
        for (const e of errors) {
          toast.warning(e);
        }
        onOpenChange(false);
        onDone?.();
      } catch (error) {
        console.error('Error emailing PO:', error);
        toast.error('Failed to email the PO');
      }
    });
  };

  const title = mode === 'send' ? 'Send PO to Supplier' : 'Email PO to Supplier';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Prevent closing while sending
        if (!next && isPending) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            The PDF of <span className="font-semibold">{poNumber}</span> is emailed to the selected addresses.
            {mode === 'send'
              ? ' The PO is then marked as Sent, and the supplier can also respond in the supplier portal.'
              : ' The PO status does not change.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading supplier emails...
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No email address found for the supplier(s) on this PO. Add a primary contact email or a contact with an
              email on the supplier, then try again.
            </p>
          ) : (
            recipients.map((r) => {
              const id = `po-email-${r.email}`;
              return (
                <label
                  key={r.email}
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    id={id}
                    checked={selected.has(r.email)}
                    onCheckedChange={(checked) => toggle(r.email, checked === true)}
                    disabled={isPending}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 text-sm">
                    <div className="font-medium break-all">{r.email}</div>
                    <div className="text-muted-foreground">
                      {[r.name, r.role, r.supplierName].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isPending || loading || selected.size === 0}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : mode === 'send' ? (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send PO
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Email PO
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
