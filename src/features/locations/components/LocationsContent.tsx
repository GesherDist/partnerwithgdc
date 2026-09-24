'use client';

/**
 * LocationsContent Component
 *
 * Client-side wrapper for locations page with drawer support.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LocationsTable } from './LocationsTable';
import { CreateLocationDrawer } from './CreateLocationDrawer';
import type { LocationTableRow } from '../types';

interface LocationsContentProps {
  data: LocationTableRow[];
  isLoading?: boolean;
}

export function LocationsContent({ data, isLoading = false }: LocationsContentProps) {
  const router = useRouter();
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const handleCreateSuccess = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locations"
        description="Manage warehouse and shipping locations"
        actions={
          <Button onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        }
      />

      <LocationsTable
        data={data}
        isLoading={isLoading}
        onRefresh={handleRefresh}
      />

      {/* Create Drawer */}
      <CreateLocationDrawer
        open={createDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
