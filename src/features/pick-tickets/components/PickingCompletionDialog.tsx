'use client';

/**
 * PickingCompletionDialog Component
 *
 * Modal dialog shown when user selects 'picked' status.
 * Presents two clear options:
 * 1. Quick Ship (No Packing List) - Direct to shipped
 * 2. Create Packing List - Move to packing workflow
 */

import { useState } from 'react';
import { Truck, Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import { completePicking } from '../actions';
import { createPackingListFromPickTicket } from '../actions/packing-list.actions';

// ============================================
// TYPES
// ============================================

interface PickingCompletionDialogProps {
  open: boolean;
  onClose: () => void;
  pickTicketId: string;
  pickTicketNumber: string;
  onSuccess: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function PickingCompletionDialog({
  open,
  onClose,
  pickTicketId,
  pickTicketNumber,
  onSuccess,
}: PickingCompletionDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleQuickShip = async () => {
    setIsProcessing(true);
    try {
      const result = await completePicking(pickTicketId);

      if (result.success) {
        toast.success('Pick ticket completed and shipped successfully');
        onSuccess();
        onClose();
      } else {
        const errorMessage = 'error' in result ? result.error : 'Failed to complete picking';
        toast.error(errorMessage || 'Failed to complete picking');
      }
    } catch (error) {
      console.error('Quick ship error:', error);
      toast.error('Failed to complete picking');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePackingList = async () => {
    setIsProcessing(true);
    try {
      const result = await createPackingListFromPickTicket(pickTicketId);

      if (result.success) {
        toast.success('Packing list created successfully');
        onSuccess();
        onClose();
      } else {
        const errorMessage = 'error' in result ? result.error : 'Failed to create packing list';
        toast.error(errorMessage || 'Failed to create packing list');
      }
    } catch (error) {
      console.error('Create packing list error:', error);
      toast.error('Failed to create packing list');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isProcessing && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pick Ticket Completion</DialogTitle>
          <DialogDescription>
            All items for <strong>{pickTicketNumber}</strong> have been picked.
            <br />
            How would you like to proceed?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Quick Ship Option */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-auto p-0 hover:border-blue-500 hover:bg-blue-50"
            onClick={handleQuickShip}
            disabled={isProcessing}
          >
            <Card className="w-full border-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <Truck className="h-5 w-5 text-blue-600" />
                  </div>
                  <span className="text-left">Quick Ship (No Packing List)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground text-left">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Direct shipment - skip packing workflow</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Best for single/small orders</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Status will change to: <strong>Shipped</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Shipment record will be auto-created</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <span>Inventory will be automatically shipped</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Button>

          {/* Create Packing List Option */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-auto p-0 hover:border-purple-500 hover:bg-purple-50"
            onClick={handleCreatePackingList}
            disabled={isProcessing}
          >
            <Card className="w-full border-0 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                    <Package className="h-5 w-5 text-purple-600" />
                  </div>
                  <span className="text-left">Create Packing List</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2 text-sm text-muted-foreground text-left">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Track multiple packages/boxes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Record weights and package numbers</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Status will change to: <strong>Packing</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Pack items before final shipment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span>Best for large/complex orders</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </Button>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        </DialogFooter>

        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Processing...</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
