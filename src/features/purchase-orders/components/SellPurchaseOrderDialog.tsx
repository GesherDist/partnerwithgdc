'use client';

/**
 * SellPurchaseOrderDialog
 *
 * Sell a container (PO) to customer sales orders before it arrives
 * (Ankur, Nov 4 2026). One PO can be split across several orders (Ankur,
 * Nov 5 2026: 72 tires → 12 to one order, 13 to another). Each order gets the
 * same Manufacturer (Direct) allocation as Sales Order → Add Allocation; the
 * sold tires then never enter general stock when the PO is received.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import {
  createAllocationAction,
  getSellablePurchaseOrderLines,
  type SellablePurchaseOrder,
} from '@/features/sales-orders/actions/fulfillment-allocation.actions';

interface SellPurchaseOrderDialogProps {
  purchaseOrderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSold: () => void;
}

export function SellPurchaseOrderDialog({ purchaseOrderId, open, onOpenChange, onSold }: SellPurchaseOrderDialogProps) {
  const [data, setData] = useState<SellablePurchaseOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Selected sales order lines → tires sold to each (one PO, several orders)
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setData(null);
    setQtyByItem({});
    getSellablePurchaseOrderLines(purchaseOrderId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setLoadError(result.error || 'Could not load sales orders');
        }
      })
      .catch(() => !cancelled && setLoadError('Could not load sales orders'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, purchaseOrderId, reloadKey]);

  const selectedLines = useMemo(
    () => (data?.lines ?? []).filter((l) => qtyByItem[l.salesOrderItemId] !== undefined),
    [data, qtyByItem]
  );

  // Tires of each product taken by the selected lines
  const usedByProduct = useMemo(() => {
    const used: Record<string, number> = {};
    for (const line of selectedLines) {
      const qty = Number(qtyByItem[line.salesOrderItemId]);
      if (Number.isInteger(qty) && qty > 0) {
        used[line.productId] = (used[line.productId] || 0) + qty;
      }
    }
    return used;
  }, [selectedLines, qtyByItem]);

  const availableOf = (productId: string) => data?.availableByProduct[productId] ?? 0;

  const lineError = (itemId: string): string | null => {
    const line = data?.lines.find((l) => l.salesOrderItemId === itemId);
    if (!line) {
      return null;
    }
    const qty = Number(qtyByItem[itemId]);
    if (!Number.isInteger(qty) || qty <= 0) {
      return 'Enter a whole number';
    }
    if (qty > line.remaining) {
      return `Max ${line.remaining} for this order`;
    }
    if ((usedByProduct[line.productId] || 0) > availableOf(line.productId)) {
      return `Only ${availableOf(line.productId)} left on the PO`;
    }
    return null;
  };

  const allValid = selectedLines.length > 0 && selectedLines.every((l) => !lineError(l.salesOrderItemId));
  const totalSelected = Object.values(usedByProduct).reduce((sum, qty) => sum + qty, 0);

  const toggleLine = (itemId: string) => {
    const line = data?.lines.find((l) => l.salesOrderItemId === itemId);
    if (!line) {
      return;
    }
    setQtyByItem((prev) => {
      const next = { ...prev };
      if (next[itemId] !== undefined) {
        delete next[itemId];
        return next;
      }
      // Default: what this order still needs, within the tires left on the PO
      const usedByOthers = (data?.lines ?? [])
        .filter((l) => l.productId === line.productId && next[l.salesOrderItemId] !== undefined)
        .reduce((sum, l) => sum + (Number(next[l.salesOrderItemId]) || 0), 0);
      const left = Math.max(0, availableOf(line.productId) - usedByOthers);
      next[itemId] = String(Math.min(line.remaining, left));
      return next;
    });
  };

  const handleSell = async () => {
    if (!data || !allValid) {
      return;
    }
    setIsSaving(true);
    const sold: string[] = [];
    const failed: string[] = [];
    try {
      // One allocation per order, one after the other (the server checks the
      // tires left on the PO each time)
      for (const line of selectedLines) {
        const qty = Number(qtyByItem[line.salesOrderItemId]);
        try {
          const result = await createAllocationAction(
            {
              salesOrderItemId: line.salesOrderItemId,
              fulfillmentSource: 'direct',
              quantity: qty,
              containerQty: data.containerQtyByProduct[line.productId] ?? 0,
              purchaseOrderId,
              containerId: '',
            },
            line.productId
          );
          if (result.success) {
            sold.push(`${line.orderNumber} (${qty})`);
          } else {
            failed.push(`${line.orderNumber}: ${result.error || 'could not sell'}`);
          }
        } catch {
          failed.push(`${line.orderNumber}: could not sell`);
        }
      }

      if (sold.length > 0) {
        const leftover = Object.keys(data.availableByProduct).reduce((sum, productId) => sum + availableOf(productId), 0) - totalSelected;
        toast.success(`${data.poNumber} sold to ${sold.join(', ')}`, {
          description:
            failed.length === 0 && leftover > 0
              ? `The other ${leftover} tires can be sold to another order, or go into stock when the container is received.`
              : undefined,
        });
        onSold();
      }
      if (failed.length > 0) {
        toast.error(`Not sold: ${failed.join('; ')}`);
        // Show what is left now
        setReloadKey((k) => k + 1);
      } else {
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSaving && onOpenChange(value)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sell to Sales Order{data ? ` – ${data.poNumber}` : ''}</DialogTitle>
          <DialogDescription>
            Pick the customer orders this container is sold to and the tires for each. One container can be split
            across several orders. The sold tires will not go into general stock when the container is received.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : data && data.lines.length === 0 ? (
          <Alert>
            <AlertDescription>
              {Object.values(data.availableByProduct).every((left) => left === 0)
                ? 'All tires on this purchase order are already sold to customer orders.'
                : 'No open sales order needs these tires. Create the customer\'s quote and sales order first, then sell this container to it.'}
            </AlertDescription>
          </Alert>
        ) : data ? (
          <div className="space-y-4">
            {/* Tires left on the container per product */}
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.keys(data.containerQtyByProduct).map((productId) => {
                const sku = data.lines.find((l) => l.productId === productId)?.sku;
                const left = availableOf(productId) - (usedByProduct[productId] || 0);
                return (
                  <span key={productId} className="rounded-md border px-2 py-1">
                    {sku ? `${sku}: ` : ''}
                    <span className={`font-medium ${left < 0 ? 'text-red-600' : ''}`}>{left}</span> of{' '}
                    {data.containerQtyByProduct[productId]} left
                  </span>
                );
              })}
            </div>

            <div className="max-h-[45vh] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Sales Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Not allocated</TableHead>
                    <TableHead className="w-32 text-right">Tires to sell</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((line) => {
                    const checked = qtyByItem[line.salesOrderItemId] !== undefined;
                    const error = checked ? lineError(line.salesOrderItemId) : null;
                    return (
                      <TableRow
                        key={line.salesOrderItemId}
                        className={`cursor-pointer ${checked ? 'bg-blue-50' : ''}`}
                        onClick={() => !isSaving && toggleLine(line.salesOrderItemId)}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Select ${line.orderNumber}`}
                            checked={checked}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggleLine(line.salesOrderItemId)}
                            disabled={isSaving}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{line.orderNumber}</div>
                          <div className="text-xs capitalize text-muted-foreground">{line.orderStatus}</div>
                        </TableCell>
                        <TableCell>
                          <div>{line.customerName || '-'}</div>
                          {line.customerPoNumber && (
                            <div className="text-xs text-muted-foreground">PO {line.customerPoNumber}</div>
                          )}
                        </TableCell>
                        <TableCell>{line.sku}</TableCell>
                        <TableCell className="text-right">{line.orderQty}</TableCell>
                        <TableCell className="text-right font-medium">{line.remaining}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {checked ? (
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min={1}
                                max={line.remaining}
                                value={qtyByItem[line.salesOrderItemId]}
                                onChange={(e) =>
                                  setQtyByItem((prev) => ({ ...prev, [line.salesOrderItemId]: e.target.value }))
                                }
                                disabled={isSaving}
                                aria-label={`Tires sold to ${line.orderNumber}`}
                                className="h-8 text-right"
                              />
                              {error && <p className="text-xs text-red-600">{error}</p>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {selectedLines.length > 0 && (
              <div className="space-y-1 text-sm">
                <Label>
                  Selling {totalSelected} tires to {selectedLines.length} order{selectedLines.length > 1 ? 's' : ''}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tires not sold here can be sold to another order later, or go into warehouse stock when received.
                </p>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSell} disabled={isSaving || !allValid}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sell to {selectedLines.length > 1 ? `${selectedLines.length} Orders` : 'Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
