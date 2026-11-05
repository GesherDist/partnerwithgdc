'use client';

/**
 * SellPurchaseOrderDialog
 *
 * Sell a container (PO) to a customer's sales order before it arrives
 * (Ankur, Nov 4 2026). Creates the same Manufacturer (Direct) allocation as
 * Sales Order → Add Allocation, which links the PO to the sales order; the sold
 * tires then never enter general stock when the PO is received.
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
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setData(null);
    setSelectedItemId(null);
    setQuantity('');
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
  }, [open, purchaseOrderId]);

  const selected = useMemo(
    () => data?.lines.find((l) => l.salesOrderItemId === selectedItemId) ?? null,
    [data, selectedItemId]
  );
  const containerQty = selected ? data?.containerQtyByProduct[selected.productId] ?? 0 : 0;
  const maxQty = selected ? Math.min(selected.remaining, containerQty) : 0;
  const qty = Number(quantity);
  const qtyValid = Number.isInteger(qty) && qty > 0 && qty <= maxQty;

  const handleSelect = (itemId: string) => {
    const line = data?.lines.find((l) => l.salesOrderItemId === itemId);
    setSelectedItemId(itemId);
    if (line && data) {
      setQuantity(String(Math.min(line.remaining, data.containerQtyByProduct[line.productId] ?? 0)));
    }
  };

  const handleSell = async () => {
    if (!selected || !qtyValid) {
      return;
    }
    setIsSaving(true);
    try {
      const result = await createAllocationAction(
        {
          salesOrderItemId: selected.salesOrderItemId,
          fulfillmentSource: 'direct',
          quantity: qty,
          containerQty,
          purchaseOrderId,
          containerId: '',
        },
        selected.productId
      );
      if (result.success) {
        const leftover = containerQty - qty;
        toast.success(`${data?.poNumber} sold to ${selected.orderNumber}`, {
          description:
            leftover > 0
              ? `${qty} tires allocated; the other ${leftover} go into stock when the container is received.`
              : `${qty} tires allocated.`,
        });
        onOpenChange(false);
        onSold();
      } else {
        toast.error(result.error || 'Could not sell the purchase order');
      }
    } catch {
      toast.error('Could not sell the purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSaving && onOpenChange(value)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sell to Sales Order{data ? ` – ${data.poNumber}` : ''}</DialogTitle>
          <DialogDescription>
            Pick the customer order this container is sold to. It is linked to that order, and the sold tires will not
            go into general stock when the container is received.
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
              No open sales order needs these tires. Create the customer&apos;s quote and sales order first, then sell
              this container to it.
            </AlertDescription>
          </Alert>
        ) : data ? (
          <div className="space-y-4">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((line) => (
                    <TableRow
                      key={line.salesOrderItemId}
                      className={`cursor-pointer ${selectedItemId === line.salesOrderItemId ? 'bg-blue-50' : ''}`}
                      onClick={() => handleSelect(line.salesOrderItemId)}
                    >
                      <TableCell>
                        <input
                          type="radio"
                          name="sell-line"
                          aria-label={`Select ${line.orderNumber}`}
                          checked={selectedItemId === line.salesOrderItemId}
                          onChange={() => handleSelect(line.salesOrderItemId)}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {selected && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="sell-qty">Tires sold to this order</Label>
                  <Input
                    id="sell-qty"
                    type="number"
                    min={1}
                    max={maxQty}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Container: {containerQty} · Max: {maxQty}
                  </p>
                </div>
                <div className="space-y-1 text-sm">
                  <Label>Left in the container</Label>
                  <p className="pt-2 font-medium">{qtyValid ? containerQty - qty : '—'}</p>
                  <p className="text-xs text-muted-foreground">Goes into warehouse stock when received</p>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSell} disabled={isSaving || !selected || !qtyValid}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sell to Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
