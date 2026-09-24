'use client';

/**
 * BillingShippingSection Component
 *
 * Section 2 of the Sales Order form.
 * Contains billing address, shipping address, and shipping method fields.
 * Integrates with React Hook Form via FormProvider.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized sub-components
 */

import { memo, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

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
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { BillingShippingSectionProps, SalesOrderFormData } from '../types';

// ============================================
// SUB-COMPONENTS
// ============================================

interface AddressFieldsProps {
  prefix: 'billingAddress' | 'shippingAddress';
  title: string;
  isLoading?: boolean;
}

const AddressFields = memo(function AddressFields({ prefix, title, isLoading }: AddressFieldsProps) {
  const { register, formState: { errors } } = useFormContext<SalesOrderFormData>();

  const addressErrors = errors[prefix] as Record<string, { message?: string }> | undefined;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          {title}
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Street */}
        <div className="space-y-2">
          <Label htmlFor={`${prefix}.street`}>Street Address</Label>
          <Input
            id={`${prefix}.street`}
            placeholder="Enter street address"
            disabled={isLoading}
            {...register(`${prefix}.street`)}
          />
          {addressErrors?.street?.message && (
            <p className="text-sm text-destructive">{addressErrors.street.message}</p>
          )}
        </div>

        {/* City & State */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}.city`}>City</Label>
            <Input
              id={`${prefix}.city`}
              placeholder="City"
              disabled={isLoading}
              {...register(`${prefix}.city`)}
            />
            {addressErrors?.city?.message && (
              <p className="text-sm text-destructive">{addressErrors.city.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}.state`}>State/Province</Label>
            <Input
              id={`${prefix}.state`}
              placeholder="State"
              disabled={isLoading}
              {...register(`${prefix}.state`)}
            />
            {addressErrors?.state?.message && (
              <p className="text-sm text-destructive">{addressErrors.state.message}</p>
            )}
          </div>
        </div>

        {/* Postal Code & Country */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${prefix}.postalCode`}>Postal Code</Label>
            <Input
              id={`${prefix}.postalCode`}
              placeholder="Postal code"
              disabled={isLoading}
              {...register(`${prefix}.postalCode`)}
            />
            {addressErrors?.postalCode?.message && (
              <p className="text-sm text-destructive">{addressErrors.postalCode.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${prefix}.country`}>Country</Label>
            <Input
              id={`${prefix}.country`}
              placeholder="Country"
              disabled={isLoading}
              {...register(`${prefix}.country`)}
            />
            {addressErrors?.country?.message && (
              <p className="text-sm text-destructive">{addressErrors.country.message}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function BillingShippingSectionComponent({
  shippingMethods,
  isLoadingAddresses = false,
}: BillingShippingSectionProps) {
  const { watch, setValue, formState: { errors } } = useFormContext<SalesOrderFormData>();
  const selectedShippingMethod = watch('shippingMethodId');

  // Memoized handler for shipping method change
  const handleShippingMethodChange = useCallback((value: string) => {
    setValue('shippingMethodId', value);
  }, [setValue]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Billing & Shipping
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter billing and shipping addresses.
          {isLoadingAddresses && ' Loading customer addresses...'}
        </p>
      </div>

      <Separator />

      {/* Address Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AddressFields
          prefix="billingAddress"
          title="Billing Address"
          isLoading={isLoadingAddresses}
        />
        <AddressFields
          prefix="shippingAddress"
          title="Shipping Address"
          isLoading={isLoadingAddresses}
        />
      </div>

      {/* Shipping Method */}
      <div className="max-w-md space-y-2">
        <Label htmlFor="shippingMethodId">Shipping Method</Label>
        <Select
          value={selectedShippingMethod || undefined}
          onValueChange={handleShippingMethodChange}
        >
          <SelectTrigger id="shippingMethodId">
            <SelectValue placeholder="Select shipping method" />
          </SelectTrigger>
          <SelectContent>
            {shippingMethods.map((method) => (
              <SelectItem key={method.id} value={method.id}>
                {method.name}
                {method.estimatedDays > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    ({method.estimatedDays} days)
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.shippingMethodId && (
          <p className="text-sm text-destructive">{errors.shippingMethodId.message}</p>
        )}
      </div>
    </div>
  );
}

// Export memoized component
export const BillingShippingSection = memo(BillingShippingSectionComponent);
