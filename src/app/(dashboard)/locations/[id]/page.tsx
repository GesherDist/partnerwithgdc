/**
 * Location Details Page
 *
 * Displays details for a single location.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { getLocation } from '@/features/locations/actions';

interface LocationPageProps {
  params: Promise<{ id: string }>;
}

export default async function LocationPage({ params }: LocationPageProps) {
  const { id } = await params;
  const result = await getLocation(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const location = result.data;

  const typeLabels: Record<string, string> = {
    warehouse: 'Warehouse',
    drop_ship: 'Direct',
    virtual: 'Virtual',
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={location.name}
        description={`Code: ${location.locationCode}`}
        actions={
          <div className="flex gap-2">
            <Link href="/locations">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <Link href={`/locations/${id}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Code</p>
                <p className="font-mono text-lg">{location.locationCode}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <Badge variant="secondary">
                  {typeLabels[location.locationType] || location.locationType}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p>{location.name}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={location.isActive ? 'default' : 'secondary'}>
                  {location.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Default</p>
                <Badge variant={location.isDefault ? 'default' : 'outline'}>
                  {location.isDefault ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {location.address1 || location.city || location.state ? (
              <>
                {location.address1 && <p>{location.address1}</p>}
                {location.address2 && <p>{location.address2}</p>}
                <p>
                  {[location.city, location.state, location.zip]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {location.country && location.country !== 'US' && (
                  <p>{location.country}</p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No address provided</p>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {location.contactName || location.contactPhone || location.contactEmail ? (
              <>
                {location.contactName && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p>{location.contactName}</p>
                  </div>
                )}
                {location.contactPhone && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p>{location.contactPhone}</p>
                  </div>
                )}
                {location.contactEmail && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p>{location.contactEmail}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No contact information provided</p>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(location.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Updated</p>
                <p className="text-sm">
                  {new Date(location.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Location ID</p>
              <p className="font-mono text-xs text-muted-foreground">{location.id}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
