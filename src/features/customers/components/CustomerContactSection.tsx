'use client';

/**
 * CustomerContactSection Component
 *
 * Section 3 of the Customer form.
 * Contains contact information fields: phone, email, website.
 */

import { useFormContext, Controller } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Separator } from '@/shared/components/ui/separator';
import { PhoneInput } from '@/shared/components/ui/phone-input';

import type { CustomerFormInput } from '../lib/schemas';

// ============================================
// COMPONENT
// ============================================

export function CustomerContactSection() {
  const { register, control, formState: { errors } } = useFormContext<CustomerFormInput>();

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Contact Information
        </h3>
        <p className="text-sm text-muted-foreground">
          Company contact details.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="phone"
                placeholder="(555) 123-4567"
                className={errors.phone ? 'border-destructive' : ''}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="contact@company.com"
            className={errors.email ? 'border-destructive' : ''}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Website */}
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://www.company.com"
            className={errors.website ? 'border-destructive' : ''}
            {...register('website')}
          />
          {errors.website && (
            <p className="text-sm text-destructive">{errors.website.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
