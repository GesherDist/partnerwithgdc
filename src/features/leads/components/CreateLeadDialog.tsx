'use client';

/**
 * CreateLeadDialog Component
 *
 * Dialog for manually creating new leads.
 */

import { useState, useTransition, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { createLead } from '../actions';
import { getPipedriveLeadLabels } from '@/features/pipedrive/actions';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from '../types';

// ============================================
// TYPES
// ============================================

interface CreateLeadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ============================================
// FORM STATE
// ============================================

interface PipedriveLabel {
  id: string;
  name: string;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  company: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  dealTitle: string;
  dealValue: string;
  status: LeadStatus;
  notes: string;
  selectedLabelIds: string[];
}

const initialFormState: FormState = {
  name: '',
  email: '',
  phone: '',
  company: '',
  addressStreet: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
  addressCountry: 'US',
  dealTitle: '',
  dealValue: '',
  status: 'new',
  notes: '',
  selectedLabelIds: [],
};

// ============================================
// COMPONENT
// ============================================

export function CreateLeadDialog({ open, onClose, onSuccess }: CreateLeadDialogProps) {
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [isPending, startTransition] = useTransition();
  const [availableLabels, setAvailableLabels] = useState<PipedriveLabel[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Fetch labels when dialog opens
  useEffect(() => {
    if (open) {
      setLabelsLoading(true);
      getPipedriveLeadLabels()
        .then((result) => {
          if (result.success && result.data) {
            setAvailableLabels(result.data.labels);
          }
        })
        .catch((error) => {
          console.error('Failed to fetch labels:', error);
        })
        .finally(() => {
          setLabelsLoading(false);
        });
    }
  }, [open]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleLabelToggle = (labelId: string) => {
    setFormState((prev) => {
      const isSelected = prev.selectedLabelIds.includes(labelId);
      return {
        ...prev,
        selectedLabelIds: isSelected
          ? prev.selectedLabelIds.filter((id) => id !== labelId)
          : [...prev.selectedLabelIds, labelId],
      };
    });
  };

  const handleSubmit = () => {
    if (!formState.name.trim()) {
      toast.error('Name is required');
      return;
    }

    startTransition(async () => {
      const result = await createLead({
        name: formState.name.trim(),
        email: formState.email.trim() || null,
        phone: formState.phone.trim() || null,
        company: formState.company.trim() || null,
        addressStreet: formState.addressStreet.trim() || null,
        addressCity: formState.addressCity.trim() || null,
        addressState: formState.addressState.trim() || null,
        addressPostalCode: formState.addressPostalCode.trim() || null,
        addressCountry: formState.addressCountry.trim() || null,
        dealTitle: formState.dealTitle.trim() || null,
        dealValue: formState.dealValue ? parseFloat(formState.dealValue) : null,
        status: formState.status,
        notes: formState.notes.trim() || null,
        pipedriveLabels: formState.selectedLabelIds.length > 0 ? formState.selectedLabelIds : null,
      });

      if (result.success) {
        toast.success('Lead created successfully');
        setFormState(initialFormState);
        onSuccess?.();
        onClose();
      } else {
        toast.error('Failed to create lead', {
          description: result.error,
        });
      }
    });
  };

  const handleClose = () => {
    setFormState(initialFormState);
    onClose();
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Create a new lead manually. You can also sync leads from Pipedrive.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Contact Information
              </h3>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formState.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Acme Inc."
                  value={formState.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formState.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+1 (555) 123-4567"
                    value={formState.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Address
              </h3>

              <div className="space-y-2">
                <Label htmlFor="addressStreet">Street</Label>
                <Input
                  id="addressStreet"
                  placeholder="123 Main St"
                  value={formState.addressStreet}
                  onChange={(e) => handleChange('addressStreet', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addressCity">City</Label>
                  <Input
                    id="addressCity"
                    placeholder="New York"
                    value={formState.addressCity}
                    onChange={(e) => handleChange('addressCity', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressState">State</Label>
                  <Input
                    id="addressState"
                    placeholder="NY"
                    value={formState.addressState}
                    onChange={(e) => handleChange('addressState', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addressPostalCode">Postal Code</Label>
                  <Input
                    id="addressPostalCode"
                    placeholder="10001"
                    value={formState.addressPostalCode}
                    onChange={(e) => handleChange('addressPostalCode', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressCountry">Country</Label>
                  <Input
                    id="addressCountry"
                    placeholder="US"
                    value={formState.addressCountry}
                    onChange={(e) => handleChange('addressCountry', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Deal Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Deal Information
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dealTitle">Deal Title</Label>
                  <Input
                    id="dealTitle"
                    placeholder="Tire order Q4 2025"
                    value={formState.dealTitle}
                    onChange={(e) => handleChange('dealTitle', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dealValue">Deal Value ($)</Label>
                  <Input
                    id="dealValue"
                    type="number"
                    placeholder="10000"
                    value={formState.dealValue}
                    onChange={(e) => handleChange('dealValue', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Status & Labels */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Classification
              </h3>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formState.status}
                  onValueChange={(value) => handleChange('status', value as LeadStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.filter((s) => s !== 'converted').map((status) => (
                      <SelectItem key={status} value={status}>
                        {LEAD_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Pipedrive Labels */}
              {availableLabels.length > 0 && (
                <div className="space-y-2">
                  <Label>Labels (Pipedrive)</Label>
                  <div className="flex flex-wrap gap-3 p-3 border rounded-md bg-muted/30">
                    {labelsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading labels...
                      </div>
                    ) : (
                      availableLabels.map((label) => (
                        <div key={label.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`label-${label.id}`}
                            checked={formState.selectedLabelIds.includes(label.id)}
                            onCheckedChange={() => handleLabelToggle(label.id)}
                          />
                          <label
                            htmlFor={`label-${label.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {label.name}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Notes
              </h3>

              <div className="space-y-2">
                <Label htmlFor="notes">Internal Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any additional notes about this lead..."
                  rows={3}
                  value={formState.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
