/**
 * Freight Update Email Processing Service
 *
 * Main service for processing freight tracking update emails from any freight forwarder.
 * Generic processor that works with SEAIR, Flexport, DHL, and other forwarders.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import { parseFreightUpdateEmail } from '../parsers/freight-update.parser';
import type {
  FreightUpdateProcessingResult,
  FreightUpdateMatchingResults,
  ParsedFreightUpdate,
} from '../types';

// ============================================
// MAIN PROCESSOR
// ============================================

/**
 * Process freight update email
 *
 * Flow:
 * 1. Extract data using AI (parseFreightUpdateEmail)
 * 2. Match with existing shipments (by container, MBL, SO, or PO)
 * 3. Update shipment tracking status and details
 * 4. Save to inbound_emails.extracted_data
 */
export async function processFreightUpdate(
  emailId: string,
  subject: string,
  body: string
): Promise<FreightUpdateProcessingResult> {
  console.log('[Freight Update Processor] Processing email:', emailId);

  const supabase = createAdminClient();

  try {
    // ============================================
    // STEP 1: EXTRACT DATA USING AI
    // ============================================

    console.log('[Freight Update Processor] Step 1: Extracting data with AI');

    const parsedData = await parseFreightUpdateEmail(subject, body);

    console.log('[Freight Update Processor] Extraction complete:', {
      forwarder: parsedData.forwarderName,
      container: parsedData.containerNumber,
      status: parsedData.trackingStatus,
      confidence: parsedData.confidence,
    });

    // ============================================
    // STEP 2: MATCH WITH SHIPMENT
    // ============================================

    console.log('[Freight Update Processor] Step 2: Matching with shipments');

    const matchingResults = await matchShipment(supabase, parsedData);

    console.log('[Freight Update Processor] Matching complete:', {
      matched: matchingResults.shipment.matchType !== 'not_found',
      shipmentId: matchingResults.shipment.shipmentId,
      matchType: matchingResults.shipment.matchType,
      confidence: matchingResults.overallConfidence,
    });

    // ============================================
    // STEP 3: UPDATE SHIPMENT (if matched)
    // ============================================

    let shipmentId: string | null = matchingResults.shipment.shipmentId;
    let updated = false;

    if (shipmentId && matchingResults.overallConfidence >= 0.6) {
      console.log('[Freight Update Processor] Step 3: Updating shipment');

      updated = await updateShipment(supabase, shipmentId, parsedData, matchingResults);

      console.log('[Freight Update Processor] Shipment updated:', updated);
    } else {
      console.log('[Freight Update Processor] Skipping shipment update (low confidence or no match)');
    }

    // ============================================
    // STEP 4: SAVE EXTRACTED DATA TO EMAIL RECORD
    // ============================================

    await supabase
      .from('inbound_emails')
      .update({
        extracted_data: {
          parsed: parsedData,
          matching: matchingResults,
        },
        extraction_confidence: matchingResults.overallConfidence,
        extraction_status: updated ? 'processed' : 'extracted',
        status: updated ? 'processed' : 'received',
      })
      .eq('id', emailId);

    // ============================================
    // STEP 5: RETURN RESULT
    // ============================================

    const shouldReview = matchingResults.hasIssues || matchingResults.overallConfidence < 0.85;

    return {
      success: true,
      emailId,
      parsedData,
      matchingResults,
      shipmentId,
      updated,
      shouldReview,
    };
  } catch (error) {
    console.error('[Freight Update Processor] Error:', error);

    // Update email status to failed
    await supabase
      .from('inbound_emails')
      .update({
        status: 'failed',
        extraction_status: 'failed',
      })
      .eq('id', emailId);

    return {
      success: false,
      emailId,
      parsedData: null,
      matchingResults: null,
      shipmentId: null,
      updated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      shouldReview: true,
    };
  }
}

// ============================================
// SHIPMENT MATCHING HELPERS
// ============================================

