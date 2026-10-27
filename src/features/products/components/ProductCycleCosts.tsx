'use client';

/**
 * ProductCycleCosts Component
 *
 * Purchase cost per order cycle (GDC 0, GDC 1, ...) for a product.
 * Dashboard COGS uses the cost of the sales order's cycle; a cycle with no
 * cost uses the product's base cost.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { ORDER_SERIES } from '@/shared/lib/global-data';

import { getProductCycleCosts, saveProductCycleCost } from '../actions';

interface ProductCycleCostsProps {
  productId: string;
  /** cents */
  baseCost: number;
  canEdit: boolean;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function ProductCycleCosts({ productId, baseCost, canEdit }: ProductCycleCostsProps) {
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchCosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const result = await getProductCycleCosts(productId);
    if (result.success && result.data) {
      setCosts(Object.fromEntries(result.data.map((c) => [c.orderSeries, c.cost])));
    } else {
      setError(result.error || 'Failed to load cycle costs');
    }
    setIsLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  const startEdit = (series: string) => {
    setEditing(series);
    const current = costs[series];
    setValue(current !== undefined ? (current / 100).toFixed(2) : '');
  };

  const save = async (series: string, dollars: number | null) => {
    setSaving(true);
    const result = await saveProductCycleCost(productId, series, dollars);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error || 'Failed to save cost');
      return;
    }
    toast.success(dollars === null ? `${series} now uses the purchase cost` : `${series} cost saved`);
    setEditing(null);
    fetchCosts();
  };

  const submit = (series: string) => {
    const trimmed = value.trim().replace(/[$,]/g, '');
    if (trimmed === '') {
      save(series, null);
      return;
    }
    const dollars = Number(trimmed);
    if (!Number.isFinite(dollars) || dollars < 0) {
      toast.error('Enter a valid cost');
      return;
    }
    save(series, dollars);
  };

  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Cost by Order Cycle
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Used for COGS on orders of that cycle. Without a cost, the purchase cost ({formatCurrency(baseCost)}) is used.
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCosts} className="mt-3">
              Try Again
            </Button>
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {ORDER_SERIES.map((series) => {
              const cost = costs[series.code];
              const isEditing = editing === series.code;
              return (
                <div key={series.code} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-16 text-sm font-medium">{series.code}</span>
                  {isEditing ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit(series.code);
                      }}
                    >
                      <Input
                        autoFocus
                        inputMode="decimal"
                        placeholder="Blank = purchase cost"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="h-8 max-w-[160px]"
                        disabled={saving}
                      />
                      <Button type="submit" size="sm" disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                        <X className="h-4 w-4" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 text-sm">
                        {cost !== undefined ? (
                          <span className="font-mono font-semibold">{formatCurrency(cost)}</span>
                        ) : (
                          <span className="text-muted-foreground">Purchase cost ({formatCurrency(baseCost)})</span>
                        )}
                      </span>
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(series.code)}
                          disabled={editing !== null}
                          aria-label={`Edit ${series.code} cost`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
