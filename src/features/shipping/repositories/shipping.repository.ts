/**
 * Shipping Repository
 *
 * Database operations for shipping tracking.
 */

import { createClient } from '@/shared/lib/supabase/server';
import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  ShippingEmail,
  ShippingEmailWithInbound,
  ShipmentStatusHistory,
  ShippingEmailExtraction,
  ShipmentReference,
} from '../types';

// ============================================
// STATUS ORDER CONSTANTS (for regression prevention)
// ============================================

/**
 * Tracking status progression order.
 * Status can only move forward in this list, never backwards.
 * Exception is special - it's a side-effect status that doesn't affect progression.
 */
const TRACKING_STATUS_ORDER: string[] = [
  'booked',
  'container_picked',
  'loaded_on_vessel',
  'departed_origin',
  'in_transit',
  'arrived_port',
  'customs_clearance',
  'on_rail',
  'at_ramp',
  'out_for_delivery',
  'delivered',
];

/**
 * Load status progression order for Operations Dashboard.
 */
const LOAD_STATUS_ORDER: string[] = ['open', 'in_transit', 'delivered'];

/**
 * Check if new status is a valid progression from current status.
 * Returns true if the transition is allowed.
 */
function isValidStatusProgression(
  currentStatus: string | null,
  newStatus: string,
  statusOrder: string[]
): boolean {
  // No current status - any status is valid
  if (!currentStatus) return true;

  // Exception status is always allowed (it's a side-effect, not progression)
  if (newStatus === 'exception') return true;

  // Hold status is always allowed (it's a side-effect, not progression)
  if (newStatus === 'hold') return true;

  const currentIdx = statusOrder.indexOf(currentStatus);
  const newIdx = statusOrder.indexOf(newStatus);

  // If either status is not in the list, allow the update
  if (currentIdx === -1 || newIdx === -1) return true;

  // Only allow forward progression or same status
  return newIdx >= currentIdx;
}

// ============================================
// SHIPPING EMAILS
// ============================================

/**
 * Create a shipping email record from extraction
 * Includes idempotency check - returns existing record if already processed
 */
export async function createShippingEmail(data: {
  inbound_email_id: string;
  extraction: ShippingEmailExtraction;
}): Promise<ShippingEmail | null> {
  const supabase = createAdminClient();

  // Idempotency check: Return existing record if this inbound email was already processed
  const { data: existing } = await supabase
    .from('shipping_emails')
    .select('*')
    .eq('inbound_email_id', data.inbound_email_id)
    .single();

  if (existing) {
    console.log(`[Shipping] Shipping email already exists for inbound ${data.inbound_email_id}, returning existing`);
    return existing as ShippingEmail;
  }

  const { data: record, error } = await supabase
    .from('shipping_emails')
    .insert({
      inbound_email_id: data.inbound_email_id,
      container_number: data.extraction.containerNumber,
      mbl_number: data.extraction.mblNumber,
      so_number: data.extraction.soNumber,
      vessel_name: data.extraction.vesselName,
      voyage_number: data.extraction.voyageNumber,
      detected_status: data.extraction.detectedStatus,
      status_description: data.extraction.statusDescription,
      current_location: data.extraction.currentLocation,
      eta_port: data.extraction.etaPort,
      eta_ramp: data.extraction.etaRamp,
      lfd_date: data.extraction.lfdDate,
      delivery_date: data.extraction.deliveryDate,
      has_issue: data.extraction.hasIssue,
      issue_type: data.extraction.issueType,
      issue_description: data.extraction.issueDescription,
      is_transload: data.extraction.isTransload,
      new_container_number: data.extraction.newContainerNumber,
      is_processed: false,
      extraction_confidence: data.extraction.confidence,
      raw_extraction: data.extraction as unknown as Record<string, unknown>,
      key_points: data.extraction.keyPoints,
    })
    .select()
    .single();

  if (error) {
    console.error('[Shipping] Error creating shipping email:', error);
    return null;
  }

  return record as ShippingEmail;
}

