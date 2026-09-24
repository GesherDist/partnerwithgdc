'use client';

/**
 * View Supplier Drawer
 *
 * Displays full supplier details in a sheet drawer (similar to ViewQuoteDrawer).
 */

import { useState, useEffect } from 'react';
import { Building2, User, MapPin, Settings, Plus } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { formatDate, cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores';
import { toast } from 'sonner';
import type { Supplier } from '../types';
import {
  SupplierContactsTable,
  CreateSupplierContactDialog,
  EditSupplierContactDialog,
} from '@/features/supplier-contacts/components';
import {
  getSupplierContactsAction,
  deleteSupplierContactAction,
} from '@/features/supplier-contacts/actions';
import type {
  SupplierContact,
  SupplierContactListItem,
} from '@/features/supplier-contacts/types';

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const displayValue = value && value !== '-' ? value : <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{displayValue}</p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

function AddressDisplay({
  address,
}: {
  address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
}) {
  const hasAddress = address.street || address.city || address.state;

  const lines = hasAddress
    ? [
        address.street,
        [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
        address.country,
      ].filter(Boolean)
    : [];

  return (
    <div className="flex items-start gap-3">
      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">Address</p>
        {lines.length > 0 ? (
          lines.map((line, i) => (
            <p key={i} className="text-sm font-medium text-foreground">
              {line}
            </p>
          ))
        ) : (
          <p className="text-sm font-medium text-muted-foreground">-</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// STATUS BADGE
// ============================================

function getStatusBadge(status: string) {
  const configs: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-green-100 text-green-700 border-green-200' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-700 border-gray-200' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  const config = configs[status] || configs.active;

  if (!config) {
    return null;
  }

  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ViewSupplierDrawerProps {
  supplier: Supplier | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
}

export function ViewSupplierDrawer({
  supplier,
  open,
  onClose,
  onEdit,
  onDelete,
}: ViewSupplierDrawerProps) {
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('suppliers.edit');
  const canDelete = hasPermission('suppliers.delete');

  // State
  const [activeTab, setActiveTab] = useState('details');
  const [contacts, setContacts] = useState<SupplierContactListItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [isCreateContactDialogOpen, setIsCreateContactDialogOpen] = useState(false);
  const [isEditContactDialogOpen, setIsEditContactDialogOpen] = useState(false);
  const [isDeleteContactDialogOpen, setIsDeleteContactDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SupplierContact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<SupplierContactListItem | null>(null);

  // Fetch contacts when supplier changes or tab is switched to contacts
  useEffect(() => {
    if (supplier && activeTab === 'contacts') {
      fetchContacts();
    }
  }, [supplier, activeTab]);

  const fetchContacts = async () => {
    if (!supplier) return;

    setLoadingContacts(true);
    try {
      const result = await getSupplierContactsAction(supplier.id);
      if (result.success && result.data) {
        setContacts(result.data);
      } else {
        toast.error(result.error || 'Failed to fetch contacts');
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleCreateContact = () => {
    setIsCreateContactDialogOpen(true);
  };

  const handleCreateContactSuccess = () => {
    fetchContacts();
  };

  const handleEditContact = (contact: SupplierContactListItem) => {
    // Fetch full contact details
    const fullContact: SupplierContact = {
      ...contact,
      fax: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: null,
      updatedBy: null,
      deletedAt: null,
    };
    setSelectedContact(fullContact);
    setIsEditContactDialogOpen(true);
  };

  const handleEditContactSuccess = () => {
    fetchContacts();
  };

  const handleDeleteContact = (contact: SupplierContactListItem) => {
    setContactToDelete(contact);
    setIsDeleteContactDialogOpen(true);
  };

  const handleConfirmDeleteContact = async () => {
    if (!contactToDelete) return;

    try {
      const result = await deleteSupplierContactAction(contactToDelete.id);
      if (result.success) {
        toast.success(`${contactToDelete.fullName} has been deleted successfully.`);
        fetchContacts();
      } else {
        toast.error(result.error || 'Failed to delete contact');
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsDeleteContactDialogOpen(false);
      setContactToDelete(null);
    }
  };

  if (!supplier) {
    return null;
  }

  const handleEdit = () => {
    onEdit?.(supplier);
  };

  const handleDelete = () => {
    onDelete?.(supplier);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 bg-background sm:max-w-[700px] md:max-w-[850px] lg:max-w-[950px]"
        >
          {/* Header */}
          <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-xl font-semibold">{supplier.name}</SheetTitle>
            <SheetDescription>{supplier.supplierCode}</SheetDescription>
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
            <div className="flex-shrink-0 border-b px-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
              </TabsList>
            </div>

            {/* Details Tab */}
            <TabsContent value="details" className="m-0 flex-1 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="px-6 py-6">
                  <div className="space-y-4">
                    {/* Status Badge & Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">{getStatusBadge(supplier.status)}</div>
                      <div className="flex items-center gap-2">
                        {canEdit && onEdit && (
                          <Button variant="outline" size="sm" onClick={handleEdit}>
                            Edit
                          </Button>
                        )}
                        {canDelete && onDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDelete}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Company Information */}
                    <Section title="Company Information">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoItem
                          label="Company Name"
                          value={supplier.name}
                          icon={<Building2 className="h-4 w-4" />}
                        />
                        <InfoItem label="Legal Name" value={supplier.legalName} />
                        <InfoItem label="Supplier Code" value={supplier.supplierCode} />
                        <InfoItem label="Tax ID" value={supplier.taxId} />
                      </div>
                    </Section>

                    {/* Primary Contact */}
                    <Section title="Primary Contact">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoItem
                          label="Name"
                          value={supplier.primaryContactName}
                          icon={<User className="h-4 w-4" />}
                        />
                        <InfoItem label="Email" value={supplier.primaryContactEmail} />
                        <InfoItem label="Phone" value={supplier.primaryContactPhone} />
                      </div>
                    </Section>

                    {/* Address */}
                    {(supplier.addressStreet ||
                      supplier.addressCity ||
                      supplier.addressState ||
                      supplier.addressPostalCode) && (
                      <Section title="Address">
                        <AddressDisplay
                          address={{
                            street: supplier.addressStreet,
                            city: supplier.addressCity,
                            state: supplier.addressState,
                            postalCode: supplier.addressPostalCode,
                            country: supplier.addressCountry,
                          }}
                        />
                      </Section>
                    )}

                    {/* Business Details */}
                    <Section title="Business Details">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoItem
                          label="Payment Terms"
                          value={supplier.paymentTerms}
                          icon={<Settings className="h-4 w-4" />}
                        />
                        <InfoItem label="Currency" value={supplier.currencyCode} />
                      </div>
                    </Section>

                    {/* Notes */}
                    {supplier.notes && (
                      <Section title="Notes">
                        <div className="bg-muted/50 rounded-md p-3">
                          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                            {supplier.notes}
                          </p>
                        </div>
                      </Section>
                    )}

                    {/* Audit Information */}
                    <Section title="Audit Information">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoItem label="Created" value={formatDate(supplier.createdAt)} />
                        <InfoItem label="Last Updated" value={formatDate(supplier.updatedAt)} />
                      </div>
                    </Section>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts" className="m-0 flex-1 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="px-6 py-6">
                  <div className="space-y-4">
                    {/* Header with Add Contact Button */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Supplier Contacts</h3>
                        <p className="text-sm text-muted-foreground">
                          Manage contacts for {supplier.name}
                        </p>
                      </div>
                      {canEdit && (
                        <Button size="sm" onClick={handleCreateContact}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Contact
                        </Button>
                      )}
                    </div>

                    {/* Contacts Table */}
                    <SupplierContactsTable
                      contacts={contacts}
                      loading={loadingContacts}
                      onEdit={canEdit ? handleEditContact : undefined}
                      onDelete={canEdit ? handleDeleteContact : undefined}
                    />
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Create Contact Dialog */}
      {supplier && (
        <CreateSupplierContactDialog
          supplierId={supplier.id}
          open={isCreateContactDialogOpen}
          onClose={() => setIsCreateContactDialogOpen(false)}
          onSuccess={handleCreateContactSuccess}
        />
      )}

      {/* Edit Contact Dialog */}
      <EditSupplierContactDialog
        contact={selectedContact}
        open={isEditContactDialogOpen}
        onClose={() => {
          setIsEditContactDialogOpen(false);
          setSelectedContact(null);
        }}
        onSuccess={handleEditContactSuccess}
      />

      {/* Delete Contact Confirmation */}
      <AlertDialog
        open={isDeleteContactDialogOpen}
        onOpenChange={setIsDeleteContactDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contactToDelete?.fullName}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteContactDialogOpen(false);
                setContactToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteContact} className="bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
