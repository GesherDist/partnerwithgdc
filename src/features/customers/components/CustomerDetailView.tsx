'use client';

/**
 * CustomerDetailView Component
 *
 * Full page view for customer details with tabs for Details, Contacts, and Documents.
 * Used in /customers/[id] page.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/stores';
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  Building2,
  FileText,
  Shield,
  Pencil,
  Trash2,
} from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
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
import { PageHeader } from '@/shared/components/layout/PageHeader';

import { formatCreditLimit, formatOpenBalance } from '../lib/schemas';
import { CustomerContactsList } from './CustomerContactsList';
import { EditCustomerDrawer } from './EditCustomerDrawer';
import { deleteCustomer } from '../actions';
import type { Customer } from '../types';
import { CustomerDocumentsTab } from '@/modules/customer-documents';
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_CHANNEL_LABELS,
  CREDIT_STATUS_LABELS,
  CREDIT_STATUS_COLORS,
} from '../types';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface CustomerDetailViewProps {
  customer: Customer;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value) {return null;}
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

// ============================================
// DETAILS TAB CONTENT
// ============================================

function CustomerDetailsTab({ customer }: { customer: Customer }) {
  const hasAddress = customer.address1 || customer.city || customer.state;
  const hasShippingAddress = customer.shippingAddress1 || customer.shippingCity || customer.shippingState;

  const formatAddress = (address: {
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  }) => {
    const lines = [
      address.address1,
      address.address2,
      [address.city, address.state, address.zip].filter(Boolean).join(', '),
      address.country,
    ].filter(Boolean);
    return lines;
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-8">
          {/* Row 1: Basic Info + Contact */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Customer Code" value={customer.customerCode} />
                <InfoItem label="Channel" value={CUSTOMER_CHANNEL_LABELS[customer.channel]} />
                <InfoItem label="Company Name" value={customer.name} />
                {customer.legalName && (
                  <InfoItem label="Legal Name" value={customer.legalName} />
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Phone" value={customer.phone} icon={<Phone className="h-4 w-4" />} />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <div className="text-sm font-medium text-foreground">
                    {CUSTOMER_STATUS_LABELS[customer.status]}
                  </div>
                </div>
                {customer.email && (
                  <InfoItem label="Email" value={customer.email} icon={<Mail className="h-4 w-4" />} />
                )}
                {customer.website && (
                  <InfoItem label="Website" value={customer.website} icon={<Globe className="h-4 w-4" />} />
                )}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Row 2: Addresses */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Addresses
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Billing Address */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Billing Address</div>
                {hasAddress ? (
                  <div className="text-sm space-y-0.5">
                    {formatAddress({
                      address1: customer.address1,
                      address2: customer.address2,
                      city: customer.city,
                      state: customer.state,
                      zip: customer.zip,
                      country: customer.country,
                    }).map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">No address provided</div>
                )}
              </div>

              {/* Shipping Address */}
              <div>
                <div className="text-xs text-muted-foreground mb-2">Shipping Address</div>
                {customer.useSeparateShipping && hasShippingAddress ? (
                  <div className="text-sm space-y-0.5">
                    {formatAddress({
                      address1: customer.shippingAddress1,
                      address2: customer.shippingAddress2,
                      city: customer.shippingCity,
                      state: customer.shippingState,
                      zip: customer.shippingZip,
                      country: customer.shippingCountry,
                    }).map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">Same as billing</div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Row 3: Credit & Tax */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Credit & Payment */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Credit & Payment
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Credit Status</div>
                  <Badge className={CREDIT_STATUS_COLORS[customer.creditStatus]}>
                    {CREDIT_STATUS_LABELS[customer.creditStatus]}
                  </Badge>
                </div>
                <InfoItem label="Credit Limit" value={formatCreditLimit(customer.creditLimit)} />
                <InfoItem label="Open Balance" value={formatOpenBalance(customer.openBalance)} />
                <InfoItem label="Payment Terms" value={customer.creditTerms || 'Net 30'} />
              </div>
            </div>

            {/* Tax Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Tax Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Tax ID" value={customer.taxId || '-'} />
                <InfoItem label="Tax Exempt" value={customer.taxExempt ? 'Yes' : 'No'} />
                {customer.taxExempt && (
                  <>
                    <InfoItem label="Certificate #" value={customer.taxExemptNumber || '-'} />
                    <InfoItem label="Expiry Date" value={customer.taxExemptExpiryAt || '-'} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          {customer.internalNotes && (
            <>
              <div className="border-t" />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Internal Notes
                </h3>
                <p className="text-sm whitespace-pre-wrap">{customer.internalNotes}</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CustomerDetailView({ customer: initialCustomer }: CustomerDetailViewProps) {
  const router = useRouter();
  const { hasPermission } = useAuthStore();
  const [customer, setCustomer] = useState(initialCustomer);
  const [activeTab, setActiveTab] = useState('details');
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canViewContacts = hasMounted && hasPermission('customers.view_contacts');
  const canViewDocuments = hasMounted && hasPermission('customers.view_documents');
  const canEdit = hasMounted && hasPermission('customers.edit');
  const canDelete = hasMounted && hasPermission('customers.delete');

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleBack = () => {
    router.push('/customers');
  };

  const handleEdit = () => {
    setEditDrawerOpen(true);
  };

  const handleEditSuccess = (updatedCustomer: Customer) => {
    setCustomer(updatedCustomer);
    setEditDrawerOpen(false);
    toast.success('Customer updated successfully');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteCustomer(customer.id);
      if (result.success) {
        toast.success('Customer deleted successfully');
        router.push('/customers');
      } else {
        toast.error(result.error || 'Failed to delete customer');
      }
    } catch {
      toast.error('Failed to delete customer');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <PageHeader
        title={customer.name}
        description={`Customer Code: ${customer.customerCode}`}
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={handleEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex-1 px-6 pb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full justify-start h-12 bg-transparent border-b rounded-none p-0 gap-6">
            <TabsTrigger
              value="details"
              className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-3 font-medium"
            >
              Details
            </TabsTrigger>
            {canViewContacts && (
              <TabsTrigger
                value="contacts"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-3 font-medium"
              >
                Contacts
              </TabsTrigger>
            )}
            {canViewDocuments && (
              <TabsTrigger
                value="documents"
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-3 font-medium"
              >
                Documents
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex-1 pt-6 overflow-auto">
            <TabsContent value="details" className="m-0 h-full">
              <CustomerDetailsTab customer={customer} />
            </TabsContent>

            {canViewContacts && (
              <TabsContent value="contacts" className="m-0 h-full">
                <CustomerContactsList customerId={customer.id} />
              </TabsContent>
            )}

            {canViewDocuments && (
              <TabsContent value="documents" className="m-0 h-full">
                <CustomerDocumentsTab customerId={customer.id} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      {/* Edit Drawer */}
      <EditCustomerDrawer
        customerId={editDrawerOpen ? customer.id : null}
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{customer.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
