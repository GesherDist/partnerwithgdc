'use client';

/**
 * Commission Section
 *
 * Shown inside the sales order view drawer. Lets a user mark an order as
 * commission-only (Galileo invoices the customer, Gesher earns a per-tire
 * commission) and shows the calculated commission.
 */

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { getSalesOrderDirectTireCount, updateSalesOrderCommission } from '../actions';
import type { SalesOrderWithItems } from '../types';

interface CommissionSectionProps {
  order: SalesOrderWithItems;
  canEdit: boolean;
  onSaved: () => void;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function CommissionSection({ order, canEdit, onSaved }: CommissionSectionProps) {
  const [isCommissionOnly, setIsCommissionOnly] = useState(order.isCommissionOnly);
  const [rateDollars, setRateDollars] = useState((order.commissionRate / 100).toFixed(2));
  const [galileoInvoiceNumber, setGalileoInvoiceNumber] = useState(order.galileoInvoiceNumber || '');
  const [isPending, startTransition] = useTransition();

  // Reset the form when another order is loaded or the order is refreshed
  useEffect(() => {
    setIsCommissionOnly(order.isCommissionOnly);
    setRateDollars((order.commissionRate / 100).toFixed(2));
    setGalileoInvoiceNumber(order.galileoInvoiceNumber || '');
  }, [order.id, order.isCommissionOnly, order.commissionRate, order.galileoInvoiceNumber]);

  // Tires allocated to Manufacturer (Direct): only these can earn commission.
  // null = still loading. Reloaded whenever the order is refreshed (e.g. after allocation changes).
  const [directTireCount, setDirectTireCount] = useState<number | null>(null);
  const [commissionInvoiceNumber, setCommissionInvoiceNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDirectTireCount(null);
    getSalesOrderDirectTireCount(order.id).then((result) => {
      if (!cancelled) {
        setDirectTireCount(result.success && result.data ? result.data.directTireCount : 0);
        setCommissionInvoiceNumber(result.success && result.data ? result.data.commissionInvoiceNumber : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [order]);

  const tireCount = directTireCount ?? 0;
  const hasDirectAllocation = tireCount > 0;

  const rateCents = Math.round(Number(rateDollars) * 100);
  const isRateValid = rateDollars.trim() !== '' && Number.isFinite(rateCents) && rateCents >= 0;
  const previewAmount = isCommissionOnly && isRateValid ? tireCount * rateCents : 0;

  // Saved amount no longer matches the Direct allocations (allocations changed after saving)
  const isStale =
    directTireCount !== null &&
    order.isCommissionOnly &&
    order.commissionAmount !== directTireCount * order.commissionRate;

  const isDirty =
    isCommissionOnly !== order.isCommissionOnly ||
    (isRateValid && rateCents !== order.commissionRate) ||
    (galileoInvoiceNumber.trim() || null) !== (order.galileoInvoiceNumber || null);

  // Once billed to Galileo the commission is locked (cancel the commission invoice to change it)
  const isBilled = !!order.commissionInvoiceId;
  const isEditable = canEdit && order.status !== 'cancelled' && !isBilled;

  // Turning commission ON needs a Direct allocation; turning it OFF is always allowed
  const canToggleOn = hasDirectAllocation || order.isCommissionOnly;

  const handleSave = () => {
    if (!isRateValid) {
      toast.error('Enter a valid commission rate');
      return;
    }

    startTransition(async () => {
      const result = await updateSalesOrderCommission(order.id, {
        isCommissionOnly,
        commissionRate: rateCents,
        galileoInvoiceNumber,
      });

      if (result.success) {
        toast.success(isCommissionOnly ? 'Commission saved' : 'Order is no longer commission-only');
        onSaved();
      } else {
        toast.error(result.error || 'Failed to save commission');
      }
    });
  };

  if (!isEditable) {
    if (!order.isCommissionOnly) {
      return <p className="text-sm text-muted-foreground">Regular order (Gesher invoices the customer).</p>;
    }
    return (
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Rate per tire</p>
          <p className="font-medium">{formatCurrency(order.commissionRate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Commission</p>
          <p className="font-semibold">{formatCurrency(order.commissionAmount)}</p>
        </div>
        {order.galileoInvoiceNumber && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Galileo invoice # (to customer)</p>
            <p className="font-medium">{order.galileoInvoiceNumber}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Billed to Galileo</p>
          {isBilled ? (
            <p className="font-medium text-emerald-700">
              {commissionInvoiceNumber ? `Yes, on ${commissionInvoiceNumber}` : 'Yes'}
            </p>
          ) : (
            <p className="font-medium text-amber-700">Not billed yet</p>
          )}
        </div>
        {isBilled && canEdit && (
          <p className="col-span-2 text-xs text-muted-foreground">
            Commission is locked because it is billed. Cancel the commission invoice to change it.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label htmlFor="isCommissionOnly" className="font-medium">Commission only</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Galileo invoices the customer. Gesher earns a commission per tire and bills Galileo.
          </p>
        </div>
        <Switch
          id="isCommissionOnly"
          checked={isCommissionOnly}
          onCheckedChange={setIsCommissionOnly}
          disabled={isPending || directTireCount === null || (!isCommissionOnly && !canToggleOn)}
        />
      </div>

      {directTireCount !== null && !hasDirectAllocation && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {order.isCommissionOnly
            ? 'This order has no Manufacturer (Direct) allocation anymore. Turn commission off or add a Direct allocation.'
            : 'Available only when tires are allocated to Manufacturer (Direct) in Fulfillment Allocations.'}
        </p>
      )}

      {isStale && hasDirectAllocation && !isDirty && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Direct allocations changed since the commission was saved. Click Save to recalculate.
        </p>
      )}

      {order.isCommissionOnly && (
        <p className="text-xs text-amber-700">Commission not billed to Galileo yet.</p>
      )}

      {isCommissionOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="commissionRate" className="text-xs">Rate per tire ($)</Label>
            <Input
              id="commissionRate"
              type="number"
              min="0"
              step="0.01"
              value={rateDollars}
              onChange={(e) => setRateDollars(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="galileoInvoiceNumber" className="text-xs">Galileo invoice # (to customer)</Label>
            <Input
              id="galileoInvoiceNumber"
              maxLength={50}
              value={galileoInvoiceNumber}
              onChange={(e) => setGalileoInvoiceNumber(e.target.value)}
              placeholder="Optional"
              disabled={isPending}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Commission ({tireCount} Direct tires)</p>
            <p className="text-lg font-semibold">{formatCurrency(previewAmount)}</p>
          </div>
        </div>
      )}

      {(isDirty || (isStale && hasDirectAllocation)) && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending || !isRateValid || (isCommissionOnly && !hasDirectAllocation)}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Commission'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export function CommissionBadge() {
  return (
    <Badge className="bg-violet-100 text-violet-800 border border-violet-200">
      <Percent className="mr-1 h-3 w-3" />
      Commission Only
    </Badge>
  );
}
