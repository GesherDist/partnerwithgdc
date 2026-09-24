'use client';

/**
 * CustomerCreditSection Component
 *
 * Section 5 of the Customer form.
 * Contains credit settings: status, limit, payment terms.
 */

import { useFormContext } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';

import type { CustomerFormInput } from '../lib/schemas';
import { CREDIT_STATUSES, CREDIT_STATUS_LABELS } from '../types';

// ============================================
// CONSTANTS
// ============================================

const CREDIT_TERMS_OPTIONS = [
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Due on Receipt', label: 'Due on Receipt' },
  { value: 'Prepaid', label: 'Prepaid' },
];

// ============================================
// COMPONENT
// ============================================

export function CustomerCreditSection() {
  const { register, formState: { errors }, watch, setValue } = useFormContext<CustomerFormInput>();

  const creditStatus = watch('creditStatus');
  const creditTerms = watch('creditTerms');

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Credit Settings
        </h3>
        <p className="text-sm text-muted-foreground">
          Credit status, limit, and payment terms.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Credit Status */}
        <div className="space-y-2">
          <Label htmlFor="creditStatus">Credit Status</Label>
          <Select
            value={creditStatus}
            onValueChange={(value) => setValue('creditStatus', value as typeof creditStatus)}
          >
            <SelectTrigger id="creditStatus" className={errors.creditStatus ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {CREDIT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {CREDIT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.creditStatus && (
            <p className="text-sm text-destructive">{errors.creditStatus.message}</p>
          )}
        </div>

        {/* Credit Limit */}
        <div className="space-y-2">
          <Label htmlFor="creditLimit">Credit Limit</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="creditLimit"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className={`pl-7 ${errors.creditLimit ? 'border-destructive' : ''}`}
              {...register('creditLimit')}
            />
          </div>
          {errors.creditLimit ? (
            <p className="text-sm text-destructive">{errors.creditLimit.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Maximum credit amount in dollars
            </p>
          )}
        </div>

        {/* Open Balance */}
        <div className="space-y-2">
          <Label htmlFor="openBalance">Open Balance</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
              id="openBalance"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className={`pl-7 ${errors.openBalance ? 'border-destructive' : ''}`}
              {...register('openBalance')}
            />
          </div>
          {errors.openBalance ? (
            <p className="text-sm text-destructive">{errors.openBalance.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Current outstanding balance
            </p>
          )}
        </div>

        {/* Payment Terms */}
        <div className="space-y-2">
          <Label htmlFor="creditTerms">Payment Terms</Label>
          <Select
            value={creditTerms}
            onValueChange={(value) => setValue('creditTerms', value)}
          >
            <SelectTrigger id="creditTerms" className={errors.creditTerms ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select terms" />
            </SelectTrigger>
            <SelectContent>
              {CREDIT_TERMS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.creditTerms && (
            <p className="text-sm text-destructive">{errors.creditTerms.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
