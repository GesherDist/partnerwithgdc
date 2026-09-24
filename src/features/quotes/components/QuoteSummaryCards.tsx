'use client';

/**
 * QuoteSummaryCards Component
 *
 * Section 4 of the Quote form.
 * Displays quote totals in card format.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Cached currency formatter
 */

import { memo } from 'react';

import { Card, CardContent } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';

// ============================================
// TYPES
// ============================================

interface QuoteSummaryCardsProps {
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  currencySymbol?: string;
  /** Optional slot for credit warning or other content */
  creditSlot?: React.ReactNode;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(value: number, symbol: string = '$'): string {
  // Simple format with symbol
  return `${symbol}${Math.abs(value).toFixed(2)}`;
}

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

  const displayValue = value < 0
    ? `-${formatCurrency(Math.abs(value), currencySymbol)}`
    : formatCurrency(value, currencySymbol);

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={valueClasses[variant]}>{displayValue}</span>
    </div>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function QuoteSummaryCardsComponent({
  subtotal,
  discount,
  tax,
  grandTotal,
  currencySymbol = '$',
  creditSlot,
}: QuoteSummaryCardsProps) {
  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Quote Summary</h3>
        <p className="text-sm text-muted-foreground">
          Quote totals and calculations.
        </p>
      </div>

      <Separator />

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
export const QuoteSummaryCards = memo(QuoteSummaryCardsComponent);
