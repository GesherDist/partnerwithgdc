/**
 * Operations Dashboard Repository
 *
 * Database queries for Jenny's operations dashboard.
 * Fetches data from shipments table with the new operations fields.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  OperationsStats,
  SKUBreakdown,
  CustomerCommitment,
  ShipmentStatusMix,
  ImmediateAttentionItem,
  ShipmentScheduleItem,
  GDC1InventoryItem,
  GDCInventoryItem,
  GDCInventoryData,
  RimInstallationItem,
  ShipmentStatus,
  SKUColumnInfo,
  FilterOptions,
  OperationsFilters,
} from '../types';

// ============================================
// HELPER: Unwrap an embedded to-one relation
// ============================================

/**
 * Supabase types every embedded relation as an array, even where the foreign
 * key makes it to-one and PostgREST returns a single object. Accepts either
 * shape and narrows it to the single row.
 */
type ToOne<T> = T extends readonly (infer U)[] ? U : T;

function toOne<T>(relation: T): ToOne<T> | null {
  if (Array.isArray(relation)) {
    return (relation[0] ?? null) as ToOne<T> | null;
  }
  return (relation ?? null) as ToOne<T> | null;
}

// ============================================
// HELPER: Map DB load_status to ShipmentStatus
// ============================================

function mapLoadStatus(dbStatus: string | null): ShipmentStatus {
  const statusMap: Record<string, ShipmentStatus> = {
    // Common statuses
    available: 'AVAILABLE',
    open: 'OPEN',
    hold: 'HOLD',
    in_transit: 'IN_TRANSIT',
    sold: 'SOLD',
    closed: 'CLOSED',
    // Invoice/Payment statuses
    invoiced: 'INVOICED',
    not_invoiced: 'NOT_INVOICED',
    partially_paid: 'PARTIALLY_PAID',
    paid: 'PAID',
    disputed: 'DISPUTED',
    // Other statuses
    po_needed: 'PO_NEEDED',
    delivered: 'DELIVERED',
  };
  return statusMap[dbStatus || 'open'] || 'OPEN';
}

// ============================================
// GET OPERATIONS STATS (KPIs)
// Based on Jenny's Excel Master Sheet logic:
// - Available Inventory = GDC1 where status = AVAILABLE
// - Committed Customer = Supplier Schedule (with Load#) + GDC1 (status = SOLD)
// ============================================

export async function getOperationsStats(filters?: OperationsFilters): Promise<OperationsStats> {
  const supabase = createAdminClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get ALL sales orders with items for KPI calculation
  let soQuery = supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      status,
      grand_total,
      requested_delivery_date,
      customer_id,
      customer_po_number,
      sales_order_items(quantity, product_id)
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled');

  // Apply filters
  if (filters?.customerId) {
    soQuery = soQuery.eq('customer_id', filters.customerId);
  }
  if (filters?.salesOrderId) {
    soQuery = soQuery.eq('id', filters.salesOrderId);
  }
  if (filters?.customerPoNumber) {
    soQuery = soQuery.eq('customer_po_number', filters.customerPoNumber);
  }

  const { data: _salesOrders, error: soError } = await soQuery;

  if (soError) {
    console.error('Error fetching sales orders for stats:', soError);
    throw soError;
  }

  // Get shipments for ALL KPI calculations (new approach - Oct 6, 2026)
  let shipmentsQuery = supabase
    .from('shipments')
    .select(`
      id,
      load_status,
      total_qty,
      eta_to_port,
      eta_port_tracking,
      estimated_arrival,
      is_delayed,
      status,
      sales_order_id,
      sales_orders(grand_total)
    `)
    .is('deleted_at', null);

  // Apply delayed filter if specified
  if (filters?.isDelayed !== undefined) {
    shipmentsQuery = shipmentsQuery.eq('is_delayed', filters.isDelayed);
  }

  const { data: shipments, error: shipError } = await shipmentsQuery;

  if (shipError) {
    console.error('Error fetching shipments for stats:', shipError);
    throw shipError;
  }

  // ============================================
  // REMOVED (Oct 6, 2026): Unallocated POs query
  // New approach: Only use SHIPMENTS for inventory calculations
  // ============================================

  // ============================================
  // NEW APPROACH (Oct 6, 2026): KPIs based on Order Series (GDC Inventories)
  // Client requirement: Calculate from GDC 1, GDC 2, GDC 3, etc. tables
  // ============================================

  // Initialize KPI values
  let availableInventoryQty = 0;
  let availableLoads = 0;
  let availableInventoryValue = 0;
  let committedCustomerQty = 0;
  let inTransitNext7Days = 0;

  // ============================================
  // 1. AVAILABLE INVENTORY from GDC Inventories (all order series)
  // Calculate: Sum of AVAILABLE status items from GDC 1 + GDC 2 + GDC 3 + ...
  // ============================================

  // Get all GDC inventories (all order series: GDC 1, GDC 2, GDC 3, etc.)
  const gdcInventories = await getAllGDCInventories(filters);

  // Loop through all order series
  gdcInventories.forEach(gdcData => {
    // Filter items with AVAILABLE status
    const availableItems = gdcData.items.filter(item =>
      item.status === 'AVAILABLE' || item.status === 'available'
    );

    // Count loads
    availableLoads += availableItems.length;

    // Sum quantities
    availableInventoryQty += availableItems.reduce((sum, item) =>
      sum + (item.totalQty || 0), 0
    );

    // Sum invoice amounts (already in dollars from GDC data)
    availableInventoryValue += availableItems.reduce((sum, item) =>
      sum + (item.invoiceAmount || 0), 0
    );
  });

  // ============================================
  // 2. IN TRANSIT / NEXT 7 DAYS from GDC Inventories
  // Calculate: Count of IN_TRANSIT status items with ETA in next 7 days
  // ============================================
  gdcInventories.forEach(gdcData => {
    const inTransitItems = gdcData.items.filter(item => {
      // Check if status is IN_TRANSIT
      if (item.status !== 'IN_TRANSIT' && item.status !== 'in_transit') return false;

      // Check if ETA to US Port is in next 7 days
      const etaDate = item.etaToUsPort;
      if (!etaDate) return false;

      const eta = new Date(etaDate);
      return eta >= now && eta <= next7Days;
    });

    inTransitNext7Days += inTransitItems.length;
  });

  // ============================================
  // 3. CUSTOMER COMMITTED from GDC Inventories
  // Calculate: Sum of Outstanding Qty where status = OPEN (all order series)
  // ============================================
  gdcInventories.forEach(gdcData => {
    const openItems = gdcData.items.filter(item =>
      item.status === 'OPEN' || item.status === 'open'
    );

    // Sum outstanding quantities
    committedCustomerQty += openItems.reduce((sum, item) =>
      sum + (item.outstandingQty || 0), 0
    );
  });

  // ============================================
  // REMOVED (Oct 6, 2026): Unallocated PO calculations
  // New approach: Only use SHIPMENTS table for inventory KPIs
  // Unallocated POs will create shipments when received, then they'll show in Available
  // ============================================

  // ============================================
  // DEALER ALLOCATION KPIs (NEW - Sept 25, 2026)
  // Get dealer allocation stats from fulfillment_allocations table
  // ============================================
  let dealerStatsQuery = supabase
    .from('fulfillment_allocations')
    .select('id, quantity, status, fulfillment_source', { count: 'exact' })
    .in('fulfillment_source', ['platinum_dealer_inventory', 'platinum_dealer_fulfillment']);

  // Apply filters if provided
  if (filters?.customerId) {
    // Note: Need to join through sales_order_items -> sales_orders to filter by customer
    // For now, skip customer filter on dealer stats (would require complex join)
  }
  if (filters?.fulfillmentSource) {
    dealerStatsQuery = dealerStatsQuery.eq('fulfillment_source', filters.fulfillmentSource);
  }
  if (filters?.platinumDealerId) {
    dealerStatsQuery = dealerStatsQuery.eq('platinum_dealer_id', filters.platinumDealerId);
  }

  const { data: dealerAllocations, count: dealerCount, error: dealerError } = await dealerStatsQuery;

  if (dealerError) {
    console.error('Error fetching dealer allocations for stats:', dealerError);
    // Don't throw - just log and continue with partial data
  }

  const dealerPendingQty = dealerAllocations
    ?.filter(a => a.status === 'pending' || a.status === 'allocated')
    .reduce((sum, a) => sum + a.quantity, 0) || 0;

  // ============================================
  // DELAYED SHIPMENTS COUNT (NEW - Oct 1, 2026)
  // Count shipments that are delayed (is_delayed=true OR auto-calculated)
  // ============================================
  const delayedShipmentsCount = shipments?.filter(s => {
    // Check manual flag first
    if (s.is_delayed === true) return true;

    // Auto-detect: ETA passed but not delivered
    const etaDate = s.eta_port_tracking || s.eta_to_port || s.estimated_arrival;
    if (!etaDate) return false;

    const eta = new Date(etaDate);
    const isDelivered = s.status === 'delivered';

    return eta < now && !isDelivered;
  }).length || 0;

  return {
    availableInventoryQty,
    availableLoads,
    availableInventoryValue,
    committedCustomerQty,
    inTransitNext7Days,
    openLoads: 0,           // REMOVED: Not used in new shipments-only approach (Oct 6, 2026)
    outstandingQty: 0,      // REMOVED: Not used in new shipments-only approach (Oct 6, 2026)
    invoiceAmount: 0,       // REMOVED: Not used in new shipments-only approach (Oct 6, 2026)
    dealerAllocationsCount: dealerCount || 0,  // 🆕 NEW
    dealerPendingQty: dealerPendingQty,         // 🆕 NEW
    delayedShipmentsCount: delayedShipmentsCount, // 🆕 NEW (Oct 1, 2026)
  };
}

// ============================================
// GET FULFILLMENT SOURCE BREAKDOWN (NEW - Sept 25, 2026)
// Get distribution of allocations across fulfillment sources
// ============================================

