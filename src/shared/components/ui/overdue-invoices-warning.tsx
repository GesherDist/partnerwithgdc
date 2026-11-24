'use client';

/**
 * Overdue Invoices Warning (Nov 20 2026)
 *
 * Ankur, Nov 19 call: credit hold is "just a warning we need to display … overdue
 * invoices is more important". Shows the customer's overdue QuickBooks invoices
 * (latest snapshot). Information only: nothing is blocked and there is nothing
 * to release. Shows nothing when there is no overdue invoice or no snapshot.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  getCustomerOverdueInvoices,
  type CustomerOverdueInvoices,
} from '@/features/customers/actions/overdue.actions';
import { cn } from '@/shared/lib/utils';

interface OverdueInvoicesWarningProps {
  customerId?: string | null;
  customerName?: string | null;
  className?: string;
}

function formatDollars(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

export function OverdueInvoicesWarning({ customerId, customerName, className }: OverdueInvoicesWarningProps) {
  const [overdue, setOverdue] = useState<CustomerOverdueInvoices | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOverdue(null);
    if (!customerId && !customerName) {
      return;
    }
    getCustomerOverdueInvoices({ customerId, customerName })
      .then((result) => {
        if (!cancelled) {
          setOverdue(result.success ? result.data ?? null : null);
        }
      })
      .catch(() => {
        // A warning must never break the page
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, customerName]);

  if (!overdue) {
    return null;
  }

  const docs = overdue.invoices
    .slice(0, 5)
    .map((i) => i.doc)
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30',
        className
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 text-amber-800 dark:text-amber-200">
        <p className="font-medium">
          {overdue.count} overdue invoice{overdue.count === 1 ? '' : 's'} · {formatDollars(overdue.amount)}
          {overdue.oldestDays > 0 ? ` · oldest ${overdue.oldestDays} day${overdue.oldestDays === 1 ? '' : 's'} past due` : ''}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {docs ? `${docs}${overdue.invoices.length > 5 ? ', …' : ''} · ` : ''}QuickBooks as of {overdue.asOf}. Warning only.
        </p>
      </div>
    </div>
  );
}
