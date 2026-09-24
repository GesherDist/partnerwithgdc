'use client';

/**
 * CustomerAddressSection Component
 *
 * Section 2 of the Customer form.
 * Contains billing and shipping address fields with toggle.
 */

import { useFormContext } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import { Separator } from '@/shared/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { CustomerFormInput } from '../lib/schemas';

// ============================================
// COMPONENT
// ============================================

export function CustomerAddressSection() {
  const { register, formState: { errors }, watch, setValue } = useFormContext<CustomerFormInput>();

  const useSeparateShipping = watch('useSeparateShipping');

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Addresses
        </h3>
        <p className="text-sm text-muted-foreground">
          Billing and shipping address information.
        </p>
      </div>

      <Separator />

      {/* Address Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Billing Address */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Billing Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address1">Address Line 1</Label>
              <Input
                id="address1"
                placeholder="Street address"
                className={errors.address1 ? 'border-destructive' : ''}
                {...register('address1')}
              />
              {errors.address1 && (
                <p className="text-sm text-destructive">{errors.address1.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address2">Address Line 2</Label>
              <Input
                id="address2"
                placeholder="Suite, unit, building, etc."
                className={errors.address2 ? 'border-destructive' : ''}
                {...register('address2')}
              />
              {errors.address2 && (
                <p className="text-sm text-destructive">{errors.address2.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  className={errors.city ? 'border-destructive' : ''}
                  {...register('city')}
                />
                {errors.city && (
                  <p className="text-sm text-destructive">{errors.city.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="State"
                  className={errors.state ? 'border-destructive' : ''}
                  {...register('state')}
                />
                {errors.state && (
                  <p className="text-sm text-destructive">{errors.state.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP / Postal Code</Label>
                <Input
                  id="zip"
                  placeholder="12345"
                  className={errors.zip ? 'border-destructive' : ''}
                  {...register('zip')}
                />
                {errors.zip && (
                  <p className="text-sm text-destructive">{errors.zip.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="US"
                  className={errors.country ? 'border-destructive' : ''}
                  {...register('country')}
                />
                {errors.country && (
                  <p className="text-sm text-destructive">{errors.country.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Address */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Shipping Address</CardTitle>
              <div className="flex items-center gap-2">
                <Switch
                  id="useSeparateShipping"
                  checked={useSeparateShipping}
                  onCheckedChange={(checked) => setValue('useSeparateShipping', checked)}
                />
                <Label htmlFor="useSeparateShipping" className="text-sm font-normal cursor-pointer">
                  Different address
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {useSeparateShipping ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="shippingAddress1">Address Line 1</Label>
                  <Input
                    id="shippingAddress1"
                    placeholder="Street address"
                    className={errors.shippingAddress1 ? 'border-destructive' : ''}
                    {...register('shippingAddress1')}
                  />
                  {errors.shippingAddress1 && (
                    <p className="text-sm text-destructive">{errors.shippingAddress1.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shippingAddress2">Address Line 2</Label>
                  <Input
                    id="shippingAddress2"
                    placeholder="Suite, unit, building, etc."
                    className={errors.shippingAddress2 ? 'border-destructive' : ''}
                    {...register('shippingAddress2')}
                  />
                  {errors.shippingAddress2 && (
                    <p className="text-sm text-destructive">{errors.shippingAddress2.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shippingCity">City</Label>
                    <Input
                      id="shippingCity"
                      placeholder="City"
                      className={errors.shippingCity ? 'border-destructive' : ''}
                      {...register('shippingCity')}
                    />
                    {errors.shippingCity && (
                      <p className="text-sm text-destructive">{errors.shippingCity.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingState">State</Label>
                    <Input
                      id="shippingState"
                      placeholder="State"
                      className={errors.shippingState ? 'border-destructive' : ''}
                      {...register('shippingState')}
                    />
                    {errors.shippingState && (
                      <p className="text-sm text-destructive">{errors.shippingState.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shippingZip">ZIP / Postal Code</Label>
                    <Input
                      id="shippingZip"
                      placeholder="12345"
                      className={errors.shippingZip ? 'border-destructive' : ''}
                      {...register('shippingZip')}
                    />
                    {errors.shippingZip && (
                      <p className="text-sm text-destructive">{errors.shippingZip.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shippingCountry">Country</Label>
                    <Input
                      id="shippingCountry"
                      placeholder="US"
                      className={errors.shippingCountry ? 'border-destructive' : ''}
                      {...register('shippingCountry')}
                    />
                    {errors.shippingCountry && (
                      <p className="text-sm text-destructive">{errors.shippingCountry.message}</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Shipping address will be the same as billing address.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