/**
 * Get shipping emails with pagination
 */
export async function getShippingEmails(params: {
  page?: number;
  limit?: number;
  isProcessed?: boolean;
  hasIssue?: boolean;
}): Promise<{ data: ShippingEmailWithInbound[]; total: number }> {
  const supabase = await createClient();
  const { page = 1, limit = 20, isProcessed, hasIssue } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('shipping_emails')
    .select(
      `
      *,
      inbound_emails (
        id,
        subject,
        from_email,
        from_name,
        received_at
      )
    `,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false });

  if (isProcessed !== undefined) {
    query = query.eq('is_processed', isProcessed);
  }

  if (hasIssue !== undefined) {
    query = query.eq('has_issue', hasIssue);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[Shipping] Error fetching shipping emails:', error);
    return { data: [], total: 0 };
  }

  return { data: data as ShippingEmailWithInbound[], total: count || 0 };
}

/**
 * Get a single shipping email by ID
 */
export async function getShippingEmailById(
  id: string
): Promise<ShippingEmailWithInbound | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shipping_emails')
    .select(
      `
      *,
      inbound_emails (
        id,
        subject,
        from_email,
        from_name,
        received_at,
        text_body
      )
    `
    )
    .eq('id', id)
    .single();

  if (error) {
    console.error('[Shipping] Error fetching shipping email:', error);
    return null;
  }

  return data as ShippingEmailWithInbound;
}

// ============================================
// SO NUMBER NORMALIZATION
// ============================================

/**
 * Normalize SO number to all possible formats for matching
 * Handles both formats:
 * - SO2600012 (compact: SO + 7 digits)
 * - SO-2026-00012 (expanded: SO-YYYY-NNNNN)
 *
 * Returns array of possible formats to try
 */
function normalizeSoNumber(soNumber: string): string[] {
  const formats: string[] = [soNumber.toUpperCase()]; // Always include original

  // Pattern 1: SO2600012 (compact) -> SO-2026-00012 (expanded)
  const compactMatch = soNumber.match(/^SO(\d{2})(\d{5})$/i);
  if (compactMatch && compactMatch[1] && compactMatch[2]) {
    const yearShort = compactMatch[1]; // "26"
    const seqNum = compactMatch[2]; // "00012"
    const yearFull = `20${yearShort}`; // "2026"
    formats.push(`SO-${yearFull}-${seqNum}`);
  }

  // Pattern 2: SO-2026-00012 (expanded) -> SO2600012 (compact)
  const expandedMatch = soNumber.match(/^SO-(\d{4})-(\d{5})$/i);
  if (expandedMatch && expandedMatch[1] && expandedMatch[2]) {
    const yearFull = expandedMatch[1]; // "2026"
    const seqNum = expandedMatch[2]; // "00012"
    const yearShort = yearFull.slice(2); // "26"
    formats.push(`SO${yearShort}${seqNum}`);
  }

  return [...new Set(formats)]; // Remove duplicates
}

// ============================================
// SHIPMENT MATCHING
// ============================================

/**
 * Find shipment by SO number or container number
 * Priority: SO number FIRST (business identifier), then container number (can be shared)
 *
 * NOTE: SO number matching handles both formats:
 * - SO2600012 (compact)
 * - SO-2026-00012 (expanded)
 */
