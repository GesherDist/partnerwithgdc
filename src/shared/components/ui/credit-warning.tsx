'use client';

/**
 * Credit Warning Component
 *
 * Compact inline credit status indicator for Quote and Sales Order forms.
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, Loader2, ShieldCheck, Clock } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { checkCustomerCredit, canOverrideCredit } from '@/features/customers/actions/credit.actions';
import type { CreditCheckResult } from '@/features/customers/services/credit-check.service';
import { cn } from '@/shared/lib/utils';

// ============================================
// TYPES
// ============================================

interface CreditWarningProps {
  customerId: string | null;
  orderTotal: number;
  onCreditApproved?: () => void;
  onCreditFailed?: (result: CreditCheckResult) => void;
  onCreditOverridden?: () => void;
  readOnly?: boolean;
}

// ============================================
// HELPERS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

// ============================================
// COMPONENT
// ============================================

export function CreditWarning({
  customerId,
  orderTotal,
  onCreditApproved,
  onCreditFailed,
  onCreditOverridden,
  readOnly = false,
}: CreditWarningProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [creditResult, setCreditResult] = useState<CreditCheckResult | null>(null);
  const [canOverride, setCanOverride] = useState(false);
  const [isOverridden, setIsOverridden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkOverridePermission() {
      const result = await canOverrideCredit();
      if (result.success) {
        setCanOverride(result.data ?? false);
      }
    }
    checkOverridePermission();
  }, []);

  const performCreditCheck = useCallback(async () => {
    if (!customerId || orderTotal <= 0) {
      setCreditResult(null);
      setError(null);
      setIsOverridden(false);
      return;
    }

    setIsChecking(true);
    setError(null);
    setIsOverridden(false);

    try {
      const orderAmountCents = Math.round(orderTotal * 100);
      const result = await checkCustomerCredit(customerId, orderAmountCents);

      if (result.success && result.data) {
        setCreditResult(result.data);
        if (result.data.passed) {
          onCreditApproved?.();
        } else {
          onCreditFailed?.(result.data);
        }
      } else {
        setError(result.error || 'Failed to check credit');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check credit');
    } finally {
      setIsChecking(false);
    }
  }, [customerId, orderTotal, onCreditApproved, onCreditFailed]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performCreditCheck();
    }, 500);
    return () => clearTimeout(timer);
  }, [performCreditCheck]);

  const handleOverride = useCallback(() => {
    setIsOverridden(true);
    onCreditOverridden?.();
  }, [onCreditOverridden]);

  if (!customerId) {
    return null;
  }

  // Loading
  if (isChecking) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking credit...</span>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive py-2">
        <XCircle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (!creditResult) {
    return null;
  }

  // Credit Approved - compact green indicator
  if (creditResult.passed) {
    return (
      <div className="flex items-center gap-3 text-sm py-2 px-3 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-800">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className="text-green-700 dark:text-green-300">
          Credit OK
        </span>
        <span className="text-green-600 dark:text-green-400 text-xs">
          Available: {formatCurrency(creditResult.availableCredit)}
        </span>
      </div>
    );
  }

  // Credit Overridden - compact blue indicator
  if (isOverridden) {
    return (
      <div className="flex items-center gap-3 text-sm py-2 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-200 dark:border-blue-800">
        <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
        <span className="text-blue-700 dark:text-blue-300">
          Credit Override Applied
        </span>
        <span className="text-blue-600 dark:text-blue-400 text-xs">
          Exceeds by: {formatCurrency(creditResult.exceededBy)}
        </span>
      </div>
    );
  }

  // Credit Not Approved (status issue) - compact red indicator
  if (creditResult.reason === 'status_not_approved') {
    return (
      <div className="flex items-center justify-between gap-3 text-sm py-2 px-3 bg-red-50 dark:bg-red-950/30 rounded-md border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <span className="text-red-700 dark:text-red-300">
            Credit {creditResult.creditStatus.toUpperCase()}
          </span>
        </div>
        {canOverride && !readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100"
            onClick={handleOverride}
          >
            Override
          </Button>
        )}
      </div>
    );
  }

  // Credit Limit Exceeded - amber card with vertical details
  if (creditResult.reason === 'limit_exceeded') {
    return (
      <div className={cn(
        "text-sm py-3 px-4 rounded-md border w-full",
        "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
      )}>
        {/* Header with title and override button */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              Credit Limit Exceeded
            </span>
          </div>
          {canOverride && !readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={handleOverride}
            >
              Override
            </Button>
          )}
        </div>

        {/* Vertical details list */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-amber-600 dark:text-amber-400">Limit:</span>
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              {formatCurrency(creditResult.creditLimit)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-600 dark:text-amber-400">Balance:</span>
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              {formatCurrency(creditResult.openBalance)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-600 dark:text-amber-400">Available:</span>
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              {formatCurrency(creditResult.availableCredit)}
            </span>
          </div>
          <div className="flex justify-between border-t border-amber-200 dark:border-amber-700 pt-1.5 mt-1.5">
            <span className="text-red-600 dark:text-red-400 font-medium">Exceeds:</span>
            <span className="text-red-600 dark:text-red-400 font-bold">
              {formatCurrency(creditResult.exceededBy)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Past Due - amber card for overdue invoices
  if (creditResult.reason === 'past_due') {
    return (
      <div className={cn(
        "text-sm py-3 px-4 rounded-md border w-full",
        "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
      )}>
        {/* Header with title and override button */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              Past Due Invoices
            </span>
          </div>
          {canOverride && !readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={handleOverride}
            >
              Override
            </Button>
          )}
        </div>

        {/* Details */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-amber-600 dark:text-amber-400">Overdue Invoices:</span>
            <span className="text-red-600 dark:text-red-400 font-bold">
              {creditResult.overdueInvoiceCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-amber-600 dark:text-amber-400">Open Balance:</span>
            <span className="text-amber-700 dark:text-amber-300 font-medium">
              {formatCurrency(creditResult.openBalance)}
            </span>
          </div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-2 pt-2 border-t border-amber-200 dark:border-amber-700">
            Payment required before placing new orders.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export type { CreditWarningProps };
