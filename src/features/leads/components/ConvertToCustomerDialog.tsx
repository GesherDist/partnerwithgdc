'use client';

/**
 * ConvertToCustomerDialog Component
 *
 * Dialog for converting a lead to a deal.
 * Customer is only created when the deal is marked as "won".
 *
 * Workflow:
 * Lead → Convert to Deal (status: open) → Mark as Won → Customer created
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Handshake, DollarSign } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

import { convertLeadToDeal } from '../actions';
import type { Lead, LeadListItem } from '../types';

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number, currency?: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================
// TYPES
// ============================================

interface ConvertToCustomerDialogProps {
  lead: Lead | LeadListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: (dealId: string) => void;
}

// ============================================
// COMPONENT
// ============================================

export function ConvertToCustomerDialog({
  lead,
  open,
  onClose,
  onSuccess,
}: ConvertToCustomerDialogProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isConverting, setIsConverting] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleConvert = async () => {
    if (!lead) return;

    setIsConverting(true);
    try {
      const result = await convertLeadToDeal(lead.id, {});

      if (result.success && result.data) {
        toast.success('Lead converted to deal successfully');
        onSuccess?.(result.data.dealId);
        handleOpenChange(false);
      } else {
        toast.error(result.error || 'Failed to convert lead');
      }
    } catch (error) {
      console.error('Convert lead error:', error);
      toast.error('Failed to convert lead');
    } finally {
      setIsConverting(false);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Convert Lead to Deal
          </DialogTitle>
          <DialogDescription>
            Convert this lead to a deal. The lead will be moved from the Leads
            Inbox to the Deals pipeline. Customer will only be created when the
            deal is marked as &quot;Won&quot;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lead Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-medium">{lead.name}</h4>
            {lead.company && (
              <p className="text-sm text-muted-foreground">{lead.company}</p>
            )}
            {lead.email && (
              <p className="text-sm text-muted-foreground">{lead.email}</p>
            )}
          </div>

          {/* Deal Info - shown if lead has deal value */}
          {'dealValue' in lead && (lead.dealValue || lead.dealTitle) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Handshake className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Deal will be created</span>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">Open</Badge>
              </div>
              {'dealTitle' in lead && lead.dealTitle && (
                <p className="text-sm text-blue-700">{lead.dealTitle}</p>
              )}
              {'dealValue' in lead && lead.dealValue && (
                <p className="text-lg font-bold text-blue-700 flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  {formatCurrency(lead.dealValue, 'dealCurrency' in lead ? lead.dealCurrency || 'USD' : 'USD')}
                </p>
              )}
            </div>
          )}

          {/* Workflow Info */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">
              <strong>Workflow:</strong> Lead → Deal (Open) → Mark as Won → Customer created
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isConverting}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={isConverting}>
            {isConverting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Handshake className="mr-2 h-4 w-4" />
                Convert to Deal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
