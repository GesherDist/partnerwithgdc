/**
 * CMA CGM Track & Trace API Types
 *
 * Based on DCSA Track & Trace v2.2.0 specification
 * API: operation/trackandtrace/v1
 */

// ============================================
// ENUMS
// ============================================

/**
 * Event types returned by CMA CGM API
 */
export type CmaCgmEventType = 'SHIPMENT' | 'TRANSPORT' | 'EQUIPMENT';

/**
 * Equipment event type codes
 */
export type CmaCgmEquipmentEventTypeCode =
  | 'LOAD' // Loaded on vessel
  | 'DISC' // Discharged from vessel
  | 'GTIN' // Gated in (entered terminal)
  | 'GTOT' // Gated out (left terminal)
  | 'STUF' // Stuffed
  | 'STRP' // Stripped
  | 'PICK' // Pick-up
  | 'DROP' // Drop-off
  | 'INSP' // Inspected
  | 'RSEA' // Resealed
  | 'RMVD'; // Removed

/**
 * Transport event type codes
 */
export type CmaCgmTransportEventTypeCode =
  | 'ARRI' // Arrived
  | 'DEPA'; // Departed

/**
 * Event classifier codes
 */
export type CmaCgmEventClassifierCode =
  | 'ACT' // Actual
  | 'PLN' // Planned
  | 'EST'; // Estimated

/**
 * Empty indicator codes
 */
export type CmaCgmEmptyIndicatorCode = 'EMPTY' | 'LADEN';

/**
 * Mode of transport
 */
export type CmaCgmModeOfTransport = 'VESSEL' | 'RAIL' | 'TRUCK' | 'BARGE';

/**
 * Facility type codes
 */
export type CmaCgmFacilityTypeCode =
  | 'BOCR' // Border crossing
  | 'CLOC' // Customer location
  | 'COFS' // Container freight station
  | 'COYA' // Deprecated - use OFFD
  | 'OFFD' // Off dock storage
  | 'DEPO' // Depot
  | 'INTE' // Inland terminal
  | 'POTE' // Port terminal
  | 'RAMP'; // Ramp

// ============================================
// API RESPONSE TYPES
// ============================================

/**
 * Vessel information
 */
export interface CmaCgmVessel {
  vesselIMONumber: string;
  vesselName?: string;
  vesselFlag?: string;
  vesselCallSignNumber?: string;
  vesselOperatorCarrierCode?: string;
  vesselOperatorCarrierCodeListProvider?: 'SMDG' | 'NMFTA';
}

/**
 * Address information
 */
export interface CmaCgmAddress {
  name?: string;
  street?: string;
  streetNumber?: string;
  floor?: string;
  postCode?: string;
  city?: string;
  stateRegion?: string;
  country?: string;
}

/**
 * Location information
 */
export interface CmaCgmLocation {
  locationName?: string;
  latitude?: string;
  longitude?: string;
  UNLocationCode?: string;
  address?: CmaCgmAddress;
}

/**
 * Transport call information
 */
export interface CmaCgmTransportCall {
  transportCallID: string;
  carrierServiceCode?: string;
  carrierVoyageNumber?: string;
  exportVoyageNumber?: string;
  importVoyageNumber?: string;
  transportCallSequenceNumber?: number;
  UNLocationCode?: string;
  facilityCode?: string;
  facilityCodeListProvider?: 'BIC' | 'SMDG';
  facilityTypeCode?: CmaCgmFacilityTypeCode;
  otherFacility?: string;
  modeOfTransport: CmaCgmModeOfTransport;
  location?: CmaCgmLocation;
  vessel?: CmaCgmVessel;
}

/**
 * Document reference
 */
export interface CmaCgmDocumentReference {
  documentReferenceType: 'BKG' | 'TRD';
  documentReferenceValue: string;
}

/**
 * Reference information
 */
export interface CmaCgmReference {
  referenceType: 'FF' | 'SI' | 'PO' | 'CR' | 'AAO' | 'EQ' | 'LOAD' | 'ERT';
  referenceValue: string;
}

/**
 * Seal information
 */
export interface CmaCgmSeal {
  sealNumber: string;
  sealSource?: 'CAR' | 'SHI' | 'PHY' | 'VET' | 'CUS';
  sealType?: 'KLP' | 'BLT' | 'WIR';
}

/**
 * Carrier-specific data (CMA CGM extensions)
 */
export interface CmaCgmCarrierSpecificData {
  internalEventCode?: string;
  internalEventLabel?: string;
  internalLocationCode?: string;
  internalFacilityCode?: string;
  bookingExportVoyageReference?: string;
  transportationPhase?: string;
  shipmentLocationType?: string;
  transportCallSequenceTotal?: number;
  numberOfUnits?: number;
}

/**
 * Base event structure
 */
export interface CmaCgmBaseEvent {
  eventID?: string;
  eventCreatedDateTime: string;
  eventType: CmaCgmEventType;
  eventClassifierCode: CmaCgmEventClassifierCode;
  eventDateTime?: string;
  carrierSpecificData?: CmaCgmCarrierSpecificData;
}

