'use client';

/**
 * EditOrderPricesDialog
 *
 * Change line prices on a confirmed / processing sales order: unit price,
 * discount % and tax % only. Product and quantity stay locked because
 * allocations, pick tickets and inventory depend on them (Ankur, Nov 4 2026).
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
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

import { updateSalesOrderItemPrices } from '../actions';
import type { SalesOrderWithItems } from '../types';

interface EditOrderPricesDialogProps {
  order: SalesOrderWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Editable values per line; price in dollars as typed */
interface PriceRow {
  itemId: string;
  price: string;
  discount: string;
  tax: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function toRows(order: SalesOrderWithItems): PriceRow[] {
  return order.items.map((item) => ({
    itemId: item.id,
    price: (item.unitPrice / 100).toFixed(2),
    discount: String(item.discountPercent ?? 0),
    tax: String(item.taxRate ?? 0),
  }));
}

export function EditOrderPricesDialog({ order, open, onOpenChange, onSaved }: EditOrderPricesDialogProps) {
  const [rows, setRows] = useState<PriceRow[]>(() => toRows(order));
  const [isSaving, setIsSaving] = useState(false);

  // Start from the saved prices every time the dialog opens
  useEffect(() => {
    if (open) {
      setRows(toRows(order));
    }
  }, [open, order]);

  const update = (itemId: string, field: keyof Omit<PriceRow, 'itemId'>, value: string) => {
    setRows((current) => current.map((row) => (row.itemId === itemId ? { ...row, [field]: value } : row)));
  };

  // Parsed values (cents / percent); null when a field is not a valid number
  const parsed = useMemo(
    () =>
      rows.map((row) => {
        const price = Number(row.price);
        const discount = Number(row.discount);
        const tax = Number(row.tax);
        const valid =
          row.price.trim() !== '' && Number.isFinite(price) && price >= 0 &&
          Number.isFinite(discount) && discount >= 0 && discount <= 100 &&
          Number.isFinite(tax) && tax >= 0 && tax <= 100;
        return valid
          ? { itemId: row.itemId, unitPrice: Math.round(price * 100), discountPercent: discount, taxRate: tax }
          : null;
      }),
    [rows]
  );

  const allValid = parsed.every((p) => p !== null);

  // Only lines that actually changed are sent
  const changes = useMemo(
    () =>
      parsed.filter((p): p is NonNullable<typeof p> => {
        if (!p) {
          return false;
        }
        const item = order.items.find((i) => i.id === p.itemId);
        return (
          !!item &&
          (item.unitPrice !== p.unitPrice ||
            (item.discountPercent ?? 0) !== p.discountPercent ||
            (item.taxRate ?? 0) !== p.taxRate)
        );
      }),
    [parsed, order.items]
  );

  const handleSave = async () => {
    if (!allValid || changes.length === 0) {
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateSalesOrderItemPrices(order.id, changes);
      if (result.success) {
        toast.success(`Prices updated on ${order.orderNumber}`);
        if (result.warning) {
          toast.warning(result.warning, { duration: 10000 });
        }
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(result.error || 'Failed to update prices');
      }
    } catch {
      toast.error('Failed to update prices');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isSaving && onOpenChange(value)}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Edit Prices – {order.orderNumber}</DialogTitle>
          <DialogDescription>
            This order is {order.status}. You can change the unit price, discount and tax. Product and
            quantity are locked because allocations and pick tickets depend on them.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="w-[140px]">Unit Price ($)</TableHead>
                <TableHead className="w-[110px]">Discount %</TableHead>
                <TableHead className="w-[110px]">Tax %</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item, index) => {
                const row = rows[index];
                const p = parsed[index];
                const lineSubtotal = p ? item.quantity * p.unitPrice : 0;
                const lineTotal = p ? lineSubtotal - Math.round(lineSubtotal * (p.discountPercent / 100)) : null;
                if (!row) {
                  return null;
                }
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.sku}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.price}
                        onChange={(e) => update(item.id, 'price', e.target.value)}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={row.discount}
                        onChange={(e) => update(item.id, 'discount', e.target.value)}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={row.tax}
                        onChange={(e) => update(item.id, 'tax', e.target.value)}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {lineTotal === null ? '—' : formatCurrency(lineTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {!allValid && (
          <p className="text-sm text-destructive">
            Enter a price of 0 or more, and a discount and tax between 0 and 100.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !allValid || changes.length === 0}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Prices
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