export async function getFulfillmentSourceBreakdown(
  filters?: OperationsFilters
): Promise<{ data: import('../types').FulfillmentSourceBreakdown[] | null; error: Error | null }> {
  try {
    const supabase = createAdminClient();

    let query = supabase
      .from('fulfillment_allocations')
      .select(`
        fulfillment_source,
        quantity,
        sales_order_item:sales_order_items!inner(
          sales_order:sales_orders!inner(
            customer_id,
            id
          ),
          product_id
        )
      `);

    // Apply filters
    if (filters?.customerId) {
      query = query.eq('sales_order_item.sales_order.customer_id', filters.customerId);
    }
    if (filters?.productId) {
      query = query.eq('sales_order_item.product_id', filters.productId);
    }
    if (filters?.fulfillmentSource) {
      query = query.eq('fulfillment_source', filters.fulfillmentSource);
    }
    if (filters?.platinumDealerId) {
      query = query.eq('platinum_dealer_id', filters.platinumDealerId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Group by fulfillment_source
    const breakdown = new Map<string, number>();
    data?.forEach(alloc => {
      const source = alloc.fulfillment_source;
      breakdown.set(source, (breakdown.get(source) || 0) + alloc.quantity);
    });

    const result: import('../types').FulfillmentSourceBreakdown[] = Array.from(breakdown.entries()).map(([source, qty]) => ({
      source: source as import('../types').FulfillmentSource,
      quantity: qty,
      percentage: 0 // Will calculate after getting total
    }));

    // Calculate percentages
    const total = result.reduce((sum, item) => sum + item.quantity, 0);
    result.forEach(item => {
      item.percentage = total > 0 ? (item.quantity / total) * 100 : 0;
    });

    return { data: result, error: null };
  } catch (error) {
    console.error('getFulfillmentSourceBreakdown error:', error);
    return { data: null, error: error as Error };
  }
}

// ============================================
// GET SKU BREAKDOWN
// ============================================

/**
 * SKU Breakdown - Combined inventory across Supplier and GDC1
 *
 * Fetches from sales_order_items based on product_source:
 * - Supplier Outstanding: sales_orders where product_source = 'direct'
 * - GDC1 Available: sales_orders where product_source = 'warehouse'
 * - Only includes inventory-type products (excludes non_inventory and service)
 */
export async function getSKUBreakdown(filters?: OperationsFilters): Promise<SKUBreakdown[]> {
  // ============================================
  // NEW APPROACH (Oct 6, 2026): SKU Breakdown from GDC Inventories
  //
  // For each SKU:
  //   Galileo Outstanding Qty = Sum from GDC 0 where Status = OPEN
  //   GDC1 Available = Sum from GDC 1 where Status = AVAILABLE
  //   GDC2 Available = Sum from GDC 2 where Status = AVAILABLE
  //   Combined Qty = Galileo Outstanding + GDC1 Available + GDC2 Available
  //   Share of Combined = (SKU Combined Qty / Total Combined Qty) × 100%
  // ============================================

  // Get all GDC inventories (GDC 0, GDC 1, GDC 2, ...)
  const gdcInventories = await getAllGDCInventories(filters);

  // Aggregate by SKU
  const skuMap = new Map<string, {
    supplier: number;           // Galileo Outstanding (GDC 0, Status = OPEN)
    gdcInventory: Record<string, number>;  // { 'GDC 1': qty, 'GDC 2': qty, ... }
    productName: string;
  }>();

  // Process all GDC inventories
  gdcInventories.forEach(gdcData => {
    const orderSeries = gdcData.orderSeries;  // 'GDC 0', 'GDC 1', 'GDC 2', etc.

    gdcData.items.forEach(item => {
      const status = item.status.toUpperCase();

      // Process each SKU in this item
      item.items.forEach(skuItem => {
        const sku = skuItem.sku || 'Unknown';
        const qty = skuItem.qty || 0;
        const productName = skuItem.productName || sku;

        // Initialize SKU if not exists
        if (!skuMap.has(sku)) {
          skuMap.set(sku, {
            supplier: 0,
            gdcInventory: {},
            productName
          });
        }

        const current = skuMap.get(sku)!;

        // GDC 0 (Galileo) with Status = OPEN → Supplier Outstanding
        if (orderSeries === 'GDC 0' && status === 'OPEN') {
          current.supplier += qty;
        }
        // GDC 1, GDC 2, etc. with Status = AVAILABLE → GDC Inventory
        else if (orderSeries !== 'GDC 0' && status === 'AVAILABLE') {
          current.gdcInventory[orderSeries] = (current.gdcInventory[orderSeries] || 0) + qty;
        }
      });
    });
  });

  // Calculate totals
  let totalCombined = 0;
  skuMap.forEach((val) => {
    const gdcTotal = Object.values(val.gdcInventory).reduce((sum, qty) => sum + qty, 0);
    totalCombined += val.supplier + gdcTotal;
  });

  // Build result
  const result: SKUBreakdown[] = [];
  skuMap.forEach((val, sku) => {
    const gdcTotal = Object.values(val.gdcInventory).reduce((sum, qty) => sum + qty, 0);
    const combined = val.supplier + gdcTotal;

    result.push({
      sku,
      skuName: val.productName,
      supplierOutstandingQty: val.supplier,    // Galileo Outstanding (GDC 0, OPEN)
      gdcInventory: val.gdcInventory,          // { 'GDC 1': qty, 'GDC 2': qty, ... }
      combinedQty: combined,
      shareOfCombined: totalCombined > 0 ? Math.round((combined / totalCombined) * 1000) / 10 : 0,
    });
  });

  // Sort by combined qty descending
  result.sort((a, b) => b.combinedQty - a.combinedQty);

  return result;
}

// ============================================
// GET CUSTOMER COMMITMENTS
// ============================================

export async function getCustomerCommitments(filters?: OperationsFilters): Promise<CustomerCommitment[]> {
  // ============================================
  // NEW APPROACH (Oct 6, 2026): Customer Commitments from GDC Inventories
  //
  // For each customer:
  //   Outstanding Qty = Sum outstandingQty from GDC 0+1+2 where Status != AVAILABLE
  //   Invoice Amount = Sum invoiceAmount from GDC 0+1+2 where Status != AVAILABLE
  //   Loads = Count of records from GDC 0+1+2 where Status != AVAILABLE
  //
  // Important: EXCLUDE all AVAILABLE inventory (not committed to customer)
  // ============================================

  const supabase = createAdminClient();
  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get all GDC inventories (GDC 0, GDC 1, GDC 2, ...)
  const gdcInventories = await getAllGDCInventories(filters);

  // Query dealer fulfillment allocations directly from database
  const { data: dealerAllocations } = await supabase
    .from('fulfillment_allocations')
    .select(`
      id,
      quantity,
      fulfillment_source,
      status,
      sales_order_items!inner(
        quantity,
        sales_orders!inner(
          grand_total,
          order_number
        )
      ),
      platinum_dealer:platinum_dealers(dealer_name, code)
    `)
    .in('fulfillment_source', ['platinum_dealer_inventory', 'platinum_dealer_fulfillment'])
    .not('platinum_dealer_id', 'is', null);

  // Aggregate by customer
  const customerMap = new Map<string, {
    id: string;
    customer: string;
    loads: number;
    outstandingQty: number;
    invoiceAmount: number;
    inTransitNext7Days: number;
    // Fulfillment breakdown
    gdcQty: number;
    dealerQty: number;
    directQty: number;
  }>();

  // Aggregate by dealer (for GDC/DealerName entries) - from direct database query
  const dealerMap = new Map<string, {
    id: string;
    customer: string;  // Format: "GDC/{DealerName}"
    loads: number;
    outstandingQty: number;
    invoiceAmount: number;
    inTransitNext7Days: number;
    totalQty: number;  // Total qty from dealer allocation
  }>();

  // Track SOs that have dealer fulfillment (to exclude from customer counts)
  const dealerFulfilledSOs = new Set<string>();

  // Process dealer allocations from direct query
  if (dealerAllocations && dealerAllocations.length > 0) {
    // Group by dealer and SO to avoid counting same SO multiple times
    const processedSOs = new Set<string>();

    dealerAllocations.forEach((alloc: any) => {
      const dealer = toOne(alloc.platinum_dealer);
      const dealerName = dealer?.dealer_name || dealer?.code;
      if (!dealerName) return;

      const soItem = toOne(alloc.sales_order_items);
      const so = soItem ? toOne((soItem as any).sales_orders) : null;
      const soNumber = so?.order_number || '';
      const soKey = `${dealerName}-${soNumber}`;

      // Track this SO as dealer-fulfilled (to exclude from customer counts)
      // Normalize SO number (remove "C-" prefix if present)
      if (soNumber) {
        const normalizedSO = soNumber.replace(/^C-/i, '');
        dealerFulfilledSOs.add(normalizedSO);
        console.log(`[Dealer] Added SO to exclude: ${soNumber} -> ${normalizedSO}`);
      }

      // Skip if already processed this SO for this dealer
      if (processedSOs.has(soKey)) return;
      processedSOs.add(soKey);

      const dealerKey = `GDC/${dealerName}`;

      if (!dealerMap.has(dealerKey)) {
        dealerMap.set(dealerKey, {
          id: dealerKey,
          customer: dealerKey,
          loads: 0,
          outstandingQty: 0,
          invoiceAmount: 0,
          inTransitNext7Days: 0,
          totalQty: 0,
        });
      }

      const dealerEntry = dealerMap.get(dealerKey)!;
      dealerEntry.loads += 1;

      // Use SO item quantity (GDC's full qty), not allocation quantity
      const soItemQty = (soItem as any)?.quantity || 0;
      const grandTotal = so?.grand_total ? so.grand_total / 100 : 0; // cents to dollars
      // For dealer allocation, use full invoice amount
      dealerEntry.invoiceAmount += grandTotal > 0 ? grandTotal : 0;

      // Track total qty from SO item (GDC's qty, not allocation qty)
      dealerEntry.totalQty += soItemQty;

      // Outstanding qty for dealer fulfillments is typically 0 (already fulfilled)
      // But if status is not 'fulfilled', count the qty as outstanding
      if (alloc.status !== 'fulfilled') {
        dealerEntry.outstandingQty += soItemQty;
      }
    });
  }

  // Process all GDC inventories
  gdcInventories.forEach(gdcData => {
    gdcData.items.forEach(item => {
      const status = item.status.toUpperCase();

      // Only exclude AVAILABLE (unallocated stock)
      // INVOICED and SOLD items ARE included (but their Outstanding Qty will be 0)
      if (status === 'AVAILABLE') return;

      // Skip items without a PO (SOs that don't have linked POs yet)
      // Client's Excel only counts orders that have POs created
      if (!item.poNumber) {
        console.log(`[Customer] Skipping ${item.soNumber} - no linked PO`);
        return;
      }

      // Skip items that have dealer fulfillment (already counted under GDC/{DealerName})
      const soNumber = item.shipmentNumber || item.soNumber || '';
      // Normalize SO number (remove "C-" prefix if present) for comparison
      const normalizedSO = soNumber.replace(/^C-/i, '');
      if (normalizedSO && dealerFulfilledSOs.has(normalizedSO)) {
        console.log(`[Customer] Skipping ${normalizedSO} - dealer fulfilled`);
        return; // Don't count under customer - already counted under dealer
      }

      // Customer info
      const customerName = item.customer || 'Unknown';
      const customerId = item.customer || 'unknown'; // Use customer name as ID (temp solution)

      // Skip non-customer entries:
      // - "Unallocated" or "Gesher" (internal inventory)
      // - Warehouse names (e.g., "Kansas Warehouse", "Nebraska Warehouse")
      // - "Unknown" customer
      if (
        customerName === 'Unallocated' ||
        customerName === 'Gesher' ||
        customerName === 'Unknown' ||
        customerName.toLowerCase().includes('warehouse')
      ) return;

      // Initialize customer if not exists
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: customerId,
          customer: customerName,
          loads: 0,
          outstandingQty: 0,
          invoiceAmount: 0,
          inTransitNext7Days: 0,
          gdcQty: 0,
          dealerQty: 0,
          directQty: 0,
        });
      }

      const current = customerMap.get(customerId)!;

      // Increment counters
      current.loads += 1;
      current.outstandingQty += (item.outstandingQty || 0);
      current.invoiceAmount += (item.invoiceAmount || 0);

      // Track fulfillment breakdown by source
      const itemQty = item.totalQty || 0;
      const fulfillmentSource = item.fulfillmentSource || 'gdc_inventory';
      if (fulfillmentSource === 'gdc_inventory') {
        current.gdcQty += itemQty;
      } else if (fulfillmentSource === 'platinum_dealer_inventory' || fulfillmentSource === 'platinum_dealer_fulfillment') {
        current.dealerQty += itemQty;
      } else if (fulfillmentSource === 'direct') {
        current.directQty += itemQty;
      }

      // Check if ETA/delivery in next 7 days
      const etaDate = item.etaToUsPort || item.expectedDelivery;
      if (etaDate) {
        const eta = new Date(etaDate);
        if (eta >= now && eta <= next7Days) {
          current.inTransitNext7Days += 1;
        }
      }
    });
  });

  // Convert to array
  const result: CustomerCommitment[] = [];

  // Add customer entries
  customerMap.forEach((val) => {
    result.push({
      ...val,
      // Fulfillment breakdown from tracked values
      gdcQty: val.gdcQty,
      dealerInventoryQty: val.dealerQty,
      dealerFulfillmentQty: 0,
      manufacturerDirectQty: val.directQty,
    });
  });

  // Add dealer entries (GDC/DealerName format)
  dealerMap.forEach((val) => {
    result.push({
      ...val,
      // Fulfillment breakdown - GDC provides the qty to dealer
      gdcQty: val.totalQty,  // GDC's qty (72)
      dealerInventoryQty: 0,
      dealerFulfillmentQty: 0,
      manufacturerDirectQty: 0,
    });
  });

  // Sort by loads descending
  result.sort((a, b) => b.loads - a.loads);

  return result;
}

