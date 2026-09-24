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

  const { data: salesOrders, error: soError } = await soQuery;

  if (soError) {
    console.error('Error fetching sales orders for stats:', soError);
    throw soError;
  }

  // Also get shipments for in-transit tracking
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select(`
      id,
      load_status,
      eta_to_port,
      eta_port_tracking,
      estimated_arrival
    `)
    .is('deleted_at', null);

  if (shipError) {
    console.error('Error fetching shipments for stats:', shipError);
    throw shipError;
  }

  // ============================================
  // UNALLOCATED POs (not linked to any Sales Order)
  // These represent speculative inventory ("Gesher" as customer)
  // ============================================
  let unallocatedPoQuery = supabase
    .from('purchase_orders')
    .select(`
      id,
      po_number,
      status,
      expected_delivery_date,
      purchase_order_items(quantity_ordered, unit_price, product_id)
    `)
    .is('deleted_at', null)
    .is('sales_order_id', null)  // No linked Sales Order = Unallocated
    .neq('status', 'cancelled');

  // Apply product filter to unallocated POs
  // Note: customerId filter doesn't apply since these are unallocated (customer = "Gesher")

  const { data: unallocatedPOs, error: poError } = await unallocatedPoQuery;

  if (poError) {
    console.error('Error fetching unallocated POs for stats:', poError);
    // Don't throw - just log and continue with partial data
  }

  // Initialize KPI values
  let availableInventoryQty = 0;
  let availableLoads = 0;
  let availableInventoryValue = 0;
  let committedCustomerQty = 0;
  let inTransitNext7Days = 0;
  let openLoads = 0;
  let outstandingQty = 0;
  let invoiceAmount = 0;

  // Process sales orders based on Jenny's Excel logic
  salesOrders?.forEach((so) => {
    const items = so.sales_order_items || [];

    // Filter by productId if specified
    if (filters?.productId) {
      const hasProduct = items.some((item: { product_id?: string }) => item.product_id === filters.productId);
      if (!hasProduct) return;
    }

    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);
    const invoiceAmt = so.grand_total ? so.grand_total / 100 : 0;
    const hasLoadNumber = !!so.order_number;  // Load # not null

    // Status mapping: draft/pending = AVAILABLE, confirmed/processing = SOLD
    const isAvailable = so.status === 'draft' || so.status === 'pending';
    const isSold = so.status === 'confirmed' || so.status === 'processing';

    // ============================================
    // INVENTORY CALCULATIONS (all orders)
    // Note: product_source column removed in migration 123
    // Treating all orders the same way for now
    // ============================================

    // Available Inventory Qty: where status = AVAILABLE → sum total qty
    if (isAvailable) {
      availableInventoryQty += totalQty;
      availableLoads += 1;  // Count of AVAILABLE records
      availableInventoryValue += invoiceAmt;  // Sum of invoice amounts
    }

    // Committed Customer Qty: status = SOLD → outstanding qty
    if (isSold && hasLoadNumber) {
      committedCustomerQty += totalQty;  // Outstanding qty = total qty for active orders
    }

    // Outstanding = all orders not yet delivered
    if (so.status === 'pending' || so.status === 'confirmed' || so.status === 'processing') {
      outstandingQty += totalQty;
    }

    // Open loads = orders that are pending
    if (so.status === 'draft' || so.status === 'pending') {
      openLoads += 1;
    }

    // Total invoice amount (all orders)
    invoiceAmount += invoiceAmt;

    // Check delivery due in next 7 days
    if (so.requested_delivery_date) {
      const deliveryDate = new Date(so.requested_delivery_date);
      if (deliveryDate >= now && deliveryDate <= next7Days) {
        inTransitNext7Days += 1;
      }
    }
  });

  // Count in-transit shipments arriving in next 7 days
  shipments?.forEach((s) => {
    // Priority: eta_port_tracking (from shipping email) > eta_to_port (manual) > estimated_arrival
    const etaDate = s.eta_port_tracking || s.eta_to_port || s.estimated_arrival;
    if (etaDate) {
      const eta = new Date(etaDate);
      if (eta >= now && eta <= next7Days) {
        inTransitNext7Days += 1;
      }
    }
  });

  // ============================================
  // UNALLOCATED PO CALCULATIONS
  // These are speculative inventory (customer = "Gesher")
  // Add to Available Inventory KPIs
  // ============================================
  unallocatedPOs?.forEach((po) => {
    const items = po.purchase_order_items || [];

    // Filter by productId if specified
    if (filters?.productId) {
      const hasProduct = items.some((item: { product_id?: string }) => item.product_id === filters.productId);
      if (!hasProduct) return;
    }

    const totalQty = items.reduce((sum: number, item: { quantity_ordered: number }) => sum + (item.quantity_ordered || 0), 0);
    const totalValue = items.reduce((sum: number, item: { quantity_ordered: number; unit_price: number }) => {
      const qty = item.quantity_ordered || 0;
      const price = item.unit_price ? item.unit_price / 100 : 0;
      return sum + (qty * price);
    }, 0);

    // Unallocated POs are AVAILABLE inventory
    // Status check: confirmed/received = truly available, in_production/in_transit = on the way
    const isAvailableStatus = po.status === 'confirmed' || po.status === 'received' ||
                               po.status === 'in_production' || po.status === 'ready_to_ship' ||
                               po.status === 'in_transit';

    if (isAvailableStatus) {
      availableInventoryQty += totalQty;
      availableLoads += 1;
      availableInventoryValue += totalValue;
    }

    // Check expected delivery in next 7 days
    if (po.expected_delivery_date) {
      const deliveryDate = new Date(po.expected_delivery_date);
      if (deliveryDate >= now && deliveryDate <= next7Days) {
        inTransitNext7Days += 1;
      }
    }
  });

  return {
    availableInventoryQty,
    availableLoads,
    availableInventoryValue,
    committedCustomerQty,
    inTransitNext7Days,
    openLoads,
    outstandingQty,
    invoiceAmount,
  };
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
  const supabase = createAdminClient();

  // Get sales order items with product_source info - only inventory products
  // Using left joins to avoid errors when no matching data exists
  let query = supabase
    .from('sales_order_items')
    .select(`
      sku,
      quantity,
      product_id,
      product:products(
        id,
        name,
        item_type
      ),
      sales_order:sales_orders(
        id,
        status,
        deleted_at,
        customer_id,
        customer_po_number
      )
    `);

  // Apply filters
  if (filters?.customerId) {
    query = query.eq('sales_order.customer_id', filters.customerId);
  }
  if (filters?.salesOrderId) {
    query = query.eq('sales_order.id', filters.salesOrderId);
  }
  if (filters?.customerPoNumber) {
    query = query.eq('sales_order.customer_po_number', filters.customerPoNumber);
  }
  if (filters?.productId) {
    query = query.eq('product_id', filters.productId);
  }

  const { data: items, error } = await query;

  if (error) {
    console.error('Error fetching SKU breakdown:', error);
    throw error;
  }

  // Aggregate by SKU - also track product name and GDC series
  const skuMap = new Map<string, {
    supplier: number;
    gdcInventory: Record<string, number>;
    productName: string
  }>();

  items?.forEach((item) => {
    const salesOrder = toOne(item.sales_order);
    const product = toOne(item.product);

    // Filter: skip if no sales order, deleted, or cancelled
    if (!salesOrder) return;
    if (salesOrder.deleted_at) return;
    if (salesOrder.status === 'cancelled') return;

    // Filter: only inventory products
    if (product && product.item_type !== 'inventory') return;

    const sku = item.sku || 'Unknown';
    const qty = item.quantity || 0;
    const productName = product?.name || sku;

    if (!skuMap.has(sku)) {
      skuMap.set(sku, { supplier: 0, gdcInventory: {}, productName });
    }

    const current = skuMap.get(sku)!;

    // Categorize by status (since product_source column removed):
    // - Draft/Pending = Available inventory (group by order_series when we add POs)
    // - Confirmed/Processing/Shipped = Supplier Outstanding (committed to customer)
    const isDraftOrPending = salesOrder.status === 'draft' || salesOrder.status === 'pending';

    if (isDraftOrPending) {
      // For SO items, we don't have order_series, so add to a generic "Available" category
      // This will be replaced by PO-based inventory below
      const series = 'Available';
      current.gdcInventory[series] = (current.gdcInventory[series] || 0) + qty;
    } else {
      current.supplier += qty;  // Outstanding orders
    }
  });

  // ============================================
  // UNALLOCATED PO ITEMS (speculative inventory)
  // These are POs not linked to any Sales Order
  // Grouped by order_series (GDC 0, GDC 1, GDC 2, etc.)
  // ============================================
  let poItemsQuery = supabase
    .from('purchase_order_items')
    .select(`
      sku,
      quantity_ordered,
      product_id,
      description,
      product:products(
        id,
        name,
        item_type
      ),
      purchase_order:purchase_orders!inner(
        id,
        status,
        deleted_at,
        sales_order_id,
        order_series
      )
    `)
    .is('purchase_order.deleted_at', null)
    .is('purchase_order.sales_order_id', null)  // No linked Sales Order = Unallocated
    .neq('purchase_order.status', 'cancelled');

  // Apply product filter
  if (filters?.productId) {
    poItemsQuery = poItemsQuery.eq('product_id', filters.productId);
  }

  const { data: poItems, error: poError } = await poItemsQuery;

  if (poError) {
    console.error('Error fetching PO items for SKU breakdown:', poError);
    // Don't throw - continue with partial data
  }

  // Add unallocated PO items to the SKU map, grouped by order_series
  poItems?.forEach((item) => {
    const product = toOne(item.product);
    const purchaseOrder = toOne(item.purchase_order);

    // Filter: only inventory products
    if (product && product.item_type !== 'inventory') return;

    const sku = item.sku || 'Unknown';
    const qty = item.quantity_ordered || 0;
    const productName = product?.name || item.description || sku;
    const orderSeries = purchaseOrder?.order_series || 'GDC 1'; // Default to GDC 1 if not specified

    if (!skuMap.has(sku)) {
      skuMap.set(sku, { supplier: 0, gdcInventory: {}, productName });
    }

    const current = skuMap.get(sku)!;
    // Group unallocated POs by order_series (GDC 0, GDC 1, etc.)
    current.gdcInventory[orderSeries] = (current.gdcInventory[orderSeries] || 0) + qty;
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
      skuName: val.productName,  // Use product name instead of SKU
      supplierOutstandingQty: val.supplier,
      gdcInventory: val.gdcInventory, // { 'GDC 0': 100, 'GDC 1': 200, ... }
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
  const supabase = createAdminClient();

  const now = new Date();
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get sales orders with customer info and items for qty calculation
  let query = supabase
    .from('sales_orders')
    .select(`
      id,
      status,
      grand_total,
      requested_delivery_date,
      customer_id,
      customer_po_number,
      customers(
        id,
        name
      ),
      sales_order_items(
        quantity,
        product_id
      )
    `)
    .is('deleted_at', null)
    .neq('status', 'cancelled');

  // Note: product_source filter removed (column doesn't exist after migration 123)

  // Apply filters
  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }
  if (filters?.salesOrderId) {
    query = query.eq('id', filters.salesOrderId);
  }
  if (filters?.customerPoNumber) {
    query = query.eq('customer_po_number', filters.customerPoNumber);
  }

  const { data: salesOrders, error } = await query;

  if (error) {
    console.error('Error fetching customer commitments:', error);
    throw error;
  }

  // Aggregate by customer
  const customerMap = new Map<string, {
    id: string;
    customer: string;
    loads: number;
    outstandingQty: number;
    invoiceAmount: number;
    inTransitNext7Days: number;
  }>();

  salesOrders?.forEach((so) => {
    const customer = toOne(so.customers);
    const customerName = customer?.name || 'Unknown';
    const customerId = customer?.id || 'unknown';

    // Calculate total qty from items
    const items = so.sales_order_items || [];

    // Filter by productId if specified
    if (filters?.productId) {
      const hasProduct = items.some((item: { product_id?: string }) => item.product_id === filters.productId);
      if (!hasProduct) return;
    }

    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);

    // Invoice amount from grand_total (stored in cents)
    const invoiceAmount = so.grand_total ? so.grand_total / 100 : 0;

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        id: customerId,
        customer: customerName,
        loads: 0,
        outstandingQty: 0,
        invoiceAmount: 0,
        inTransitNext7Days: 0,
      });
    }

    const current = customerMap.get(customerId)!;
    current.loads += 1;
    current.outstandingQty += totalQty;
    current.invoiceAmount += invoiceAmount;

    // Check if delivery due in next 7 days
    if (so.requested_delivery_date) {
      const deliveryDate = new Date(so.requested_delivery_date);
      if (deliveryDate >= now && deliveryDate <= next7Days) {
        current.inTransitNext7Days += 1;
      }
    }
  });

  // Convert to array
  const result: CustomerCommitment[] = [];
  customerMap.forEach((val) => {
    result.push(val);
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
  const supabase = createAdminClient();

  // Get sales orders with items AND linked shipments for status breakdown
  // Using shipments.load_status when available for consistency
  let soQuery = supabase
    .from('sales_orders')
    .select(`
      id,
      status,
      customer_id,
      customer_po_number,
      sales_order_items(quantity, product_id),
      shipments(id, load_status, total_qty)
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

  const { data: salesOrders, error: soError } = await soQuery;

  if (soError) {
    console.error('Error fetching sales orders for status mix:', soError);
    throw soError;
  }

  // Initialize status counters
  const statusMap = new Map<ShipmentStatus, { loads: number; qty: number }>();

  // Helper to get SO status (fallback when no shipment)
  // Note: product_source column removed in migration 123
  const getSoDisplayStatus = (so: { status: string }): ShipmentStatus => {
    // Unified status mapping for all orders
    if (so.status === 'draft' || so.status === 'pending') {
      return 'OPEN';
    } else if (so.status === 'confirmed' || so.status === 'processing') {
      return 'SOLD';
    } else if (so.status === 'shipped') {
      return 'IN_TRANSIT';
    } else if (so.status === 'delivered') {
      return 'DELIVERED';
    }
    return 'OPEN';
  };

  // Process sales orders - use shipment status if available
  salesOrders?.forEach((so) => {
    const items = so.sales_order_items || [];

    // Filter by productId if specified
    if (filters?.productId) {
      const hasProduct = items.some((item: { product_id?: string }) => item.product_id === filters.productId);
      if (!hasProduct) return;
    }

    const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);

    // Check if linked shipment exists - use its load_status for consistency
    const shipments = so.shipments as { id: string; load_status: string; total_qty: number }[] | null;
    const shipment = shipments && shipments.length > 0 ? shipments[0] : null;

    let displayStatus: ShipmentStatus;

    if (shipment?.load_status) {
      // Use shipment's load_status for consistent display across all tabs
      displayStatus = mapLoadStatus(shipment.load_status);
    } else {
      // Fallback to sales order status
      displayStatus = getSoDisplayStatus(so);
    }

    if (!statusMap.has(displayStatus)) {
      statusMap.set(displayStatus, { loads: 0, qty: 0 });
    }

    const current = statusMap.get(displayStatus)!;
    current.loads += 1;
    current.qty += totalQty;
  });

  // ============================================
  // UNALLOCATED POs (speculative inventory)
  // These are POs not linked to any Sales Order
  // Show as "AVAILABLE" status (customer = "Gesher")
  // ============================================
  let unallocatedPoQuery = supabase
    .from('purchase_orders')
    .select(`
      id,
      status,
      purchase_order_items(quantity_ordered, product_id)
    `)
    .is('deleted_at', null)
    .is('sales_order_id', null)  // No linked Sales Order = Unallocated
    .neq('status', 'cancelled');

  const { data: unallocatedPOs, error: poError } = await unallocatedPoQuery;

  if (poError) {
    console.error('Error fetching unallocated POs for status mix:', poError);
    // Don't throw - continue with partial data
  }

  // Add unallocated POs to status map as "AVAILABLE"
  unallocatedPOs?.forEach((po) => {
    const items = po.purchase_order_items || [];

    // Filter by productId if specified
    if (filters?.productId) {
      const hasProduct = items.some((item: { product_id?: string }) => item.product_id === filters.productId);
      if (!hasProduct) return;
    }

    const totalQty = items.reduce((sum: number, item: { quantity_ordered: number }) => sum + (item.quantity_ordered || 0), 0);

    // Unallocated POs are AVAILABLE inventory
    const displayStatus: ShipmentStatus = 'AVAILABLE';

    if (!statusMap.has(displayStatus)) {
      statusMap.set(displayStatus, { loads: 0, qty: 0 });
    }

    const current = statusMap.get(displayStatus)!;
    current.loads += 1;
    current.qty += totalQty;
  });

  // Convert to array
  const result: ShipmentStatusMix[] = [];
  statusMap.forEach((val, status) => {
    result.push({
      status,
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
      load_status,
      action_required,
      is_delayed,
      estimated_arrival,
      sales_order_id,
      lfd_date,
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
        customers(id, name)
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

  const { data: shipments, error: shipError } = await shipQuery;

  if (shipError) {
    console.error('Error fetching shipments for immediate attention:', shipError);
  }

  shipments?.forEach((s) => {
    const salesOrderData = toOne(s.sales_orders);

    // Note: product_source column removed in migration 123
    // All shipments are included now (no warehouse/dropship distinction)

    // Apply filters on related sales order data
    if (filters?.customerId && salesOrderData?.customer_id !== filters.customerId) {
      return;
    }
    if (filters?.customerPoNumber && salesOrderData?.customer_po_number !== filters.customerPoNumber) {
      return;
    }

    // Priority: eta_port_tracking (from shipping email) > eta_to_port (manual) > estimated_arrival
    const etaDate = s.eta_port_tracking || s.eta_to_port || s.estimated_arrival;
    const etaPort = etaDate ? new Date(etaDate) : null;
    const customerDueDate = s.customer_expected_delivery || salesOrderData?.requested_delivery_date;
    const customerDue = customerDueDate ? new Date(customerDueDate) : null;

    const isThisWeek = etaPort ? (etaPort >= now && etaPort <= next7Days) : false;
    const isOverdue = s.is_delayed || (customerDue ? customerDue < now : false);
    const status = s.load_status as string;
    const isActive = status === 'open' || status === 'in_transit' || !status;

    // LFD (Last Free Day) Alert calculations
    const lfdDateStr = s.lfd_date as string | null;
    const lfdDate = lfdDateStr ? new Date(lfdDateStr) : null;
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // LFD Critical: LFD is today or tomorrow
    const isLFDCritical = lfdDate ? (lfdDate <= tomorrow) : false;
    // LFD Approaching: LFD is within 3 days (but not critical)
    const isLFDApproaching = lfdDate ? (lfdDate > tomorrow && lfdDate <= in3Days) : false;

    // Delay Detection:
    // 1. Manual flag: is_delayed = true (set by AI from Seaair emails or manually)
    // 2. Auto-detect: ETA passed but status is not 'delivered'
    const isManuallyDelayed = s.is_delayed === true;
    const isAutoDelayed = etaPort && etaPort < now && status !== 'delivered';
    const isDelayed = isManuallyDelayed || isAutoDelayed;

    // If status filter is applied, include all matching items
    // Otherwise, only include active/urgent items
    const shouldInclude = filters?.status
      ? true  // Status filter already applied in query
      : (isActive || isThisWeek || isOverdue || isDelayed);

    // Include if LFD is approaching/critical or delayed
    const hasLFDAlert = isLFDCritical || isLFDApproaching;
    const shouldIncludeFinal = shouldInclude || hasLFDAlert || isDelayed;

    if (shouldIncludeFinal) {
      result.push({
        id: s.id,
        loadNumber: salesOrderData?.order_number || s.shipment_number || 'N/A',
        customer: toOne(salesOrderData?.customers)?.name || 'Unknown',
        po: salesOrderData?.customer_po_number || 'N/A',
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
      });
    }
  });

  // ============================================
  // 2. Get from SALES_ORDERS table (for orders without shipments)
  // Only DROPSHIP orders - warehouse orders shown in GDC1 Inventory tab
  // ============================================

  // Map ShipmentStatus to SO status for filtering
  const statusToSoStatusMap: Partial<Record<ShipmentStatus, string[]>> = {
    'OPEN': ['pending', 'draft'],
    'SOLD': ['confirmed'],
    'IN_TRANSIT': ['processing', 'shipped'],
    'DELIVERED': ['delivered'],
    // AVAILABLE is for warehouse inventory, not direct orders - returns empty
  };

  let soQuery = supabase
    .from('sales_orders')
    .select(`
      id,
      order_number,
      customer_po_number,
      status,
      requested_delivery_date,
      internal_notes,
      customer_id,
      customers(id, name),
      sales_order_items(quantity, product_id)
    `)
    .is('deleted_at', null)
    .order('requested_delivery_date', { ascending: true });

  // Apply status filter - if status doesn't map to SO statuses, skip SO query
  if (filters?.status) {
    const soStatuses = statusToSoStatusMap[filters.status];
    if (soStatuses && soStatuses.length > 0) {
      soQuery = soQuery.in('status', soStatuses);
    } else {
      // Status like AVAILABLE doesn't apply to direct orders - return empty for SO
      soQuery = soQuery.eq('status', 'NONE_MATCH'); // Will return empty
    }
  } else {
    // No status filter - get all active statuses
    soQuery = soQuery.in('status', ['pending', 'confirmed', 'processing', 'shipped']);
  }

  // Apply other filters
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
    console.error('Error fetching sales orders for immediate attention:', soError);
  }

  // Track SALES ORDER IDs we've already added from shipments (to avoid duplicates)
  const addedSalesOrderIds = new Set<string>();
  shipments?.forEach((s) => {
    if (s.sales_order_id) {
      addedSalesOrderIds.add(s.sales_order_id);
    }
  });

  salesOrders?.forEach((so) => {
    // Skip if already added from shipments (by sales_order_id)
    if (addedSalesOrderIds.has(so.id)) { return; }

    // Filter by productId if specified
    const items = so.sales_order_items || [];
    if (filters?.productId) {
      const hasProduct = items.some((item: { product_id?: string }) => item.product_id === filters.productId);
      if (!hasProduct) return;
    }

    const customerData = toOne(so.customers);
    const deliveryDate = so.requested_delivery_date ? new Date(so.requested_delivery_date) : null;

    // Check if delivery due in next 7 days or overdue
    const isThisWeek = deliveryDate ? (deliveryDate >= now && deliveryDate <= next7Days) : false;
    const isOverdue = deliveryDate ? deliveryDate < now : false;

    // Delay Detection for Sales Orders:
    // Auto-detect: Delivery date passed but status is not 'delivered'
    const isDelayed = deliveryDate && deliveryDate < now && so.status !== 'delivered';

    // Include if due this week, overdue, delayed, or in active status
    const isActive = so.status === 'pending' || so.status === 'confirmed' || so.status === 'processing';

    // If status filter is applied, include all matching items
    // Otherwise, only include active/urgent items
    const shouldInclude = filters?.status
      ? true  // Status filter already applied in query
      : (isThisWeek || isOverdue || isDelayed || isActive);

    if (shouldInclude) {
      // Calculate total qty from items
      const items = so.sales_order_items || [];
      const totalQty = items.reduce((sum: number, item: { quantity: number }) => sum + (item.quantity || 0), 0);

      // Map SO status to display status
      // Business Flow: confirmed → processing → shipped → delivered
      let displayStatus: ShipmentStatus = 'OPEN';
      if (so.status === 'confirmed') {
        displayStatus = 'CONFIRMED'; // Order confirmed, waiting for supplier
      } else if (so.status === 'processing') {
        displayStatus = 'PROCESSING'; // Order being processed
      } else if (so.status === 'shipped') {
        displayStatus = 'IN_TRANSIT'; // Goods in transit
      } else if (so.status === 'delivered') {
        displayStatus = 'DELIVERED';
      }

      result.push({
        id: so.id,
        loadNumber: so.order_number || 'N/A',
        customer: customerData?.name || 'Unknown',
        po: so.customer_po_number || 'N/A',
        qty: totalQty,
        etaPort: null,
        customerEtaDue: so.requested_delivery_date,
        status: displayStatus,
        actionRequired: so.internal_notes || '',
        isOverdue,
        isThisWeek,
        productSource: 'direct', // Default value (product_source column removed)
        // Delay Alert
        isDelayed: isDelayed || false,
      });
    }
  });

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

    // For direct orders, use order_number as load number
    const loadNumber = so.order_number || 'N/A';

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
      outstandingQtyForPO: so.outstanding_qty || totalQty,
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

    result.push({
      id: so.id,
      no: index + 1,
      loadNumber: so.order_number,
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
      status,
      internal_notes,
      order_series,
      sales_order_id,
      created_at,
      sales_orders (
        id,
        order_number,
        customer_id,
        customer_po_number,
        eta_to_us_port,
        confirmed_eta,
        requested_delivery_date,
        actual_delivery_date,
        qty_delivered,
        outstanding_qty,
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        grand_total,
        customers (id, name)
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

  if (!purchaseOrders || purchaseOrders.length === 0) {
    console.log(`[GDC] No Purchase Orders found for ${orderSeries}`);
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
      products(id, name, item_type)
    `)
    .in('purchase_order_id', poIds);

  // Apply product filter
  if (filters?.productId) {
    poItemsQuery = poItemsQuery.eq('product_id', filters.productId);
  }

  const { data: poItems } = await poItemsQuery;

  console.log(`[GDC] Found ${poItems?.length || 0} Purchase Order Items`);

  // Group items by purchase order and build SKU info map
  const itemsByPO = new Map<string, { sku: string; productName: string; qty: number; unitPrice: number }[]>();
  const skuInfoMap = new Map<string, string>(); // sku -> productName

  poItems?.forEach((item) => {
    const productData = toOne(item.products);
    const productName = productData?.name || item.description || item.sku;
    const unitPrice = item.unit_price ? item.unit_price / 100 : 0;

    // Store SKU info for column headers
    if (item.sku && !skuInfoMap.has(item.sku)) {
      skuInfoMap.set(item.sku, productName);
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
    const customerData = linkedSO?.customers ? toOne(linkedSO.customers) : null;
    const isAllocated = !!linkedSO;

    const poItemsList = itemsByPO.get(po.id) || [];
    const totalQty = poItemsList.reduce((sum, item) => sum + item.qty, 0);

    // Build address from SO if allocated
    const addressParts = linkedSO ? [
      linkedSO.shipping_address_street,
      linkedSO.shipping_address_city,
      linkedSO.shipping_address_state,
      linkedSO.shipping_address_postal_code,
    ].filter(Boolean) : [];

    // Determine customer name
    let customerName = 'Gesher'; // Default for unallocated inventory
    if (isAllocated && customerData?.name) {
      customerName = customerData.name;
      allocatedCount++;
    } else {
      unallocatedCount++;
    }

    // Apply customer filter
    if (filters?.customerId && (!linkedSO || linkedSO.customer_id !== filters.customerId)) {
      return; // Skip this PO if it doesn't match customer filter
    }

    console.log(`[GDC] Row ${index + 1} - PO: ${po.po_number} (${po.id}), SO: ${linkedSO?.order_number || 'None'}, Customer: ${customerName}, Status: ${po.status}`);

    result.push({
      id: po.id, // Always use PO ID (not SO ID)
      no: index + 1,
      poNumber: po.po_number,
      soNumber: linkedSO?.order_number || null,
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
      supplierName: 'Galileo Manufacturing',
      etaToUsPort: linkedSO?.eta_to_us_port || null,
      confirmedEta: linkedSO?.confirmed_eta || null,
      actualDeliveryDate: linkedSO?.actual_delivery_date || null,
      qtyDelivered: linkedSO?.qty_delivered || 0,
      outstandingQty: linkedSO?.outstanding_qty || totalQty,
      invoiceAmount: linkedSO?.grand_total ? linkedSO.grand_total / 100 : 0,
      deliveryAddress: addressParts.join(', '),
      expectedDelivery: po.expected_delivery_date || linkedSO?.requested_delivery_date || null,
      status: po.status, // Always use PO status (draft, sent, confirmed, partial, received, cancelled)
      actionRequired: po.internal_notes || '',
      notes: '',
      isUnallocated: !isAllocated,
    });
  });

  console.log(`[GDC] Built ${result.length} items for display (Allocated: ${allocatedCount}, Unallocated: ${unallocatedCount})`);

  // Build unique SKUs with product names for column headers
  const uniqueSkus: SKUColumnInfo[] = [];
  skuInfoMap.forEach((productName, sku) => {
    uniqueSkus.push({ sku, productName });
  });
  uniqueSkus.sort((a, b) => a.sku.localeCompare(b.sku));

  console.log(`[GDC] ========== Finished fetching ${orderSeries} (${result.length} POs, ${uniqueSkus.length} SKUs) ==========`);

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

  return {
    customers,
    products,
    statuses,
    salesOrders,
    customerPoNumbers,
  };
}
