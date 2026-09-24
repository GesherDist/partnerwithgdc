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
      return {
        success: false,
        containerNumber,
        error: `API error: ${response.status}`,
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

    return {
      success: true,
      containerNumber,
      events: sortedEvents,
      latestEvent: sortedEvents[0],
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
  mappedStatus: CmaCgmMappedStatus
): Promise<boolean> {
  try {
    // Update shipment tracking info
    // Pass location as final_destination (current location from CMA-CGM tracking)
    // Pass vessel_name which gets mapped to carrier in the repository
    const trackingUpdated = await updateShipmentTracking(
      shipmentId,
      {
        tracking_status: mappedStatus.trackingStatus,
        vessel_name: mappedStatus.vesselName,
        final_destination: mappedStatus.location, // Current location from CMA-CGM
      },
      mappedStatus.eventDateTime
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

    // Update last sync timestamp
    const supabase = createAdminClient();
    await supabase
      .from('shipments')
      .update({
        cma_cgm_last_sync: new Date().toISOString(),
        cma_cgm_last_event_code: mappedStatus.eventCode,
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
    .not('tracking_status', 'eq', 'delivered')
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
        console.log(`[CMA-CGM] No events for ${container.containerNumber}`);
        skippedCount++;
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
        mappedStatus
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