/**
 * Normalize SO/Shipment number to shipment_number formats
 * IMPORTANT: In freight emails, "SO" refers to SHIPMENT number, not Sales Order!
 * Converts: SO2600045 → SH-2026-00045 (database shipment_number format)
 *
 * Handles formats:
 * - SO2600045 (compact from emails) → SH-2026-00045
 * - SO-2600045 → SH-2600045 (current format without year expansion)
 * - SO-2026-00045 → SH-2026-00045
 */
function normalizeShipmentNumber(soNumber: string): string[] {
  const formats: string[] = [];

  // Pattern 1: SO2600045 (compact) → SH-2026-00045
  const compactMatch = soNumber.match(/^SO(\d{2})(\d{5})$/i);
  if (compactMatch && compactMatch[1] && compactMatch[2]) {
    const yearShort = compactMatch[1]; // "26"
    const seqNum = compactMatch[2]; // "00045"
    const yearFull = `20${yearShort}`; // "2026"
    formats.push(`SH-${yearFull}-${seqNum}`); // Database format: SH-2026-00045
    formats.push(`SH-${yearShort}${seqNum}`); // Alternative: SH-2600045
  }

  // Pattern 2: SO-2600045 (with dash, short year) → SH-2600045
  const dashShortMatch = soNumber.match(/^SO-(\d{2})(\d{5})$/i);
  if (dashShortMatch && dashShortMatch[1] && dashShortMatch[2]) {
    const yearShort = dashShortMatch[1];
    const seqNum = dashShortMatch[2];
    const yearFull = `20${yearShort}`;
    formats.push(`SH-${yearShort}${seqNum}`); // SH-2600045
    formats.push(`SH-${yearFull}-${seqNum}`); // SH-2026-00045
  }

  // Pattern 3: SO-2026-00045 (expanded) → SH-2026-00045
  const expandedMatch = soNumber.match(/^SO-(\d{4})-(\d{5})$/i);
  if (expandedMatch && expandedMatch[1] && expandedMatch[2]) {
    const yearFull = expandedMatch[1]; // "2026"
    const seqNum = expandedMatch[2]; // "00045"
    const yearShort = yearFull.slice(2); // "26"
    formats.push(`SH-${yearFull}-${seqNum}`); // SH-2026-00045
    formats.push(`SH-${yearShort}${seqNum}`); // SH-2600045
  }

  return [...new Set(formats)]; // Remove duplicates
}

// NOTE: normalizeSoNumber removed from here
// Freight emails use normalizeShipmentNumber (SO actually means Shipment, not Sales Order)
// For Sales Order matching, see src/features/shipping/repositories/shipping.repository.ts

// ============================================
// SHIPMENT MATCHING
// ============================================

/**
 * Match freight update with existing shipment
 * Tries multiple methods: container number, MBL, SO number, PO number
 */
