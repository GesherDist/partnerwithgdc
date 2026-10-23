/**
 * CMA CGM Container Tracking Service
 *
 * Integrates with CMA CGM Track & Trace API to fetch real-time container status.
 * Replaces manual email-based tracking with direct API calls.
 *
 * API: operation/trackandtrace/v1
 * Auth: API Key (keyId header)
 */

import type {
  CmaCgmEvent,
  CmaCgmEquipmentEvent,
  CmaCgmTransportEvent,
  CmaCgmEventsResponse,
  CmaCgmTrackingResult,
  CmaCgmMappedStatus,
  CmaCgmSyncResult,
  CmaCgmEquipmentEventTypeCode,
  CmaCgmTransportEventTypeCode,
} from '../types';

import {
  updateShipmentTracking,
  createStatusHistory,
  updateShipmentLoadStatus,
  updateSalesOrderStatus,
  updatePurchaseOrderStatus,
} from '../repositories/shipping.repository';

import { createAdminClient } from '@/shared/lib/supabase/admin';

// ============================================
// CONFIGURATION
// ============================================

const CMA_CGM_BASE_URL = 'https://apis.cma-cgm.net/operation/trackandtrace/v1';
const CMA_CGM_TIMEOUT = 30000; // 30 seconds

/**
 * Get API key from environment
 */
function getApiKey(): string | null {
  return process.env.CMA_CGM_API_KEY || null;
}

/**
 * Check if CMA CGM integration is configured
 */
export function isCmaCgmConfigured(): boolean {
  return !!getApiKey();
}

// ============================================
// EVENT TYPE GUARDS
// ============================================

function isEquipmentEvent(event: CmaCgmEvent): event is CmaCgmEquipmentEvent {
  return event.eventType === 'EQUIPMENT';
}

function isTransportEvent(event: CmaCgmEvent): event is CmaCgmTransportEvent {
  return event.eventType === 'TRANSPORT';
}

// ============================================
// STATUS MAPPING
// ============================================

/**
 * Map CMA CGM equipment event code to our internal tracking status
 */
function mapEquipmentEventToStatus(
  eventCode: CmaCgmEquipmentEventTypeCode,
  _emptyIndicator?: string
): { trackingStatus: string; loadStatus: string; description: string } {
  switch (eventCode) {
    case 'LOAD':
      return {
        trackingStatus: 'loaded_on_vessel',
        loadStatus: 'open',
        description: 'Container loaded on vessel',
      };
    case 'DISC':
      return {
        trackingStatus: 'arrived_port',
        loadStatus: 'in_transit',
        description: 'Container discharged at port',
      };
    case 'GTIN':
      return {
        trackingStatus: 'arrived_port',
        loadStatus: 'in_transit',
        description: 'Container gated in at terminal',
      };
    case 'GTOT':
      return {
        trackingStatus: 'out_for_delivery',
        loadStatus: 'in_transit',
        description: 'Container gated out from terminal',
      };
    case 'PICK':
      return {
        trackingStatus: 'out_for_delivery',
        loadStatus: 'in_transit',
        description: 'Container picked up',
      };
    case 'DROP':
      return {
        trackingStatus: 'delivered',
        loadStatus: 'delivered',
        description: 'Container dropped off',
      };
    case 'STUF':
      return {
        trackingStatus: 'container_picked',
        loadStatus: 'open',
        description: 'Container stuffed',
      };
    case 'STRP':
      return {
        trackingStatus: 'delivered',
        loadStatus: 'delivered',
        description: 'Container stripped',
      };
    default:
      return {
        trackingStatus: 'in_transit',
        loadStatus: 'in_transit',
        description: `Container event: ${eventCode}`,
      };
  }
}

/**
 * Map CMA CGM transport event code to our internal tracking status
 */
function mapTransportEventToStatus(
  eventCode: CmaCgmTransportEventTypeCode,
  classifier: string
): { trackingStatus: string; loadStatus: string; description: string } {
  const isActual = classifier === 'ACT';

  switch (eventCode) {
    case 'DEPA':
      return {
        trackingStatus: isActual ? 'departed_origin' : 'loaded_on_vessel',
        loadStatus: isActual ? 'in_transit' : 'open',
        description: isActual ? 'Vessel departed' : 'Vessel departure planned',
      };
    case 'ARRI':
      return {
        trackingStatus: isActual ? 'arrived_port' : 'in_transit',
        loadStatus: 'in_transit',
        description: isActual ? 'Vessel arrived at port' : 'Vessel arrival estimated',
      };
    default:
      return {
        trackingStatus: 'in_transit',
        loadStatus: 'in_transit',
        description: `Transport event: ${eventCode}`,
      };
  }
}

