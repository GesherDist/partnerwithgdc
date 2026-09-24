'use client';

/**
 * OrderSummaryCards Component
 *
 * Section 4 of the Sales Order form.
 * Displays order totals in card format.
 *
 * All values are received via props - display only.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized sub-components
 */

import { memo } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';

import type { OrderSummaryCardsProps } from '../types';
import { formatCurrency } from '../lib/mock-data';

// ============================================
// SUB-COMPONENTS
// ============================================

interface SummaryItemProps {
  label: string;
  value: number;
  currencySymbol: string;
  variant?: 'default' | 'highlight' | 'muted';
}

const SummaryItem = memo(function SummaryItem({
  label,
  value,
  currencySymbol,
  variant = 'default',
}: SummaryItemProps) {
  const valueClasses = {
    default: 'text-foreground',
    highlight: 'text-primary font-bold text-lg',
    muted: 'text-muted-foreground',
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={valueClasses[variant]}>
        {formatCurrency(value, currencySymbol)}
      </span>
    </div>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function OrderSummaryCardsComponent({
  subtotal,
  discount,
  tax,
  shipping,
  grandTotal,
  currencySymbol = '$',
  creditSlot,
}: OrderSummaryCardsProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Order Summary</h3>
        <p className="text-sm text-muted-foreground">
          Order totals and calculations.
        </p>
      </div>

      <Separator />

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Subtotal Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Subtotal
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(subtotal, currencySymbol)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Discount Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Discount
              </p>
              <p className="text-2xl font-semibold text-red-600">
                -{formatCurrency(discount, currencySymbol)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tax Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tax
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(tax, currencySymbol)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Card */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Shipping
              </p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(shipping, currencySymbol)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Grand Total Card */}
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                Grand Total
              </p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(grandTotal, currencySymbol)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credit Slot + Detailed Summary Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Credit Slot (left side) */}
        {creditSlot && (
          <div className="w-full sm:w-72 flex-shrink-0">
            {creditSlot}
          </div>
        )}

        {/* Detailed Summary (right side) */}
        <Card className={creditSlot ? "w-full sm:w-80 flex-shrink-0 sm:ml-auto" : "max-w-md ml-auto"}>
          <CardContent className="p-4">
            <SummaryItem
              label="Subtotal"
              value={subtotal}
              currencySymbol={currencySymbol}
            />
            <SummaryItem
              label="Discount"
              value={-discount}
              currencySymbol={currencySymbol}
              variant="muted"
            />
            <SummaryItem
              label="Tax"
              value={tax}
              currencySymbol={currencySymbol}
            />
            <SummaryItem
              label="Shipping"
              value={shipping}
              currencySymbol={currencySymbol}
            />
            <Separator className="my-2" />
            <SummaryItem
              label="Grand Total"
              value={grandTotal}
              currencySymbol={currencySymbol}
              variant="highlight"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Export memoized component
export const OrderSummaryCards = memo(OrderSummaryCardsComponent);
