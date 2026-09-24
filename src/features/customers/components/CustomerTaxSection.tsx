'use client';

/**
 * CustomerTaxSection Component
 *
 * Section 4 of the Customer form.
 * Contains tax settings: tax ID, tax exempt status, certificate info.
 */

import { useFormContext } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { Separator } from '@/shared/components/ui/separator';

import type { CustomerFormInput } from '../lib/schemas';

// ============================================
// COMPONENT
// ============================================

export function CustomerTaxSection() {
  const { register, formState: { errors }, watch, setValue } = useFormContext<CustomerFormInput>();

  const taxExempt = watch('taxExempt');

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Tax Settings
        </h3>
        <p className="text-sm text-muted-foreground">
          Tax identification and exemption information.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Tax ID */}
        <div className="space-y-2">
          <Label htmlFor="taxId">Tax ID / EIN</Label>
          <Input
            id="taxId"
            placeholder="XX-XXXXXXX"
            className={errors.taxId ? 'border-destructive' : ''}
            {...register('taxId')}
          />
          {errors.taxId && (
            <p className="text-sm text-destructive">{errors.taxId.message}</p>
          )}
        </div>

        {/* Tax Exempt Toggle */}
        <div className="flex items-center gap-4 pt-6">
          <Switch
            id="taxExempt"
            checked={taxExempt}
            onCheckedChange={(checked) => setValue('taxExempt', checked)}
          />
          <div>
            <Label htmlFor="taxExempt" className="cursor-pointer">Tax Exempt</Label>
            <p className="text-xs text-muted-foreground">
              Customer is exempt from sales tax
            </p>
          </div>
        </div>

        {/* Tax Exempt Fields (shown when tax exempt is enabled) */}
        {taxExempt && (
          <>
            <div className="space-y-2">
              <Label htmlFor="taxExemptNumber">Certificate Number</Label>
              <Input
                id="taxExemptNumber"
                placeholder="Tax exempt certificate number"
                className={errors.taxExemptNumber ? 'border-destructive' : ''}
                {...register('taxExemptNumber')}
              />
              {errors.taxExemptNumber && (
                <p className="text-sm text-destructive">{errors.taxExemptNumber.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxExemptExpiryAt">Certificate Expiry Date</Label>
              <Input
                id="taxExemptExpiryAt"
                type="date"
                className={errors.taxExemptExpiryAt ? 'border-destructive' : ''}
                {...register('taxExemptExpiryAt')}
              />
              {errors.taxExemptExpiryAt && (
                <p className="text-sm text-destructive">{errors.taxExemptExpiryAt.message}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