/**
 * Map CMA CGM event to our internal status
 */
export function mapCmaCgmEventToStatus(event: CmaCgmEvent): CmaCgmMappedStatus {
  let statusMapping: { trackingStatus: string; loadStatus: string; description: string };

  if (isEquipmentEvent(event)) {
    statusMapping = mapEquipmentEventToStatus(
      event.equipmentEventTypeCode,
      event.emptyIndicatorCode
    );
  } else if (isTransportEvent(event)) {
    statusMapping = mapTransportEventToStatus(
      event.transportEventTypeCode,
      event.eventClassifierCode
    );
  } else {
    statusMapping = {
      trackingStatus: 'in_transit',
      loadStatus: 'in_transit',
      description: 'Unknown event type',
    };
  }

  // Extract location information
  let location: string | undefined;
  if (isEquipmentEvent(event)) {
    location =
      event.eventLocation?.locationName ||
      event.eventLocation?.UNLocationCode ||
      event.transportCall?.UNLocationCode ||
      event.transportCall?.location?.locationName;
  } else if (isTransportEvent(event)) {
    location =
      event.transportCall?.UNLocationCode ||
      event.transportCall?.location?.locationName;
  }

  // Extract vessel name
  let vesselName: string | undefined;
  if (isEquipmentEvent(event) && event.transportCall?.vessel) {
    vesselName = event.transportCall.vessel.vesselName;
  } else if (isTransportEvent(event) && event.transportCall?.vessel) {
    vesselName = event.transportCall.vessel.vesselName;
  }

  // Build event code for display
  let eventCode: string;
  if (isEquipmentEvent(event)) {
    eventCode = event.equipmentEventTypeCode;
  } else if (isTransportEvent(event)) {
    eventCode = event.transportEventTypeCode;
  } else {
    eventCode = 'UNKNOWN';
  }

  return {
    trackingStatus: statusMapping.trackingStatus,
    loadStatus: statusMapping.loadStatus,
    location,
    vesselName,
    eventDateTime: event.eventDateTime || event.eventCreatedDateTime,
    eventCode,
    eventDescription: statusMapping.description,
  };
}

// ============================================
// API CLIENT
// ============================================

/**
 * Estimated arrival at the final port: the latest planned/estimated vessel
 * arrival (ARRI) event. Returns YYYY-MM-DD, or undefined when there is none.
 */
function getEstimatedArrival(events: CmaCgmEvent[]): string | undefined {
  const arrival = events.find(
    (e) =>
      isTransportEvent(e) &&
      e.transportEventTypeCode === 'ARRI' &&
      e.eventClassifierCode !== 'ACT' &&
      Boolean(e.eventDateTime)
  );
  return arrival?.eventDateTime?.slice(0, 10);
}

/**
 * Fetch tracking events from CMA CGM API
 */
