'use client';

/**
 * EditLeadDialog Component
 *
 * Dialog for editing existing leads with Pipedrive sync.
 */

import { useState, useTransition, useEffect } from 'react';
import { Loader2, Pencil } from 'lucide-react';
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

import { updateLead } from '../actions';
import { getPipedriveLeadLabels } from '@/features/pipedrive/actions';
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type Lead,
  type LeadStatus,
} from '../types';

// ============================================
// TYPES
// ============================================

interface EditLeadDialogProps {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
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

// ============================================
// COMPONENT
// ============================================

export function EditLeadDialog({ open, onClose, lead, onSuccess }: EditLeadDialogProps) {
  const [formState, setFormState] = useState<FormState>({
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
  });
  const [isPending, startTransition] = useTransition();
  const [availableLabels, setAvailableLabels] = useState<PipedriveLabel[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Populate form when lead changes
  useEffect(() => {
    if (lead && open) {
      setFormState({
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        company: lead.company || '',
        addressStreet: lead.addressStreet || '',
        addressCity: lead.addressCity || '',
        addressState: lead.addressState || '',
        addressPostalCode: lead.addressPostalCode || '',
        addressCountry: lead.addressCountry || 'US',
        dealTitle: lead.dealTitle || '',
        dealValue: lead.dealValue?.toString() || '',
        status: lead.status,
        notes: lead.notes || '',
        selectedLabelIds: [], // Will be populated after labels are fetched
      });
    }
  }, [lead, open]);

  // Fetch labels when dialog opens
  useEffect(() => {
    if (open) {
      setLabelsLoading(true);
      getPipedriveLeadLabels()
        .then((result) => {
          if (result.success && result.data) {
            setAvailableLabels(result.data.labels);
            // Match current lead labels with available labels
            if (lead?.pipedriveLabels && result.data.labels.length > 0) {
              const matchedIds = result.data.labels
                .filter((l) => lead.pipedriveLabels?.includes(l.name))
                .map((l) => l.id);
              setFormState((prev) => ({
                ...prev,
                selectedLabelIds: matchedIds,
              }));
            }
          }
        })
        .catch((error) => {
          console.error('Failed to fetch labels:', error);
        })
        .finally(() => {
          setLabelsLoading(false);
        });
    }
  }, [open, lead]);

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
    if (!lead) {
      console.error('[EditLeadDialog] No lead provided');
      return;
    }

    if (!formState.name.trim()) {
      toast.error('Name is required');
      return;
    }

    console.log('[EditLeadDialog] Submitting update for lead:', lead.id);
    console.log('[EditLeadDialog] Form state:', JSON.stringify(formState, null, 2));

    startTransition(async () => {
      const result = await updateLead(lead.id, {
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
      }, formState.selectedLabelIds.length > 0 ? formState.selectedLabelIds : undefined);

      console.log('[EditLeadDialog] Update result:', result);

      if (result.success) {
        console.log('[EditLeadDialog] Update successful, updated lead:', result.data);
        toast.success('Lead updated successfully');
        onSuccess?.();
        onClose();
      } else {
        console.error('[EditLeadDialog] Update failed:', result.error);
        toast.error('Failed to update lead', {
          description: result.error,
        });
      }
    });
  };

  const handleClose = () => {
    onClose();
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Lead
          </DialogTitle>
          <DialogDescription>
            Update lead information. Changes will sync to Pipedrive.
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
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="John Doe"
                  value={formState.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-company">Company</Label>
                <Input
                  id="edit-company"
                  placeholder="Acme Inc."
                  value={formState.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="john@example.com"
                    value={formState.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
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
                <Label htmlFor="edit-addressStreet">Street</Label>
                <Input
                  id="edit-addressStreet"
                  placeholder="123 Main St"
                  value={formState.addressStreet}
                  onChange={(e) => handleChange('addressStreet', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-addressCity">City</Label>
                  <Input
                    id="edit-addressCity"
                    placeholder="New York"
                    value={formState.addressCity}
                    onChange={(e) => handleChange('addressCity', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-addressState">State</Label>
                  <Input
                    id="edit-addressState"
                    placeholder="NY"
                    value={formState.addressState}
                    onChange={(e) => handleChange('addressState', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-addressPostalCode">Postal Code</Label>
                  <Input
                    id="edit-addressPostalCode"
                    placeholder="10001"
                    value={formState.addressPostalCode}
                    onChange={(e) => handleChange('addressPostalCode', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-addressCountry">Country</Label>
                  <Input
                    id="edit-addressCountry"
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
                  <Label htmlFor="edit-dealTitle">Deal Title</Label>
                  <Input
                    id="edit-dealTitle"
                    placeholder="Tire order Q4 2025"
                    value={formState.dealTitle}
                    onChange={(e) => handleChange('dealTitle', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dealValue">Deal Value ($)</Label>
                  <Input
                    id="edit-dealValue"
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
                            id={`edit-label-${label.id}`}
                            checked={formState.selectedLabelIds.includes(label.id)}
                            onCheckedChange={() => handleLabelToggle(label.id)}
                          />
                          <label
                            htmlFor={`edit-label-${label.id}`}
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
                <Label htmlFor="edit-notes">Internal Notes</Label>
                <Textarea
                  id="edit-notes"
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
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