// ============================================
// GET SHIPMENT STATUS MIX
// Based on Jenny's Excel logic - same as KPI calculations:
// - AVAILABLE: GDC1 (warehouse) where status = draft/pending
// - SOLD: GDC1 (warehouse) where status = confirmed/processing
// - OPEN: Supplier Schedule (direct) where status = draft/pending
// - IN_TRANSIT: Any order where status = shipped
// - HOLD: From shipments table
// ============================================

export async function getShipmentStatusMix(filters?: OperationsFilters): Promise<ShipmentStatusMix[]> {
  // ============================================
  // NEW APPROACH (Oct 6, 2026): Status Mix from GDC Inventories
  // Calculate from all order series (GDC 0, GDC 1, GDC 2, ...)
  // For each status: Count loads, Sum (Total Qty - Delivered Qty)
  // ============================================

  // Get all GDC inventories (all order series)
  const gdcInventories = await getAllGDCInventories(filters);

  // Initialize status counters
  const statusMap = new Map<string, { loads: number; qty: number }>();

  // Process all GDC inventories
  gdcInventories.forEach(gdcData => {
    gdcData.items.forEach(item => {
      const status = item.status.toUpperCase();

      // Calculate remaining qty: Total Qty - Delivered Qty
      const remainingQty = (item.totalQty || 0) - (item.qtyDelivered || 0);

      // Initialize status if not exists
      if (!statusMap.has(status)) {
        statusMap.set(status, { loads: 0, qty: 0 });
      }

      // Increment counters
      const current = statusMap.get(status)!;
      current.loads += 1;  // Count this row/load
      current.qty += remainingQty;  // Add remaining qty
    });
  });

  // Convert to array
  const result: ShipmentStatusMix[] = [];
  statusMap.forEach((val, status) => {
    result.push({
      status: status as ShipmentStatus,
      loads: val.loads,
      qty: val.qty,
    });
  });

  // Sort by qty descending
  result.sort((a, b) => b.qty - a.qty);

  return result;
}

// ============================================
// GET IMMEDIATE ATTENTION ITEMS
// Based on Jenny's workflow: Show items that need immediate attention
// - In Transit shipments arriving in next 7 days
// - Overdue orders
// - Orders with delivery due in next 7 days
// Now pulls from BOTH shipments table AND sales_orders table
// ============================================