export async function fetchContainerEvents(
  containerNumber: string
): Promise<CmaCgmTrackingResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.log('[CMA-CGM] API key not configured - skipping tracking');
    return {
      success: false,
      containerNumber,
      error: 'CMA CGM API key not configured',
    };
  }

  try {
    const url = `${CMA_CGM_BASE_URL}/events?equipmentReference=${encodeURIComponent(containerNumber)}`;

    console.log(`[CMA-CGM] Fetching events for container: ${containerNumber}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        keyId: apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(CMA_CGM_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CMA-CGM] API error: ${response.status} - ${errorText}`);
      // Surface CMA's reason (e.g. "Community Client Free Trial Expired")
      let reason = '';
      try {
        const parsed = JSON.parse(errorText) as { description?: string; message?: string };
        reason = parsed.description || parsed.message || '';
      } catch {
        // not JSON
      }
      return {
        success: false,
        containerNumber,
        error: `API error: ${response.status}${reason ? ` - ${reason}` : ''}`,
      };
    }

    const events: CmaCgmEventsResponse = await response.json();

    if (!events || events.length === 0) {
      console.log(`[CMA-CGM] No events found for container: ${containerNumber}`);
      return {
        success: true,
        containerNumber,
        events: [],
        latestEvent: undefined,
      };
    }

    // Sort events by date descending to get latest first
    const sortedEvents = [...events].sort((a, b) => {
      const dateA = new Date(a.eventDateTime || a.eventCreatedDateTime).getTime();
      const dateB = new Date(b.eventDateTime || b.eventCreatedDateTime).getTime();
      return dateB - dateA;
    });

    console.log(
      `[CMA-CGM] Found ${events.length} events for container: ${containerNumber}`
    );

    // The feed also carries planned/estimated (future) events. Status must
    // come from what actually happened: with no actual event yet (booking
    // only) there is no status change, only the estimated arrival.
    const latestActual = sortedEvents.find((e) => e.eventClassifierCode === 'ACT');

    return {
      success: true,
      containerNumber,
      events: sortedEvents,
      latestEvent: latestActual,
      estimatedArrival: getEstimatedArrival(sortedEvents),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[CMA-CGM] Error fetching events: ${message}`);
    return {
      success: false,
      containerNumber,
      error: message,
    };
  }
}

// ============================================
// SHIPMENT UPDATE
// ============================================

/**
 * Update shipment with CMA CGM tracking data
 */
export async function updateShipmentFromCmaCgm(
  shipmentId: string,
  salesOrderId: string | null,
  purchaseOrderId: string | null,
  _containerNumber: string,
  mappedStatus: CmaCgmMappedStatus,
  estimatedArrival?: string
): Promise<boolean> {
  try {
    // Read before the update: stock is received only on the change to delivered
    const { poReceivingService } = await import('@/features/inventory/services/po-receiving.service');
    const wasDelivered = await poReceivingService.isShipmentDelivered(shipmentId);

    // Update shipment tracking info. The current location is kept in the
    // status history only - final_destination is the real delivery destination.
    // vessel_name gets mapped to carrier in the repository.
    // The API is the current source of truth, so its ETA is stamped "now"
    // (the repository skips ETAs from events older than the last update).
    const trackingUpdated = await updateShipmentTracking(
      shipmentId,
      {
        tracking_status: mappedStatus.trackingStatus,
        vessel_name: mappedStatus.vesselName,
        eta_port_tracking: estimatedArrival,
      },
      estimatedArrival ? new Date().toISOString() : mappedStatus.eventDateTime
    );

    if (!trackingUpdated) {
      console.error(`[CMA-CGM] Failed to update tracking for shipment ${shipmentId}`);
      return false;
    }

    // Update load status for Operations Dashboard
    await updateShipmentLoadStatus(shipmentId, mappedStatus.trackingStatus);

    // Create status history entry
    await createStatusHistory({
      shipment_id: shipmentId,
      status: mappedStatus.trackingStatus,
      location: mappedStatus.location,
      notes: `[CMA-CGM API] ${mappedStatus.eventDescription}`,
      raw_extract: {
        source: 'cma_cgm_api',
        eventCode: mappedStatus.eventCode,
        eventDateTime: mappedStatus.eventDateTime,
        vesselName: mappedStatus.vesselName,
        location: mappedStatus.location,
      },
    });

    // Update sales order status if applicable
    if (salesOrderId) {
      const soStatus = mapTrackingToSalesOrderStatus(mappedStatus.trackingStatus);
      if (soStatus) {
        await updateSalesOrderStatus(salesOrderId, soStatus);
      }
    }

    // Update purchase order status if applicable
    // When shipment is delivered, mark PO as received
    if (purchaseOrderId) {
      const poStatus = mapTrackingToPurchaseOrderStatus(mappedStatus.trackingStatus);
      if (poStatus) {
        await updatePurchaseOrderStatus(purchaseOrderId, poStatus);
      }
    }

    // Container delivered: put clear stock POs into warehouse stock (once)
    if (mappedStatus.trackingStatus === 'delivered' && !wasDelivered) {
      await poReceivingService.autoReceiveForShipment(shipmentId);
    }

    // Calculate is_delayed field
    // Get current shipment data to check ETA
    const supabase = createAdminClient();
    const { data: shipmentData } = await supabase
      .from('shipments')
      .select('eta_port_tracking, eta_to_port, estimated_arrival')
      .eq('id', shipmentId)
      .single();

    // Auto-detect delay: ETA passed but shipment not delivered
    const now = new Date();
    const etaDate = shipmentData?.eta_port_tracking || shipmentData?.eta_to_port || shipmentData?.estimated_arrival;
    const eta = etaDate ? new Date(etaDate) : null;
    const isDelivered = mappedStatus.trackingStatus === 'delivered';
    const isDelayed = eta && eta < now && !isDelivered;

    // Update last sync timestamp and is_delayed field
    await supabase
      .from('shipments')
      .update({
        cma_cgm_last_sync: new Date().toISOString(),
        cma_cgm_last_event_code: mappedStatus.eventCode,
        is_delayed: isDelayed || false, // Auto-update delayed status
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipmentId);

    console.log(
      `[CMA-CGM] Updated shipment ${shipmentId}: ${mappedStatus.eventCode} → ${mappedStatus.trackingStatus}`
    );

    return true;
  } catch (error) {
    console.error(`[CMA-CGM] Error updating shipment: ${error}`);
    return false;
  }
}

/**
 * Map tracking status to sales order status
 */
function mapTrackingToSalesOrderStatus(trackingStatus: string): string | null {
  switch (trackingStatus) {
    case 'departed_origin':
    case 'in_transit':
      return 'shipped';
    case 'delivered':
      return 'delivered';
    default:
      return null;
  }
}

/**
 * Map tracking status to purchase order status
 * When shipment departs/in transit → PO is in_transit
 * When shipment is delivered → PO is received
 */
function mapTrackingToPurchaseOrderStatus(trackingStatus: string): string | null {
  switch (trackingStatus) {
    case 'booked':
    case 'container_picked':
      return 'ready_to_ship';
    case 'loaded_on_vessel':
    case 'departed_origin':
    case 'in_transit':
    case 'arrived_port':
    case 'customs_clearance':
    case 'on_rail':
    case 'at_ramp':
    case 'out_for_delivery':
      return 'in_transit';
    case 'delivered':
      return 'received';
    default:
      return null;
  }
}

/**
 * Container known to CMA but nothing has actually happened yet (booking
 * only): keep the status, just record the estimated arrival and sync time.
 */
async function saveEstimatedArrivalOnly(shipmentId: string, estimatedArrival?: string): Promise<void> {
  if (estimatedArrival) {
    await updateShipmentTracking(
      shipmentId,
      { eta_port_tracking: estimatedArrival },
      new Date().toISOString()
    );
  }
  const supabase = createAdminClient();
  await supabase
    .from('shipments')
    .update({ cma_cgm_last_sync: new Date().toISOString() })
    .eq('id', shipmentId);
}

// ============================================
// CONTAINER SYNC
// ============================================

/**
 * Get all active containers that need tracking
 */
export async function getActiveContainersForTracking(): Promise<
  Array<{
    shipmentId: string;
    salesOrderId: string | null;
    purchaseOrderId: string | null;
    containerNumber: string;
  }>
> {
  const supabase = createAdminClient();

  // Get shipments with container numbers that are not yet delivered
  const { data, error } = await supabase
    .from('shipments')
    .select('id, sales_order_id, purchase_order_id, container_number, tracking_status')
    .not('container_number', 'is', null)
    // NULL = never tracked yet; a plain "<> delivered" filter would skip those
    .or('tracking_status.is.null,tracking_status.neq.delivered')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[CMA-CGM] Error fetching active containers:', error);
    return [];
  }

  return (data || [])
    .filter((s) => s.container_number) // Extra safety check
    .map((s) => ({
      shipmentId: s.id,
      salesOrderId: s.sales_order_id,
      purchaseOrderId: s.purchase_order_id,
      containerNumber: s.container_number!,
    }));
}

/**
 * Sync all active containers with CMA CGM API
 */
export async function syncAllContainers(): Promise<CmaCgmSyncResult> {
  if (!isCmaCgmConfigured()) {
    console.log('[CMA-CGM] API not configured - skipping sync');
    return {
      success: false,
      totalContainers: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      errors: [{ containerNumber: 'N/A', error: 'CMA CGM API key not configured' }],
    };
  }

  console.log('[CMA-CGM] Starting container sync...');

  const containers = await getActiveContainersForTracking();

  if (containers.length === 0) {
    console.log('[CMA-CGM] No active containers to sync');
    return {
      success: true,
      totalContainers: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      errors: [],
    };
  }

  console.log(`[CMA-CGM] Found ${containers.length} containers to sync`);

  let successCount = 0;
  let failureCount = 0;
  let skippedCount = 0;
  const errors: Array<{ containerNumber: string; error: string }> = [];

  // Process containers with rate limiting (1 request per second)
  for (const container of containers) {
    try {
      // Note: CMA-CGM API can track ANY container that ships on CMA-CGM vessels,
      // not just CMA-CGM owned containers (CMAU, CGMU, etc.)
      // So we try to track all containers and let the API tell us if it can't find them

      // Fetch events from API
      const result = await fetchContainerEvents(container.containerNumber);

      if (!result.success) {
        console.error(
          `[CMA-CGM] Failed to fetch events for ${container.containerNumber}: ${result.error}`
        );
        failureCount++;
        errors.push({
          containerNumber: container.containerNumber,
          error: result.error || 'Unknown error',
        });
        continue;
      }

      if (!result.latestEvent) {
        console.log(`[CMA-CGM] No actual events yet for ${container.containerNumber}`);
        await saveEstimatedArrivalOnly(container.shipmentId, result.estimatedArrival);
        skippedCount++;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      // Map event to our status
      const mappedStatus = mapCmaCgmEventToStatus(result.latestEvent);

      // Update shipment
      const updated = await updateShipmentFromCmaCgm(
        container.shipmentId,
        container.salesOrderId,
        container.purchaseOrderId,
        container.containerNumber,
        mappedStatus,
        result.estimatedArrival
      );

      if (updated) {
        successCount++;
      } else {
        failureCount++;
        errors.push({
          containerNumber: container.containerNumber,
          error: 'Failed to update shipment',
        });
      }

      // Rate limiting: wait 1 second between requests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[CMA-CGM] Error processing ${container.containerNumber}: ${message}`
      );
      failureCount++;
      errors.push({
        containerNumber: container.containerNumber,
        error: message,
      });
    }
  }

  console.log(
    `[CMA-CGM] Sync complete: ${successCount} success, ${failureCount} failed, ${skippedCount} skipped`
  );

  return {
    success: failureCount === 0,
    totalContainers: containers.length,
    successCount,
    failureCount,
    skippedCount,
    errors,
  };
}

