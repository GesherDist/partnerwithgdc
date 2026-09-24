'use client';

/**
 * Shipment Update Form
 *
 * Form for supplier to update shipment details.
 */

import { useState, useTransition } from 'react';
import { Truck, Calendar, Loader2, Ship, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'sonner';
import { updateShipmentAction } from '../actions';
import type { SupplierShipment } from '../types';

interface ShipmentUpdateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: SupplierShipment;
}

export function ShipmentUpdateForm({
  open,
  onOpenChange,
  shipment,
}: ShipmentUpdateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    containerNumber: shipment.containerNumber || '',
    billOfLading: shipment.billOfLading || '',
    vesselName: shipment.vesselName || '',
    portOfLoading: shipment.portOfLoading || '',
    portOfDischarge: shipment.portOfDischarge || '',
    etd: shipment.etd?.split('T')[0] || '',
    etaPort: shipment.etaPort?.split('T')[0] || '',
    etaCustomer: shipment.etaCustomer?.split('T')[0] || '',
    notes: shipment.notes || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updateShipmentAction({
        shipmentId: shipment.id,
        containerNumber: formData.containerNumber || undefined,
        billOfLading: formData.billOfLading || undefined,
        vesselName: formData.vesselName || undefined,
        portOfLoading: formData.portOfLoading || undefined,
        portOfDischarge: formData.portOfDischarge || undefined,
        etd: formData.etd || undefined,
        etaPort: formData.etaPort || undefined,
        etaCustomer: formData.etaCustomer || undefined,
        notes: formData.notes || undefined,
      });

      if (result.success) {
        toast.success('Shipment Updated', {
          description: 'Shipment details have been updated successfully.',
        });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error('Error', {
          description: result.error || 'Failed to update shipment.',
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            Update Shipment Details
          </DialogTitle>
          <DialogDescription>
            Update shipping information for {shipment.shipmentNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Container & BL Section */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Ship className="h-4 w-4" />
              Shipping Details
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="containerNumber">Container Number</Label>
                <Input
                  id="containerNumber"
                  value={formData.containerNumber}
                  onChange={(e) => handleChange('containerNumber', e.target.value)}
                  placeholder="e.g., ABCD1234567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billOfLading">Bill of Lading</Label>
                <Input
                  id="billOfLading"
                  value={formData.billOfLading}
                  onChange={(e) => handleChange('billOfLading', e.target.value)}
                  placeholder="e.g., BL123456789"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vesselName">Vessel Name</Label>
                <Input
                  id="vesselName"
                  value={formData.vesselName}
                  onChange={(e) => handleChange('vesselName', e.target.value)}
                  placeholder="e.g., MSC OSCAR"
                />
              </div>
            </div>
          </div>

          {/* Ports Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Ports</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="portOfLoading">Port of Loading</Label>
                <Input
                  id="portOfLoading"
                  value={formData.portOfLoading}
                  onChange={(e) => handleChange('portOfLoading', e.target.value)}
                  placeholder="e.g., Shanghai, CN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portOfDischarge">Port of Discharge</Label>
                <Input
                  id="portOfDischarge"
                  value={formData.portOfDischarge}
                  onChange={(e) => handleChange('portOfDischarge', e.target.value)}
                  placeholder="e.g., Los Angeles, US"
                />
              </div>
            </div>
          </div>

          {/* Dates Section */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Estimated Dates
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="etd">ETD (Departure)</Label>
                <Input
                  id="etd"
                  type="date"
                  value={formData.etd}
                  onChange={(e) => handleChange('etd', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etaPort">ETA Port</Label>
                <Input
                  id="etaPort"
                  type="date"
                  value={formData.etaPort}
                  onChange={(e) => handleChange('etaPort', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="etaCustomer">ETA Customer</Label>
                <Input
                  id="etaCustomer"
                  type="date"
                  value={formData.etaCustomer}
                  onChange={(e) => handleChange('etaCustomer', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Notes
            </h4>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional shipping notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Shipment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
