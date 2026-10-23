'use client';

/**
 * Receive Purchase Order Dialog
 *
 * "Receive into Warehouse": puts the tires of a delivered container into
 * warehouse stock (inventory on_hand). Quantities are pre-filled:
 * - stock PO: everything not received yet
 * - pre-sold container (allocated): the leftover units (container remaining)
 * - drop-ship: 0 (tires went to the customer)
 * Only the pending qty can be received, so nothing is received twice.
 */

import { useEffect, useState } from 'react';
import { Loader2, PackageCheck, Warehouse } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { getPurchaseOrderReceivingInfo, receivePurchaseOrderIntoStock } from '../actions';
import type { ReceivingInfo } from '@/features/inventory/services/po-receiving.service';

interface ReceivePurchaseOrderDialogProps {
  open: boolean;
  purchaseOrderId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const MODE_NOTES: Record<ReceivingInfo['mode'], string> = {
  stock: 'Stock container: all tires not received yet are pre-filled.',
  allocated: 'Pre-sold container: only the leftover tires (not for the customer) are pre-filled.',
  dropship: 'Drop-ship: tires went directly to the customer, so nothing is pre-filled. Enter a quantity only if tires came into a warehouse.',
};

export function ReceivePurchaseOrderDialog({
  open,
  purchaseOrderId,
  onClose,
  onSuccess,
}: ReceivePurchaseOrderDialogProps) {
  const [info, setInfo] = useState<ReceivingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !purchaseOrderId) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setInfo(null);
    setNotes('');

    getPurchaseOrderReceivingInfo(purchaseOrderId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result.success || !result.data) {
          setError(result.error || 'Failed to load receiving data');
          return;
        }
        const data = result.data as ReceivingInfo;
        setInfo(data);
        setLocationId(data.defaultLocationId || '');
        setQuantities(
          Object.fromEntries(
            data.items.map((item) => [item.poItemId, item.suggested > 0 ? String(item.suggested) : ''])
          )
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load receiving data');
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
  }, [open, purchaseOrderId]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    setError(null);
    onClose();
  };

  const lines = (info?.items || [])
    .filter((item) => item.isStockItem && item.pending > 0)
    .map((item) => ({ item, qty: Number(quantities[item.poItemId] || 0) }));

  const lineErrors = lines
    .filter(({ item, qty }) => !Number.isInteger(qty) || qty < 0 || qty > item.pending)
    .map(({ item }) => item.poItemId);

  const totalToReceive = lines.reduce((sum, { qty }) => sum + (Number.isInteger(qty) && qty > 0 ? qty : 0), 0);
  const canSubmit = !!info?.canReceive && !!locationId && totalToReceive > 0 && lineErrors.length === 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!info || !canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await receivePurchaseOrderIntoStock({
        purchaseOrderId: info.purchaseOrderId,
        locationId,
        lines: lines.filter(({ qty }) => qty > 0).map(({ item, qty }) => ({ poItemId: item.poItemId, quantity: qty })),
        notes: notes.trim() || undefined,
      });

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to receive');
        return;
      }

      const locationName = info.locations.find((l) => l.id === locationId)?.name || 'warehouse';
      toast.success(`Received ${result.data.totalReceived} tires into ${locationName}`);
      if (result.data.errors.length > 0) {
        toast.warning(result.data.errors.join('; '));
      }
      onSuccess?.();
      onClose();
    } catch {
      setError('Failed to receive');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Receive into Warehouse
          </DialogTitle>
          <DialogDescription>
            {info ? `${info.poNumber}: add the delivered tires to warehouse stock (On Hand).` : 'Add the delivered tires to warehouse stock (On Hand).'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : info ? (
          <div className="space-y-4">
            {info.canReceive ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{MODE_NOTES[info.mode]}</p>
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{info.blockedReason}</p>
            )}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 text-right font-medium">Ordered</th>
                    <th className="px-3 py-2 text-right font-medium">Received</th>
                    <th className="px-3 py-2 text-right font-medium">Receive now</th>
                  </tr>
                </thead>
                <tbody>
                  {info.items.map((item) => {
                    const editable = info.canReceive && item.isStockItem && item.pending > 0;
                    const hasError = lineErrors.includes(item.poItemId);
                    return (
                      <tr key={item.poItemId} className="border-t">
                        <td className="min-w-0 px-3 py-2">
                          <div className="font-medium break-words">{item.sku || '-'}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground break-words">{item.description}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{item.ordered}</td>
                        <td className="px-3 py-2 text-right">{item.received}</td>
                        <td className="px-3 py-2 text-right">
                          {editable ? (
                            <div className="flex flex-col items-end">
                              <Input
                                type="number"
                                min={0}
                                max={item.pending}
                                step={1}
                                value={quantities[item.poItemId] ?? ''}
                                onChange={(e) =>
                                  setQuantities((prev) => ({ ...prev, [item.poItemId]: e.target.value }))
                                }
                                className={`h-8 w-24 text-right ${hasError ? 'border-destructive' : ''}`}
                                disabled={isSubmitting}
                              />
                              <span className={`mt-1 text-xs ${hasError ? 'text-destructive' : 'text-muted-foreground'}`}>
                                max {item.pending}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {!item.isStockItem ? 'Not stock' : item.pending === 0 ? 'Done' : '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {info.canReceive && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4" />
                    Warehouse
                  </Label>
                  <Select value={locationId} onValueChange={setLocationId} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {info.locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receive-notes">Note (optional)</Label>
                  <Textarea
                    id="receive-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="e.g. 2 tires damaged, received 70"
                    disabled={isSubmitting}
                  />
                </div>
              </>
            )}
          </div>
        ) : null}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {info?.canReceive && (
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Receiving...
                </>
              ) : (
                `Receive ${totalToReceive} into Stock`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