/**
 * Track a single container (for manual/on-demand tracking)
 */
export async function trackContainer(
  containerNumber: string
): Promise<CmaCgmTrackingResult & { mappedStatus?: CmaCgmMappedStatus }> {
  const result = await fetchContainerEvents(containerNumber);

  if (!result.success || !result.latestEvent) {
    return result;
  }

  const mappedStatus = mapCmaCgmEventToStatus(result.latestEvent);

  return {
    ...result,
    mappedStatus,
  };
}

/**
 * Track one shipment's container now and apply the result to the shipment.
 * Used by the "Track now" button and right after a container number is saved,
 * so the operations team does not wait for the daily sync.
 */
export async function syncShipmentContainer(
  shipmentId: string
): Promise<{ success: boolean; message: string; trackingStatus?: string }> {
  if (!isCmaCgmConfigured()) {
    return { success: false, message: 'CMA CGM API key not configured' };
  }

  const supabase = createAdminClient();
  const { data: shipment, error } = await supabase
    .from('shipments')
    .select('id, sales_order_id, purchase_order_id, container_number')
    .eq('id', shipmentId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !shipment) {
    return { success: false, message: 'Shipment not found' };
  }
  if (!shipment.container_number) {
    return { success: false, message: 'Add a container number first' };
  }

  const result = await fetchContainerEvents(shipment.container_number);
  if (!result.success) {
    return { success: false, message: result.error || 'CMA CGM tracking failed' };
  }
  if (!result.latestEvent) {
    await saveEstimatedArrivalOnly(shipment.id, result.estimatedArrival);
    return {
      success: true,
      message: result.estimatedArrival
        ? `Booked - no movement yet. Estimated arrival ${result.estimatedArrival}`
        : `No CMA CGM events yet for ${shipment.container_number}`,
    };
  }

  const mappedStatus = mapCmaCgmEventToStatus(result.latestEvent);
  const updated = await updateShipmentFromCmaCgm(
    shipment.id,
    shipment.sales_order_id,
    shipment.purchase_order_id,
    shipment.container_number,
    mappedStatus,
    result.estimatedArrival
  );

  return updated
    ? {
        success: true,
        message: `${mappedStatus.eventDescription}${mappedStatus.location ? ` - ${mappedStatus.location}` : ''}`,
        trackingStatus: mappedStatus.trackingStatus,
      }
    : { success: false, message: 'Tracking received but the shipment could not be updated' };
}
