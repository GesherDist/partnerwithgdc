'use client';

/**
 * NotesSection Component
 *
 * Section 5 of the Sales Order form.
 * Contains customer notes and internal notes fields.
 * Uses react-hook-form context for form state management.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 */

import { memo } from 'react';
import { useFormContext } from 'react-hook-form';

import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';

import type { SalesOrderFormInput } from '../lib/schemas';

// ============================================
// COMPONENT
// ============================================

function NotesSectionComponent() {
  const { register } = useFormContext<SalesOrderFormInput>();

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">Notes</h3>
        <p className="text-sm text-muted-foreground">
          Add notes for the customer or internal use.
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
            placeholder="Notes visible to the customer (e.g., special delivery instructions)"
            rows={4}
            className="resize-none"
            {...register('customerNotes')}
          />
          <p className="text-xs text-muted-foreground">
            These notes will be visible on customer-facing documents.
          </p>
        </div>

        {/* Internal Notes */}
        <div className="space-y-2">
          <Label htmlFor="internalNotes">Internal Notes</Label>
          <Textarea
            id="internalNotes"
            placeholder="Internal notes (not visible to customer)"
            rows={4}
            className="resize-none"
            {...register('internalNotes')}
          />
          <p className="text-xs text-muted-foreground">
            For internal use only. Not printed on customer documents.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export memoized component
export const NotesSection = memo(NotesSectionComponent);
