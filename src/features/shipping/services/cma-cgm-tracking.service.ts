/**
 * CMA CGM Container Tracking Service
 *
 * Integrates with CMA CGM Track & Trace API to fetch real-time container status.
 * Replaces manual email-based tracking with direct API calls.
 *
 * API: operation/trackandtrace/v1
 * Auth: API Key (keyId header); OAuth2 client_credentials as fallback (Nov 26 2026)
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
  CmaCgmOtherTrip,
  CmaCgmApiLog,
  CmaCgmApiLogSource,
  CmaCgmApiLogOutcome,
  CmaJourneyPoint,
  CmaJourneySummary,
} from '../types';

import {
  updateShipmentTracking,
  createStatusHistory,
  updateShipmentLoadStatus,
  updatePurchaseOrderStatus,
  purchaseOrderStatusForTracking,
  AUTO_ACTION_MESSAGES,
  CMA_OTHER_TRIP_ACTION,
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

// /**
//  * Check if CMA CGM integration is configured
//  */
// export function isCmaCgmConfigured(): boolean {
//   return !!getApiKey();
// }

/**
 * Check if CMA CGM integration is configured
 * Nov 26 2026: API key OR OAuth2 client credentials (either one is enough)
 */
export function isCmaCgmConfigured(): boolean {
  return !!getApiKey() || !!getOAuthCredentials();
}

// ============================================
// OAUTH2 (Nov 26 2026)
// ============================================
// CMA's docs (Quick Start Guide, [API] LOGISTIC TRACKING SERVICE collection)
// list Track & Trace as a private API: OAuth2 client_credentials, client id +
// secret sent as HTTP Basic, scope tandtcommercial:read:be. The keyId header
// works today, so it stays first; OAuth2 is used when keyId is refused
// (401/403) or when no API key is set. Needs CMA_CGM_CLIENT_ID and
// CMA_CGM_CLIENT_SECRET from the portal (My Organization -> API application /
// Client settings). Without them, behaviour is exactly as before.

const CMA_CGM_TOKEN_URL = 'https://auth.cma-cgm.com/as/token.oauth2';
const CMA_CGM_TOKEN_SCOPE = 'tandtcommercial:read:be';

function getOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.CMA_CGM_CLIENT_ID;
  const clientSecret = process.env.CMA_CGM_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

/** Token cached in memory until shortly before it expires */
let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Get an OAuth2 access token (client_credentials). Returns null when the
 * client credentials are not set or the token request fails.
 */
async function getAccessToken(forceRefresh = false): Promise<string | null> {
  const creds = getOAuthCredentials();
  if (!creds) {
    return null;
  }

  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  try {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    const response = await fetch(CMA_CGM_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: CMA_CGM_TOKEN_SCOPE,
      }).toString(),
      signal: AbortSignal.timeout(CMA_CGM_TIMEOUT),
    });

    if (!response.ok) {
      // Never log the body in full - it can echo request details
      console.error(`[CMA-CGM] OAuth2 token request failed: ${response.status}`);
      cachedToken = null;
      return null;
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) {
      console.error('[CMA-CGM] OAuth2 token response had no access_token');
      cachedToken = null;
      return null;
    }

    // Refresh 60s early; default to 5 minutes if expires_in is missing
    const lifetimeMs = Math.max((data.expires_in ?? 300) - 60, 30) * 1000;
    cachedToken = { value: data.access_token, expiresAt: Date.now() + lifetimeMs };
    return cachedToken.value;
  } catch (error) {
    console.error(
      '[CMA-CGM] OAuth2 token request error:',
      error instanceof Error ? error.message : error
    );
    cachedToken = null;
    return null;
  }
}

/**
 * Call the Track & Trace API: keyId first, OAuth2 Bearer as fallback.
 */
async function fetchCmaCgm(url: string): Promise<Response | null> {
  const apiKey = getApiKey();
  let response: Response | null = null;

  if (apiKey) {
    response = await fetch(url, {
      method: 'GET',
      headers: { keyId: apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(CMA_CGM_TIMEOUT),
    });
    // Anything except an auth refusal is final (incl. 404 / 5xx)
    if (response.status !== 401 && response.status !== 403) {
      return response;
    }
    if (!getOAuthCredentials()) {
      return response; // no fallback configured - keep the original error
    }
    console.warn(`[CMA-CGM] keyId refused (${response.status}) - trying OAuth2`);
  }

  let token = await getAccessToken();
  if (!token) {
    return response; // keyId error (if any) is the best we have
  }

  const callWithToken = (bearer: string) =>
    fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(CMA_CGM_TIMEOUT),
    });

  let oauthResponse = await callWithToken(token);
  if (oauthResponse.status === 401) {
    // Cached token may have been revoked - get a fresh one once
    token = await getAccessToken(true);
    if (token) {
      oauthResponse = await callWithToken(token);
    }
  }
  return oauthResponse;
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
// TRIP OF THE CONTAINER (Nov 26 2026)
// ============================================
//
// CMA reuses containers. The feed holds the container's latest booking, which
// can be another customer's trip after our load was unloaded (e.g. container
// CMAU5516400 of SO2600044: empty picked up in Kansas City on Nov 23 for an
// export to Korea). Our loads are always imports into the US, so a booking
// that exports from the US, or ends outside the US, is not ours.

