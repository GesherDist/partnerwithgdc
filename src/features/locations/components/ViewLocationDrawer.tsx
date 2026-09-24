'use client';

/**
 * ViewLocationDrawer Component
 *
 * Side drawer for viewing location details with tabbed interface.
 * Tab 1: Location Detail - Shows location information
 * Tab 2: Location User - Shows and manages users assigned to this location
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, MapPin, Phone, Mail, User, Building2, CheckCircle2, XCircle, Tag, Hash, Users } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

import type { ViewLocationDrawerProps, Location } from '../types';
import { LOCATION_TYPE_OPTIONS } from '../types';
import { getLocation } from '../actions';
import { LocationContactsTable } from './LocationContactsTable';

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value) { return null; }
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
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

function AddressDisplay({ address }: {
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
  if (!hasAddress) { return null; }

  const lines = [
    address.address1,
    address.address2,
    [address.city, address.state, address.zip].filter(Boolean).join(', '),
    address.country && address.country !== 'US' ? address.country : null,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3">
      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">Address</p>
        {lines.map((line, i) => (
          <p key={i} className="text-sm font-medium text-foreground">{line}</p>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ViewLocationDrawer({
  open,
  locationId,
  onClose,
}: ViewLocationDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  // Fetch location data
  const fetchLocation = useCallback(async () => {
    if (!locationId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getLocation(locationId);
      if (result.success && result.data) {
        setLocation(result.data);
      } else {
        setError(result.error || 'Failed to load location');
      }
    } catch (err) {
      console.error('Error fetching location:', err);
      setError('Failed to load location');
    } finally {
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open && locationId) {
      fetchLocation();
      setActiveTab('details'); // Reset to details tab when opening
    } else {
      setLocation(null);
      setError(null);
      setActiveTab('details');
    }
  }, [open, locationId, fetchLocation]);

  const getTypeLabel = (type: string) => {
    const option = LOCATION_TYPE_OPTIONS.find(opt => opt.value === type);
    return option?.label || type;
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[800px]"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : location?.name || 'Location Details'}
          </SheetTitle>
          <SheetDescription>
            {location?.locationCode || 'View location information'}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchLocation} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : location ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="border-b px-6">
              <TabsList className="h-10">
                <TabsTrigger value="details" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Location Detail
                </TabsTrigger>
                <TabsTrigger value="contacts" className="gap-2">
                  <Users className="h-4 w-4" />
                  Contacts
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="flex-1 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-6">
                  <div className="space-y-4">
                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{getTypeLabel(location.locationType)}</Badge>
                      {location.isActive ? (
                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" />
                          Inactive
                        </Badge>
                      )}
                      {location.isDefault && (
                        <Badge variant="default">Default</Badge>
                      )}
                    </div>

                    {/* Location Information */}
                    <Section title="Location Information">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InfoItem
                          label="Location Name"
                          value={location.name}
                          icon={<Building2 className="h-4 w-4" />}
                        />
                        <InfoItem
                          label="Location Code"
                          value={location.locationCode}
                          icon={<Hash className="h-4 w-4" />}
                        />
                        <InfoItem
                          label="Type"
                          value={getTypeLabel(location.locationType)}
                          icon={<Tag className="h-4 w-4" />}
                        />
                      </div>
                    </Section>

                    {/* Address */}
                    <Section title="Address">
                      {(location.address1 || location.city || location.state) ? (
                        <AddressDisplay
                          address={{
                            address1: location.address1,
                            address2: location.address2,
                            city: location.city,
                            state: location.state,
                            zip: location.zip,
                            country: location.country,
                          }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">No address provided</p>
                      )}
                    </Section>

                    {/* Contact Information */}
                    <Section title="Contact Information">
                      {(location.contactName || location.contactPhone || location.contactEmail) ? (
                        <div className="space-y-4">
                          <InfoItem
                            label="Contact Name"
                            value={location.contactName}
                            icon={<User className="h-4 w-4" />}
                          />
                          <InfoItem
                            label="Phone"
                            value={location.contactPhone}
                            icon={<Phone className="h-4 w-4" />}
                          />
                          <InfoItem
                            label="Email"
                            value={location.contactEmail}
                            icon={<Mail className="h-4 w-4" />}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No contact information provided</p>
                      )}
                    </Section>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="contacts" className="flex-1 mt-0">
              <ScrollArea className="h-full">
                <div className="px-6 py-6">
                  <LocationContactsTable locationId={location.id} />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : null}

        {/* Footer */}
        {location && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
