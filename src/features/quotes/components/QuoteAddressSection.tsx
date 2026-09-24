'use client';

/**
 * QuoteAddressSection Component
 *
 * Section 2 of the Quote form.
 * Contains billing and shipping address fields.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized helper functions with useCallback
 */

import { memo, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { Loader2 } from 'lucide-react';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { QuoteFormInput } from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface QuoteAddressSectionProps {
  isLoadingAddresses?: boolean;
}

// ============================================
// COMPONENT
// ============================================

function QuoteAddressSectionComponent({
  isLoadingAddresses = false,
}: QuoteAddressSectionProps) {
  const { register, formState: { errors } } = useFormContext<QuoteFormInput>();

  // Memoized helper to get nested error message
  const getAddressError = useCallback((type: 'billingAddress' | 'shippingAddress', field: string) => {
    const addressErrors = errors[type] as Record<string, { message?: string }> | undefined;
    return addressErrors?.[field]?.message;
  }, [errors]);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Billing & Shipping
          </h3>
          <p className="text-sm text-muted-foreground">
            Customer billing and shipping addresses.
          </p>
        </div>
        {isLoadingAddresses && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <Separator />

      {/* Address Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Billing Address */}
        <Card className={errors.billingAddress ? 'border-destructive' : ''}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Billing Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="billingAddress.street">Street</Label>
              <Input
                id="billingAddress.street"
                placeholder="123 Main St"
                className={getAddressError('billingAddress', 'street') ? 'border-destructive' : ''}
                {...register('billingAddress.street')}
              />
              {getAddressError('billingAddress', 'street') && (
                <p className="text-sm text-destructive">{getAddressError('billingAddress', 'street')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingAddress.city">City</Label>
                <Input
                  id="billingAddress.city"
                  placeholder="City"
                  className={getAddressError('billingAddress', 'city') ? 'border-destructive' : ''}
                  {...register('billingAddress.city')}
                />
                {getAddressError('billingAddress', 'city') && (
                  <p className="text-sm text-destructive">{getAddressError('billingAddress', 'city')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingAddress.state">State</Label>
                <Input
                  id="billingAddress.state"
                  placeholder="State"
                  className={getAddressError('billingAddress', 'state') ? 'border-destructive' : ''}
                  {...register('billingAddress.state')}
                />
                {getAddressError('billingAddress', 'state') && (
                  <p className="text-sm text-destructive">{getAddressError('billingAddress', 'state')}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billingAddress.postalCode">Postal Code</Label>
                <Input
                  id="billingAddress.postalCode"
                  placeholder="12345"
                  className={getAddressError('billingAddress', 'postalCode') ? 'border-destructive' : ''}
                  {...register('billingAddress.postalCode')}
                />
                {getAddressError('billingAddress', 'postalCode') && (
                  <p className="text-sm text-destructive">{getAddressError('billingAddress', 'postalCode')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingAddress.country">Country</Label>
                <Input
                  id="billingAddress.country"
                  placeholder="US"
                  className={getAddressError('billingAddress', 'country') ? 'border-destructive' : ''}
                  {...register('billingAddress.country')}
                />
                {getAddressError('billingAddress', 'country') && (
                  <p className="text-sm text-destructive">{getAddressError('billingAddress', 'country')}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card className={errors.shippingAddress ? 'border-destructive' : ''}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Shipping Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shippingAddress.street">Street</Label>
              <Input
                id="shippingAddress.street"
                placeholder="123 Main St"
                className={getAddressError('shippingAddress', 'street') ? 'border-destructive' : ''}
                {...register('shippingAddress.street')}
              />
              {getAddressError('shippingAddress', 'street') && (
                <p className="text-sm text-destructive">{getAddressError('shippingAddress', 'street')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shippingAddress.city">City</Label>
                <Input
                  id="shippingAddress.city"
                  placeholder="City"
                  className={getAddressError('shippingAddress', 'city') ? 'border-destructive' : ''}
                  {...register('shippingAddress.city')}
                />
                {getAddressError('shippingAddress', 'city') && (
                  <p className="text-sm text-destructive">{getAddressError('shippingAddress', 'city')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingAddress.state">State</Label>
                <Input
                  id="shippingAddress.state"
                  placeholder="State"
                  className={getAddressError('shippingAddress', 'state') ? 'border-destructive' : ''}
                  {...register('shippingAddress.state')}
                />
                {getAddressError('shippingAddress', 'state') && (
                  <p className="text-sm text-destructive">{getAddressError('shippingAddress', 'state')}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shippingAddress.postalCode">Postal Code</Label>
                <Input
                  id="shippingAddress.postalCode"
                  placeholder="12345"
                  className={getAddressError('shippingAddress', 'postalCode') ? 'border-destructive' : ''}
                  {...register('shippingAddress.postalCode')}
                />
                {getAddressError('shippingAddress', 'postalCode') && (
                  <p className="text-sm text-destructive">{getAddressError('shippingAddress', 'postalCode')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingAddress.country">Country</Label>
                <Input
                  id="shippingAddress.country"
                  placeholder="US"
                  className={getAddressError('shippingAddress', 'country') ? 'border-destructive' : ''}
                  {...register('shippingAddress.country')}
                />
                {getAddressError('shippingAddress', 'country') && (
                  <p className="text-sm text-destructive">{getAddressError('shippingAddress', 'country')}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Export memoized component
export const QuoteAddressSection = memo(QuoteAddressSectionComponent);