/** Shipment phase of an event in CMA's data ("Export" / "Import"), lower case */
function eventPhase(event: CmaCgmEvent): string {
  return (event.carrierSpecificData?.transportationPhase || '').toLowerCase();
}

/** UN/LOCODE of where the event happened, when known */
function eventLocationCode(event: CmaCgmEvent): string | undefined {
  const code = isEquipmentEvent(event)
    ? event.eventLocation?.UNLocationCode ||
      event.transportCall?.UNLocationCode ||
      event.transportCall?.location?.UNLocationCode
    : event.transportCall?.UNLocationCode || event.transportCall?.location?.UNLocationCode;
  return (code || event.carrierSpecificData?.internalLocationCode || undefined)?.toUpperCase();
}

/** Readable place of the event (name, else UN/LOCODE) */
function eventPlace(event: CmaCgmEvent): string | undefined {
  const name = isEquipmentEvent(event)
    ? event.eventLocation?.locationName || event.transportCall?.location?.locationName
    : event.transportCall?.location?.locationName;
  return name || eventLocationCode(event);
}

function isUsLocation(code: string | undefined): boolean {
  return !!code && code.startsWith('US');
}

/** Booking the event belongs to ('' when the feed gives none) */
function eventBooking(event: CmaCgmEvent): string {
  const refs = isEquipmentEvent(event) || isTransportEvent(event) ? event.documentReferences : undefined;
  return refs?.find((r) => r.documentReferenceType === 'BKG')?.documentReferenceValue || '';
}

/** True when this booking's events show a trip that is not a US import */
function isOtherTrip(events: CmaCgmEvent[]): boolean {
  // Leaves the US (export phase at a US place): never one of our loads
  const exportsFromUs = events.some((e) => eventPhase(e) === 'export' && isUsLocation(eventLocationCode(e)));
  if (exportsFromUs) {
    return true;
  }
  // Destination side known and none of it is in the US
  const importSide = events
    .filter((e) => {
      const locationType = (e.carrierSpecificData?.shipmentLocationType || '').toUpperCase();
      return eventPhase(e) === 'import' || locationType === 'POD' || locationType === 'FPD';
    })
    .map(eventLocationCode)
    .filter((code): code is string => !!code);
  return importSide.length > 0 && !importSide.some(isUsLocation);
}

/**
 * Keep only the events of our own trip. Events are grouped by booking; a
 * booking that is another customer's trip is dropped. When nothing of ours is
 * left, the first actual event of the newest other trip is described instead.
 */
