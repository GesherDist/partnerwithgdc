'use client';

/**
 * CustomerStatusSection Component
 *
 * Section 6 of the Customer form.
 * Contains status and internal notes.
 */

import { useFormContext } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';

import type { CustomerFormInput } from '../lib/schemas';
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS } from '../types';

// ============================================
// COMPONENT
// ============================================

export function CustomerStatusSection() {
  const { register, formState: { errors }, watch, setValue } = useFormContext<CustomerFormInput>();

  const status = watch('status');

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Status & Notes
        </h3>
        <p className="text-sm text-muted-foreground">
          Customer status and internal notes.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Customer Status *</Label>
          <Select
            value={status}
            onValueChange={(value) => setValue('status', value as typeof status)}
          >
            <SelectTrigger id="status" className={errors.status ? 'border-destructive' : ''}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CUSTOMER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="text-sm text-destructive">{errors.status.message}</p>
          )}
        </div>

        {/* Internal Notes */}
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="internalNotes">Internal Notes</Label>
          <Textarea
            id="internalNotes"
            placeholder="Add any internal notes about this customer..."
            className={`min-h-[120px] resize-none ${errors.internalNotes ? 'border-destructive' : ''}`}
            {...register('internalNotes')}
          />
          {errors.internalNotes ? (
            <p className="text-sm text-destructive">{errors.internalNotes.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              These notes are for internal use only and not visible to the customer.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