export async function findShipmentByReference(
  containerNumber?: string | null,
  soNumber?: string | null
): Promise<ShipmentReference | null> {
  const supabase = createAdminClient();

  // PRIORITY 1: Try SO number first (more reliable business identifier)
  if (soNumber) {
    // Get all possible SO number formats
    const soFormats = normalizeSoNumber(soNumber);
    console.log(`[Shipping] Trying SO formats: ${soFormats.join(', ')}`);

    // First find the sales order with customer info (try all formats)
    const { data: salesOrder } = await supabase
      .from('sales_orders')
      .select(`
        id,
        order_number,
        customer_po_number,
        customers!inner (
          id,
          name
        )
      `)
      .in('order_number', soFormats)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (salesOrder) {
      // Then find shipment linked to this sales order
      const { data: shipment } = await supabase
        .from('shipments')
        .select('id, shipment_number, sales_order_id')
        .eq('sales_order_id', salesOrder.id)
        .is('deleted_at', null)
        .single();

      if (shipment) {
        console.log(`[Shipping] Matched by SO number: ${soNumber} → ${shipment.shipment_number}`);
        const customerData = salesOrder.customers as unknown as { id: string; name: string } | null;
        return {
          id: shipment.id,
          shipment_number: shipment.shipment_number,
          sales_order_id: shipment.sales_order_id,
          order_number: salesOrder.order_number,
          customer_name: customerData?.name || null,
          customer_po_number: salesOrder.customer_po_number || null,
        };
      }
    }
  }

  // PRIORITY 2: Try container number (fallback if SO doesn't match)
  if (containerNumber) {
    // Try current container_number first
    const { data } = await supabase
      .from('shipments')
      .select(`
        id,
        shipment_number,
        sales_order_id,
        sales_orders (
          order_number,
          customer_po_number,
          customers (
            id,
            name
          )
        )
      `)
      .eq('container_number', containerNumber)
      .is('deleted_at', null)
      .single();

    if (data) {
      console.log(`[Shipping] Matched by container number: ${containerNumber} → ${data.shipment_number}`);
      const salesOrderData = data.sales_orders as unknown as {
        order_number: string;
        customer_po_number: string | null;
        customers: { id: string; name: string } | null;
      } | null;
      return {
        id: data.id,
        shipment_number: data.shipment_number,
        sales_order_id: data.sales_order_id,
        order_number: salesOrderData?.order_number,
        customer_name: salesOrderData?.customers?.name || null,
        customer_po_number: salesOrderData?.customer_po_number || null,
      };
    }

    // PRIORITY 3: Try original_container_number (for transload scenarios)
    // The shipment may have been updated with new container, but email refers to original
    const { data: transloadMatch } = await supabase
      .from('shipments')
      .select(`
        id,
        shipment_number,
        sales_order_id,
        sales_orders (
          order_number,
          customer_po_number,
          customers (
            id,
            name
          )
        )
      `)
      .eq('original_container_number', containerNumber)
      .is('deleted_at', null)
      .single();

    if (transloadMatch) {
      console.log(`[Shipping] Matched by ORIGINAL container number: ${containerNumber} → ${transloadMatch.shipment_number}`);
      const salesOrderData = transloadMatch.sales_orders as unknown as {
        order_number: string;
        customer_po_number: string | null;
        customers: { id: string; name: string } | null;
      } | null;
      return {
        id: transloadMatch.id,
        shipment_number: transloadMatch.shipment_number,
        sales_order_id: transloadMatch.sales_order_id,
        order_number: salesOrderData?.order_number,
        customer_name: salesOrderData?.customers?.name || null,
        customer_po_number: salesOrderData?.customer_po_number || null,
      };
    }
  }

  return null;
}

// ============================================
// SHIPMENT UPDATE
// ============================================

/**
 * Update shipment with tracking info
 * Includes regression protection for status and ETA
 *
 * @param shipmentId - The shipment to update
 * @param data - Tracking data to update
 * @param eventTimestamp - Optional timestamp of the email event (for ETA comparison)
 */
