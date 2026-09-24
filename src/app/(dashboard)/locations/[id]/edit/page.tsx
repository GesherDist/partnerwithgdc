'use client';

/**
 * Edit Location Page
 *
 * Form for editing an existing location.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { LocationForm } from '@/features/locations/components';
import { getLocation, updateLocationFromData } from '@/features/locations/actions';
import { formToCreateDTO, type LocationFormInput } from '@/features/locations/lib/schemas';
import type { LocationWithFormattedAddress } from '@/features/locations/types';
import { toast } from 'sonner';

export default function EditLocationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [location, setLocation] = useState<LocationWithFormattedAddress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLocation() {
      const result = await getLocation(id);

      if (result.success && result.data) {
        setLocation(result.data as LocationWithFormattedAddress);
      } else {
        setError(result.error || 'Location not found');
      }
      setIsLoading(false);
    }

    loadLocation();
  }, [id]);

  const handleSubmit = async (data: LocationFormInput) => {
    setIsSaving(true);
    try {
      const dto = formToCreateDTO(data);
      const result = await updateLocationFromData(id, dto);

      if (result.success) {
        toast.success('Location updated successfully');
        router.push(`/locations/${id}`);
      } else {
        if (result.errors) {
          const errorMessages = Object.values(result.errors).flat();
          toast.error(errorMessages[0] || 'Validation failed');
        } else {
          toast.error(result.error || 'Failed to update location');
        }
      }
    } catch {
      toast.error('An error occurred while updating the location');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/locations/${id}`);
  };

  if (isLoading) {
    return <LoadingState message="Loading location..." />;
  }

  if (error || !location) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Edit Location"
          actions={
            <Link href="/locations">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Locations
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive">{error || 'Location not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Location"
        description={`Editing ${location.name} (${location.locationCode})`}
        actions={
          <Link href={`/locations/${id}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Location
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
          <CardDescription>
            Update the location information. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocationForm
            initialData={{
              locationCode: location.locationCode,
              name: location.name,
              locationType: location.locationType,
              address1: location.address1,
              address2: location.address2,
              city: location.city,
              state: location.state,
              zip: location.zip,
              country: location.country,
              contactName: location.contactName,
              contactPhone: location.contactPhone,
              contactEmail: location.contactEmail,
              isActive: location.isActive,
              isDefault: location.isDefault,
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSaving}
            submitLabel="Update Location"
          />
        </CardContent>
      </Card>
    </div>
  );
}