async function matchShipment(
  supabase: any,
  parsedData: ParsedFreightUpdate
): Promise<FreightUpdateMatchingResults> {
  const issues: string[] = [];
  let shipmentId: string | null = null;
  let matchType: 'container' | 'mbl' | 'so' | 'po' | 'not_found' = 'not_found';
  let confidence = 0.0;

  // Try 1: Match by container number (most accurate)
  if (parsedData.containerNumber) {
    const { data: containerMatch } = await supabase
      .from('shipments')
      .select('id, container_number, sales_order_id')
      .eq('container_number', parsedData.containerNumber)
      .single();

    if (containerMatch) {
      shipmentId = containerMatch.id;
      matchType = 'container';
      confidence = 1.0;
      console.log('[Freight Matching] Matched by container:', parsedData.containerNumber);
    }
  }

  // Try 2: Match by MBL number
  if (!shipmentId && parsedData.mblNumber) {
    const { data: mblMatch } = await supabase
      .from('shipments')
      .select('id, mbl_number, sales_order_id')
      .eq('mbl_number', parsedData.mblNumber)
      .single();

    if (mblMatch) {
      shipmentId = mblMatch.id;
      matchType = 'mbl';
      confidence = 0.95;
      console.log('[Freight Matching] Matched by MBL:', parsedData.mblNumber);
    }
  }

  // Try 3: Match by SO number (actually SHIPMENT number in freight emails)
  // IMPORTANT: Freight forwarders call shipments as "SO" but they mean SHIPMENT, not Sales Order
  // Email format: "SO2600045" → Database format: "SH-2026-00045"
  if (!shipmentId && parsedData.soNumber) {
    // Convert SO number to shipment number formats
    // Email: SO2600045 → Database: SH-2026-00045
    const shipmentFormats = normalizeShipmentNumber(parsedData.soNumber);
    console.log('[Freight Matching] Trying Shipment formats:', shipmentFormats);

    const { data: shipmentMatch } = await supabase
      .from('shipments')
      .select('id, shipment_number')
      .in('shipment_number', shipmentFormats)
      .is('deleted_at', null)
      .single();

    if (shipmentMatch) {
      shipmentId = shipmentMatch.id;
      matchType = 'so'; // Keep as 'so' for backward compatibility
      confidence = 0.95; // High confidence - direct shipment match
      console.log('[Freight Matching] Matched by Shipment#:', parsedData.soNumber, '→', shipmentMatch.shipment_number);
    }
  }

  // Try 4: Match by PO number
  if (!shipmentId && parsedData.poNumber) {
    const { data: poMatch } = await supabase
      .from('purchase_orders')
      .select('id, po_number')
      .eq('po_number', parsedData.poNumber)
      .single();

    if (poMatch) {
      // Find shipment for this PO
      const { data: shipment } = await supabase
        .from('shipments')
        .select('id, purchase_order_id')
        .eq('purchase_order_id', poMatch.id)
        .single();

      if (shipment) {
        shipmentId = shipment.id;
        matchType = 'po';
        confidence = 0.85;
        console.log('[Freight Matching] Matched by PO:', parsedData.poNumber);
      }
    }
  }

  // Check for issues
  if (!shipmentId) {
    issues.push('No matching shipment found');
    if (parsedData.containerNumber) {
      issues.push(`Container ${parsedData.containerNumber} not found in system`);
    }
  }

  if (parsedData.hasIssue) {
    issues.push(`Freight issue: ${parsedData.issueDescription || parsedData.issueType}`);
  }

  if (parsedData.isDelayed) {
    issues.push(`Delayed: ${parsedData.delayReason || 'Unknown reason'}`);
  }

  const overallConfidence = shipmentId ? confidence : 0.0;

  return {
    shipment: {
      shipmentId,
      containerNumber: parsedData.containerNumber,
      soNumber: parsedData.soNumber,
      matchType,
      confidence,
    },
    overallConfidence,
    hasIssues: issues.length > 0,
    issues,
  };
}

// ============================================
// SHIPMENT UPDATE
// ============================================

/**
 * Update shipment with freight tracking data
 */