function selectOwnTrip(events: CmaCgmEvent[]): { ownEvents: CmaCgmEvent[]; otherTrip?: CmaCgmOtherTrip } {
  const byBooking = new Map<string, CmaCgmEvent[]>();
  for (const event of events) {
    const key = eventBooking(event);
    byBooking.set(key, [...(byBooking.get(key) ?? []), event]);
  }

  const ownEvents: CmaCgmEvent[] = [];
  const otherEvents: CmaCgmEvent[] = [];
  for (const group of byBooking.values()) {
    (isOtherTrip(group) ? otherEvents : ownEvents).push(...group);
  }

  if (ownEvents.length > 0 || otherEvents.length === 0) {
    return { ownEvents };
  }

  // Events come newest first: the oldest actual event is where that trip began
  const firstActual = [...otherEvents].reverse().find((e) => e.eventClassifierCode === 'ACT');
  return {
    ownEvents: [],
    otherTrip: {
      startedAt: firstActual?.eventDateTime || firstActual?.eventCreatedDateTime,
      location: firstActual ? eventPlace(firstActual) : undefined,
      label: firstActual?.carrierSpecificData?.internalEventLabel,
    },
  };
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

  // Nov 26 2026: corrections the plain event code cannot see
  const phase = eventPhase(event);
  const isActual = event.eventClassifierCode === 'ACT';
  const mode = event.transportCall?.modeOfTransport;
  const code = isEquipmentEvent(event) ? event.equipmentEventTypeCode : event.transportEventTypeCode;
  const isVesselMove = mode !== 'RAIL' && mode !== 'TRUCK' && mode !== 'BARGE';
  if (
    isActual &&
    isEquipmentEvent(event) &&
    event.emptyIndicatorCode === 'EMPTY' &&
    phase === 'import' &&
    (code === 'GTIN' || code === 'DROP')
  ) {
    // Empty container back at the depot after our trip: the load was unloaded
    statusMapping = {
      trackingStatus: 'delivered',
      loadStatus: 'delivered',
      description: 'Empty container returned - load delivered',
    };
  } else if (isActual && phase === 'export' && !((code === 'LOAD' || code === 'DEPA') && isVesselMove)) {
    // Origin side before the vessel leaves (empty pick-up, stuffing, gate in,
    // inland rail): the trip is only starting. Mapping these to "arrived at
    // port" / "out for delivery" blocked the later vessel statuses.
    statusMapping = {
      trackingStatus: 'container_picked',
      loadStatus: 'open',
      description: 'Container being prepared at origin',
    };
  } else if (mode === 'RAIL' && isActual) {
    // Rail moves are not vessel moves ("Vessel arrived at port" was wrong)
    if (code === 'LOAD' || code === 'DEPA') {
      statusMapping = { trackingStatus: 'on_rail', loadStatus: 'in_transit', description: 'Container on rail' };
    } else if (code === 'DISC' || code === 'ARRI') {
      statusMapping = { trackingStatus: 'at_ramp', loadStatus: 'in_transit', description: 'Container arrived at rail ramp' };
    }
  }
  // CMA's own wording is clearer than the generic one (e.g. "Discharged")
  const cmaLabel = event.carrierSpecificData?.internalEventLabel;
  if (cmaLabel && statusMapping.trackingStatus !== 'delivered') {
    statusMapping = { ...statusMapping, description: cmaLabel };
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
      // Nov 26 2026: vessel arrival only - a planned train arrival inland is not the port ETA
      e.transportCall?.modeOfTransport !== 'RAIL' &&
      e.transportCall?.modeOfTransport !== 'TRUCK' &&
      Boolean(e.eventDateTime)
  );
  return arrival?.eventDateTime?.slice(0, 10);
}

/**
 * Fetch tracking events from CMA CGM API
 */