export async function updateShipmentTracking(
  shipmentId: string,
  data: {
    container_number?: string;
    mbl_number?: string;
    vessel_name?: string;
    voyage_number?: string;
    tracking_status?: string;
    eta_port_tracking?: string;
    eta_ramp?: string;
    lfd_date?: string;
    has_issue?: boolean;
    issue_type?: string;
    issue_description?: string;
    transload_container?: string;
    original_container_number?: string;
    is_transloaded?: boolean;
    port_of_discharge?: string;
    final_destination?: string;
  },
  eventTimestamp?: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // Get current shipment state for comparison
  const { data: current, error: fetchError } = await supabase
    .from('shipments')
    .select('tracking_status, eta_port_tracking, eta_ramp, last_tracking_update')
    .eq('id', shipmentId)
    .single();

  if (fetchError) {
    console.error('[Shipping] Error fetching current shipment:', fetchError);
    return false;
  }

  const updateData: Record<string, unknown> = { ...data };

  // MAP SHIPPING FIELDS TO STANDARD SHIPMENT FIELDS
  // So they show in the Shipments list UI
  if (data.container_number) {
    updateData.tracking_number = data.container_number; // Container # = Tracking #
  }
  if (data.vessel_name) {
    updateData.carrier = data.vessel_name; // Vessel name as carrier
  }
  // If no vessel but we have container, set carrier to SEAIR Global (freight forwarder)
  if (!data.vessel_name && data.container_number) {
    updateData.carrier = 'SEAIR Global';
  }

  // STATUS REGRESSION PROTECTION
  // Only allow status to move forward in the progression order
  if (data.tracking_status && current?.tracking_status) {
    if (!isValidStatusProgression(current.tracking_status, data.tracking_status, TRACKING_STATUS_ORDER)) {
      console.log(
        `[Shipping] Skipping status regression: ${current.tracking_status} → ${data.tracking_status}`
      );
      delete updateData.tracking_status;
    }
  }

  // ETA COMPARISON USING EVENT TIMESTAMP
  // Only update ETA if this event is newer than the last tracking update
  const currentLastUpdate = current?.last_tracking_update
    ? new Date(current.last_tracking_update).getTime()
    : 0;
  const eventTime = eventTimestamp
    ? new Date(eventTimestamp).getTime()
    : Date.now();

  // If this event is older than the last update, skip ETA updates
  if (eventTime < currentLastUpdate) {
    console.log(
      `[Shipping] Skipping ETA update from older event: event=${eventTimestamp}, last=${current?.last_tracking_update}`
    );
    delete updateData.eta_port_tracking;
    delete updateData.eta_ramp;
  }

  // Remove undefined values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // If nothing to update after filtering, return success
  if (Object.keys(updateData).length === 0) {
    console.log('[Shipping] No updates needed after regression checks');
    return true;
  }

  // Add timestamps
  updateData.last_tracking_update = new Date().toISOString();
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('shipments')
    .update(updateData)
    .eq('id', shipmentId);

  if (error) {
    console.error('[Shipping] Error updating shipment tracking:', error);
    return false;
  }

  return true;
}

// ============================================
// STATUS HISTORY
// ============================================

/**
 * Deduplication window in milliseconds (5 minutes)
 * Prevents duplicate status history entries from webhook retries
 */
const STATUS_HISTORY_DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Create status history entry
 * Includes idempotency check - skips if same status exists within dedup window
 */
export async function createStatusHistory(data: {
  shipment_id: string;
  status: string;
  location?: string;
  inbound_email_id?: string;
  shipping_email_id?: string;
  notes?: string;
  raw_extract?: Record<string, unknown>;
}): Promise<ShipmentStatusHistory | null> {
  const supabase = createAdminClient();

  // Idempotency check: Skip if same status was recorded within the dedup window
  const dedupCutoff = new Date(Date.now() - STATUS_HISTORY_DEDUP_WINDOW_MS).toISOString();

  const { data: existing } = await supabase
    .from('shipment_status_history')
    .select('id, status_date')
    .eq('shipment_id', data.shipment_id)
    .eq('status', data.status)
    .gte('status_date', dedupCutoff)
    .order('status_date', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    console.log(
      `[Shipping] Skipping duplicate status history: ${data.status} already recorded at ${existing.status_date}`
    );
    return existing as ShipmentStatusHistory;
  }

  const { data: record, error } = await supabase
    .from('shipment_status_history')
    .insert({
      shipment_id: data.shipment_id,
      status: data.status,
      status_date: new Date().toISOString(),
      location: data.location,
      inbound_email_id: data.inbound_email_id,
      shipping_email_id: data.shipping_email_id,
      notes: data.notes,
      raw_extract: data.raw_extract,
    })
    .select()
    .single();

  if (error) {
    console.error('[Shipping] Error creating status history:', error);
    return null;
  }

  return record as ShipmentStatusHistory;
}

