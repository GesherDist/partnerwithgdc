'use client';

/**
 * EditDealDialog Component
 *
 * Dialog for editing existing deals.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';

import { updateDeal } from '../actions';
import type { Deal } from '../types';

// ============================================
// TYPES
// ============================================

interface EditDealDialogProps {
  open: boolean;
  onClose: () => void;
  deal: Deal | null;
  onSuccess?: () => void;
}

interface FormState {
  title: string;
  value: string;
  currency: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  organizationName: string;
  organizationAddressStreet: string;
  organizationAddressCity: string;
  organizationAddressState: string;
  organizationAddressPostalCode: string;
  organizationAddressCountry: string;
  expectedCloseDate: string;
}

// ============================================
// COMPONENT
// ============================================

export function EditDealDialog({ open, onClose, deal, onSuccess }: EditDealDialogProps) {
  const [formState, setFormState] = useState<FormState>({
    title: '',
    value: '',
    currency: 'USD',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    organizationName: '',
    organizationAddressStreet: '',
    organizationAddressCity: '',
    organizationAddressState: '',
    organizationAddressPostalCode: '',
    organizationAddressCountry: '',
    expectedCloseDate: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when deal changes
  useEffect(() => {
    if (deal && open) {
      setFormState({
        title: deal.title ?? '',
        value: deal.value?.toString() ?? '',
        currency: deal.currency ?? 'USD',
        contactName: deal.contactName ?? '',
        contactEmail: deal.contactEmail ?? '',
        contactPhone: deal.contactPhone ?? '',
        organizationName: deal.organizationName ?? '',
        organizationAddressStreet: deal.organizationAddressStreet ?? '',
        organizationAddressCity: deal.organizationAddressCity ?? '',
        organizationAddressState: deal.organizationAddressState ?? '',
        organizationAddressPostalCode: deal.organizationAddressPostalCode ?? '',
        organizationAddressCountry: deal.organizationAddressCountry ?? '',
        expectedCloseDate: (deal.expectedCloseDate
          ? new Date(deal.expectedCloseDate).toISOString().split('T')[0]
          : '') as string,
      });
    }
  }, [deal, open]);

  const handleChange = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal) return;

    setIsSubmitting(true);
    try {
      const result = await updateDeal(deal.id, {
        title: formState.title,
        value: formState.value ? parseFloat(formState.value) : null,
        currency: formState.currency,
        contactName: formState.contactName || null,
        contactEmail: formState.contactEmail || null,
        contactPhone: formState.contactPhone || null,
        organizationName: formState.organizationName || null,
        organizationAddressStreet: formState.organizationAddressStreet || null,
        organizationAddressCity: formState.organizationAddressCity || null,
        organizationAddressState: formState.organizationAddressState || null,
        organizationAddressPostalCode: formState.organizationAddressPostalCode || null,
        organizationAddressCountry: formState.organizationAddressCountry || null,
        expectedCloseDate: formState.expectedCloseDate
          ? new Date(formState.expectedCloseDate)
          : null,
      });

      if (result.success) {
        toast.success('Deal updated successfully');
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to update deal');
      }
    } catch (error) {
      console.error('Update deal error:', error);
      toast.error('Failed to update deal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Deal</DialogTitle>
          <DialogDescription>
            Update the deal information below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Deal Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formState.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter deal title"
              required
            />
          </div>

          {/* Value & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Deal Value</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                value={formState.value || ''}
                onChange={(e) => handleChange('value', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={formState.currency || ''}
                onChange={(e) => handleChange('currency', e.target.value)}
                placeholder="USD"
                maxLength={3}
              />
            </div>
          </div>

          {/* Expected Close Date */}
          <div className="space-y-2">
            <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
            <Input
              id="expectedCloseDate"
              type="date"
              value={formState.expectedCloseDate || ''}
              onChange={(e) => handleChange('expectedCloseDate', e.target.value)}
            />
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Contact Information</h3>

            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={formState.contactName || ''}
                onChange={(e) => handleChange('contactName', e.target.value)}
                placeholder="Contact person name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formState.contactEmail || ''}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  placeholder="contact@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={formState.contactPhone || ''}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Organization */}
          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              value={formState.organizationName || ''}
              onChange={(e) => handleChange('organizationName', e.target.value)}
              placeholder="Company or organization name"
            />
          </div>

          {/* Organization Address */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Organization Address</h3>

            <div className="space-y-2">
              <Label htmlFor="organizationAddressStreet">Street Address</Label>
              <Input
                id="organizationAddressStreet"
                value={formState.organizationAddressStreet || ''}
                onChange={(e) => handleChange('organizationAddressStreet', e.target.value)}
                placeholder="Street address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organizationAddressCity">City</Label>
                <Input
                  id="organizationAddressCity"
                  value={formState.organizationAddressCity || ''}
                  onChange={(e) => handleChange('organizationAddressCity', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationAddressState">State</Label>
                <Input
                  id="organizationAddressState"
                  value={formState.organizationAddressState || ''}
                  onChange={(e) => handleChange('organizationAddressState', e.target.value)}
                  placeholder="State"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="organizationAddressPostalCode">Postal Code</Label>
                <Input
                  id="organizationAddressPostalCode"
                  value={formState.organizationAddressPostalCode || ''}
                  onChange={(e) => handleChange('organizationAddressPostalCode', e.target.value)}
                  placeholder="Postal code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organizationAddressCountry">Country</Label>
                <Input
                  id="organizationAddressCountry"
                  value={formState.organizationAddressCountry || ''}
                  onChange={(e) => handleChange('organizationAddressCountry', e.target.value)}
                  placeholder="Country"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formState.title}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Deal'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
