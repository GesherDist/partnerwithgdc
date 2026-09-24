'use client';

/**
 * Operations Dashboard Page
 *
 * Jenny's main operations view showing:
 * Tab 1: Executive Summary (KPIs, Immediate Attention)
 * Tab 2: Shipment Overview
 * Tab 3+: Dynamic GDC tabs (GDC 1, GDC 2, GDC 3) - Purchase Orders by order_series
 *
 * Note: Supplier Schedule tab hidden per Ankur/Jenny feedback Aug 26, 2025
 * Note: Story in Brief removed per user request Aug 31, 2025
 * GDC tabs now show Purchase Orders filtered by order_series (redesign Aug 27, 2025)
 */

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Import components directly to avoid barrel export issues
import { OperationsHeader, type ExportOption } from '@/features/operations-dashboard/components/OperationsHeader';
import { OperationsFilters } from '@/features/operations-dashboard/components/OperationsFilters';
import { OperationsStatsGrid } from '@/features/operations-dashboard/components/OperationsStatsGrid';
import { ImmediateAttentionTable } from '@/features/operations-dashboard/components/ImmediateAttentionTable';
import { SKUBreakdown } from '@/features/operations-dashboard/components/SKUBreakdown';
import { CustomerCommitments } from '@/features/operations-dashboard/components/CustomerCommitments';
import { ShipmentStatusMix } from '@/features/operations-dashboard/components/ShipmentStatusMix';
// REMOVED: Story in Brief - per user request Aug 31, 2025
// import { StoryInBrief } from '@/features/operations-dashboard/components/StoryInBrief';
import { ShipmentOverviewTable } from '@/features/operations-dashboard/components/ShipmentOverviewTable';
// HIDDEN: Supplier Schedule - per Ankur/Jenny feedback Aug 26, 2025
// import { SupplierShipmentScheduleTable } from '@/features/operations-dashboard/components/SupplierShipmentScheduleTable';
// REPLACED: GDC1InventoryTable replaced with dynamic GDCInventoryTable - Aug 27, 2025
// import { GDC1InventoryTable } from '@/features/operations-dashboard/components/GDC1InventoryTable';
import { GDCInventoryTable } from '@/features/operations-dashboard/components/GDCInventoryTable';
import { EditShipmentDialog, type EditSource } from '@/features/operations-dashboard/components/EditShipmentDialog';
import { ViewShipmentDetailDialog } from '@/features/operations-dashboard/components/ViewShipmentDetailDialog';

// Global data for dynamic tabs
import { ORDER_SERIES } from '@/shared/lib/global-data';

// Server actions
import { fetchOperationsData, fetchFilterOptions } from '@/features/operations-dashboard/actions';

// Export utilities
import { exportToXLSX, type XLSXExportType } from '@/features/operations-dashboard/lib/xlsx-export';

// Types
import type {
  OperationsData,
  ImmediateAttentionItem,
  // ShipmentScheduleItem, // HIDDEN: Supplier Schedule - per Ankur/Jenny feedback Aug 26, 2025
  // GDC1InventoryItem,    // REPLACED: Now using GDCInventoryItem from PO data
  GDCInventoryItem,
  ShipmentStatus,
  OperationsFilters as OperationsFiltersType,
  FilterOptions,
} from '@/features/operations-dashboard/types';

// Helper type for edit dialog
interface EditableShipment {
  id: string;
  loadNumber: string;
  customer: string;
  status: ShipmentStatus;
  actionRequired: string;
  confirmedEta?: string | null;
  actualDeliveryDate?: string | null;
  qtyDelivered?: number;
  totalQty?: number;
}

// Empty data structure for initial state
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
  gdcInventories: [],  // NEW: GDC inventories by order series from Purchase Orders
  rimInstallationRequired: [],
  rimInstallationSkus: [],
  storyInBrief: '',
};

// Empty filter options for initial state
const emptyFilterOptions: FilterOptions = {
  customers: [],
  products: [],
  statuses: [],
  salesOrders: [],
  customerPoNumbers: [],
};

