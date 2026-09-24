/**
 * Locations List Page
 *
 * Displays all locations with filtering and pagination.
 * Uses drawers for create/edit/view operations.
 */

import { Suspense } from 'react';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { LocationsContent } from '@/features/locations/components/LocationsContent';
import { getLocations } from '@/features/locations/actions';
import type { LocationTableRow } from '@/features/locations/types';

interface LocationsPageProps {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    locationType?: string;
    isActive?: string;
  }>;
}

async function LocationsData({ searchParams }: LocationsPageProps) {
  const params = await searchParams;

  const result = await getLocations({
    page: params.page ? parseInt(params.page) : 1,
    limit: params.limit ? parseInt(params.limit) : 10,
    search: params.search,
    locationType: params.locationType as 'warehouse' | 'drop_ship' | 'virtual' | undefined,
    isActive: params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined,
  });

  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error || 'Failed to load locations'}
      </div>
    );
  }

  const data = result.data as { data: LocationTableRow[]; meta: { totalPages: number } };

  return <LocationsContent data={data.data} />;
}

export default async function LocationsPage(props: LocationsPageProps) {
  return (
    <Suspense fallback={<LoadingState message="Loading locations..." />}>
      <LocationsData searchParams={props.searchParams} />
    </Suspense>
  );
}
