'use client';

/**
 * ViewCustomerDrawer Component
 *
 * Drawer to view customer details with tabs for Details, Contacts, and Documents.
 * Fetches full customer data when opened.
 */

import { useEffect, useState, useTransition } from 'react';
import { Loader2, Mail, Phone, Globe, MapPin, CreditCard, Building2, FileText, Calendar, Shield, Link2, Unlink, RefreshCw } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';

import { getCustomer } from '../actions';
import { formatCreditLimit } from '../lib/schemas';
import { CustomerContactsList } from './CustomerContactsList';
import { pushCustomerLTVToPipedrive } from '@/features/pipedrive/actions';
import type { Customer } from '../types';
import { toast } from 'sonner';
import {
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_COLORS,
  CUSTOMER_CHANNEL_LABELS,
  CUSTOMER_CHANNEL_COLORS,
  CREDIT_STATUS_LABELS,
  CREDIT_STATUS_COLORS,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ViewCustomerDrawerProps {
  customerId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (customer: Customer) => void;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value) {return null;}
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function AddressCard({ label, address, icon }: {
  label: string;
  icon?: React.ReactNode;
  address: {
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
  }
}) {
  const hasAddress = address.address1 || address.city || address.state;
  if (!hasAddress) {return null;}

  const lines = [
    address.address1,
    address.address2,
    [address.city, address.state, address.zip].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {lines.map((line, i) => (
          <p key={i} className="text-sm font-medium text-foreground">{line}</p>
        ))}
      </div>
    </div>
  );
}

// ============================================
// DETAILS TAB CONTENT
// ============================================

function CustomerDetailsTab({ customer }: { customer: Customer }) {
  const [isPushingLTV, startPushLTV] = useTransition();

  const isPipedriveLinked = Boolean(
    customer.pipedrivePersonId || customer.pipedriveDealId || customer.pipedriveOrgId
  );

  const handlePushLTV = () => {
    startPushLTV(async () => {
      const result = await pushCustomerLTVToPipedrive(customer.id);
      if (result.success && result.data) {
        toast.success('LTV synced to Pipedrive', {
          description: `Revenue: $${result.data.ltv.totalRevenue.toLocaleString()} | Orders: ${result.data.ltv.orderCount}`,
        });
      } else {
        toast.error('Failed to sync LTV', {
          description: result.error || 'Unknown error',
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Status Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge className={CUSTOMER_STATUS_COLORS[customer.status]}>
          {CUSTOMER_STATUS_LABELS[customer.status]}
        </Badge>
        <Badge className={CUSTOMER_CHANNEL_COLORS[customer.channel]}>
          {CUSTOMER_CHANNEL_LABELS[customer.channel]}
        </Badge>
        <Badge className={CREDIT_STATUS_COLORS[customer.creditStatus]}>
          {CREDIT_STATUS_LABELS[customer.creditStatus]}
        </Badge>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        <div className="grid grid-cols-2 gap-4">
          <InfoItem
            label="Customer Code"
            value={customer.customerCode}
            icon={<Building2 className="h-4 w-4" />}
          />
          <InfoItem
            label="Channel"
            value={CUSTOMER_CHANNEL_LABELS[customer.channel]}
            icon={<FileText className="h-4 w-4" />}
          />
          <InfoItem
            label="Company Name"
            value={customer.name}
            icon={<Building2 className="h-4 w-4" />}
          />
          {customer.legalName && (
            <InfoItem
              label="Legal Name"
              value={customer.legalName}
              icon={<FileText className="h-4 w-4" />}
            />
          )}
        </div>
      </Section>

      {/* Contact Info */}
      <Section title="Contact Information">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InfoItem
            label="Email"
            value={customer.email}
            icon={<Mail className="h-4 w-4" />}
          />
          <InfoItem
            label="Phone"
            value={customer.phone}
            icon={<Phone className="h-4 w-4" />}
          />
          <InfoItem
            label="Website"
            value={customer.website}
            icon={<Globe className="h-4 w-4" />}
          />
        </div>
      </Section>

      {/* Addresses */}
      <Section title="Addresses">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AddressCard
            label="Billing Address"
            icon={<MapPin className="h-4 w-4" />}
            address={{
              address1: customer.address1,
              address2: customer.address2,
              city: customer.city,
              state: customer.state,
              zip: customer.zip,
              country: customer.country,
            }}
          />
          {customer.useSeparateShipping ? (
            <AddressCard
              label="Shipping Address"
              icon={<MapPin className="h-4 w-4" />}
              address={{
                address1: customer.shippingAddress1,
                address2: customer.shippingAddress2,
                city: customer.shippingCity,
                state: customer.shippingState,
                zip: customer.shippingZip,
                country: customer.shippingCountry,
              }}
            />
          ) : (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Shipping Address</p>
                <p className="text-sm text-muted-foreground italic">Same as billing</p>
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Credit & Payment */}
      <Section title="Credit & Payment">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoItem
            label="Credit Status"
            value={
              <Badge className={CREDIT_STATUS_COLORS[customer.creditStatus]}>
                {CREDIT_STATUS_LABELS[customer.creditStatus]}
              </Badge>
            }
            icon={<CreditCard className="h-4 w-4" />}
          />
          <InfoItem
            label="Credit Limit"
            value={formatCreditLimit(customer.creditLimit)}
            icon={<CreditCard className="h-4 w-4" />}
          />
          <InfoItem
            label="Payment Terms"
            value={customer.creditTerms || 'Net 30'}
            icon={<Calendar className="h-4 w-4" />}
          />
        </div>
      </Section>

      {/* Tax Info */}
      {(customer.taxId || customer.taxExempt) && (
        <Section title="Tax Information">
          <div className="grid grid-cols-2 gap-4">
            <InfoItem
              label="Tax ID"
              value={customer.taxId}
              icon={<FileText className="h-4 w-4" />}
            />
            <InfoItem
              label="Tax Exempt"
              value={customer.taxExempt ? 'Yes' : 'No'}
              icon={<Shield className="h-4 w-4" />}
            />
            {customer.taxExempt && (
              <>
                <InfoItem
                  label="Exempt Certificate #"
                  value={customer.taxExemptNumber}
                  icon={<FileText className="h-4 w-4" />}
                />
                <InfoItem
                  label="Certificate Expiry"
                  value={customer.taxExemptExpiryAt}
                  icon={<Calendar className="h-4 w-4" />}
                />
              </>
            )}
          </div>
        </Section>
      )}

      {/* Internal Notes */}
      {customer.internalNotes && (
        <Section title="Internal Notes">
          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-sm whitespace-pre-wrap">{customer.internalNotes}</p>
          </div>
        </Section>
      )}

      {/* Pipedrive Integration */}
      <Section title="Pipedrive CRM">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {isPipedriveLinked ? (
              <>
                <Link2 className="h-4 w-4 text-emerald-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-700">Connected to Pipedrive</p>
                  <p className="text-xs text-muted-foreground">
                    {customer.pipedrivePersonId && `Person ID: ${customer.pipedrivePersonId}`}
                    {customer.pipedriveDealId && ` | Deal ID: ${customer.pipedriveDealId}`}
                    {customer.pipedriveOrgId && ` | Org ID: ${customer.pipedriveOrgId}`}
                  </p>
                </div>
              </>
            ) : (
              <>
                <Unlink className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Not linked to Pipedrive</p>
                  <p className="text-xs text-muted-foreground">
                    Sync from Pipedrive to link this customer
                  </p>
                </div>
              </>
            )}
          </div>

          {isPipedriveLinked && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePushLTV}
                disabled={isPushingLTV}
              >
                {isPushingLTV ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync LTV to Pipedrive
              </Button>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ViewCustomerDrawer({
  customerId,
  open,
  onClose,
  onEdit,
}: ViewCustomerDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  useEffect(() => {
    if (open && customerId) {
      fetchCustomer();
      setActiveTab('details'); // Reset to details tab when opening
    } else {
      setCustomer(null);
      setError(null);
    }
  }, [open, customerId]);

  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const fetchCustomer = async () => {
    if (!customerId) {return;}

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCustomer(customerId);
      if (result.success && result.data) {
        setCustomer(result.data);
      } else {
        setError(result.error || 'Failed to load customer');
      }
    } catch {
      setError('Failed to load customer');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleEdit = () => {
    if (customer) {
      onEdit?.(customer);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[600px] md:max-w-[700px]"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : customer?.name || 'Customer Details'}
          </SheetTitle>
          <SheetDescription>
            {customer?.customerCode || 'View customer information'}
          </SheetDescription>
        </SheetHeader>

        {/* Content with Tabs */}
        {isLoading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchCustomer} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : customer ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-shrink-0 border-b px-6">
              <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                <TabsTrigger
                  value="details"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-3 font-medium"
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="contacts"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-3 font-medium"
                >
                  Contacts
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-0 pb-3 font-medium"
                >
                  Documents
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1">
              <div className="px-6 py-6">
                <TabsContent value="details" className="m-0">
                  <CustomerDetailsTab customer={customer} />
                </TabsContent>

                <TabsContent value="contacts" className="m-0">
                  <CustomerContactsList customerId={customer.id} />
                </TabsContent>

                <TabsContent value="documents" className="m-0">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground font-medium">Documents feature coming soon</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload W-9, tax exemption certificates, and more.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        ) : null}

        {/* Footer */}
        {customer && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {onEdit && (
                <Button onClick={handleEdit}>
                  Edit Customer
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