export default function OperationsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [data, setData] = useState<OperationsData>(emptyData);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<OperationsFiltersType>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(emptyFilterOptions);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingShipment, setEditingShipment] = useState<EditableShipment | null>(null);
  const [editSource, setEditSource] = useState<EditSource>('shipment');

  // View detail dialog state
  const [viewShipmentId, setViewShipmentId] = useState<string | null>(null);

  // Set initial date on client side only to avoid hydration mismatch
  useEffect(() => {
    if (!lastUpdated) {
      setLastUpdated(new Date());
    }
  }, [lastUpdated]);

  // Fetch data from database
  const loadData = useCallback(async (showRefreshing = false, currentFilters?: OperationsFiltersType) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      const result = await fetchOperationsData(currentFilters);

      if (result.success && result.data) {
        setData(result.data);
        setError(null);
      } else {
        console.error('Failed to fetch operations data:', result.error);
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Error loading operations data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }
  }, []);

  // Load filter options
  const loadFilterOptions = useCallback(async () => {
    try {
      const result = await fetchFilterOptions();
      if (result.success && result.data) {
        setFilterOptions(result.data);
      }
    } catch (err) {
      console.error('Error loading filter options:', err);
    }
  }, []);

  // Load data and filter options on mount
  useEffect(() => {
    loadData();
    loadFilterOptions();
  }, [loadData, loadFilterOptions]);

  // Reload data when filters change
  const handleFiltersChange = (newFilters: OperationsFiltersType) => {
    setFilters(newFilters);
    loadData(true, newFilters);
  };

  const handleRefresh = () => {
    loadData(true, filters);
  };

  const handleExport = async (type: ExportOption = 'all') => {
    setIsExporting(true);
    try {
      if (type === 'pdf') {
        // PDF export via API with filters
        const params = new URLSearchParams();
        if (filters.customerId) params.append('customerId', filters.customerId);
        if (filters.productId) params.append('productId', filters.productId);
        if (filters.status) params.append('status', filters.status);
        if (filters.salesOrderId) params.append('salesOrderId', filters.salesOrderId);
        if (filters.customerPoNumber) params.append('customerPoNumber', filters.customerPoNumber);

        const queryString = params.toString();
        const response = await fetch(`/api/operations/export-pdf${queryString ? `?${queryString}` : ''}`);
        if (!response.ok) {
          throw new Error('PDF export failed');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `operations-dashboard-${dateStr}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success('PDF export completed successfully');
      } else {
        // XLSX export with filters
        await exportToXLSX(type as XLSXExportType, data, filters);
        toast.success('Excel export completed successfully');
      }
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle view details from Immediate Attention table
  const handleViewDetails = (item: ImmediateAttentionItem) => {
    setViewShipmentId(item.id);
  };

  // Handle edit from Immediate Attention table
  const handleEditAttentionItem = (item: ImmediateAttentionItem) => {
    setEditingShipment({
      id: item.id,
      loadNumber: item.loadNumber,
      customer: item.customer,
      status: item.status,
      actionRequired: item.actionRequired,
      confirmedEta: item.etaPort,
      totalQty: item.qty,
    });
    setEditSource('shipment');
    setEditDialogOpen(true);
  };

  // HIDDEN: Handle edit from Supplier Schedule table (Galileo Orders) - per Ankur/Jenny feedback Aug 26, 2025
  // const handleEditScheduleItem = (item: ShipmentScheduleItem) => {
  //   setEditingShipment({
  //     id: item.id,
  //     loadNumber: item.loadNumber,
  //     customer: item.customer,
  //     status: item.status,
  //     actionRequired: item.actionRequired,
  //     confirmedEta: item.confirmedEta,
  //     actualDeliveryDate: item.actualDeliveryDate,
  //     qtyDelivered: item.qtyDelivered,
  //     totalQty: item.totalQty,
  //   });
  //   setEditSource('supplier');
  //   setEditDialogOpen(true);
  // };

  // Handle view from dynamic GDC Inventory table (Purchase Orders)
  const handleViewGDCItem = (item: GDCInventoryItem) => {
    setViewShipmentId(item.id);
  };

  // Handle edit from dynamic GDC Inventory table (Sales Orders)
  const handleEditGDCItem = (item: GDCInventoryItem) => {
    // Convert GDCInventoryItem to EditableShipment format
    // Note: Dialog's confirmedEta = ETA to Port (item.etaToUsPort)
    //       Dialog's actualDeliveryDate = Customer Expected Delivery (item.expectedDelivery)
    setEditingShipment({
      id: item.id,
      loadNumber: item.soNumber || item.poNumber || 'N/A',
      customer: item.customer || 'Unknown',
      status: item.status as ShipmentStatus,
      actionRequired: item.actionRequired || '',
      confirmedEta: item.etaToUsPort || '', // ETA to US Port maps to dialog's "ETA to Port"
      actualDeliveryDate: item.expectedDelivery || '', // Expected Delivery maps to dialog's "Customer Expected Delivery"
      qtyDelivered: item.qtyDelivered,
      totalQty: item.totalQty,
    });
    setEditSource('gdc');
    setEditDialogOpen(true);
  };

  // Handle successful edit - refresh data
  const handleEditSuccess = () => {
    loadData(true, filters);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading operations data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1920px] mx-auto">
      {/* Error Message */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <OperationsHeader
        lastUpdated={lastUpdated}
        onRefresh={handleRefresh}
        onExport={handleExport}
        isRefreshing={isRefreshing}
        isExporting={isExporting}
      />

      {/* Tabbed Content */}
      <Tabs defaultValue="executive-summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="executive-summary">Executive Summary</TabsTrigger>
          <TabsTrigger value="shipment-overview">Shipment Overview</TabsTrigger>
          {/* HIDDEN: Supplier Schedule tab - per Ankur/Jenny feedback Aug 26, 2025 */}
          {/* <TabsTrigger value="supplier-schedule">Supplier Schedule</TabsTrigger> */}
          {/* Dynamic GDC tabs based on ORDER_SERIES */}
          {ORDER_SERIES.map((series) => (
            <TabsTrigger key={series.id} value={`gdc-${series.id}`}>
              {series.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Filters - Between tabs and content */}
        <div className="mt-4">
          <OperationsFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            filterOptions={filterOptions}
            isLoading={isRefreshing}
          />
        </div>

        {/* Loading Overlay for Data */}
        {isRefreshing && (
          <div className="mt-4 flex items-center justify-center rounded-lg border bg-muted/50 py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}

        {/* Tab 1: Executive Summary */}
        <TabsContent value="executive-summary" className={`space-y-6 ${isRefreshing ? 'hidden' : ''}`}>
          {/* KPI Stats */}
          <OperationsStatsGrid stats={data.stats} />

          {/* REMOVED: Story in Brief - per user request Aug 31, 2025 */}

          {/* Immediate Attention - This is what Jenny checks FIRST */}
          <ImmediateAttentionTable
            items={data.immediateAttention}
            onViewDetails={handleViewDetails}
            onEdit={handleEditAttentionItem}
            onRefresh={handleRefresh}
          />

          {/* Two column layout for breakdown and status */}
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* SKU Breakdown - Wider column for better spacing */}
            <SKUBreakdown data={data.skuBreakdown} />

            {/* Shipment Status Mix - Narrower column */}
            <ShipmentStatusMix data={data.shipmentStatusMix} />
          </div>

          {/* Customer Commitments */}
          <CustomerCommitments data={data.customerCommitments} />
        </TabsContent>

        {/* Tab 2: Shipment Overview */}
        <TabsContent value="shipment-overview" className={`space-y-6 ${isRefreshing ? 'hidden' : ''}`}>
          <ShipmentOverviewTable
            inTransitItems={data.immediateAttention}
            customerSummary={data.customerCommitments}
          />
        </TabsContent>

        {/* HIDDEN: Tab 3: Supplier Schedule - per Ankur/Jenny feedback Aug 26, 2025 */}
        {/* <TabsContent value="supplier-schedule" className={`space-y-6 ${isRefreshing ? 'hidden' : ''}`}>
          <SupplierShipmentScheduleTable
            data={data.supplierShipmentSchedule}
            uniqueSkus={data.supplierScheduleSkus || []}
            onEdit={handleEditScheduleItem}
          />
        </TabsContent> */}

        {/* Dynamic GDC Tabs - Purchase Orders by Order Series */}
        {ORDER_SERIES.map((series) => {
          const gdcData = data.gdcInventories?.find((g) => g.orderSeries === series.code);
          return (
            <TabsContent
              key={series.id}
              value={`gdc-${series.id}`}
              className={`space-y-6 ${isRefreshing ? 'hidden' : ''}`}
            >
              <GDCInventoryTable
                orderSeries={series.name}
                data={gdcData?.items || []}
                uniqueSkus={gdcData?.uniqueSkus || []}
                onView={handleViewGDCItem}
                onEdit={handleEditGDCItem}
              />
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Edit Shipment Dialog */}
      <EditShipmentDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        shipment={editingShipment}
        onSuccess={handleEditSuccess}
        source={editSource}
      />

      {/* View Shipment Detail Dialog */}
      <ViewShipmentDetailDialog
        open={!!viewShipmentId}
        onClose={() => setViewShipmentId(null)}
        shipmentId={viewShipmentId}
      />
    </div>
  );
}
