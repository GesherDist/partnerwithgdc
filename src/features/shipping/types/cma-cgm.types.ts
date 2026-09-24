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
  error?: string;
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
