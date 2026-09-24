/**
 * Supplier Portal Repository
 *
 * Database operations for supplier portal.
 * RLS policies ensure suppliers only see their own data.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  Supplier,
  SupplierPurchaseOrder,
  SupplierPurchaseOrderItem,
  SupplierShipment,
  SupplierShipmentItem,
  SupplierDashboardStats,
  ProductionStatus,
} from '../types';

// ============================================
// SUPPLIER
// ============================================

/**
 * Get supplier by ID
 */
export async function getSupplierById(supplierId: string): Promise<Supplier | null> {
  const { data, error } = await db
    .from('suppliers')
    .select('*')
    .eq('id', supplierId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    console.error('[getSupplierById] Error:', error);
    return null;
  }

  return mapSupplier(data);
}

// ============================================
// PURCHASE ORDERS
// ============================================

/**
 * Get purchase orders for the supplier
 * Now checks item-level supplier_id instead of PO-level
 */
export async function getSupplierPurchaseOrders(
  supplierId: string,
  options?: {
    status?: string;
    productionStatus?: ProductionStatus;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: SupplierPurchaseOrder[]; count: number }> {
  // First, get distinct PO IDs where items belong to this supplier
  const { data: poItems, error: itemsError } = await db
    .from('purchase_order_items')
    .select('purchase_order_id')
    .eq('supplier_id', supplierId);

  if (itemsError) {
    console.error('[getSupplierPurchaseOrders] Error fetching PO items:', itemsError);
    return { data: [], count: 0 };
  }

  // Get unique PO IDs
  const poIds = [...new Set((poItems || []).map(item => item.purchase_order_id))];

  if (poIds.length === 0) {
    return { data: [], count: 0 };
  }

  // Now fetch POs with those IDs, including items
  let query = db
    .from('purchase_orders')
    .select('*, items:purchase_order_items(*)', { count: 'exact' })
    .in('id', poIds)
    .neq('status', 'draft') // Suppliers should NOT see draft POs
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.productionStatus) {
    query = query.eq('production_status', options.productionStatus);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[getSupplierPurchaseOrders] Error:', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data || []).map(mapPurchaseOrder),
    count: count || 0,
  };
}

/**
 * Get a single purchase order by ID
 */
export async function getSupplierPurchaseOrderById(
  poId: string
): Promise<SupplierPurchaseOrder | null> {
  // First fetch the PO
  const { data: poData, error: poError } = await db
    .from('purchase_orders')
    .select('*')
    .eq('id', poId)
    .is('deleted_at', null)
    .single();

  if (poError) {
    console.error('[getSupplierPurchaseOrderById] PO Error:', poError.message, poError.code, poError.details);
    return null;
  }

  if (!poData) {
    console.error('[getSupplierPurchaseOrderById] PO not found:', poId);
    return null;
  }

  // Fetch items separately
  const { data: itemsData, error: itemsError } = await db
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', poId)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    console.error('[getSupplierPurchaseOrderById] Items Error:', itemsError.message);
  }

  // Fetch sales order if exists
  let salesOrder = null;
  if (poData.sales_order_id) {
    const { data: soData } = await db
      .from('sales_orders')
      .select('id, so_number')
      .eq('id', poData.sales_order_id)
      .single();
    salesOrder = soData;
  }

  return mapPurchaseOrder({
    ...poData,
    items: itemsData || [],
    sales_order: salesOrder,
  });
}

/**
 * Get pending POs that need confirmation
 * Now checks item-level supplier_id
 */
