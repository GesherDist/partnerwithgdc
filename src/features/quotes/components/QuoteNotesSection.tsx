'use client';

/**
 * QuoteNotesSection Component
 *
 * Section 5 of the Quote form.
 * Contains customer notes, internal notes, and terms.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 */

import { memo } from 'react';
import { useFormContext } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';

import type { QuoteFormInput } from '../lib/schemas';

// ============================================
// COMPONENT
// ============================================

function QuoteNotesSectionComponent() {
  const { register, formState: { errors } } = useFormContext<QuoteFormInput>();

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Notes & Terms</h3>
        <p className="text-sm text-muted-foreground">
          Add notes and terms for this quote.
        </p>
      </div>

      <Separator />

      {/* Notes Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Customer Notes */}
        <div className="space-y-2">
          <Label htmlFor="customerNotes">Customer Notes</Label>
          <Textarea
            id="customerNotes"
            placeholder="Notes visible to customer on the quote..."
            className={`min-h-[120px] resize-none ${errors.customerNotes ? 'border-destructive' : ''}`}
            {...register('customerNotes')}
          />
          {errors.customerNotes ? (
            <p className="text-sm text-destructive">{errors.customerNotes.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              These notes will be visible to the customer.
            </p>
          )}
        </div>

        {/* Internal Notes */}
        <div className="space-y-2">
          <Label htmlFor="internalNotes">Internal Notes</Label>
          <Textarea
            id="internalNotes"
            placeholder="Internal notes (not visible to customer)..."
            className={`min-h-[120px] resize-none ${errors.internalNotes ? 'border-destructive' : ''}`}
            {...register('internalNotes')}
          />
          {errors.internalNotes ? (
            <p className="text-sm text-destructive">{errors.internalNotes.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              These notes are for internal use only.
            </p>
          )}
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="space-y-2">
        <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
        <Textarea
          id="termsAndConditions"
          placeholder="Enter terms and conditions for this quote..."
          className={`min-h-[100px] resize-none ${errors.termsAndConditions ? 'border-destructive' : ''}`}
          {...register('termsAndConditions')}
        />
        {errors.termsAndConditions && (
          <p className="text-sm text-destructive">{errors.termsAndConditions.message}</p>
        )}
      </div>
    </div>
  );
}

// Export memoized component
export const QuoteNotesSection = memo(QuoteNotesSectionComponent);