/**
 * Get status history for a shipment
 */
export async function getShipmentStatusHistory(
  shipmentId: string
): Promise<ShipmentStatusHistory[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('shipment_status_history')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('status_date', { ascending: false });

  if (error) {
    console.error('[Shipping] Error fetching status history:', error);
    return [];
  }

  return data as ShipmentStatusHistory[];
}

// ============================================
// LINKING
// ============================================

/**
 * Link shipping email to shipment
 */
export async function linkShippingEmailToShipment(
  shippingEmailId: string,
  shipmentId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('shipping_emails')
    .update({
      shipment_id: shipmentId,
      is_processed: true,
      is_matched: true,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', shippingEmailId);

  if (error) {
    console.error('[Shipping] Error linking email to shipment:', error);
    return false;
  }

  return true;
}

/**
 * Mark shipping email as processed (without match)
 */
export async function markShippingEmailProcessed(
  shippingEmailId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('shipping_emails')
    .update({
      is_processed: true,
      is_matched: false,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', shippingEmailId);

  if (error) {
    console.error('[Shipping] Error marking email processed:', error);
    return false;
  }

  return true;
}

// ============================================
// SHIPMENT LOAD STATUS UPDATE (for Operations Dashboard)
// ============================================

/**
 * Map tracking status to load_status (for Operations Dashboard)
 * Tracking status from emails → load_status that Jenny sees
 */
const TRACKING_TO_LOAD_STATUS: Record<string, string> = {
  booked: 'open',
  container_picked: 'open',
  loaded_on_vessel: 'open',
  departed_origin: 'in_transit',
  in_transit: 'in_transit',
  arrived_port: 'in_transit',
  customs_clearance: 'in_transit',
  on_rail: 'in_transit',
  at_ramp: 'in_transit',
  out_for_delivery: 'in_transit',
  delivered: 'delivered',
  exception: 'hold',
};

/**
 * Update shipment load_status based on tracking status
 * This updates the status shown in Operations Dashboard
 * Includes regression protection for load_status
 */
export async function updateShipmentLoadStatus(
  shipmentId: string,
  trackingStatus: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const loadStatus = TRACKING_TO_LOAD_STATUS[trackingStatus] || 'open';

  // Get current load_status for regression check
  const { data: current, error: fetchError } = await supabase
    .from('shipments')
    .select('load_status')
    .eq('id', shipmentId)
    .single();

  if (fetchError) {
    console.error('[Shipping] Error fetching current load_status:', fetchError);
    return false;
  }

  // LOAD STATUS REGRESSION PROTECTION
  if (current?.load_status && !isValidStatusProgression(current.load_status, loadStatus, LOAD_STATUS_ORDER)) {
    console.log(
      `[Shipping] Skipping load_status regression: ${current.load_status} → ${loadStatus}`
    );
    return true; // Not an error, just skip the update
  }

  // Build action_required message based on status
  let actionRequired = '';
  switch (trackingStatus) {
    case 'in_transit':
    case 'departed_origin':
      actionRequired = 'In Transit - Awaiting Delivery';
      break;
    case 'arrived_port':
      actionRequired = 'Arrived at Port - Awaiting Customs';
      break;
    case 'customs_clearance':
      actionRequired = 'Customs Clearance in Progress';
      break;
    case 'on_rail':
      actionRequired = 'On Rail - En Route to Ramp';
      break;
    case 'at_ramp':
      actionRequired = 'At Ramp - Ready for Pickup';
      break;
    case 'out_for_delivery':
      actionRequired = 'Out for Delivery';
      break;
    case 'delivered':
      actionRequired = 'Delivered';
      break;
    case 'exception':
      actionRequired = 'Exception - Requires Attention';
      break;
  }

  const { error } = await supabase
    .from('shipments')
    .update({
      load_status: loadStatus,
      action_required: actionRequired,
      updated_at: new Date().toISOString(),
    })
    .eq('id', shipmentId);

  if (error) {
    console.error('[Shipping] Error updating shipment load_status:', error);
    return false;
  }

  console.log(
    `[Shipping] Updated shipment ${shipmentId} load_status: ${trackingStatus} → ${loadStatus}`
  );
  return true;
}

// ============================================
// SALES ORDER STATUS UPDATE
// ============================================

/**
 * Update sales order status based on shipping tracking status
 */
export async function updateSalesOrderStatus(
  salesOrderId: string,
  newStatus: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // First get current status to check if update is needed
  const { data: currentOrder, error: fetchError } = await supabase
    .from('sales_orders')
    .select('status')
    .eq('id', salesOrderId)
    .single();

  if (fetchError || !currentOrder) {
    console.error('[Shipping] Error fetching sales order:', fetchError);
    return false;
  }

  // Don't update if already at target status or beyond
  const statusOrder = ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  const currentIndex = statusOrder.indexOf(currentOrder.status);
  const newIndex = statusOrder.indexOf(newStatus);

  // Only update if moving forward in the workflow
  if (newIndex <= currentIndex) {
    console.log(
      `[Shipping] Skipping SO status update: current=${currentOrder.status}, proposed=${newStatus}`
    );
    return true; // Not an error, just no update needed
  }

  // Don't update cancelled orders
  if (currentOrder.status === 'cancelled') {
    console.log('[Shipping] Skipping SO status update: order is cancelled');
    return true;
  }

  const { error } = await supabase
    .from('sales_orders')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', salesOrderId);

  if (error) {
    console.error('[Shipping] Error updating sales order status:', error);
    return false;
  }

  console.log(
    `[Shipping] Updated SO ${salesOrderId} status: ${currentOrder.status} → ${newStatus}`
  );
  return true;
}

/**
 * Update purchase order status based on shipping tracking status
 * Called when shipment tracking status changes (e.g., delivered → PO received)
 */
export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  newStatus: string
): Promise<boolean> {
  const supabase = createAdminClient();

  // First get current status to check if update is needed
  const { data: currentPO, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', purchaseOrderId)
    .single();

  if (fetchError || !currentPO) {
    console.error('[Shipping] Error fetching purchase order:', fetchError);
    return false;
  }

  // PO status order - can only move forward
  const statusOrder = ['draft', 'sent', 'confirmed', 'in_production', 'ready_to_ship', 'in_transit', 'partial', 'received'];
  const currentIndex = statusOrder.indexOf(currentPO.status);
  const newIndex = statusOrder.indexOf(newStatus);

  // Only update if moving forward in the workflow
  if (newIndex <= currentIndex) {
    console.log(
      `[Shipping] Skipping PO status update: current=${currentPO.status}, proposed=${newStatus}`
    );
    return true; // Not an error, just no update needed
  }

  // Don't update cancelled orders
  if (currentPO.status === 'cancelled') {
    console.log('[Shipping] Skipping PO status update: order is cancelled');
    return true;
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', purchaseOrderId);

  if (error) {
    console.error('[Shipping] Error updating purchase order status:', error);
    return false;
  }

  console.log(
    `[Shipping] Updated PO ${purchaseOrderId} status: ${currentPO.status} → ${newStatus}`
  );
  return true;
}
