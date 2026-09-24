'use client';

/**
 * QuoteInfoSection Component
 *
 * Section 1 of the Quote form.
 * Contains quote information fields.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 */

import { memo, useCallback, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Wand2 } from 'lucide-react';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';

import type { QuoteFormInput } from '../lib/schemas';
import { getNextQuoteNumber } from '../actions';

// ============================================
// TYPES
// ============================================

interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface SalesRep {
  id: string;
  name: string;
  email: string;
}

interface QuoteInfoSectionProps {
  customers: Customer[];
  salesReps: SalesRep[];
  onCustomerChange?: (customerId: string) => void;
}

// ============================================
// COMPONENT
// ============================================

function QuoteInfoSectionComponent({
  customers,
  salesReps,
  onCustomerChange,
}: QuoteInfoSectionProps) {
  const { register, control, setValue, formState: { errors } } = useFormContext<QuoteFormInput>();
  const [isGenerating, setIsGenerating] = useState(false);

  // Memoized customer change handler
  const handleCustomerChange = useCallback((value: string) => {
    onCustomerChange?.(value);
  }, [onCustomerChange]);

  // Auto-generate quote number handler
  const handleAutoGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await getNextQuoteNumber();
      if (result.success && result.data) {
        setValue('quoteNumber', result.data);
      }
    } catch (error) {
      console.error('Failed to generate quote number:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [setValue]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Quote Information
        </h3>
        <p className="text-sm text-muted-foreground">
          Basic quote details and customer information.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quote Number */}
        <div className="space-y-2">
          <Label htmlFor="quoteNumber">Quote Number</Label>
          <div className="flex gap-2">
            <Input
              id="quoteNumber"
              placeholder="Enter or auto-generate"
              className={errors.quoteNumber ? 'border-destructive' : ''}
              {...register('quoteNumber')}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              title="Auto-generate quote number"
            >
              <Wand2 className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a custom number or click the wand to auto-generate
          </p>
          {errors.quoteNumber && (
            <p className="text-sm text-destructive">{errors.quoteNumber.message}</p>
          )}
        </div>

        {/* Quote Date */}
        <div className="space-y-2">
          <Label htmlFor="quoteDate">Quote Date *</Label>
          <Input
            id="quoteDate"
            type="date"
            className={errors.quoteDate ? 'border-destructive' : ''}
            {...register('quoteDate')}
          />
          {errors.quoteDate && (
            <p className="text-sm text-destructive">{errors.quoteDate.message}</p>
          )}
        </div>

        {/* Valid Until */}
        <div className="space-y-2">
          <Label htmlFor="validUntil">Valid Until *</Label>
          <Input
            id="validUntil"
            type="date"
            className={errors.validUntil ? 'border-destructive' : ''}
            {...register('validUntil')}
          />
          {errors.validUntil && (
            <p className="text-sm text-destructive">{errors.validUntil.message}</p>
          )}
        </div>

        {/* Customer */}
        <div className="space-y-2">
          <Label htmlFor="customerId">Customer *</Label>
          <Controller
            name="customerId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  handleCustomerChange(value);
                }}
              >
                <SelectTrigger id="customerId" className={errors.customerId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.customerId && (
            <p className="text-sm text-destructive">{errors.customerId.message}</p>
          )}
        </div>

        {/* Sales Representative */}
        <div className="space-y-2">
          <Label htmlFor="salesRepId">Sales Representative</Label>
          <Controller
            name="salesRepId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger id="salesRepId" className={errors.salesRepId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select sales rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.salesRepId && (
            <p className="text-sm text-destructive">{errors.salesRepId.message}</p>
          )}
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currencyId">Currency</Label>
          <Controller
            name="currencyId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || 'USD'} onValueChange={field.onChange}>
                <SelectTrigger id="currencyId" className={errors.currencyId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.currencyId && (
            <p className="text-sm text-destructive">{errors.currencyId.message}</p>
          )}
        </div>

        {/* Customer PO Number */}
        <div className="space-y-2">
          <Label htmlFor="customerPoNumber">Customer PO Number *</Label>
          <Input
            id="customerPoNumber"
            placeholder="Enter customer PO number"
            className={errors.customerPoNumber ? 'border-destructive' : ''}
            {...register('customerPoNumber')}
          />
          {errors.customerPoNumber && (
            <p className="text-sm text-destructive">{errors.customerPoNumber.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Export memoized component
export const QuoteInfoSection = memo(QuoteInfoSectionComponent);
