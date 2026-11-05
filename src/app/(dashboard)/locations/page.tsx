/**
 * Locations List Page
 *
 * Displays all locations with filtering and pagination.
 * Uses drawers for create/edit/view operations.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { getCurrentUser, hasPermission } from '@/shared/lib/auth/check-permission';
import { LocationsContent } from '@/features/locations/components/LocationsContent';
import { getLocations } from '@/features/locations/actions';
import { LOCATION_PERMISSIONS } from '@/features/locations/lib/permissions';
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
  // Server-side permission check (same permission as the sidebar link)
  const user = await getCurrentUser();

  if (!user || !hasPermission(user, LOCATION_PERMISSIONS.viewModule)) {
    redirect('/no-permission');
  }

  return (
    <Suspense fallback={<LoadingState message="Loading locations..." />}>
      <LocationsData searchParams={props.searchParams} />
    </Suspense>
  );
}