export async function getPendingConfirmationPOs(
  supplierId: string
): Promise<SupplierPurchaseOrder[]> {
  // First, get distinct PO IDs where items belong to this supplier
  const { data: poItems, error: itemsError } = await db
    .from('purchase_order_items')
    .select('purchase_order_id')
    .eq('supplier_id', supplierId);

  if (itemsError || !poItems || poItems.length === 0) {
    return [];
  }

  const poIds = [...new Set(poItems.map(item => item.purchase_order_id))];

  const { data, error } = await db
    .from('purchase_orders')
    .select('*, items:purchase_order_items(*)')
    .in('id', poIds)
    .eq('status', 'sent')
    .is('supplier_confirmed_at', null)
    .is('supplier_rejected_at', null)
    .is('deleted_at', null)
    .order('po_date', { ascending: true });

  if (error) {
    console.error('[getPendingConfirmationPOs] Error:', error);
    return [];
  }

  return (data || []).map(mapPurchaseOrder);
}

/**
 * Confirm/Accept a purchase order
 * Also creates a shipment record for operations tracking
 */
export async function confirmPurchaseOrder(
  poId: string,
  userId: string,
  data: {
    expectedCompletionDate?: string;
    supplierNotes?: string;
    supplierReferenceNumber?: string;
  }
): Promise<{ success: boolean; error?: string; shipmentId?: string }> {
  // 1. Get PO details with items and sales order
  const { data: poData, error: poError } = await db
    .from('purchase_orders')
    .select(`
      *,
      items:purchase_order_items(*),
      sales_order:sales_orders(
        id,
        order_number,
        customer_id,
        shipping_address_street,
        shipping_address_city,
        shipping_address_state,
        shipping_address_postal_code,
        shipping_address_country,
        requested_delivery_date,
        customer:customers(id, name)
      )
    `)
    .eq('id', poId)
    .single();

  if (poError || !poData) {
    console.error('[confirmPurchaseOrder] Error fetching PO:', poError);
    return { success: false, error: 'Failed to fetch purchase order details' };
  }

  // Get supplier_id from the first item (item-level supplier)
  const items = poData.items as Array<{
    id: string;
    product_id: string;
    sku: string;
    description: string | null;
    quantity_ordered: number;
    supplier_id: string | null;
  }>;

  const supplierId = items?.[0]?.supplier_id || null;

  // 2. Update PO status
  const { error: updateError } = await db
    .from('purchase_orders')
    .update({
      status: 'confirmed',
      supplier_confirmed_at: new Date().toISOString(),
      supplier_confirmed_by: userId,
      production_status: 'not_started',
      expected_completion_date: data.expectedCompletionDate || null,
      supplier_notes: data.supplierNotes || null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', poId);

  if (updateError) {
    console.error('[confirmPurchaseOrder] Error updating PO:', updateError);
    return { success: false, error: updateError.message };
  }

  // 3. Generate shipment number
  const year = new Date().getFullYear();
  const { data: lastShipment } = await db
    .from('shipments')
    .select('shipment_number')
    .ilike('shipment_number', `SH-${year}-%`)
    .order('shipment_number', { ascending: false })
    .limit(1)
    .single();

  let nextNumber = 1;
  if (lastShipment?.shipment_number) {
    const match = lastShipment.shipment_number.match(/SH-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  const shipmentNumber = `SH-${year}-${String(nextNumber).padStart(5, '0')}`;

  // 4. Calculate total quantity from items
  const totalQty = items?.reduce((sum, item) => sum + (item.quantity_ordered || 0), 0) || 0;

  // 5. Get shipping address from Sales Order if exists
  const salesOrder = poData.sales_order as {
    id: string;
    order_number: string;
    customer_id: string;
    shipping_address_street: string | null;
    shipping_address_city: string | null;
    shipping_address_state: string | null;
    shipping_address_postal_code: string | null;
    shipping_address_country: string | null;
    requested_delivery_date: string | null;
    customer: { id: string; name: string } | null;
  } | null;

  // 6. Create shipment record
  const { data: shipment, error: shipmentError } = await db
    .from('shipments')
    .insert({
      shipment_number: shipmentNumber,
      shipment_date: new Date().toISOString().split('T')[0],
      purchase_order_id: poId,
      sales_order_id: salesOrder?.id || null,
      supplier_id: supplierId,

      // Supplier reference number (Galileo's SO#)
      supplier_reference_number: data.supplierReferenceNumber || null,

      // ETA dates
      eta_to_port: data.expectedCompletionDate || poData.expected_delivery_date || null,
      customer_expected_delivery: salesOrder?.requested_delivery_date || null,

      // Quantities
      total_qty: totalQty,
      qty_delivered: 0,
      outstanding_qty: totalQty,

      // Status
      status: 'pending',
      load_status: 'open',
      action_required: 'PO Confirmed - Awaiting Shipping Details',

      // Ship to address from Sales Order
      ship_to_name: salesOrder?.customer?.name || null,
      ship_to_address_street: salesOrder?.shipping_address_street || null,
      ship_to_address_city: salesOrder?.shipping_address_city || null,
      ship_to_address_state: salesOrder?.shipping_address_state || null,
      ship_to_address_postal_code: salesOrder?.shipping_address_postal_code || null,
      ship_to_address_country: salesOrder?.shipping_address_country || 'US',

      // Audit
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: userId,
      updated_by: userId,
    })
    .select('id')
    .single();

  if (shipmentError) {
    console.error('[confirmPurchaseOrder] Error creating shipment:', shipmentError);
    // PO is already confirmed, so we continue but log the error
    // In production, you might want to handle this differently
    return { success: true, error: `PO confirmed but shipment creation failed: ${shipmentError.message}` };
  }

  // 7. Create shipment items from PO items
  if (shipment && items && items.length > 0) {
    const shipmentItems = items.map((item, index) => ({
      shipment_id: shipment.id,
      product_id: item.product_id,
      sku: item.sku,
      description: item.description,
      quantity_shipped: item.quantity_ordered,
      sort_order: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: userId,
      updated_by: userId,
    }));

    const { error: itemsError } = await db
      .from('shipment_items')
      .insert(shipmentItems);

    if (itemsError) {
      console.error('[confirmPurchaseOrder] Error creating shipment items:', itemsError);
      // Continue anyway, shipment is created
    }
  }

  return { success: true, shipmentId: shipment?.id };
}

/**
 * Reject a purchase order
 */
export async function rejectPurchaseOrder(
  poId: string,
  userId: string,
  rejectionReason: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from('purchase_orders')
    .update({
      supplier_rejected_at: new Date().toISOString(),
      supplier_rejected_by: userId,
      supplier_rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', poId);

  if (error) {
    console.error('[rejectPurchaseOrder] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update production status
 * Also syncs shipment load_status when production status changes
 */
export async function updateProductionStatus(
  poId: string,
  userId: string,
  data: {
    productionStatus: ProductionStatus;
    expectedCompletionDate?: string;
    supplierNotes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  // 1. Update PO production status and sync PO status
  const poUpdateData: Record<string, unknown> = {
    production_status: data.productionStatus,
    expected_completion_date: data.expectedCompletionDate || null,
    supplier_notes: data.supplierNotes || null,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  // Map production_status to PO status
  // This keeps PO status in sync with supplier's production progress
  const productionToPOStatus: Record<string, string> = {
    not_started: 'confirmed',      // No change - just confirmed
    in_production: 'in_production', // Supplier started manufacturing
    ready_to_ship: 'ready_to_ship', // Goods ready, waiting to ship
    shipped: 'in_transit',          // Goods shipped by supplier
  };

  const newPOStatus = productionToPOStatus[data.productionStatus];
  if (newPOStatus && newPOStatus !== 'confirmed') {
    // Only update if it's a production-related status (not 'confirmed' which means no change)
    poUpdateData.status = newPOStatus;
  }

  const { error } = await db
    .from('purchase_orders')
    .update(poUpdateData)
    .eq('id', poId);

  if (error) {
    console.error('[updateProductionStatus] Error:', error);
    return { success: false, error: error.message };
  }

  // 2. Sync shipment fields based on production status
  // Always update eta_to_port if expectedCompletionDate is provided
  const shipmentUpdateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  // Sync eta_to_port from expected completion date
  if (data.expectedCompletionDate) {
    shipmentUpdateData.eta_to_port = data.expectedCompletionDate;
  }

  // Map: production_status → load_status
  // - "shipped" → "in_transit"
  // - "ready_to_ship" → "open" (no change, already open)
  // - "in_production" → "open" (no change)
  if (data.productionStatus === 'shipped') {
    shipmentUpdateData.status = 'in_transit';
    shipmentUpdateData.load_status = 'in_transit';
    shipmentUpdateData.action_required = 'In Transit - Awaiting Delivery';
  }

  // Update shipment if there's anything to update
  if (Object.keys(shipmentUpdateData).length > 2) { // More than just updated_at/updated_by
    const { error: shipmentError } = await db
      .from('shipments')
      .update(shipmentUpdateData)
      .eq('purchase_order_id', poId);

    if (shipmentError) {
      console.error('[updateProductionStatus] Error syncing shipment:', shipmentError);
      // Don't fail the whole operation, PO is already updated
    }
  }

  // 3. Update Sales Order status when production status is "shipped"
  if (data.productionStatus === 'shipped') {
    // Get shipment to find sales_order_id
    const { data: shipment } = await db
      .from('shipments')
      .select('sales_order_id')
      .eq('purchase_order_id', poId)
      .single();

    if (shipment?.sales_order_id) {
      const { error: soError } = await db
        .from('sales_orders')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', shipment.sales_order_id)
        .in('status', ['confirmed']); // Only update if currently confirmed

      if (soError) {
        console.error('[updateProductionStatus] Error updating SO status:', soError);
      } else {
        console.log(`[updateProductionStatus] Updated SO ${shipment.sales_order_id} status to processing`);
      }
    }
  }

  return { success: true };
}

// ============================================
// SHIPMENTS
// ============================================

/**
 * Get shipments for the supplier
 */
export async function getSupplierShipments(
  supplierId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: SupplierShipment[]; count: number }> {
  let query = db
    .from('shipments')
    .select('*, purchase_order:purchase_orders(id, po_number)', { count: 'exact' })
    .eq('supplier_id', supplierId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[getSupplierShipments] Error:', error);
    return { data: [], count: 0 };
  }

  return {
    data: (data || []).map(mapShipment),
    count: count || 0,
  };
}

/**
 * Get a single shipment by ID
 */
export async function getSupplierShipmentById(
  shipmentId: string
): Promise<SupplierShipment | null> {
  const { data, error } = await db
    .from('shipments')
    .select(`
      *,
      purchase_order:purchase_orders(id, po_number),
      items:shipment_items(*)
    `)
    .eq('id', shipmentId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    console.error('[getSupplierShipmentById] Error:', error);
    return null;
  }

  return mapShipment(data);
}

/**
 * Update shipment details
 */
export async function updateShipment(
  shipmentId: string,
  userId: string,
  data: {
    containerNumber?: string;
    billOfLading?: string;
    vesselName?: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    etd?: string;
    etaPort?: string;
    etaCustomer?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from('shipments')
    .update({
      container_number: data.containerNumber || null,
      bill_of_lading: data.billOfLading || null,
      vessel_name: data.vesselName || null,
      port_of_loading: data.portOfLoading || null,
      port_of_discharge: data.portOfDischarge || null,
      etd: data.etd || null,
      eta_port: data.etaPort || null,
      eta_customer: data.etaCustomer || null,
      notes: data.notes || null,
      supplier_updated_at: new Date().toISOString(),
      supplier_updated_by: userId,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq('id', shipmentId);

  if (error) {
    console.error('[updateShipment] Error:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * Get dashboard statistics for supplier
 * Now checks item-level supplier_id
 */
export async function getSupplierDashboardStats(
  supplierId: string
): Promise<SupplierDashboardStats> {
  // First, get distinct PO IDs where items belong to this supplier
  const { data: poItems } = await db
    .from('purchase_order_items')
    .select('purchase_order_id')
    .eq('supplier_id', supplierId);

  const poIds = [...new Set((poItems || []).map(item => item.purchase_order_id))];

  if (poIds.length === 0) {
    return {
      totalOrders: 0,
      pendingConfirmation: 0,
      inProduction: 0,
      readyToShip: 0,
      inTransit: 0,
      delivered: 0,
      delayed: 0,
    };
  }

  // Get PO counts (excluding drafts - suppliers shouldn't see drafts)
  const [totalResult, pendingResult, productionResult, readyResult] = await Promise.all([
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('id', poIds)
      .neq('status', 'draft')
      .is('deleted_at', null),
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('id', poIds)
      .eq('status', 'sent')
      .is('supplier_confirmed_at', null)
      .is('supplier_rejected_at', null)
      .is('deleted_at', null),
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('id', poIds)
      .eq('production_status', 'in_production')
      .is('deleted_at', null),
    db
      .from('purchase_orders')
      .select('id', { count: 'exact', head: true })
      .in('id', poIds)
      .eq('production_status', 'ready_to_ship')
      .is('deleted_at', null),
  ]);

  // Get shipment counts (shipments still use shipments.supplier_id for now)
  const [inTransitResult, deliveredResult] = await Promise.all([
    db
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'in_transit')
      .is('deleted_at', null),
    db
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)
      .eq('status', 'delivered')
      .is('deleted_at', null),
  ]);

  // Calculate delayed (POs past expected delivery date and not completed)
  const { count: delayedCount } = await db
    .from('purchase_orders')
    .select('id', { count: 'exact', head: true })
    .in('id', poIds)
    .lt('expected_delivery_date', new Date().toISOString().split('T')[0])
    .not('production_status', 'eq', 'shipped')
    .is('deleted_at', null);

  return {
    totalOrders: totalResult.count || 0,
    pendingConfirmation: pendingResult.count || 0,
    inProduction: productionResult.count || 0,
    readyToShip: readyResult.count || 0,
    inTransit: inTransitResult.count || 0,
    delivered: deliveredResult.count || 0,
    delayed: delayedCount || 0,
  };
}

// ============================================
// MAPPERS
// ============================================

function mapSupplier(data: Record<string, unknown>): Supplier {
  return {
    id: data.id as string,
    supplierCode: data.supplier_code as string,
    name: data.name as string,
    legalName: data.legal_name as string | null,
    primaryContactName: data.primary_contact_name as string | null,
    primaryContactEmail: data.primary_contact_email as string | null,
    primaryContactPhone: data.primary_contact_phone as string | null,
    addressStreet: data.address_street as string | null,
    addressCity: data.address_city as string | null,
    addressState: data.address_state as string | null,
    addressPostalCode: data.address_postal_code as string | null,
    addressCountry: data.address_country as string,
    paymentTerms: data.payment_terms as string | null,
    currencyCode: data.currency_code as string,
    taxId: data.tax_id as string | null,
    status: data.status as Supplier['status'],
    notes: data.notes as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

function mapPurchaseOrder(data: Record<string, unknown>): SupplierPurchaseOrder {
  const salesOrder = data.sales_order as Record<string, unknown> | null;
  const items = data.items as Record<string, unknown>[] | undefined;

  return {
    id: data.id as string,
    poNumber: data.po_number as string,
    poDate: data.po_date as string,
    expectedDeliveryDate: data.expected_delivery_date as string | null,
    // Supplier info is now at item level
    salesOrderId: data.sales_order_id as string | null,
    warehouseId: data.warehouse_id as string | null,
    currencyCode: data.currency_code as string,
    status: data.status as SupplierPurchaseOrder['status'],
    productionStatus: (data.production_status as ProductionStatus) || 'not_started',
    supplierConfirmedAt: data.supplier_confirmed_at as string | null,
    supplierConfirmedBy: data.supplier_confirmed_by as string | null,
    supplierRejectedAt: data.supplier_rejected_at as string | null,
    supplierRejectedBy: data.supplier_rejected_by as string | null,
    supplierRejectionReason: data.supplier_rejection_reason as string | null,
    expectedCompletionDate: data.expected_completion_date as string | null,
    supplierNotes: data.supplier_notes as string | null,
    subtotal: data.subtotal as number,
    taxTotal: data.tax_total as number,
    shippingCost: data.shipping_cost as number,
    grandTotal: data.grand_total as number,
    vendorNotes: data.vendor_notes as string | null,
    internalNotes: data.internal_notes as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    salesOrder: salesOrder
      ? { id: salesOrder.id as string, soNumber: salesOrder.so_number as string }
      : undefined,
    items: items?.map(mapPurchaseOrderItem),
  };
}

function mapPurchaseOrderItem(data: Record<string, unknown>): SupplierPurchaseOrderItem {
  return {
    id: data.id as string,
    purchaseOrderId: data.purchase_order_id as string,
    productId: data.product_id as string,
    sku: data.sku as string,
    description: data.description as string | null,
    quantityOrdered: data.quantity_ordered as number,
    quantityReceived: data.quantity_received as number,
    unitCode: data.unit_code as string,
    unitPrice: data.unit_price as number,
    taxRate: data.tax_rate as number,
    lineTotal: data.line_total as number,
    sortOrder: data.sort_order as number,
    supplierId: data.supplier_id as string | null,
    supplierName: data.supplier_name as string | null,
  };
}

function mapShipment(data: Record<string, unknown>): SupplierShipment {
  const purchaseOrder = data.purchase_order as Record<string, unknown> | null;
  const items = data.items as Record<string, unknown>[] | undefined;

  return {
    id: data.id as string,
    shipmentNumber: data.shipment_number as string,
    shipmentDate: data.shipment_date as string,
    estimatedArrival: data.estimated_arrival as string | null,
    actualArrival: data.actual_arrival as string | null,
    salesOrderId: data.sales_order_id as string | null,
    purchaseOrderId: data.purchase_order_id as string | null,
    supplierId: data.supplier_id as string | null,
    carrier: data.carrier as string | null,
    trackingNumber: data.tracking_number as string | null,
    serviceType: data.service_type as string | null,
    status: data.status as SupplierShipment['status'],
    containerNumber: data.container_number as string | null,
    billOfLading: data.bill_of_lading as string | null,
    vesselName: data.vessel_name as string | null,
    portOfLoading: data.port_of_loading as string | null,
    portOfDischarge: data.port_of_discharge as string | null,
    etd: data.etd as string | null,
    etaPort: data.eta_port as string | null,
    etaCustomer: data.eta_customer as string | null,
    supplierUpdatedAt: data.supplier_updated_at as string | null,
    supplierUpdatedBy: data.supplier_updated_by as string | null,
    shipToName: data.ship_to_name as string | null,
    shipToAddressStreet: data.ship_to_address_street as string | null,
    shipToAddressCity: data.ship_to_address_city as string | null,
    shipToAddressState: data.ship_to_address_state as string | null,
    shipToAddressPostalCode: data.ship_to_address_postal_code as string | null,
    shipToAddressCountry: data.ship_to_address_country as string | null,
    totalWeight: data.total_weight as number | null,
    weightUnit: data.weight_unit as string,
    totalPackages: data.total_packages as number,
    notes: data.notes as string | null,
    deliveryInstructions: data.delivery_instructions as string | null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    purchaseOrder: purchaseOrder
      ? { id: purchaseOrder.id as string, poNumber: purchaseOrder.po_number as string }
      : undefined,
    items: items?.map(mapShipmentItem),
  };
}

function mapShipmentItem(data: Record<string, unknown>): SupplierShipmentItem {
  return {
    id: data.id as string,
    shipmentId: data.shipment_id as string,
    productId: data.product_id as string,
    sku: data.sku as string,
    description: data.description as string | null,
    quantityShipped: data.quantity_shipped as number,
    sortOrder: data.sort_order as number,
  };
}