export async function getImmediateAttention(filters?: OperationsFilters): Promise<ImmediateAttentionItem[]> {
  const supabase = createAdminClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const result: ImmediateAttentionItem[] = [];

  // ============================================
  // 1. Get from SHIPMENTS table (traditional flow)
  // ============================================
  let shipQuery = supabase
    .from('shipments')
    .select(`
      id,
      shipment_number,
      supplier_reference_number,
      total_qty,
      eta_to_port,
      eta_port_tracking,
      customer_expected_delivery,
      status,
      load_status,
      action_required,
      is_delayed,
      estimated_arrival,
      sales_order_id,
      purchase_order_id,
      lfd_date,
      cma_cgm_last_sync,
      last_tracking_update,
      ship_to_name,
      ship_to_address_street,
      ship_to_address_city,
      ship_to_address_state,
      ship_to_address_postal_code,
      sales_orders(
        id,
        order_number,
        customer_po_number,
        requested_delivery_date,
        customer_id,
        customers(id, name),
        sales_order_items(
          id,
          fulfillment_allocations(
            fulfillment_source,
            quantity,
            platinum_dealer:platinum_dealers(dealer_name),
            dealer_location:platinum_dealer_locations(location_name)
          )
        )
      ),
      purchase_orders(
        id,
        po_number,
        sales_order_id,
        sales_orders(
          id,
          order_number,
          customer_po_number,
          requested_delivery_date,
          customer_id,
          customers(id, name)
        )
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Apply status filter to load_status
  if (filters?.status) {
    const statusMap: Record<ShipmentStatus, string> = {
      'AVAILABLE': 'available',
      'OPEN': 'open',
      'HOLD': 'hold',
      'IN_TRANSIT': 'in_transit',
      'SOLD': 'sold',
      'CLOSED': 'closed',
      'INVOICED': 'invoiced',
      'NOT_INVOICED': 'not_invoiced',
      'PARTIALLY_PAID': 'partially_paid',
      'PAID': 'paid',
      'DISPUTED': 'disputed',
      'PO_NEEDED': 'po_needed',
      'DELIVERED': 'delivered',
      'CONFIRMED': 'confirmed',
      'PROCESSING': 'processing',
    };
    shipQuery = shipQuery.eq('load_status', statusMap[filters.status]);
  }
  if (filters?.salesOrderId) {
    shipQuery = shipQuery.eq('sales_order_id', filters.salesOrderId);
  }
  if (filters?.isDelayed !== undefined) {
    shipQuery = shipQuery.eq('is_delayed', filters.isDelayed);
  }

  const { data: shipments, error: shipError } = await shipQuery;

  if (shipError) {
    console.error('Error fetching shipments for immediate attention:', shipError);
  }

  shipments?.forEach((s) => {
    const salesOrderData = toOne(s.sales_orders);
    const purchaseOrderData = toOne(s.purchase_orders);

    // For shipments linked to PO (but not direct SO), try to get SO from PO
    const poLinkedSO = purchaseOrderData?.sales_orders ? toOne(purchaseOrderData.sales_orders) : null;

    // Customer resolution order: Direct SO > PO → SO > ship_to_name (warehouse location) > Unknown
    const finalSO = salesOrderData || poLinkedSO;
    const customerName = toOne(finalSO?.customers)?.name || s.ship_to_name || 'Unknown';

    // PO Number resolution: SO customer PO > PO number (for unallocated) > N/A
    const customerPoNumber = finalSO?.customer_po_number || purchaseOrderData?.po_number || 'N/A';

    // Note: product_source column removed in migration 123
    // All shipments are included now (no warehouse/dropship distinction)

    // Apply filters on related sales order data
    if (filters?.customerId && finalSO?.customer_id !== filters.customerId) {
      return;
    }
    if (filters?.customerPoNumber && customerPoNumber !== filters.customerPoNumber) {
      return;
    }

    // Priority: eta_port_tracking (from shipping email) > eta_to_port (manual) > estimated_arrival
    const etaDate = s.eta_port_tracking || s.eta_to_port || s.estimated_arrival;
    const etaPort = etaDate ? new Date(etaDate) : null;
    const customerDueDate = s.customer_expected_delivery || finalSO?.requested_delivery_date;
    const customerDue = customerDueDate ? new Date(customerDueDate) : null;

    const isThisWeek = etaPort ? (etaPort >= now && etaPort <= next7Days) : false;
    const isOverdue = s.is_delayed || (customerDue ? customerDue < now : false);
    const status = s.load_status as string;
    const shipmentStatus = s.status as string;

    // LFD (Last Free Day) Alert calculations
    const lfdDateStr = s.lfd_date as string | null;
    const lfdDate = lfdDateStr ? new Date(lfdDateStr) : null;
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // LFD Critical: LFD is today or tomorrow
    const isLFDCritical = lfdDate ? (lfdDate <= tomorrow) : false;
    // LFD Approaching: LFD is within 3 days (but not critical)
    const isLFDApproaching = lfdDate ? (lfdDate > tomorrow && lfdDate <= in3Days) : false;

    // Check if shipment is delivered (either status column)
    // status = shipment_status enum (pending, in_transit, delivered, failed)
    // load_status = load_status enum (available, sold, open, hold, in_transit, invoiced)
    const isDelivered = shipmentStatus === 'delivered' || status === 'invoiced';

    // Delay Detection:
    // 1. Manual flag: is_delayed = true (set by AI from Seaair emails or manually)
    // 2. Auto-detect: ETA passed but shipment is not delivered
    const isManuallyDelayed = s.is_delayed === true;
    const isAutoDelayed = etaPort && etaPort < now && !isDelivered;
    const isDelayed = isManuallyDelayed || isAutoDelayed;

    // CRITICAL CHANGE (Oct 6, 2026): Only include records with:
    // 1. ETA in next 7 days (isThisWeek)
    // 2. OR Overdue (customer due date passed)
    // 3. OR Delayed (manual flag or auto-detected)
    // 4. OR LFD Alert (approaching/critical)
    // REMOVED: isActive condition (don't include just because status is open/in_transit)
    const hasLFDAlert = isLFDCritical || isLFDApproaching;

    const shouldInclude = filters?.status
      ? true  // Status filter already applied in query
      : (isThisWeek || isOverdue || isDelayed || hasLFDAlert);

    // Exclude delivered shipments from "Immediate Attention" section
    // EXCEPT if user specifically selects "DELIVERED" status filter
    const shouldShowDelivered = filters?.status === 'DELIVERED';
    const shouldExcludeDelivered = isDelivered && !shouldShowDelivered;

    if (shouldInclude && !shouldExcludeDelivered) {
      // 🆕 Extract fulfillment allocation data
      // Only available from direct sales_orders, not from PO → SO (since PO query doesn't include items)
      const soItems = salesOrderData?.sales_order_items as Array<{
        fulfillment_allocations?: Array<{
          fulfillment_source: string;
          quantity: number;
          platinum_dealer?: { dealer_name: string } | { dealer_name: string }[];
          dealer_location?: { location_name: string } | { location_name: string }[];
        }>;
      }> | undefined;
      const allocations = soItems?.[0]?.fulfillment_allocations || [];
      const primaryAllocation = allocations[0]; // Get first allocation as primary

      result.push({
        id: s.id,
        loadNumber: s.shipment_number || finalSO?.order_number || 'N/A',
        customer: customerName,
        po: customerPoNumber,
        qty: s.total_qty || 0,
        etaPort: etaDate,
        customerEtaDue: customerDueDate,
        status: mapLoadStatus(s.load_status),
        actionRequired: s.action_required || '',
        isOverdue,
        isThisWeek,
        productSource: 'direct', // Default value (product_source column removed)
        // LFD Alert fields
        lfdDate: lfdDateStr,
        isLFDApproaching,
        isLFDCritical,
        deliveryAddress: [
          s.ship_to_address_street,
          s.ship_to_address_city,
          s.ship_to_address_state,
          s.ship_to_address_postal_code
        ].filter(Boolean).join(', ') || undefined,
        // Delay Alert fields
        isDelayed: isDelayed || false,
        // Last Updated fields (Client requirement)
        lastUpdated: s.cma_cgm_last_sync || s.last_tracking_update || null,
        lastUpdatedSource: s.cma_cgm_last_sync ? 'CMA CGM API' : (s.last_tracking_update ? 'Email' : null),
        // 🆕 NEW: Fulfillment allocation fields
        fulfillmentSource: primaryAllocation?.fulfillment_source as import('../types').FulfillmentSource || null,
        allocatedToDealerName: toOne(primaryAllocation?.platinum_dealer)?.dealer_name || null,
        allocatedToDealerLocation: toOne(primaryAllocation?.dealer_location)?.location_name || null,
      });
    }
  });

  // ============================================
  // REMOVED (Oct 6, 2026): Sales Orders query
  // Only show records from SHIPMENTS table (not Sales Orders without shipments)
  // Client requirement: Immediate Attention should only show shipments with ETA in next 7 days,
  // plus overdue, delayed, and LFD alert shipments
  // ============================================

  // Sort by priority: LFD critical > LFD approaching > Delayed > Overdue > This week
  result.sort((a, b) => {
    // LFD Critical items first (highest priority)
    if (a.isLFDCritical && !b.isLFDCritical) { return -1; }
    if (!a.isLFDCritical && b.isLFDCritical) { return 1; }
    // LFD Approaching items next
    if (a.isLFDApproaching && !b.isLFDApproaching) { return -1; }
    if (!a.isLFDApproaching && b.isLFDApproaching) { return 1; }
    // Delayed items next
    if (a.isDelayed && !b.isDelayed) { return -1; }
    if (!a.isDelayed && b.isDelayed) { return 1; }
    // Then overdue items
    if (a.isOverdue && !b.isOverdue) { return -1; }
    if (!a.isOverdue && b.isOverdue) { return 1; }
    // Then this week items
    if (a.isThisWeek && !b.isThisWeek) { return -1; }
    if (!a.isThisWeek && b.isThisWeek) { return 1; }
    return 0;
  });

  return result;
}

// ============================================
// GET UNIQUE SKUs FOR DYNAMIC COLUMNS
// ============================================

export async function getUniqueSKUs(): Promise<string[]> {
  const supabase = createAdminClient();

  const { data: items, error } = await supabase
    .from('shipment_items')
    .select('sku')
    .not('sku', 'is', null);

  if (error) {
    console.error('Error fetching unique SKUs:', error);
    return [];
  }

  // Get unique SKUs and sort them
  const uniqueSkus = [...new Set(items?.map((i) => i.sku) || [])].sort();
  return uniqueSkus;
}

// ============================================
// GET SUPPLIER SHIPMENT SCHEDULE (Galileo)
// ============================================

/**
 * Supplier Shipment Schedule - Sales Orders fulfilled via Dropship
 *
 * Shows Sales Orders where product_source = 'direct'
 * These are orders that ship directly from supplier (Galileo) to customer
 * Status mapping:
 *   - draft, pending → OPEN (order placed, not yet confirmed)
 *   - confirmed, processing → SOLD (committed to customer)
 *   - shipped → IN_TRANSIT
 *   - delivered → DELIVERED
 *   - cancelled → excluded
 */
export async function getSupplierShipmentSchedule(filters?: OperationsFilters): Promise<{ data: ShipmentScheduleItem[]; uniqueSkus: SKUColumnInfo[] }> {
  const supabase = createAdminClient();

  // Map ShipmentStatus to SO status for filtering
  const statusToSoStatus: Partial<Record<ShipmentStatus, string[]>> = {
    'OPEN': ['draft', 'pending'],
    'SOLD': ['confirmed', 'processing'],
    'IN_TRANSIT': ['shipped'],
    'DELIVERED': ['delivered'],
  };

  // Get Sales Orders (all orders - product_source column removed in migration 123)
  // Also fetch linked shipments to get load_status for consistent status display
  let soQuery = supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_date,
      customer_id,
      customer_po_number,
      requested_delivery_date,
      status,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      eta_to_us_port,
      confirmed_eta,
      actual_delivery_date,
      qty_delivered,
      outstanding_qty,
      subtotal,
      grand_total,
      internal_notes,
      created_at,
      customers(
        id,
        name
      ),
      shipments(
        id,
        shipment_number,
        load_status
      )
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.customerId) {
    soQuery = soQuery.eq('customer_id', filters.customerId);
  }
  if (filters?.salesOrderId) {
    soQuery = soQuery.eq('id', filters.salesOrderId);
  }
  if (filters?.customerPoNumber) {
    soQuery = soQuery.eq('customer_po_number', filters.customerPoNumber);
  }
  if (filters?.status && statusToSoStatus[filters.status]) {
    soQuery = soQuery.in('status', statusToSoStatus[filters.status]!);
  }

  const { data: salesOrders, error } = await soQuery;

  if (error) {
    console.error('Error fetching supplier schedule:', error);
    throw error;
  }

  // Get sales order items for SKU breakdown with product names
  // Using left join to avoid errors when no products exist
  const salesOrderIds = salesOrders?.map((s) => s.id) || [];

  let itemsQuery = supabase
    .from('sales_order_items')
    .select(`
      sales_order_id,
      sku,
      description,
      quantity,
      unit_price,
      line_total,
      product_id,
      products(id, name, item_type)
    `)
    .in('sales_order_id', salesOrderIds);

  // Apply product filter
  if (filters?.productId) {
    itemsQuery = itemsQuery.eq('product_id', filters.productId);
  }

  const { data: items } = await itemsQuery;

  // Group items by sales order and build SKU info map
  // Also track prices per SKU per order for price columns
  // Filter to only include inventory products in JavaScript
  const itemsBySalesOrder = new Map<string, { sku: string; productName: string; qty: number; unitPrice: number }[]>();
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  items?.forEach((item) => {
    // Get product name: prefer products.name, fallback to description, then sku
    const productData = toOne(item.products);
    // Skip non-inventory products
    if (productData && productData.item_type !== 'inventory') return;
    const productName = productData?.name || item.description || item.sku;
    // unit_price is stored in cents, convert to dollars
    const unitPrice = item.unit_price ? item.unit_price / 100 : 0;

    // Store SKU info for column headers
    if (!skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
    }

    if (!itemsBySalesOrder.has(item.sales_order_id)) {
      itemsBySalesOrder.set(item.sales_order_id, []);
    }
    itemsBySalesOrder.get(item.sales_order_id)!.push({
      sku: item.sku,
      productName,
      qty: item.quantity,
      unitPrice,
    });
  });

  // Map Sales Order status to ShipmentStatus for Supplier Schedule
  // Used as fallback when no shipment exists
  const mapSalesOrderStatusToSupplier = (status: string): ShipmentStatus => {
    switch (status) {
      case 'draft':
      case 'pending':
        return 'OPEN';       // Order placed, not yet confirmed
      case 'confirmed':
      case 'processing':
        return 'SOLD';       // Committed to customer
      case 'shipped':
        return 'IN_TRANSIT'; // On the way
      case 'delivered':
        return 'DELIVERED';  // Delivered to customer
      default:
        return 'OPEN';
    }
  };

  // Get status from shipment if exists, otherwise from sales order
  // This ensures consistent status display across all tabs
  const getDisplayStatus = (so: { status: string; shipments?: unknown }): ShipmentStatus => {
    // Check if linked shipment exists with load_status
    const shipment = toOne(so.shipments) as { load_status?: string } | null;
    if (shipment?.load_status) {
      // Use shipment's load_status for consistency with Executive Summary
      return mapLoadStatus(shipment.load_status);
    }
    // Fallback to sales order status
    return mapSalesOrderStatusToSupplier(so.status);
  };

  const result: ShipmentScheduleItem[] = [];

  salesOrders?.forEach((so, index) => {
    // Handle relationship data - customers
    const customerData = toOne(so.customers);

    // Get sales order items
    const soItems = itemsBySalesOrder.get(so.id) || [];

    // Calculate total quantity
    const totalQty = soItems.reduce((sum, item) => sum + item.qty, 0);

    // Build address
    const addressParts = [
      so.shipping_address_street,
      so.shipping_address_city,
      so.shipping_address_state,
      so.shipping_address_postal_code,
    ].filter(Boolean);

    // Get shipment number if shipment exists, otherwise use order number
    const shipment = toOne(so.shipments) as { shipment_number?: string; load_status?: string } | null;
    const loadNumber = shipment?.shipment_number || so.order_number || 'N/A';

    // PO # from customer_po_number
    const poNumber = so.customer_po_number || 'N/A';

    result.push({
      id: so.id,
      no: index + 1,
      loadNumber,
      items: soItems,
      totalQty: totalQty,
      customer: customerData?.name || 'Unknown',
      po: poNumber,
      etaToUsPort: so.eta_to_us_port || null,
      deliveryAddress: addressParts.join(', '),
      confirmedEta: so.confirmed_eta || null,
      customerExpectedDelivery: so.requested_delivery_date,
      actualDeliveryDate: so.actual_delivery_date || null,
      qtyDelivered: so.qty_delivered || 0,
      outstandingQtyForPO: so.outstanding_qty ?? totalQty,
      invoiceNumber: null,  // Invoice #
      invoiceAmount: so.grand_total ? so.grand_total / 100 : 0,  // Invoice Amount (cents to dollars)
      // Prices are dynamic per product via items[].unitPrice
      payment50PercentDate: null,  // 50% Payment Date
      remaining50DueDate: null,    // Remaining 50% Due Date
      status: getDisplayStatus(so),  // Use shipment status if exists, else SO status
      actionRequired: so.internal_notes || '',  // Action Required / Notes (from internal_notes)
      ankurNotes: '',  // Ankur Comments (separate field - TODO: add to DB if needed)
    });
  });

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  const seenSkus = new Set<string>();

  skuInfoMap.forEach((productName, sku) => {
    if (!seenSkus.has(sku)) {
      seenSkus.add(sku);
      uniqueSkus.push({ sku, productName });
    }
  });

  // Sort by SKU
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  return { data: result, uniqueSkus };
}

// ============================================
// GET GDC1 INVENTORY
// ============================================

/**
 * GDC1 Inventory - Sales Orders fulfilled from warehouse
 *
 * Shows Sales Orders where product_source = 'warehouse'
 * Status mapping:
 *   - draft, pending → AVAILABLE (in stock, not committed)
 *   - confirmed, processing → SOLD (committed to customer)
 *   - shipped, delivered → INVOICED
 *   - cancelled → excluded
 */
export async function getGDC1Inventory(filters?: OperationsFilters): Promise<{ data: GDC1InventoryItem[]; uniqueSkus: SKUColumnInfo[] }> {
  const supabase = createAdminClient();

  // Map ShipmentStatus to SO status for filtering
  const statusToSoStatus: Partial<Record<ShipmentStatus, string[]>> = {
    'AVAILABLE': ['draft', 'pending'],
    'SOLD': ['confirmed', 'processing'],
    'INVOICED': ['shipped', 'delivered'],
  };

  // Get Sales Orders (all orders - product_source column removed in migration 123)
  // Also fetch linked shipments to get load_status for consistent status display
  let soQuery = supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_date,
      customer_id,
      customer_po_number,
      requested_delivery_date,
      status,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      eta_to_us_port,
      confirmed_eta,
      actual_delivery_date,
      qty_delivered,
      outstanding_qty,
      subtotal,
      grand_total,
      internal_notes,
      created_at,
      customers(
        id,
        name
      ),
      shipments(
        id,
        shipment_number,
        load_status
      )
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.customerId) {
    soQuery = soQuery.eq('customer_id', filters.customerId);
  }
  if (filters?.salesOrderId) {
    soQuery = soQuery.eq('id', filters.salesOrderId);
  }
  if (filters?.customerPoNumber) {
    soQuery = soQuery.eq('customer_po_number', filters.customerPoNumber);
  }
  if (filters?.status && statusToSoStatus[filters.status]) {
    soQuery = soQuery.in('status', statusToSoStatus[filters.status]!);
  }

  const { data: salesOrders, error } = await soQuery;

  if (error) {
    console.error('Error fetching GDC1 inventory:', error);
    throw error;
  }

  // Get sales order items for SKU breakdown with product names and prices
  // Using left join to avoid errors when no products exist
  const salesOrderIds = salesOrders?.map((s) => s.id) || [];

  let itemsQuery = supabase
    .from('sales_order_items')
    .select(`
      sales_order_id,
      sku,
      description,
      quantity,
      unit_price,
      line_total,
      product_id,
      products(id, name, item_type)
    `)
    .in('sales_order_id', salesOrderIds);

  // Apply product filter
  if (filters?.productId) {
    itemsQuery = itemsQuery.eq('product_id', filters.productId);
  }

  const { data: items } = await itemsQuery;

  // Group items by sales order and build SKU info map
  // Also track prices per SKU per order for price columns
  // Filter to only include inventory products in JavaScript
  const itemsBySalesOrder = new Map<string, { sku: string; productName: string; qty: number; unitPrice: number }[]>();
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  items?.forEach((item) => {
    // Get product name: prefer products.name, fallback to description, then sku
    const productData = toOne(item.products);
    // Skip non-inventory products
    if (productData && productData.item_type !== 'inventory') return;
    const productName = productData?.name || item.description || item.sku;
    // unit_price is stored in cents, convert to dollars
    const unitPrice = item.unit_price ? item.unit_price / 100 : 0;

    // Store SKU info for column headers
    if (!skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
    }

    if (!itemsBySalesOrder.has(item.sales_order_id)) {
      itemsBySalesOrder.set(item.sales_order_id, []);
    }
    itemsBySalesOrder.get(item.sales_order_id)!.push({
      sku: item.sku,
      productName,
      qty: item.quantity,
      unitPrice,
    });
  });

  // Map Sales Order status to GDC1 status
  // Used as fallback when no shipment exists
  const mapSalesOrderStatusToGDC1 = (status: string): ShipmentStatus => {
    switch (status) {
      case 'draft':
      case 'pending':
        return 'AVAILABLE';  // In stock, not committed
      case 'confirmed':
      case 'processing':
        return 'SOLD';       // Committed to customer
      case 'shipped':
      case 'delivered':
        return 'INVOICED';   // Shipped/Delivered
      default:
        return 'OPEN';
    }
  };

  // Get status from shipment if exists, otherwise from sales order
  // This ensures consistent status display across all tabs
  const getGDC1DisplayStatus = (so: { status: string; shipments?: unknown }): ShipmentStatus => {
    // Check if linked shipment exists with load_status
    const shipment = toOne(so.shipments) as { load_status?: string } | null;
    if (shipment?.load_status) {
      // Use shipment's load_status for consistency with Executive Summary
      return mapLoadStatus(shipment.load_status);
    }
    // Fallback to sales order status mapping for GDC1
    return mapSalesOrderStatusToGDC1(so.status);
  };

  const result: GDC1InventoryItem[] = [];

  salesOrders?.forEach((so, index) => {
    // Handle relationship data - customers
    const customerData = toOne(so.customers);

    // Get sales order items
    const soItems = itemsBySalesOrder.get(so.id) || [];

    // Calculate total quantity and per-SKU quantities and prices
    const totalQty = soItems.reduce((sum, item) => sum + item.qty, 0);

    // Calculate specific SKU quantities and extract prices (for 290/85R38 and 380/85R24)
    let sku290Qty = 0;
    let sku380Qty = 0;
    let price38: number | null = null;  // Price for 38" tire (290/85R38)
    let price24: number | null = null;  // Price for 24" tire (380/85R24)

    soItems.forEach((item) => {
      const skuLower = item.sku.toLowerCase();
      if (skuLower.includes('290/85r38') || skuLower.includes('290-85r38') || skuLower.includes('38')) {
        sku290Qty += item.qty;
        // Get price for 38" tire (use first price found)
        if (price38 === null && item.unitPrice > 0) {
          price38 = item.unitPrice;
        }
      } else if (skuLower.includes('380/85r24') || skuLower.includes('380-85r24') || skuLower.includes('24')) {
        sku380Qty += item.qty;
        // Get price for 24" tire (use first price found)
        if (price24 === null && item.unitPrice > 0) {
          price24 = item.unitPrice;
        }
      }
    });

    // Build address
    const addressParts = [
      so.shipping_address_street,
      so.shipping_address_city,
      so.shipping_address_state,
      so.shipping_address_postal_code,
    ].filter(Boolean);

    // Get shipment data if exists (id, number, status)
    const shipment = toOne(so.shipments) as { id?: string; shipment_number?: string; load_status?: string } | null;
    const loadNumber = shipment?.shipment_number || so.order_number;

    // CRITICAL FIX: Use shipment ID (not SO ID) so status updates work correctly
    // This allows updateShipmentOrOrder to find the record in shipments table
    result.push({
      id: shipment?.id || so.id,  // Shipment ID first, fallback to SO ID if no shipment
      no: index + 1,
      loadNumber,
      sku290Qty,   // 290/85R38 CW Qty
      sku380Qty,   // 380/85R24 CW Qty
      items: soItems,
      totalQty: totalQty,
      customer: customerData?.name || null,
      po: so.customer_po_number || null,
      etaToUsPort: so.eta_to_us_port || null,
      deliveryAddress: addressParts.join(', '),
      confirmedEta: so.confirmed_eta || null,
      customerExpectedDelivery: so.requested_delivery_date,  // Customer Expected Delivery
      actualDelivery: so.actual_delivery_date || null,
      qtyDelivered: so.qty_delivered || 0,
      outstandingPoQty: so.outstanding_qty || totalQty,
      invoiceNumber: null,   // Invoice #
      invoiceAmount: so.grand_total ? so.grand_total / 100 : 0,  // Invoice Amount (cents to dollars)
      // Prices are dynamic per product via items[].unitPrice
      payment50PercentDate: null,  // 50% Payment Date
      remaining50DueDate: null,    // Remaining 50% Due Date
      status: getGDC1DisplayStatus(so),  // Use shipment status if exists, else SO status
      actionRequired: so.internal_notes || '',  // Action Required / Notes (from internal_notes)
      ankurNotes: '',  // Ankur Comments (separate field - TODO: add to DB if needed)
    });
  });

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  const seenSkus = new Set<string>();

  skuInfoMap.forEach((productName, sku) => {
    if (!seenSkus.has(sku)) {
      seenSkus.add(sku);
      uniqueSkus.push({ sku, productName });
    }
  });

  // Sort by SKU
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  return { data: result, uniqueSkus };
}

// ============================================
// GET GDC INVENTORY BY ORDER SERIES (from Sales Orders AND Unallocated POs)
// Shows Purchase Orders filtered by order_series:
// 1. POs linked to Sales Orders where SO.order_series matches
// 2. Unallocated POs (no linked SO) where PO.order_series matches directly
// ============================================

export async function getGDCInventoryByOrderSeries(
  orderSeries: string,
  filters?: OperationsFilters
): Promise<GDCInventoryData> {
  // Use admin client to bypass RLS policies (fixes infinite recursion error)
  const supabase = createAdminClient();

  console.log(`[GDC] ========== Fetching Purchase Orders for order_series: ${orderSeries} ==========`);

  // ============================================
  // NEW APPROACH (Aug 27, 2025): Query Purchase Orders DIRECTLY by order_series
  // Then optionally join with Sales Orders if allocated
  // This shows both allocated POs (with customer) and unallocated POs (customer="Gesher")
  // ============================================

  let poQuery = supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      po_date,
      expected_delivery_date,
      confirmed_eta,
      actual_delivery_date,
      qty_delivered,
      outstanding_qty,
      status,
      load_status,
      order_series,
      internal_notes,
      sales_order_id,
      warehouse_id,
      grand_total,
      created_at,
      sales_orders (
        id,
        order_number,
        status,
        customer_id,
        customer_po_number,
        eta_to_us_port,
        confirmed_eta,
        requested_delivery_date,
        customer_expected_delivery,
        actual_delivery_date,
        qty_delivered,
        outstanding_qty,
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        grand_total,
        customers (id, name)
      ),
      locations:warehouse_id (
        id,
        name
      )
    `)
    .is('deleted_at', null)
    .eq('order_series', orderSeries)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  // Apply filters
  if (filters?.salesOrderId) {
    poQuery = poQuery.eq('sales_order_id', filters.salesOrderId);
  }

  const { data: purchaseOrders, error: poError } = await poQuery;

  if (poError) {
    console.error(`[GDC] Error fetching purchase orders for ${orderSeries}:`, poError);
    throw poError;
  }

  console.log(`[GDC] Found ${purchaseOrders?.length || 0} Purchase Orders for '${orderSeries}'`);

  // ============================================
  // QUERY 1B: Fetch Sales Orders WITHOUT Purchase Orders
  // (For orders with fulfillment allocations but no PO created yet)
  // ============================================
  let soQuery = supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      order_series,
      customer_id,
      customer_po_number,
      eta_to_us_port,
      confirmed_eta,
      requested_delivery_date,
      customer_expected_delivery,
      actual_delivery_date,
      qty_delivered,
      outstanding_qty,
      shipping_address_street,
      shipping_address_city,
      shipping_address_state,
      shipping_address_postal_code,
      grand_total,
      status,
      internal_notes,
      created_at,
      customers (id, name)
    `)
    .eq('order_series', orderSeries)
    .neq('status', 'cancelled')
    .neq('status', 'delivered')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Only fetch SOs that don't have POs
  const poSalesOrderIds = purchaseOrders?.map(po => po.sales_order_id).filter(Boolean) || [];
  if (poSalesOrderIds.length > 0) {
    soQuery = soQuery.not('id', 'in', `(${poSalesOrderIds.join(',')})`);
  }

  const { data: salesOrdersWithoutPOs, error: soError } = await soQuery;

  if (soError) {
    console.error(`[GDC] Error fetching sales orders for ${orderSeries}:`, soError);
  }

  console.log(`[GDC] Found ${salesOrdersWithoutPOs?.length || 0} Sales Orders without POs for '${orderSeries}'`);

  if ((!purchaseOrders || purchaseOrders.length === 0) && (!salesOrdersWithoutPOs || salesOrdersWithoutPOs.length === 0)) {
    console.log(`[GDC] No Purchase Orders or Sales Orders found for ${orderSeries}`);
    return { orderSeries, items: [], uniqueSkus: [] };
  }

  console.log(`[GDC] Sample PO data:`, purchaseOrders.slice(0, 2).map(po => ({
    id: po.id,
    po_number: po.po_number,
    status: po.status,
    has_sales_order: !!po.sales_order_id,
    sales_order_number: po.sales_orders ? toOne(po.sales_orders)?.order_number : null
  })));

  // ============================================
  // QUERY 2: Get Purchase Order Items for SKU breakdown
  // ============================================
  const poIds = purchaseOrders.map(po => po.id);

  let poItemsQuery = supabase
    .from('purchase_order_items')
    .select(`
      purchase_order_id,
      sku,
      description,
      quantity_ordered,
      unit_price,
      product_id,
      supplier_id,
      supplier_name,
      products(id, name, item_type),
      sales_order_item_id,
      sales_order_items(
        id,
        fulfillment_allocations(
          id,
          fulfillment_source,
          quantity,
          status,
          location:locations(name),
          platinum_dealer:platinum_dealers(dealer_name, code),
          dealer_location:platinum_dealer_locations(location_name)
        )
      )
    `)
    .in('purchase_order_id', poIds);

  // Apply product filter
  if (filters?.productId) {
    poItemsQuery = poItemsQuery.eq('product_id', filters.productId);
  }

  const { data: poItems } = await poItemsQuery;

  console.log(`[GDC] Found ${poItems?.length || 0} Purchase Order Items`);

  // ============================================
  // QUERY 2B: Get Sales Order Items (for SOs without POs)
  // ============================================
  const soIds = salesOrdersWithoutPOs?.map(so => so.id) || [];
  let soItems: any[] = [];

  if (soIds.length > 0) {
    let soItemsQuery = supabase
      .from('sales_order_items')
      .select(`
        sales_order_id,
        sku,
        description,
        quantity,
        unit_price,
        product_id,
        products(id, name, item_type),
        fulfillment_allocations(
          id,
          fulfillment_source,
          quantity,
          status,
          location:locations(name),
          platinum_dealer:platinum_dealers(dealer_name, code),
          dealer_location:platinum_dealer_locations(location_name)
        )
      `)
      .in('sales_order_id', soIds);

    // Apply product filter
    if (filters?.productId) {
      soItemsQuery = soItemsQuery.eq('product_id', filters.productId);
    }

    const { data: fetchedSOItems } = await soItemsQuery;
    soItems = fetchedSOItems || [];
    console.log(`[GDC] Found ${soItems.length} Sales Order Items (without POs)`);
  }

  // ============================================
  // QUERY 3: Get Shipments for these POs and SOs (for ETA dates and status)
  // ============================================
  const soIdsForShipments = salesOrdersWithoutPOs?.map(so => so.id) || [];

  // Fetch shipments for both POs and SOs
  const shipmentsForPOs = poIds.length > 0 ? await supabase
    .from('shipments')
    .select(`
      id,
      shipment_number,
      purchase_order_id,
      sales_order_id,
      status,
      load_status,
      eta_to_port,
      confirmed_eta,
      customer_expected_delivery,
      actual_arrival,
      qty_delivered,
      outstanding_qty
    `)
    .in('purchase_order_id', poIds) : { data: [] };

  const shipmentsForSOs = soIdsForShipments.length > 0 ? await supabase
    .from('shipments')
    .select(`
      id,
      shipment_number,
      purchase_order_id,
      sales_order_id,
      status,
      load_status,
      eta_to_port,
      confirmed_eta,
      customer_expected_delivery,
      actual_arrival,
      qty_delivered,
      outstanding_qty
    `)
    .in('sales_order_id', soIdsForShipments) : { data: [] };

  const shipments = [...(shipmentsForPOs.data || []), ...(shipmentsForSOs.data || [])];

  console.log(`[GDC] Found ${shipments.length} Shipments (${shipmentsForPOs.data?.length || 0} for POs, ${shipmentsForSOs.data?.length || 0} for SOs)`);

  // Map shipments by purchase_order_id and sales_order_id
  const shipmentByPO = new Map<string, any>();
  const shipmentBySO = new Map<string, any>();

  shipments.forEach((shipment) => {
    if (shipment.purchase_order_id && !shipmentByPO.has(shipment.purchase_order_id)) {
      shipmentByPO.set(shipment.purchase_order_id, shipment);
    }
    if (shipment.sales_order_id && !shipmentBySO.has(shipment.sales_order_id)) {
      shipmentBySO.set(shipment.sales_order_id, shipment);
    }
  });

  // Group items by purchase order and build SKU info map
  const itemsByPO = new Map<string, { sku: string; productName: string; qty: number; unitPrice: number }[]>();
  const supplierNameByPO = new Map<string, string>(); // purchase_order_id -> supplier_name
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  poItems?.forEach((item) => {
    const productData = toOne(item.products);
    const productName = productData?.name || item.description || item.sku;
    const unitPrice = item.unit_price ? item.unit_price / 100 : 0;

    // Store SKU info for column headers
    if (item.sku && !skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
    }

    // Store supplier name for this PO (from first item)
    if (item.supplier_name && !supplierNameByPO.has(item.purchase_order_id)) {
      supplierNameByPO.set(item.purchase_order_id, item.supplier_name);
    }

    if (!itemsByPO.has(item.purchase_order_id)) {
      itemsByPO.set(item.purchase_order_id, []);
    }
    itemsByPO.get(item.purchase_order_id)!.push({
      sku: item.sku || 'Unknown',
      productName,
      qty: item.quantity_ordered || 0,
      unitPrice,
    });
  });

  // ============================================
  // Build result items from Purchase Orders
  // ============================================
  const result: GDCInventoryItem[] = [];
  let allocatedCount = 0;
  let unallocatedCount = 0;

  purchaseOrders.forEach((po, index) => {
    const linkedSO = po.sales_orders ? toOne(po.sales_orders) : null;

    // Get shipment data for this PO (early fetch for filtering)
    const shipment = shipmentByPO.get(po.id);

    // Skip delivered shipments based on filter:
    // - If status filter = "DELIVERED" → show only delivered
    // - If status filter = undefined ("All Statuses") → show all (including delivered)
    // - If status filter = other status → hide delivered
    const isDelivered = linkedSO?.status === 'delivered' || shipment?.status === 'delivered';

    if (filters?.status) {
      // Status filter is active
      if (filters.status === 'DELIVERED' && !isDelivered) {
        return; // Skip non-delivered when filter is DELIVERED
      } else if (filters.status !== 'DELIVERED' && isDelivered) {
        return; // Skip delivered when filter is other status
      }
    }
    // If no status filter → show all (including delivered)

    const customerData = linkedSO?.customers ? toOne(linkedSO.customers) : null;
    const warehouseData = (po as any).locations ? toOne((po as any).locations) : null;
    const isAllocated = !!linkedSO;

    const poItemsList = itemsByPO.get(po.id) || [];
    const totalQty = poItemsList.reduce((sum, item) => sum + item.qty, 0);

    // Skip POs with no items when product filter is active
    // (means this PO doesn't have the filtered product)
    if (filters?.productId && poItemsList.length === 0) {
      return;
    }

    // Build address from SO if allocated
    const addressParts = linkedSO ? [
      linkedSO.shipping_address_street,
      linkedSO.shipping_address_city,
      linkedSO.shipping_address_state,
      linkedSO.shipping_address_postal_code,
    ].filter(Boolean) : [];

    // Determine customer/warehouse name
    let customerName: string;
    if (isAllocated && customerData?.name) {
      // Allocated to customer - show customer name
      customerName = customerData.name;
      allocatedCount++;
    } else if (warehouseData?.name) {
      // Unallocated but has warehouse - show warehouse name
      customerName = warehouseData.name;
      unallocatedCount++;
    } else {
      // No warehouse assigned - show "Unallocated"
      customerName = 'Unallocated';
      unallocatedCount++;
    }

    // Apply customer filter
    if (filters?.customerId && (!linkedSO || linkedSO.customer_id !== filters.customerId)) {
      return; // Skip this PO if it doesn't match customer filter
    }

    console.log(`[GDC] Row ${index + 1} - PO: ${po.po_number} (${po.id}), SO: ${linkedSO?.order_number || 'None'}, Customer: ${customerName}, Status: ${po.status}, OrderSeries: ${po.order_series}`);

    // 🆕 Extract fulfillment allocation data from first PO item
    const firstPoItem = poItems?.find(item => item.purchase_order_id === po.id);
    const soItemData = firstPoItem?.sales_order_items ? toOne(firstPoItem.sales_order_items) : null;
    const allocationsRaw = (soItemData as any)?.fulfillment_allocations as Array<{
      fulfillment_source: string;
      quantity: number;
      status: string;
      location?: { name: string } | { name: string }[];
      platinum_dealer?: { dealer_name: string; code: string } | { dealer_name: string; code: string }[];
      dealer_location?: { location_name: string } | { location_name: string }[];
    }> | undefined;
    const primaryAllocation = allocationsRaw?.[0]; // Get first allocation as primary

    // Get supplier name for this PO
    const poSupplierName = supplierNameByPO.get(po.id) || null;

    // DEBUG: Log allocations raw data for SO2600023
    if (linkedSO?.order_number === 'SO2600023') {
      console.log('[DEBUG] SO2600023 Allocations Raw:', JSON.stringify(allocationsRaw, null, 2));
    }

    // Map allocations to FulfillmentAllocationDetail array
    const allocationDetails: import('../types').FulfillmentAllocationDetail[] | undefined = allocationsRaw?.map(alloc => {
      const locationName = toOne(alloc.location)?.name;
      const dealerName = toOne(alloc.platinum_dealer)?.dealer_name;
      const dealerLocationName = toOne(alloc.dealer_location)?.location_name;
      const finalLocation = locationName || dealerName || dealerLocationName || null;

      // DEBUG: Log mapping for SO2600023
      if (linkedSO?.order_number === 'SO2600023') {
        console.log('[DEBUG] Allocation mapping:', {
          source: alloc.fulfillment_source,
          locationName,
          dealerName,
          dealerLocationName,
          finalLocation,
        });
      }

      return {
        source: alloc.fulfillment_source as import('../types').FulfillmentSource,
        quantity: alloc.quantity,
        status: alloc.status as import('../types').AllocationStatus,
        locationOrDealer: finalLocation,
        // For 'direct' source, use PO supplier name; for others, use dealer/location name
        supplierName: alloc.fulfillment_source === 'direct' ? poSupplierName : (dealerName || null),
      };
    });

    // Determine which status to show:
    // Priority: Shipment load_status > PO load_status
    // Use load_status (Operations status: AVAILABLE, OPEN, CLOSED, etc.)
    let displayStatus = po.load_status ? po.load_status.toUpperCase() : (po.status ? po.status.toUpperCase() : 'OPEN');
    if (shipment?.load_status) {
      displayStatus = shipment.load_status.toUpperCase();
    }

    // Calculate qtyDelivered first, then compute outstandingQty
    const qtyDelivered = shipment?.qty_delivered ?? linkedSO?.qty_delivered ?? po.qty_delivered ?? 0;
    // Outstanding Qty = MAX(Total Qty - Qty Delivered, 0)
    const outstandingQty = Math.max(totalQty - qtyDelivered, 0);

    const itemData = {
      id: po.id, // Always use PO ID (not SO ID)
      no: index + 1,
      // PO Column: Show customer PO if allocated to customer, otherwise show Purchase Order number
      poNumber: linkedSO?.customer_po_number || po.po_number,
      soNumber: linkedSO?.order_number || null,
      shipmentNumber: shipment?.shipment_number || null, // Shipment number (SO2600063)
      customerPoNumber: linkedSO?.customer_po_number || null, // Customer PO Number
      orderSeries: po.order_series,
      items: poItemsList.map(item => ({
        sku: item.sku,
        productName: item.productName,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
      totalQty,
      customer: customerName,
      supplierName: supplierNameByPO.get(po.id) || null,
      etaToUsPort: shipment?.eta_to_port || linkedSO?.eta_to_us_port || null,
      confirmedEta: shipment?.confirmed_eta || linkedSO?.confirmed_eta || po.confirmed_eta || null,
      actualDeliveryDate: shipment?.actual_arrival || linkedSO?.actual_delivery_date || po.actual_delivery_date || null,
      qtyDelivered,
      outstandingQty,
      invoiceAmount: linkedSO?.grand_total
        ? linkedSO.grand_total / 100  // Customer invoice (for allocated POs)
        : po.grand_total / 100 || 0,  // PO amount (for warehouse/unallocated POs)
      deliveryAddress: addressParts.join(', '),
      expectedDelivery: shipment?.customer_expected_delivery || po.expected_delivery_date || linkedSO?.requested_delivery_date || null,
      status: displayStatus, // Shipment status (if exists) or PO status
      actionRequired: po.internal_notes || '',
      notes: '',
      isUnallocated: !isAllocated,
      // 🆕 NEW: Fulfillment allocation fields
      fulfillmentSource: (primaryAllocation?.fulfillment_source as import('../types').FulfillmentSource) || 'gdc_inventory',
      allocatedToDealerName: toOne(primaryAllocation?.platinum_dealer)?.dealer_name || null,
      allocatedToDealerLocation: toOne(primaryAllocation?.dealer_location)?.location_name || null,
      allocationStatus: (primaryAllocation?.status as import('../types').AllocationStatus) || null,
      // 🆕 Multiple fulfillment allocations array
      allocations: allocationDetails && allocationDetails.length > 0 ? allocationDetails : undefined,
    };

    console.log(`[GDC] Item ${index + 1} orderSeries:`, itemData.orderSeries, 'Type:', typeof itemData.orderSeries);
    result.push(itemData);
  });

  // ============================================
  // Build result items from Sales Orders WITHOUT Purchase Orders
  // ============================================
  const itemsBySO = new Map<string, { sku: string; productName: string; qty: number; unitPrice: number }[]>();

  soItems?.forEach((item) => {
    const productData = toOne(item.products);
    const productName = productData?.name || item.description || item.sku;
    const unitPrice = item.unit_price ? item.unit_price / 100 : 0;

    // Store SKU info for column headers
    if (item.sku && !skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
    }

    if (!itemsBySO.has(item.sales_order_id)) {
      itemsBySO.set(item.sales_order_id, []);
    }
    itemsBySO.get(item.sales_order_id)!.push({
      sku: item.sku || 'Unknown',
      productName,
      qty: item.quantity || 0,
      unitPrice,
    });
  });

  const soStartIndex = result.length;

  salesOrdersWithoutPOs?.forEach((so, index) => {
    const customerData = so.customers ? toOne(so.customers) : null;

    // Get shipment data for this SO (for filtering and status)
    const shipment = shipmentBySO.get(so.id);

    // Skip delivered shipments based on filter (same logic as POs):
    const isDelivered = so.status === 'delivered' || shipment?.status === 'delivered';

    if (filters?.status) {
      // Status filter is active
      if (filters.status === 'DELIVERED' && !isDelivered) {
        return; // Skip non-delivered when filter is DELIVERED
      } else if (filters.status !== 'DELIVERED' && isDelivered) {
        return; // Skip delivered when filter is other status
      }
    }
    // If no status filter → show all (including delivered)

    const soItemsList = itemsBySO.get(so.id) || [];
    const totalQty = soItemsList.reduce((sum, item) => sum + item.qty, 0);

    // Skip SOs with no items when product filter is active
    // (means this SO doesn't have the filtered product)
    if (filters?.productId && soItemsList.length === 0) {
      return;
    }

    // Build address
    const addressParts = [
      so.shipping_address_street,
      so.shipping_address_city,
      so.shipping_address_state,
      so.shipping_address_postal_code,
    ].filter(Boolean);

    const customerName = customerData?.name || 'Unknown';
    allocatedCount++;

    // Apply customer filter
    if (filters?.customerId && so.customer_id !== filters.customerId) {
      return; // Skip this SO if it doesn't match customer filter
    }

    console.log(`[GDC] Row ${soStartIndex + index + 1} - SO: ${so.order_number} (${so.id}), No PO, Customer: ${customerName}`);

    // Extract fulfillment allocations from first SO item
    const firstSoItem = soItems?.find(item => item.sales_order_id === so.id);
    const allocationsRaw = (firstSoItem as any)?.fulfillment_allocations as Array<{
      fulfillment_source: string;
      quantity: number;
      status: string;
      location?: { name: string } | { name: string }[];
      platinum_dealer?: { dealer_name: string; code: string } | { dealer_name: string; code: string }[];
      dealer_location?: { location_name: string } | { location_name: string }[];
    }> | undefined;
    const primaryAllocation = allocationsRaw?.[0];

    // Map allocations to FulfillmentAllocationDetail array
    // Note: For SOs without POs, there's no supplier name for 'direct' source yet
    const allocationDetails: import('../types').FulfillmentAllocationDetail[] | undefined = allocationsRaw?.map(alloc => ({
      source: alloc.fulfillment_source as import('../types').FulfillmentSource,
      quantity: alloc.quantity,
      status: alloc.status as import('../types').AllocationStatus,
      locationOrDealer: toOne(alloc.location)?.name || toOne(alloc.platinum_dealer)?.dealer_name || toOne(alloc.dealer_location)?.location_name || null,
      // For 'direct' source without PO, we don't have supplier name yet
      // For dealer sources, use dealer name
      supplierName: toOne(alloc.platinum_dealer)?.dealer_name || null,
    }));

    // Determine which status to show:
    // Priority: Shipment load_status > SO status
    // Use load_status (Operations status: AVAILABLE, OPEN, CLOSED, etc.)
    let displayStatus = so.status;
    if (shipment?.load_status) {
      displayStatus = shipment.load_status.toUpperCase();
    }

    // Calculate qtyDelivered first, then compute outstandingQty
    const qtyDeliveredSO = shipment?.qty_delivered ?? so.qty_delivered ?? 0;
    // Outstanding Qty = MAX(Total Qty - Qty Delivered, 0)
    const outstandingQtySO = Math.max(totalQty - qtyDeliveredSO, 0);

    result.push({
      id: so.id,
      no: soStartIndex + index + 1,
      poNumber: null, // No PO for this SO
      soNumber: so.order_number,
      shipmentNumber: shipment?.shipment_number || null, // Shipment number (SO2600063)
      customerPoNumber: so.customer_po_number || null,
      orderSeries: so.order_series,
      items: soItemsList.map(item => ({
        sku: item.sku,
        productName: item.productName,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
      totalQty,
      customer: customerName,
      supplierName: null, // No supplier since no PO
      etaToUsPort: shipment?.eta_to_port || so.eta_to_us_port || null,
      confirmedEta: shipment?.confirmed_eta || so.confirmed_eta || null,
      actualDeliveryDate: shipment?.actual_arrival || so.actual_delivery_date || null,
      qtyDelivered: qtyDeliveredSO,
      outstandingQty: outstandingQtySO,
      invoiceAmount: so.grand_total ? so.grand_total / 100 : 0,
      deliveryAddress: addressParts.join(', '),
      expectedDelivery: shipment?.customer_expected_delivery || so.requested_delivery_date || null,
      status: displayStatus, // Shipment status (if exists) or SO status
      actionRequired: so.internal_notes || '',
      notes: '',
      isUnallocated: false, // Always allocated (has customer)
      // Fulfillment allocation fields
      fulfillmentSource: (primaryAllocation?.fulfillment_source as import('../types').FulfillmentSource) || 'gdc_inventory',
      allocatedToDealerName: toOne(primaryAllocation?.platinum_dealer)?.dealer_name || null,
      allocatedToDealerLocation: toOne(primaryAllocation?.dealer_location)?.location_name || null,
      allocationStatus: (primaryAllocation?.status as import('../types').AllocationStatus) || null,
      // Multiple fulfillment allocations array
      allocations: allocationDetails && allocationDetails.length > 0 ? allocationDetails : undefined,
    });
  });

  console.log(`[GDC] Built ${result.length} items for display (Allocated: ${allocatedCount}, Unallocated: ${unallocatedCount})`);

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  skuInfoMap.forEach((productName, sku) => {
    uniqueSkus.push({ sku, productName });
  });
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  console.log(`[GDC] ========== Finished fetching ${orderSeries} (${purchaseOrders?.length || 0} POs + ${salesOrdersWithoutPOs?.length || 0} SOs = ${result.length} rows, ${uniqueSkus.length} SKUs) ==========`);

  return { orderSeries, items: result, uniqueSkus };
}

// ============================================
// GET ALL GDC INVENTORIES (for all order series)
// Returns data for all order series tabs
// ============================================

export async function getAllGDCInventories(filters?: OperationsFilters): Promise<GDCInventoryData[]> {
  const { ORDER_SERIES } = await import('@/shared/lib/global-data');

  const results: GDCInventoryData[] = [];

  for (const series of ORDER_SERIES) {
    try {
      const data = await getGDCInventoryByOrderSeries(series.code, filters);
      results.push(data);
    } catch (error) {
      console.error(`Error fetching GDC inventory for ${series.code}:`, error);
      // Return empty data for this series instead of failing
      results.push({ orderSeries: series.code, items: [], uniqueSkus: [] });
    }
  }

  return results;
}

// ============================================
// GET RIM INSTALLATION REQUIRED
// Checks BOTH shipments.action_required AND sales_orders.internal_notes
// for items that need rim installation
// Returns dynamic SKU columns like other tables
// ============================================

export async function getRimInstallationRequired(filters?: OperationsFilters): Promise<{ data: RimInstallationItem[]; uniqueSkus: SKUColumnInfo[] }> {
  const supabase = createAdminClient();
  const result: RimInstallationItem[] = [];
  const skuInfoMap = new Map<string, string>(); // sku -> productName
  let gdc1Counter = 1;

  // ============================================
  // 1. Check SHIPMENTS table for rim installation
  // ============================================
  let shipQuery = supabase
    .from('shipments')
    .select(`
      id,
      supplier_reference_number,
      total_qty,
      load_status,
      action_required,
      executive_notes,
      sales_order_id,
      sales_orders(customer_id, customer_po_number)
    `)
    .is('deleted_at', null)
    .ilike('action_required', '%rim%installation%')
    .order('supplier_reference_number', { ascending: true });

  // Apply status filter
  if (filters?.status) {
    const statusMap: Record<ShipmentStatus, string> = {
      'AVAILABLE': 'available',
      'OPEN': 'open',
      'HOLD': 'hold',
      'IN_TRANSIT': 'in_transit',
      'SOLD': 'sold',
      'CLOSED': 'closed',
      'INVOICED': 'invoiced',
      'NOT_INVOICED': 'not_invoiced',
      'PARTIALLY_PAID': 'partially_paid',
      'PAID': 'paid',
      'DISPUTED': 'disputed',
      'PO_NEEDED': 'po_needed',
      'DELIVERED': 'delivered',
      'CONFIRMED': 'confirmed',
      'PROCESSING': 'processing',
    };
    shipQuery = shipQuery.eq('load_status', statusMap[filters.status]);
  }
  if (filters?.salesOrderId) {
    shipQuery = shipQuery.eq('sales_order_id', filters.salesOrderId);
  }

  const { data: shipments, error: shipError } = await shipQuery;

  if (shipError) {
    console.error('Error fetching shipments for rim installation:', shipError);
  }

  // Get shipment items for SKU breakdown with product names
  const shipmentIds = shipments?.map((s) => s.id) || [];

  if (shipmentIds.length > 0) {
    const { data: shipmentItems } = await supabase
      .from('shipment_items')
      .select(`
        shipment_id,
        sku,
        quantity_shipped,
        products(id, name)
      `)
      .in('shipment_id', shipmentIds);

    // Group items by shipment
    const itemsByShipment = new Map<string, { sku: string; productName: string; qty: number }[]>();
    shipmentItems?.forEach((item) => {
      const productData = toOne(item.products);
      const productName = productData?.name || item.sku;

      // Store SKU info for column headers
      if (!skuInfoMap.has(item.sku)) {
        skuInfoMap.set(item.sku, productName);
      }

      if (!itemsByShipment.has(item.shipment_id)) {
        itemsByShipment.set(item.shipment_id, []);
      }
      itemsByShipment.get(item.shipment_id)!.push({
        sku: item.sku,
        productName,
        qty: item.quantity_shipped,
      });
    });

    shipments?.forEach((s) => {
      const salesOrderData = toOne(s.sales_orders);

      // Apply filters on related sales order data
      if (filters?.customerId && salesOrderData?.customer_id !== filters.customerId) {
        return;
      }
      if (filters?.customerPoNumber && salesOrderData?.customer_po_number !== filters.customerPoNumber) {
        return;
      }

      const items = itemsByShipment.get(s.id) || [];
      const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

      result.push({
        id: s.id,
        gdc1No: gdc1Counter++,
        loadNumber: s.supplier_reference_number || 'N/A',
        items,
        totalQty: s.total_qty || totalQty,
        status: mapLoadStatus(s.load_status),
        actionRequired: s.action_required || '',
        executiveNote: s.executive_notes || '',
      });
    });
  }

  // ============================================
  // 2. Check SALES_ORDERS table for rim installation
  // ============================================
  let soQuery = supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      status,
      internal_notes,
      customer_id,
      customer_po_number,
      sales_order_items(
        sku,
        quantity,
        product_id,
        products(id, name)
      )
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .ilike('internal_notes', '%rim%installation%')
    .order('order_number', { ascending: true });

  // Apply filters
  if (filters?.customerId) {
    soQuery = soQuery.eq('customer_id', filters.customerId);
  }
  if (filters?.salesOrderId) {
    soQuery = soQuery.eq('id', filters.salesOrderId);
  }
  if (filters?.customerPoNumber) {
    soQuery = soQuery.eq('customer_po_number', filters.customerPoNumber);
  }

  const { data: salesOrders, error: soError } = await soQuery;

  if (soError) {
    console.error('Error fetching sales orders for rim installation:', soError);
  }

  // Track IDs we've already added
  const addedIds = new Set(result.map(r => r.id));

  salesOrders?.forEach((so) => {
    // Skip if already added from shipments
    if (addedIds.has(so.id)) { return; }

    const soItems = so.sales_order_items || [];

    // Filter by productId if specified
    if (filters?.productId) {
      const hasProduct = soItems.some((item: { product_id?: string }) => item.product_id === filters.productId);
      if (!hasProduct) return;
    }

    const items: { sku: string; productName: string; qty: number }[] = [];
    let totalQty = 0;

    soItems.forEach((item: { sku: string; quantity: number; product_id?: string; products: unknown }) => {
      const productData = toOne(item.products) as { name?: string } | null;
      const productName = productData?.name || item.sku || 'Unknown';
      const qty = item.quantity || 0;
      totalQty += qty;

      // Store SKU info for column headers
      if (item.sku && !skuInfoMap.has(item.sku)) {
        skuInfoMap.set(item.sku, productName);
      }

      items.push({
        sku: item.sku || 'Unknown',
        productName,
        qty,
      });
    });

    // Map SO status to display status
    let displayStatus: ShipmentStatus = 'OPEN';
    if (so.status === 'confirmed') {
      displayStatus = 'CONFIRMED';
    } else if (so.status === 'processing') {
      displayStatus = 'PROCESSING';
    } else if (so.status === 'shipped') {
      displayStatus = 'IN_TRANSIT';
    } else if (so.status === 'delivered') {
      displayStatus = 'DELIVERED';
    }

    result.push({
      id: so.id,
      gdc1No: gdc1Counter++,
      loadNumber: so.order_number || 'N/A',
      items,
      totalQty,
      status: displayStatus,
      actionRequired: so.internal_notes || '',
      executiveNote: '',
    });
  });

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  skuInfoMap.forEach((productName, sku) => {
    uniqueSkus.push({ sku, productName });
  });

  // Sort by SKU
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  return { data: result, uniqueSkus };
}

// ============================================
// GENERATE STORY IN BRIEF
// ============================================

export async function generateStoryInBrief(
  stats: OperationsStats,
  skuBreakdown: SKUBreakdown[],
  rimItems: RimInstallationItem[]
): Promise<string> {
  // Build SKU summary
  const skuParts = skuBreakdown.map((s) => `${s.combinedQty} units of ${s.skuName}`);
  const skuSummary = skuParts.join(', ');

  // Count rim installation items
  const rimCount = rimItems.length;
  const rimQty = rimItems.reduce((sum, r) => sum + r.totalQty, 0);

  let story = `Inventory reflects all GDC/MWI-owned product, including available GDC1 inventory and Galileo shipments assigned to GDC/MWI, whether open or in transit. Under this definition, total inventory is ${stats.availableInventoryQty + stats.outstandingQty} units across ${stats.availableLoads + stats.openLoads} loads, consisting of ${skuSummary}. Of this inventory, ${stats.committedCustomerQty} units are customer-committed, with ${stats.inTransitNext7Days} loads currently on the immediate watchlist.`;

  if (rimCount > 0) {
    story += `\n\n${rimCount} GDC inventory loads / ${rimQty} units need rim installation — TWS manufacturer. See RIM INSTALLATION REQUIRED section below.`;
  }

  return story;
}

// ============================================
// GET FILTER OPTIONS
// Fetches dropdown options for all filters
// ============================================

export async function getFilterOptions(): Promise<FilterOptions> {
  const supabase = createAdminClient();

  // Fetch customers, products, sales orders, and customer PO numbers in parallel
  const [customersResult, productsResult, salesOrdersResult] = await Promise.all([
    // Customers
    supabase
      .from('customers')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),

    // Products (inventory items only)
    supabase
      .from('products')
      .select('id, name, sku')
      .is('deleted_at', null)
      .eq('item_type', 'inventory')
      .order('name', { ascending: true }),

    // Sales Orders (for SO# and Customer PO#)
    supabase
      .from('sales_orders')
      .select('id, order_number, customer_po_number')
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  // Build customer options
  const customers = (customersResult.data || []).map((c) => ({
    value: c.id,
    label: c.name,
  }));

  // Build product options
  const products = (productsResult.data || []).map((p) => ({
    value: p.id,
    label: p.name || p.sku || 'Unknown',
  }));

  // Build sales order options
  const salesOrders = (salesOrdersResult.data || []).map((so) => ({
    value: so.id,
    label: so.order_number,
  }));

  // Build unique customer PO numbers
  const customerPoSet = new Set<string>();
  (salesOrdersResult.data || []).forEach((so) => {
    if (so.customer_po_number) {
      customerPoSet.add(so.customer_po_number);
    }
  });

  const customerPoNumbers = Array.from(customerPoSet)
    .sort()
    .map((po) => ({
      value: po,
      label: po,
    }));

  // Status options are static and defined in the component
  const statuses: FilterOptions['statuses'] = [];

  // 🆕 NEW: Fetch platinum dealers
  const { data: dealers } = await supabase
    .from('platinum_dealers')
    .select('id, dealer_name, code')
    .eq('status', 'active')
    .order('dealer_name');

  const dealerOptions = dealers?.map(d => ({
    value: d.id,
    label: `${d.dealer_name} (${d.code})`
  })) || [];

  // 🆕 NEW: Fulfillment source options (static)
  const fulfillmentSources: FilterOptions['fulfillmentSources'] = [
    { value: 'gdc_inventory', label: 'GDC Inventory' },
    { value: 'platinum_dealer_inventory', label: 'Platinum Dealer Inventory' },
    { value: 'platinum_dealer_fulfillment', label: 'Platinum Dealer Fulfillment' },
    { value: 'direct', label: 'Manufacturer Direct' }
  ];

  return {
    customers,
    products,
    statuses,
    salesOrders,
    customerPoNumbers,
    dealers: dealerOptions,              // 🆕 NEW
    fulfillmentSources,                  // 🆕 NEW
  };
}