/**
 * Equipment event
 */
export interface CmaCgmEquipmentEvent extends CmaCgmBaseEvent {
  eventType: 'EQUIPMENT';
  equipmentEventTypeCode: CmaCgmEquipmentEventTypeCode;
  equipmentReference?: string;
  ISOEquipmentCode?: string;
  emptyIndicatorCode: CmaCgmEmptyIndicatorCode;
  eventLocation?: CmaCgmLocation;
  transportCall?: CmaCgmTransportCall;
  documentReferences?: CmaCgmDocumentReference[];
  references?: CmaCgmReference[];
  seals?: CmaCgmSeal[];
}

/**
 * Transport event
 */
export interface CmaCgmTransportEvent extends CmaCgmBaseEvent {
  eventType: 'TRANSPORT';
  transportEventTypeCode: CmaCgmTransportEventTypeCode;
  delayReasonCode?: string;
  changeRemark?: string;
  transportCall: CmaCgmTransportCall;
  documentReferences?: CmaCgmDocumentReference[];
  references?: CmaCgmReference[];
}

/**
 * Union type for all events
 */
export type CmaCgmEvent = CmaCgmEquipmentEvent | CmaCgmTransportEvent;

/**
 * API response for events endpoint
 */
export type CmaCgmEventsResponse = CmaCgmEvent[];

// ============================================
// SERVICE TYPES
// ============================================

/**
 * Configuration for CMA CGM API
 */
export interface CmaCgmApiConfig {
  apiKey?: string;
  baseUrl: string;
  timeout?: number;
}

/**
 * Result of tracking a container
 */
export interface CmaCgmTrackingResult {
  success: boolean;
  containerNumber: string;
  events?: CmaCgmEvent[];
  latestEvent?: CmaCgmEvent;
  /** Estimated/planned arrival at the final port (YYYY-MM-DD), when the API provides one */
  estimatedArrival?: string;
  /**
   * Nov 26 2026: CMA reuses containers. When the feed only holds a later trip
   * of the container for another customer (e.g. empty picked up in the US for
   * an export), our own trip is no longer in it. The status must not change.
   */
  otherTrip?: CmaCgmOtherTrip;
  error?: string;
  /** Nov 27 2026: CMA's HTTP status and reply as received (for the API log) */
  httpStatus?: number;
  rawResponse?: unknown;
}

/**
 * Nov 27 2026: readable summary of one CMA reply (eye icon dialog).
 * Dates are kept as CMA sent them (local time of the place, with offset).
 */
export interface CmaJourneyPoint {
  date?: string;
  label?: string;
  place?: string;
  facility?: string;
  address?: string;
  mode?: string;
  laden?: string;
  latitude?: string;
  longitude?: string;
}

export interface CmaJourneySummary {
  /** Set when the reply only holds another booking's trip */
  otherTrip?: CmaCgmOtherTrip;
  current?: CmaJourneyPoint;
  vessel?: { name?: string; imo?: string; voyage?: string; service?: string };
  portOfLoading?: { place?: string; departedAt?: string; plannedDeparture?: string };
  portOfDischarge?: { place?: string; arrivedAt?: string; plannedArrival?: string };
  progress?: { leg: number; total: number };
  oceanDays?: number;
  totalDays?: number;
  containerType?: string;
  estimatedArrival?: string;
  /** Actual vs CMA's first plan for the same move (positive = late) */
  delays: Array<{ label: string; place?: string; planned: string; actual: string; days: number }>;
  /** Time spent at one place between the first and last actual event there */
  dwell: Array<{ place: string; from: string; to: string; days: number }>;
  timeline: CmaJourneyPoint[];
}

/**
 * Nov 27 2026: one logged CMA CGM call (table cma_cgm_api_logs)
 */
export type CmaCgmApiLogSource = 'daily_sync' | 'track_now' | 'auto';
export type CmaCgmApiLogOutcome = 'updated' | 'no_events' | 'other_trip' | 'error';

export interface CmaCgmApiLog {
  id: string;
  containerNumber: string;
  source: CmaCgmApiLogSource;
  outcome: CmaCgmApiLogOutcome;
  httpStatus: number | null;
  message: string | null;
  eventCount: number | null;
  response: unknown;
  createdAt: string;
}

/**
 * A trip of the container that is not our load (another booking)
 */
export interface CmaCgmOtherTrip {
  /** First actual event of that trip (ISO date-time) */
  startedAt?: string;
  /** Where that trip started (location name or UN/LOCODE) */
  location?: string;
  /** CMA label of that first event, e.g. "Empty Picked-up at Depot" */
  label?: string;
}

/**
 * Mapped tracking status from CMA CGM event
 */
export interface CmaCgmMappedStatus {
  trackingStatus: string;
  loadStatus: string;
  location?: string;
  vesselName?: string;
  eventDateTime?: string;
  eventCode: string;
  eventDescription: string;
}

/**
 * Result of syncing all containers
 */
export interface CmaCgmSyncResult {
  success: boolean;
  totalContainers: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  errors: Array<{
    containerNumber: string;
    error: string;
  }>;
}
