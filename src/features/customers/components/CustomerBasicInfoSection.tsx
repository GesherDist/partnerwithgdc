'use client';

/**
 * CustomerBasicInfoSection Component
 *
 * Section 1 of the Customer form.
 * Contains basic information fields: name, legal name, channel.
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
import { CUSTOMER_CHANNELS, CUSTOMER_CHANNEL_LABELS } from '../types';

// ============================================
// COMPONENT
// ============================================

export function CustomerBasicInfoSection() {
  const { register, formState: { errors }, watch, setValue } = useFormContext<CustomerFormInput>();

  const channel = watch('channel');

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Basic Information
        </h3>
        <p className="text-sm text-muted-foreground">
          Company name and classification.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Company Name *</Label>
          <Input
            id="name"
            placeholder="Company Name"
            className={errors.name ? 'border-destructive' : ''}
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* Channel */}
        <div className="space-y-2">
          <Label htmlFor="channel">Channel *</Label>
          <Select
            value={channel}
            onValueChange={(value) => setValue('channel', value as typeof channel)}
          >
            <SelectTrigger id="channel" className={errors.channel ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_CHANNELS.map((ch) => (
                <SelectItem key={ch} value={ch}>
                  {CUSTOMER_CHANNEL_LABELS[ch]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.channel && (
            <p className="text-sm text-destructive">{errors.channel.message}</p>
          )}
        </div>

        {/* Legal Name */}
        <div className="space-y-2 lg:col-span-1 md:col-span-2">
          <Label htmlFor="legalName">Legal Name</Label>
          <Input
            id="legalName"
            placeholder="Legal Entity Name (if different)"
            className={errors.legalName ? 'border-destructive' : ''}
            {...register('legalName')}
          />
          {errors.legalName ? (
            <p className="text-sm text-destructive">{errors.legalName.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Optional. Use if different from company name.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