export async function fetchContainerEvents(
  containerNumber: string,
  // Nov 27 2026: ISO date-time - CMA returns the container's last trip before this date
  before?: string
): Promise<CmaCgmTrackingResult> {
  // const apiKey = getApiKey();
  //
  // if (!apiKey) {
  // Nov 26 2026: API key or OAuth2 client credentials
  if (!isCmaCgmConfigured()) {
    console.log('[CMA-CGM] API key not configured - skipping tracking');
    return {
      success: false,
      containerNumber,
      error: 'CMA CGM API key not configured',
    };
  }

  try {
    // const url = `${CMA_CGM_BASE_URL}/events?equipmentReference=${encodeURIComponent(containerNumber)}`;
    const url =
      `${CMA_CGM_BASE_URL}/events?equipmentReference=${encodeURIComponent(containerNumber)}` +
      (before ? `&eventDateTime=${encodeURIComponent(before)}` : '');

    console.log(`[CMA-CGM] Fetching events for container: ${containerNumber}`);

    // const response = await fetch(url, {
    //   method: 'GET',
    //   headers: {
    //     keyId: apiKey,
    //     Accept: 'application/json',
    //   },
    //   signal: AbortSignal.timeout(CMA_CGM_TIMEOUT),
    // });
    // Nov 26 2026: keyId first, OAuth2 Bearer fallback (see fetchCmaCgm)
    const response = await fetchCmaCgm(url);

    if (!response) {
      return {
        success: false,
        containerNumber,
        error: 'CMA CGM OAuth2 token could not be obtained - check CMA_CGM_CLIENT_ID / CMA_CGM_CLIENT_SECRET',
      };
    }

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
      // Nov 27 2026: keep CMA's reply for the API log
      let errorBody: unknown = errorText;
      try {
        errorBody = JSON.parse(errorText);
      } catch {
        // keep the text
      }
      return {
        success: false,
        containerNumber,
        error: `API error: ${response.status}${reason ? ` - ${reason}` : ''}`,
        httpStatus: response.status,
        rawResponse: errorBody,
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
        httpStatus: response.status,
        rawResponse: events ?? [],
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
    // const latestActual = sortedEvents.find((e) => e.eventClassifierCode === 'ACT');
    //
    // return {
    //   success: true,
    //   containerNumber,
    //   events: sortedEvents,
    //   latestEvent: latestActual,
    //   estimatedArrival: getEstimatedArrival(sortedEvents),
    // };

    // Nov 26 2026: only our own trip counts (containers are reused by CMA)
    const { ownEvents, otherTrip } = selectOwnTrip(sortedEvents);
    if (otherTrip) {
      console.log(
        `[CMA-CGM] ${containerNumber} is on another booking (${otherTrip.label || 'trip'} ${otherTrip.startedAt || ''} ${otherTrip.location || ''}) - status not changed`
      );
    }
    const latestActual = ownEvents.find((e) => e.eventClassifierCode === 'ACT');

    return {
      success: true,
      containerNumber,
      events: ownEvents,
      latestEvent: latestActual,
      estimatedArrival: getEstimatedArrival(ownEvents),
      otherTrip,
      // Nov 27 2026: full reply (all trips) for the API log
      httpStatus: response.status,
      rawResponse: events,
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
  _salesOrderId: string | null,
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

    // The customer's sales order is not changed here: tracking is about the
    // supplier load (shipment + purchase order); Jenny sets the order status.

    // Update purchase order status if applicable
    // When shipment is delivered, mark PO as received
    if (purchaseOrderId) {
      const poStatus = purchaseOrderStatusForTracking(mappedStatus.trackingStatus);
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

/**
 * Nov 26 2026: the container is on another customer's booking, so the feed no
 * longer shows our trip. Status, ETA and delay stay as they are; only the sync
 * time is stamped and the operations team gets a note to confirm delivery
 * (a note they typed themselves is never overwritten).
 */
async function saveOtherTrip(shipmentId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from('shipments')
    .select('action_required')
    .eq('id', shipmentId)
    .maybeSingle();
  const currentAction = current?.action_required?.trim() || '';
  const canReplaceAction = !currentAction || AUTO_ACTION_MESSAGES.has(currentAction);
  await supabase
    .from('shipments')
    .update({
      cma_cgm_last_sync: new Date().toISOString(),
      cma_cgm_last_event_code: 'REUSED',
      ...(canReplaceAction ? { action_required: CMA_OTHER_TRIP_ACTION } : {}),
    })
    .eq('id', shipmentId);
}

/** Message for the operations team when the container is on another booking */
// function otherTripMessage(containerNumber: string, otherTrip: CmaCgmOtherTrip): string {
//   const when = otherTrip.startedAt ? ` on ${otherTrip.startedAt.slice(0, 10)}` : '';
//   const where = otherTrip.location ? ` at ${otherTrip.location}` : '';
//   return `${containerNumber} is now on another CMA booking (${otherTrip.label || 'new trip'}${when}${where}). This load's own trip is no longer in CMA's data - status not changed. Please confirm delivery and mark it Delivered.`;
// }
// Nov 26 2026: plainer wording - the old text read like an error
function otherTripMessage(containerNumber: string, otherTrip: CmaCgmOtherTrip): string {
  const when = otherTrip.startedAt ? ` on ${formatTripDate(otherTrip.startedAt)}` : '';
  const where = otherTrip.location ? ` (${otherTrip.location})` : '';
  return `${containerNumber} was emptied and picked up for another booking${when}${where}, so this load was already unloaded. Status not changed - please confirm the delivery date and mark it Delivered.`;
}

// ============================================
// PREVIOUS TRIP OF A REUSED CONTAINER (Nov 27 2026)
// ============================================
// CMA's eventDateTime filter returns the container's last trip before a date.
// Asking for the trip before the newest trip's first event gives our load's
// own journey back (vessel, ports, gate out to consignee, empty return).

/** Our load's trip, fetched again from CMA when the container was reused; null if not found */
async function fetchPreviousTrip(
  containerNumber: string,
  current: CmaCgmTrackingResult
): Promise<CmaCgmTrackingResult | null> {
  const raw = Array.isArray(current.rawResponse) ? (current.rawResponse as CmaCgmEvent[]) : [];
  const times = raw.map(eventTime).filter((t) => Number.isFinite(t));
  if (times.length === 0) {
    return null;
  }
  // const before = new Date(Math.min(...times) - 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  // await new Promise((resolve) => setTimeout(resolve, 1100)); // CMA rate limit
  // const previous = await fetchContainerEvents(containerNumber, before);
  // if (!previous.success || previous.otherTrip || !previous.latestEvent) {
  //   return null;
  // }
  // return previous;
  // CMA does not always cut exactly at the date given, so step further back
  const earliest = Math.min(...times);
  const DAY = 24 * 60 * 60 * 1000;
  for (const back of [1000, DAY, 7 * DAY]) {
    const before = new Date(earliest - back).toISOString().replace(/\.\d{3}Z$/, 'Z');
    await new Promise((resolve) => setTimeout(resolve, 1100)); // CMA rate limit
    const previous = await fetchContainerEvents(containerNumber, before);
    if (!previous.success) {
      return null;
    }
    if (!previous.otherTrip && previous.latestEvent) {
      return previous;
    }
  }
  return null;
}

/** e.g. "Gate out to Consignee on Nov 19, 2026 (KANSAS CITY, KS), empty returned on Nov 23, 2026" */
function previousTripFacts(previous: CmaCgmTrackingResult): string {
  const events = previous.events || [];
  const gateOut = events.find(
    (e) =>
      e.eventClassifierCode === 'ACT' &&
      isEquipmentEvent(e) &&
      e.equipmentEventTypeCode === 'GTOT' &&
      e.emptyIndicatorCode === 'LADEN' &&
      eventPhase(e) === 'import'
  );
  const emptyBack = events.find(
    (e) => e.eventClassifierCode === 'ACT' && isEquipmentEvent(e) && e.emptyIndicatorCode === 'EMPTY' && eventPhase(e) === 'import'
  );
  const parts: string[] = [];
  if (gateOut) {
    const place = eventPlace(gateOut);
    parts.push(
      `${gateOut.carrierSpecificData?.internalEventLabel || 'Gate out'} on ${formatTripDate(gateOut.eventDateTime || gateOut.eventCreatedDateTime)}${place ? ` (${place})` : ''}`
    );
  }
  if (emptyBack) {
    parts.push(`empty returned on ${formatTripDate(emptyBack.eventDateTime || emptyBack.eventCreatedDateTime)}`);
  }
  if (parts.length === 0 && previous.latestEvent) {
    const e = previous.latestEvent;
    parts.push(
      `${e.carrierSpecificData?.internalEventLabel || 'last event'} on ${formatTripDate(e.eventDateTime || e.eventCreatedDateTime)}`
    );
  }
  return parts.join(', ');
}

/** "2026-11-23T09:54:01-06:00" -> "Nov 23, 2026" (date as CMA reported it, no timezone shift) */
function formatTripDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) {
    return iso.slice(0, 10);
  }
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

// ============================================
// API LOG (Nov 27 2026)
// ============================================
// Every call made for a shipment is kept with CMA's full reply (table
// cma_cgm_api_logs, migration 178) so the team can see what CMA returned.
// Logging never stops tracking: if the table is missing it is just skipped.

const API_LOG_RETENTION_DAYS = 90;

async function logCmaCgmApiCall(params: {
  shipmentId: string;
  containerNumber: string;
  source: CmaCgmApiLogSource;
  outcome: CmaCgmApiLogOutcome;
  result: CmaCgmTrackingResult;
  message?: string;
}): Promise<void> {
  try {
    const raw = params.result.rawResponse;
    const { error } = await createAdminClient()
      .from('cma_cgm_api_logs')
      .insert({
        shipment_id: params.shipmentId,
        container_number: params.containerNumber,
        source: params.source,
        outcome: params.outcome,
        http_status: params.result.httpStatus ?? null,
        message: params.message ?? params.result.error ?? null,
        event_count: Array.isArray(raw) ? raw.length : null,
        response: raw === undefined ? null : raw,
      });
    if (error) {
      console.error(`[CMA-CGM] API log not saved for ${params.containerNumber}: ${error.message}`);
    }
  } catch (error) {
    console.error(
      `[CMA-CGM] API log not saved for ${params.containerNumber}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/** Delete API logs older than the retention period (run by the daily sync) */
async function pruneCmaCgmApiLogs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - API_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await createAdminClient().from('cma_cgm_api_logs').delete().lt('created_at', cutoff);
    if (error) {
      console.error(`[CMA-CGM] Old API logs not deleted: ${error.message}`);
    }
  } catch (error) {
    console.error('[CMA-CGM] Old API logs not deleted:', error instanceof Error ? error.message : error);
  }
}

// ============================================
// JOURNEY SUMMARY (Nov 27 2026)
// ============================================
// Turns one CMA reply into what people want to read: where the container is,
// vessel / ports, transit days, delays against CMA's plan, time spent at each
// place, and the timeline. Only our own trip is used (reused containers).

const ISO_CONTAINER_TYPES: Record<string, string> = {
  '22G1': "20' Standard",
  '42G1': "40' Standard",
  '45G1': "40' High Cube",
  '22R1': "20' Reefer",
  '45R1': "40' High Cube Reefer",
  L5G1: "45' High Cube",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function eventTime(event: CmaCgmEvent): number {
  return new Date(event.eventDateTime || event.eventCreatedDateTime).getTime();
}

function eventLocation(event: CmaCgmEvent) {
  return isEquipmentEvent(event)
    ? event.eventLocation || event.transportCall?.location
    : event.transportCall?.location;
}

function toJourneyPoint(event: CmaCgmEvent): CmaJourneyPoint {
  const loc = eventLocation(event);
  const a = loc?.address;
  const address = [a?.street, a?.city, a?.postCode, a?.country].filter(Boolean).join(', ');
  return {
    date: event.eventDateTime || event.eventCreatedDateTime,
    label: event.carrierSpecificData?.internalEventLabel,
    place: eventPlace(event),
    facility: a?.name,
    address: address || undefined,
    mode: event.transportCall?.modeOfTransport,
    laden: isEquipmentEvent(event) ? event.emptyIndicatorCode : undefined,
    latitude: loc?.latitude,
    longitude: loc?.longitude,
  };
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.round(((toMs - fromMs) / DAY_MS) * 10) / 10;
}

export function summarizeCmaJourney(rawEvents: CmaCgmEvent[]): CmaJourneySummary {
  const empty: CmaJourneySummary = { delays: [], dwell: [], timeline: [] };
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return empty;
  }

  const sortedDesc = [...rawEvents].sort((a, b) => eventTime(b) - eventTime(a));
  const { ownEvents, otherTrip } = selectOwnTrip(sortedDesc);
  if (otherTrip) {
    return { ...empty, otherTrip };
  }

  const isAct = (e: CmaCgmEvent) => e.eventClassifierCode === 'ACT';
  const isPlan = (e: CmaCgmEvent) => e.eventClassifierCode === 'PLN' || e.eventClassifierCode === 'EST';
  const acts = ownEvents.filter(isAct).sort((a, b) => eventTime(a) - eventTime(b));
  const locType = (e: CmaCgmEvent) => e.carrierSpecificData?.shipmentLocationType;
  const transportCode = (e: CmaCgmEvent) => (isTransportEvent(e) ? e.transportEventTypeCode : undefined);

  // Vessel / voyage / service (newest event that has them)
  const withVessel = ownEvents.find((e) => e.transportCall?.vessel?.vesselName);
  const withService = ownEvents.find((e) => e.transportCall?.carrierServiceCode);
  const vessel = withVessel
    ? {
        name: withVessel.transportCall?.vessel?.vesselName,
        imo: withVessel.transportCall?.vessel?.vesselIMONumber,
        voyage:
          withVessel.transportCall?.importVoyageNumber ||
          withVessel.transportCall?.exportVoyageNumber ||
          withVessel.carrierSpecificData?.bookingExportVoyageReference,
        service: withService?.transportCall?.carrierServiceCode,
      }
    : undefined;

  // Ports: POL departure / POD arrival (actual, and CMA's first plan)
  const firstPlan = (list: CmaCgmEvent[]) =>
    [...list].sort(
      (a, b) => new Date(a.eventCreatedDateTime).getTime() - new Date(b.eventCreatedDateTime).getTime()
    )[0];
  const polEvents = ownEvents.filter((e) => locType(e) === 'POL' && transportCode(e) === 'DEPA');
  const podEvents = ownEvents.filter((e) => locType(e) === 'POD' && transportCode(e) === 'ARRI');
  const polAct = polEvents.find(isAct);
  const podAct = podEvents.find(isAct);
  const polPlan = firstPlan(polEvents.filter(isPlan));
  const podPlan = firstPlan(podEvents.filter(isPlan));
  const portOfLoading =
    polEvents.length > 0
      ? { place: eventPlace(polEvents[0]!), departedAt: polAct?.eventDateTime, plannedDeparture: polPlan?.eventDateTime }
      : undefined;
  const portOfDischarge =
    podEvents.length > 0
      ? { place: eventPlace(podEvents[0]!), arrivedAt: podAct?.eventDateTime, plannedArrival: podPlan?.eventDateTime }
      : undefined;

  // Progress: legs done out of the legs CMA planned
  const total = Math.max(0, ...ownEvents.map((e) => e.carrierSpecificData?.transportCallSequenceTotal ?? 0));
  const leg = Math.max(0, ...acts.map((e) => e.transportCall?.transportCallSequenceNumber ?? 0));
  const progress = total > 0 && leg > 0 ? { leg, total } : undefined;

  // Delays: each actual arrival/departure against CMA's first plan for the same move
  const delays: CmaJourneySummary['delays'] = [];
  for (const act of acts) {
    const code = transportCode(act);
    if (!code || !act.eventDateTime) {
      continue;
    }
    const plans = ownEvents.filter(
      (e) =>
        isPlan(e) &&
        transportCode(e) === code &&
        eventLocationCode(e) === eventLocationCode(act) &&
        e.transportCall?.modeOfTransport === act.transportCall?.modeOfTransport &&
        e.eventDateTime
    );
    const plan = firstPlan(plans);
    if (!plan?.eventDateTime) {
      continue;
    }
    const days = daysBetween(new Date(plan.eventDateTime).getTime(), new Date(act.eventDateTime).getTime());
    if (Math.abs(days) >= 1) {
      delays.push({
        label: act.carrierSpecificData?.internalEventLabel || code,
        place: eventPlace(act),
        planned: plan.eventDateTime,
        actual: act.eventDateTime,
        days,
      });
    }
  }

  // Dwell: consecutive actual events at the same place
  const dwell: CmaJourneySummary['dwell'] = [];
  let groupStart = 0;
  for (let i = 1; i <= acts.length; i++) {
    const prev = acts[i - 1]!;
    const cur = acts[i];
    if (cur && eventLocationCode(cur) === eventLocationCode(prev)) {
      continue;
    }
    const first = acts[groupStart]!;
    const days = daysBetween(eventTime(first), eventTime(prev));
    if (i - groupStart >= 2 && days >= 0.5) {
      dwell.push({
        place: eventPlace(first) || eventLocationCode(first) || '-',
        from: first.eventDateTime || first.eventCreatedDateTime,
        to: prev.eventDateTime || prev.eventCreatedDateTime,
        days,
      });
    }
    groupStart = i;
  }

  const firstAct = acts[0];
  const lastAct = acts[acts.length - 1];
  const isoCode = acts.map((e) => (isEquipmentEvent(e) ? e.ISOEquipmentCode : undefined)).find(Boolean);

  return {
    current: lastAct ? toJourneyPoint(lastAct) : undefined,
    vessel,
    portOfLoading,
    portOfDischarge,
    progress,
    oceanDays:
      polAct?.eventDateTime && podAct?.eventDateTime
        ? daysBetween(eventTime(polAct), eventTime(podAct))
        : undefined,
    totalDays: firstAct && lastAct && firstAct !== lastAct ? daysBetween(eventTime(firstAct), eventTime(lastAct)) : undefined,
    containerType: isoCode ? ISO_CONTAINER_TYPES[isoCode] || isoCode : undefined,
    estimatedArrival: getEstimatedArrival(sortedDesc.filter((e) => ownEvents.includes(e))),
    delays,
    dwell,
    timeline: acts.map(toJourneyPoint),
  };
}

/**
 * Which of these shipments have at least one logged call (eye icon shown only
 * for them). Returns an empty list if the table is not set up yet.
 */
export async function getShipmentIdsWithCmaApiLogs(shipmentIds: string[]): Promise<string[]> {
  const ids = [...new Set(shipmentIds.filter(Boolean))].slice(0, 200);
  if (ids.length === 0) {
    return [];
  }
  const found = new Set<string>();
  // One small query per shipment (limit 1) instead of pulling every log row
  await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await createAdminClient()
        .from('cma_cgm_api_logs')
        .select('shipment_id')
        .eq('shipment_id', id)
        .limit(1);
      if (!error && data && data.length > 0) {
        found.add(id);
      }
    })
  );
  return [...found];
}

/** API calls logged for one shipment, newest first */
export async function getCmaCgmApiLogs(shipmentId: string, limit = 50): Promise<CmaCgmApiLog[]> {
  const { data, error } = await createAdminClient()
    .from('cma_cgm_api_logs')
    .select('id, container_number, source, outcome, http_status, message, event_count, response, created_at')
    .eq('shipment_id', shipmentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return (data || []).map((r) => ({
    id: r.id,
    containerNumber: r.container_number,
    source: r.source as CmaCgmApiLogSource,
    outcome: r.outcome as CmaCgmApiLogOutcome,
    httpStatus: r.http_status,
    message: r.message,
    eventCount: r.event_count,
    response: r.response,
    createdAt: r.created_at,
  }));
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
      // Nov 27 2026: keep every call with CMA's reply
      const logCall = (outcome: CmaCgmApiLogOutcome, message?: string) =>
        logCmaCgmApiCall({
          shipmentId: container.shipmentId,
          containerNumber: container.containerNumber,
          source: 'daily_sync',
          outcome,
          result,
          message,
        });

      if (!result.success) {
        console.error(
          `[CMA-CGM] Failed to fetch events for ${container.containerNumber}: ${result.error}`
        );
        await logCall('error');
        failureCount++;
        errors.push({
          containerNumber: container.containerNumber,
          error: result.error || 'Unknown error',
        });
        continue;
      }

      // Nov 26 2026: container reused on another booking - do not touch the status
      if (result.otherTrip) {
        await saveOtherTrip(container.shipmentId);
        await logCall('other_trip', otherTripMessage(container.containerNumber, result.otherTrip));
        // Nov 27 2026: fetch and log our load's own (previous) trip for the eye-icon summary
        const previous = await fetchPreviousTrip(container.containerNumber, result);
        const facts = previous ? previousTripFacts(previous) : '';
        if (previous) {
          await logCmaCgmApiCall({
            shipmentId: container.shipmentId,
            containerNumber: container.containerNumber,
            source: 'daily_sync',
            outcome: 'other_trip',
            result: previous,
            message: `This load's trip (before reuse): ${facts}`,
          });
        }
        skippedCount++;
        errors.push({
          containerNumber: container.containerNumber,
          // error: otherTripMessage(container.containerNumber, result.otherTrip),
          error:
            otherTripMessage(container.containerNumber, result.otherTrip) +
            (facts ? ` CMA's earlier trip: ${facts}.` : ''),
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      if (!result.latestEvent) {
        console.log(`[CMA-CGM] No actual events yet for ${container.containerNumber}`);
        await saveEstimatedArrivalOnly(container.shipmentId, result.estimatedArrival);
        await logCall(
          'no_events',
          result.estimatedArrival
            ? `Booked - no movement yet. Estimated arrival ${result.estimatedArrival}`
            : 'No actual events yet - status not changed'
        );
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
        await logCall(
          'updated',
          `${mappedStatus.trackingStatus}: ${mappedStatus.eventDescription}${mappedStatus.location ? ` - ${mappedStatus.location}` : ''}`
        );
        successCount++;
      } else {
        await logCall('error', 'Tracking received but the shipment could not be updated');
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

  // Nov 27 2026: keep the API log to the last 90 days
  await pruneCmaCgmApiLogs();

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
  shipmentId: string,
  // Nov 27 2026: for the API log - 'track_now' from the button, 'auto' after a container number is saved
  source: CmaCgmApiLogSource = 'auto'
  // ): Promise<{ success: boolean; message: string; trackingStatus?: string }> {
  // Nov 26 2026: needsConfirm = container reused, not an error (UI shows a warning)
): Promise<{ success: boolean; message: string; trackingStatus?: string; needsConfirm?: boolean }> {
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
  // Nov 27 2026: keep every call with CMA's reply
  const containerNumber: string = shipment.container_number;
  const logCall = (outcome: CmaCgmApiLogOutcome, message?: string) =>
    logCmaCgmApiCall({ shipmentId: shipment.id, containerNumber, source, outcome, result, message });

  if (!result.success) {
    await logCall('error');
    return { success: false, message: result.error || 'CMA CGM tracking failed' };
  }
  // Nov 26 2026: container reused on another booking - do not touch the status
  if (result.otherTrip) {
    await saveOtherTrip(shipment.id);
    await logCall('other_trip', otherTripMessage(containerNumber, result.otherTrip));
    // Nov 27 2026: fetch and log our load's own (previous) trip for the eye-icon summary
    const previous = await fetchPreviousTrip(containerNumber, result);
    const facts = previous ? previousTripFacts(previous) : '';
    if (previous) {
      await logCmaCgmApiCall({
        shipmentId: shipment.id,
        containerNumber,
        source,
        outcome: 'other_trip',
        result: previous,
        message: `This load's trip (before reuse): ${facts}`,
      });
    }
    // return { success: false, message: otherTripMessage(shipment.container_number, result.otherTrip) };
    return {
      success: false,
      needsConfirm: true,
      // message: otherTripMessage(shipment.container_number, result.otherTrip),
      message: otherTripMessage(containerNumber, result.otherTrip) + (facts ? ` CMA's earlier trip: ${facts}.` : ''),
    };
  }
  if (!result.latestEvent) {
    await saveEstimatedArrivalOnly(shipment.id, result.estimatedArrival);
    // return {
    //   success: true,
    //   message: result.estimatedArrival
    //     ? `Booked - no movement yet. Estimated arrival ${result.estimatedArrival}`
    //     : `No CMA CGM events yet for ${shipment.container_number}`,
    // };
    const noEventsMessage = result.estimatedArrival
      ? `Booked - no movement yet. Estimated arrival ${result.estimatedArrival}`
      : `No CMA CGM events yet for ${shipment.container_number}`;
    await logCall('no_events', noEventsMessage);
    return { success: true, message: noEventsMessage };
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

  // Nov 27 2026: API log
  await logCall(
    updated ? 'updated' : 'error',
    updated
      ? `${mappedStatus.trackingStatus}: ${mappedStatus.eventDescription}${mappedStatus.location ? ` - ${mappedStatus.location}` : ''}`
      : 'Tracking received but the shipment could not be updated'
  );

  return updated
    ? {
        success: true,
        message: `${mappedStatus.eventDescription}${mappedStatus.location ? ` - ${mappedStatus.location}` : ''}`,
        trackingStatus: mappedStatus.trackingStatus,
      }
    : { success: false, message: 'Tracking received but the shipment could not be updated' };
}