async function updateShipment(
  supabase: any,
  shipmentId: string,
  parsedData: ParsedFreightUpdate,
  matchingResults: FreightUpdateMatchingResults
): Promise<boolean> {
  try {
    const updateData: any = {};

    // Update container info
    if (parsedData.containerNumber && !matchingResults.shipment.containerNumber) {
      updateData.container_number = parsedData.containerNumber;
    }

    // Update vessel info
    if (parsedData.vesselName) {
      updateData.vessel_name = parsedData.vesselName;
    }
    if (parsedData.voyageNumber) {
      updateData.voyage_number = parsedData.voyageNumber;
    }

    // Update MBL/HBL
    if (parsedData.mblNumber) {
      updateData.mbl_number = parsedData.mblNumber;
    }

    // Update ports
    if (parsedData.portOfLoading) {
      updateData.port_of_loading = parsedData.portOfLoading;
    }
    if (parsedData.portOfDischarge) {
      updateData.port_of_discharge = parsedData.portOfDischarge;
    }
    if (parsedData.finalDestination) {
      updateData.final_destination = parsedData.finalDestination;
    }

    // Update dates
    if (parsedData.etdOriginPort) {
      updateData.etd_origin = parsedData.etdOriginPort;
    }
    if (parsedData.etaDestinationPort) {
      updateData.eta_to_port = parsedData.etaDestinationPort;
    }
    if (parsedData.etaFinalDestination) {
      updateData.eta_destination = parsedData.etaFinalDestination;
    }
    if (parsedData.lfdDate) {
      updateData.lfd_date = parsedData.lfdDate;
    }
    if (parsedData.actualArrivalDate) {
      updateData.actual_arrival_port = parsedData.actualArrivalDate;
    }

    // Update tracking status (map to our tracking_status enum)
    if (parsedData.trackingStatus) {
      const statusMapping: Record<string, string> = {
        booked: 'booked',
        picked_up: 'container_picked',
        at_origin_port: 'container_picked',
        loaded_on_vessel: 'loaded_on_vessel',
        departed: 'departed_origin',
        in_transit: 'in_transit',
        arrived_destination_port: 'arrived_port',
        customs_clearance: 'customs_clearance',
        released: 'arrived_port',
        on_rail: 'on_rail',
        at_ramp: 'at_ramp',
        out_for_delivery: 'out_for_delivery',
        delivered: 'delivered',
      };

      const mappedStatus = statusMapping[parsedData.trackingStatus];
      if (mappedStatus) {
        updateData.tracking_status = mappedStatus;
      }
    }

    // Update issue flags
    if (parsedData.hasIssue) {
      updateData.has_issue = true;
      if (parsedData.issueType) {
        updateData.issue_type = parsedData.issueType;
      }
      if (parsedData.issueDescription) {
        updateData.issue_description = parsedData.issueDescription;
      }
    }

    // Update current location
    if (parsedData.currentLocation) {
      updateData.current_location = parsedData.currentLocation;
    }

    // Update last tracking timestamp
    updateData.last_tracking_update = new Date().toISOString();

    // Add notes
    if (parsedData.notes) {
      const freightNotes = `
Freight Update (${new Date().toISOString().split('T')[0]}):
Forwarder: ${parsedData.forwarderName || 'Unknown'}
Status: ${parsedData.currentStatus || parsedData.trackingStatus}
${parsedData.notes}
      `.trim();

      updateData.tracking_notes = freightNotes;
    }

    // Only update if we have data to update
    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('shipments')
        .update(updateData)
        .eq('id', shipmentId);

      if (error) {
        console.error('[Freight Update Processor] Error updating shipment:', error);
        return false;
      }

      console.log('[Freight Update Processor] Shipment updated with:', Object.keys(updateData));

      // Create status history entry
      await createStatusHistory(supabase, shipmentId, parsedData);

      return true;
    }

    console.log('[Freight Update Processor] No updates needed for shipment');
    return false;
  } catch (error) {
    console.error('[Freight Update Processor] Error in updateShipment:', error);
    return false;
  }
}

/**
 * Create shipment status history entry
 */
async function createStatusHistory(
  supabase: any,
  shipmentId: string,
  parsedData: ParsedFreightUpdate
): Promise<void> {
  try {
    const historyEntry = {
      shipment_id: shipmentId,
      status: parsedData.trackingStatus || 'unknown',
      status_date: new Date().toISOString(),
      location: parsedData.currentLocation,
      description: parsedData.statusDescription || parsedData.currentStatus,
      notes: parsedData.notes,
      source: 'email',
      created_at: new Date().toISOString(),
    };

    await supabase.from('shipment_status_history').insert(historyEntry);

    console.log('[Freight Update Processor] Status history entry created');
  } catch (error) {
    console.error('[Freight Update Processor] Error creating status history:', error);
  }
}
