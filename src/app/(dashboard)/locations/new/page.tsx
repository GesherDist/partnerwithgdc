'use client';

/**
 * New Location Page
 *
 * Form for creating a new location.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LocationForm } from '@/features/locations/components';
import { createLocationFromData } from '@/features/locations/actions';
import { formToCreateDTO, type LocationFormInput } from '@/features/locations/lib/schemas';
import { toast } from 'sonner';

export default function NewLocationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: LocationFormInput) => {
    setIsLoading(true);
    try {
      const dto = formToCreateDTO(data);
      const result = await createLocationFromData(dto);

      if (result.success) {
        toast.success('Location created successfully');
        router.push('/locations');
      } else {
        if (result.errors) {
          const errorMessages = Object.values(result.errors).flat();
          toast.error(errorMessages[0] || 'Validation failed');
        } else {
          toast.error(result.error || 'Failed to create location');
        }
      }
    } catch {
      toast.error('An error occurred while creating the location');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/locations');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Location"
        description="Add a new warehouse or shipping location"
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
        <CardHeader>
          <CardTitle>Location Details</CardTitle>
          <CardDescription>
            Enter the details for the new location. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocationForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel="Create Location"
          />
        </CardContent>
      </Card>
    </div>
  );
}
