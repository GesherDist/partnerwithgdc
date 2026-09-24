'use client';

/**
 * Operations Dashboard Content
 *
 * Client component wrapper for the Operations Dashboard.
 * This is shown to users with "Operations Manager" role.
 *
 * Tabs:
 * 1. Executive Summary - KPIs, Story in Brief, Immediate Attention
 * 2. Shipment Overview - Customer summary and in-transit items
 * 3. Supplier Schedule - Full supplier shipment schedule
 * 4. GDC1 Inventory - Full GDC1 warehouse inventory
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';

// Import components directly to avoid barrel export issues
import { OperationsHeader, type ExportOption } from '@/features/operations-dashboard/components/OperationsHeader';
import { OperationsStatsGrid } from '@/features/operations-dashboard/components/OperationsStatsGrid';
import { ImmediateAttentionTable } from '@/features/operations-dashboard/components/ImmediateAttentionTable';
import { SKUBreakdown } from '@/features/operations-dashboard/components/SKUBreakdown';
import { CustomerCommitments } from '@/features/operations-dashboard/components/CustomerCommitments';
import { ShipmentStatusMix } from '@/features/operations-dashboard/components/ShipmentStatusMix';
import { StoryInBrief } from '@/features/operations-dashboard/components/StoryInBrief';
import { ShipmentOverviewTable } from '@/features/operations-dashboard/components/ShipmentOverviewTable';
import { SupplierShipmentScheduleTable } from '@/features/operations-dashboard/components/SupplierShipmentScheduleTable';
import { GDC1InventoryTable } from '@/features/operations-dashboard/components/GDC1InventoryTable';
import { ViewShipmentDetailDialog } from '@/features/operations-dashboard/components/ViewShipmentDetailDialog';
import { fetchOperationsData } from '@/features/operations-dashboard/actions';
import { exportToXLSX, type XLSXExportType } from '@/features/operations-dashboard/lib/xlsx-export';
import type { OperationsData, ImmediateAttentionItem } from '@/features/operations-dashboard/types';

// Default empty data structure
const emptyData: OperationsData = {
  stats: {
    availableInventoryQty: 0,
    availableLoads: 0,
    availableInventoryValue: 0,
    committedCustomerQty: 0,
    inTransitNext7Days: 0,
    openLoads: 0,
    outstandingQty: 0,
    invoiceAmount: 0,
  },
  skuBreakdown: [],
  customerCommitments: [],
  shipmentStatusMix: [],
  immediateAttention: [],
  supplierShipmentSchedule: [],
  supplierScheduleSkus: [],
  gdc1Inventory: [],
  gdc1InventorySkus: [],
  gdcInventories: [],  // Dynamic GDC inventories by order series
  rimInstallationRequired: [],
  rimInstallationSkus: [],
  storyInBrief: '',
};

export function OperationsDashboardContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [data, setData] = useState<OperationsData>(emptyData);

  // View shipment detail dialog state
  const [viewShipmentId, setViewShipmentId] = useState<string | null>(null);

  // Fetch data on mount
  const loadData = useCallback(async () => {
    try {
      const result = await fetchOperationsData();
      if (result.success && result.data) {
        setData(result.data);
        setLastUpdated(new Date());
      } else {
        console.error('Failed to fetch operations data:', result.error);
        toast.error('Failed to load dashboard data');
      }
    } catch (error) {
      console.error('Error fetching operations data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    toast.success('Dashboard refreshed');
  };

  const handleExport = (type: ExportOption) => {
    // Export to XLSX
    exportToXLSX(type as XLSXExportType, data);
  };

  // Handle view shipment details
  const handleViewDetails = (item: ImmediateAttentionItem) => {
    console.log('View details clicked for item:', item.id, item);
    setViewShipmentId(item.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <OperationsHeader
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        onExport={handleExport}
        isRefreshing={isRefreshing}
      />

      {/* Tabbed Content */}
      <Tabs defaultValue="executive-summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="executive-summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="shipment-overview">Shipment Overview</TabsTrigger>
          <TabsTrigger value="supplier-schedule">Supplier Schedule</TabsTrigger>
          <TabsTrigger value="gdc1-inventory">GDC 1 Inventory</TabsTrigger>
        </TabsList>

        {/* Tab 1: Executive Summary */}
        <TabsContent value="executive-summary" className="space-y-6">
          {/* KPI Stats */}
          <OperationsStatsGrid stats={data.stats} />

          {/* Story in Brief */}
          <StoryInBrief content={data.storyInBrief} />

          {/* Immediate Attention - This is what Jenny checks FIRST */}
          <ImmediateAttentionTable
            items={data.immediateAttention}
            onViewDetails={handleViewDetails}
          />

          {/* Two column layout for breakdown and status */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* SKU Breakdown */}
            <SKUBreakdown data={data.skuBreakdown} />

            {/* Shipment Status Mix */}
            <ShipmentStatusMix data={data.shipmentStatusMix} />
          </div>

          {/* Customer Commitments */}
          <CustomerCommitments data={data.customerCommitments} />
        </TabsContent>

        {/* Tab 2: Shipment Overview */}
        <TabsContent value="shipment-overview" className="space-y-6">
          <ShipmentOverviewTable
            inTransitItems={data.immediateAttention}
            customerSummary={data.customerCommitments}
          />
        </TabsContent>

        {/* Tab 3: Supplier Schedule */}
        <TabsContent value="supplier-schedule" className="space-y-6">
          <SupplierShipmentScheduleTable
            data={data.supplierShipmentSchedule}
            uniqueSkus={data.supplierScheduleSkus || []}
          />
        </TabsContent>

        {/* Tab 4: GDC1 Inventory */}
        <TabsContent value="gdc1-inventory" className="space-y-6">
          <GDC1InventoryTable
            data={data.gdc1Inventory}
            uniqueSkus={data.gdc1InventorySkus || []}
          />
        </TabsContent>
      </Tabs>

      {/* View Shipment Detail Dialog */}
      <ViewShipmentDetailDialog
        open={!!viewShipmentId}
        onClose={() => setViewShipmentId(null)}
        shipmentId={viewShipmentId}
      />
    </div>
  );
}
