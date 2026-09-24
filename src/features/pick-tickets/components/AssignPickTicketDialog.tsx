'use client';

/**
 * AssignPickTicketDialog Component
 *
 * Dialog to assign a pick ticket to a warehouse worker.
 */

import { useState, useEffect } from 'react';
import { Loader2, User } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
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
import { Label } from '@/shared/components/ui/label';

import { assignPickTicket } from '../actions';
import { getActiveLocations } from '@/features/locations/actions';
import { getActiveLocationContacts } from '@/features/locations/actions/location-contacts';
import type { PickTicketListItem } from '../types';

// ============================================
// TYPES
// ============================================

interface AssignPickTicketDialogProps {
  pickTicket: PickTicketListItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
}

interface ContactOption {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

// ============================================
// COMPONENT
// ============================================

export function AssignPickTicketDialog({
  pickTicket,
  open,
  onClose,
  onSuccess,
}: AssignPickTicketDialogProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch locations when dialog opens
  useEffect(() => {
    if (open) {
      fetchLocations();
      // Pre-select pick ticket's warehouse if exists
      if (pickTicket?.warehouseId) {
        setSelectedWarehouseId(pickTicket.warehouseId);
      }
      // Pre-select assigned contact if exists
      if (pickTicket?.assignedContactId) {
        setSelectedContactId(pickTicket.assignedContactId);
      }
    }
  }, [open, pickTicket?.warehouseId, pickTicket?.assignedContactId]);

  // Fetch contacts when warehouse changes
  useEffect(() => {
    if (selectedWarehouseId) {
      fetchLocationContacts(selectedWarehouseId);
    } else {
      setContacts([]);
      setSelectedContactId('');
    }
  }, [selectedWarehouseId]);

  const fetchLocations = async () => {
    setIsLoadingLocations(true);
    try {
      const result = await getActiveLocations();
      if (result.success && result.data) {
        const locationOptions = result.data
          .filter((loc) => loc.locationType === 'warehouse')
          .map((loc) => ({
            id: loc.id,
            name: loc.name,
            code: loc.locationCode,
          }));
        setLocations(locationOptions);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      toast.error('Failed to load warehouses');
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const fetchLocationContacts = async (warehouseId: string) => {
    setIsLoadingContacts(true);
    try {
      const result = await getActiveLocationContacts(warehouseId);
      if (result.success && result.data) {
        const contactOptions = result.data.map((contact) => ({
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
        }));
        setContacts(contactOptions);
      } else {
        setContacts([]);
      }
    } catch (error) {
      console.error('Failed to fetch location contacts:', error);
      toast.error('Failed to load warehouse contacts');
      setContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleAssign = async () => {
    if (!pickTicket || !selectedWarehouseId || !selectedContactId) {
      return;
    }

    setIsAssigning(true);
    const isReassign = !!pickTicket.assignedContactId;
    try {
      const result = await assignPickTicket(pickTicket.id, selectedWarehouseId, selectedContactId);
      if (result.success) {
        const assignedContact = contacts.find(c => c.id === selectedContactId);
        toast.success(
          `${isReassign ? 'Reassigned' : 'Assigned'} ${pickTicket.pickTicketNumber} to ${assignedContact?.name}`
        );
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || `Failed to ${isReassign ? 'reassign' : 'assign'} pick ticket`);
      }
    } catch (error) {
      console.error('Failed to assign pick ticket:', error);
      toast.error(`Failed to ${isReassign ? 'reassign' : 'assign'} pick ticket`);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    setSelectedWarehouseId('');
    setSelectedContactId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {pickTicket?.assignedContactId ? 'Reassign Pick Ticket' : 'Assign Pick Ticket'}
          </DialogTitle>
          <DialogDescription>
            {pickTicket?.assignedContactId ? 'Reassign' : 'Assign'}{' '}
            <span className="font-semibold">{pickTicket?.pickTicketNumber}</span> to a
            warehouse worker for picking.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Warehouse Dropdown */}
          <div>
            <Label htmlFor="warehouse">Warehouse</Label>
            {isLoadingLocations ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select warehouse..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Contact Dropdown */}
          <div>
            <Label htmlFor="contact">Assign To</Label>
            {isLoadingContacts ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select
                value={selectedContactId}
                onValueChange={setSelectedContactId}
                disabled={!selectedWarehouseId}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={
                    !selectedWarehouseId
                      ? "Select warehouse first..."
                      : contacts.length === 0
                      ? "No contacts available"
                      : "Select contact..."
                  } />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.name}
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({contact.email})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isAssigning || !selectedWarehouseId || !selectedContactId}>
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pickTicket?.assignedContactId ? 'Reassign' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
