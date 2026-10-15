'use client';

/**
 * Create Shipment from a Purchase Order
 *
 * Shipments are created automatically when a supplier confirms a PO. This
 * dialog covers POs that ended up without one: it lists them, creates the
 * shipment through the same logic, and hands the new shipment back so the
 * page can open it for editing (container number, vessel, dates).
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Button } from '@/shared/components/ui/button';
import {
  createShipmentFromPurchaseOrder,
  listPurchaseOrdersWithoutShipment,
  type PurchaseOrderWithoutShipment,
} from '../actions';

interface CreateShipmentFromPODialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (shipmentId: string) => void;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CreateShipmentFromPODialog({
  open,
  onClose,
  onCreated,
}: CreateShipmentFromPODialogProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderWithoutShipment[]>([]);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedPoId('');
    setIsLoading(true);
    listPurchaseOrdersWithoutShipment()
      .then((result) => {
        if (result.success) {
          setPurchaseOrders(result.data);
        } else {
          toast.error(result.error);
          setPurchaseOrders([]);
        }
      })
      .catch(() => toast.error('Failed to load purchase orders'))
      .finally(() => setIsLoading(false));
  }, [open]);

  const handleCreate = async () => {
    if (!selectedPoId) {
      return;
    }
    setIsCreating(true);
    try {
      const result = await createShipmentFromPurchaseOrder(selectedPoId);
      if (result.success) {
        toast.success(`Shipment ${result.shipmentNumber} created`, {
          description: 'Add the container number to start tracking.',
        });
        onCreated(result.shipmentId);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to create shipment');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isCreating && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Shipment</DialogTitle>
          <DialogDescription>
            Shipments are created automatically when the supplier confirms a PO. Pick a
            confirmed PO that has no shipment yet.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-2">Loading purchase orders...</p>
        ) : purchaseOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Every confirmed purchase order already has a shipment. Open the shipment to add its
            container number.
          </p>
        ) : (
          <Select value={selectedPoId} onValueChange={setSelectedPoId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a purchase order" />
            </SelectTrigger>
            <SelectContent>
              {purchaseOrders.map((po) => (
                <SelectItem key={po.id} value={po.id}>
                  {po.poNumber} · {formatStatus(po.status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!selectedPoId || isCreating}>
            {isCreating ? 'Creating...' : 'Create Shipment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
