/**
 * Freight Update Email Parser
 *
 * Extracts freight tracking updates from emails sent by freight forwarders.
 * Generic parser that works with any freight forwarder (SEAIR, Flexport, DHL, etc.)
 */

import OpenAI from 'openai';
import type { ParsedFreightUpdate } from '../types';

// ============================================
// OPENAI CLIENT
// ============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// PARSER FUNCTION
// ============================================

/**
 * Parse freight update email using AI extraction
 */
export async function parseFreightUpdateEmail(
  subject: string,
  body: string
): Promise<ParsedFreightUpdate> {
  console.log('[Freight Update Parser] Starting extraction');

  try {
    const extractedData = await extractWithAI(subject, body);
    return extractedData;
  } catch (error) {
    console.error('[Freight Update Parser] AI extraction failed:', error);

    // Fallback: Return minimal data
    return {
      forwarderName: null,
      forwarderEmail: null,
      contactPerson: null,
      containerNumber: null,
      mblNumber: null,
      hblNumber: null,
      bookingNumber: null,
      soNumber: null,
      poNumber: null,
      vesselName: null,
      voyageNumber: null,
      currentStatus: null,
      trackingStatus: 'unknown',
      currentLocation: null,
      statusDescription: body.substring(0, 500),
      etaOriginPort: null,
      etdOriginPort: null,
      etaDestinationPort: null,
      etdDestinationPort: null,
      etaFinalDestination: null,
      lfdDate: null,
      actualArrivalDate: null,
      actualDeliveryDate: null,
      portOfLoading: null,
      portOfDischarge: null,
      finalDestination: null,
      hasIssue: false,
      issueType: null,
      issueDescription: null,
      isDelayed: false,
      delayReason: null,
      cargoDescription: null,
      weight: null,
      volume: null,
      notes: body.substring(0, 500),
      confidence: 0.0,
      extractionMethod: 'manual',
    };
  }
}

// ============================================
// AI EXTRACTION
// ============================================

async function extractWithAI(
  subject: string,
  body: string
): Promise<ParsedFreightUpdate> {
  const prompt = `
You are an expert at extracting freight tracking information from emails sent by freight forwarders and logistics companies.

IMPORTANT CONTEXT:
- These are emails FROM freight forwarders (SEAIR Global, Flexport, DHL, Kuehne+Nagel, etc.) TO Gesher Distribution
- Forwarders send updates about container/shipment status
- Container numbers: 4 letters + 7 digits (e.g., CMAU9876543, TCLU8042633)
- MBL (Master Bill of Lading): Varies by carrier (e.g., SEAOTB17624, MAEU123456)
- SO/PO numbers may be mentioned in subject or body

Extract the following information from this email:

Email Subject: ${subject}
Email Body:
${body}

Extract and return ONLY a valid JSON object with this structure (no markdown, no code blocks):
{
  "forwarderName": "Freight forwarder company name (e.g., SEAIR Global, Flexport, DHL)",
  "forwarderEmail": "Forwarder's email address",
  "contactPerson": "Contact person name if mentioned",
  "containerNumber": "Container number (4 letters + 7 digits)",
  "mblNumber": "Master Bill of Lading number",
  "hblNumber": "House Bill of Lading if mentioned",
  "bookingNumber": "Booking reference number",
  "soNumber": "Sales Order number if mentioned (SO-####, SO2600###)",
  "poNumber": "Purchase Order number if mentioned (PO-####, GDC-PO-####)",
  "vesselName": "Vessel/ship name",
  "voyageNumber": "Voyage number",
  "currentStatus": "Free-text status from email (e.g., 'Discharged at Norfolk', 'Loaded on rail')",
  "trackingStatus": "booked | picked_up | at_origin_port | loaded_on_vessel | departed | in_transit | arrived_destination_port | customs_clearance | released | on_rail | at_ramp | out_for_delivery | delivered | unknown",
  "currentLocation": "Current location of shipment",
  "statusDescription": "Detailed description of current status",
  "etaOriginPort": "ETA to origin port (YYYY-MM-DD) or null",
  "etdOriginPort": "ETD from origin port (YYYY-MM-DD) or null",
  "etaDestinationPort": "ETA to destination port (YYYY-MM-DD)",
  "etdDestinationPort": "ETD from destination port (YYYY-MM-DD) or null",
  "etaFinalDestination": "ETA to final destination (YYYY-MM-DD) or null",
  "lfdDate": "Last Free Day (YYYY-MM-DD) - CRITICAL!",
  "actualArrivalDate": "Actual arrival date if arrived (YYYY-MM-DD) or null",
  "actualDeliveryDate": "Actual delivery date if delivered (YYYY-MM-DD) or null",
  "portOfLoading": "Port where cargo was loaded (e.g., Mumbai, Nhava Sheva, Shanghai)",
  "portOfDischarge": "Port where cargo will be discharged (e.g., Norfolk, Los Angeles, New York)",
  "finalDestination": "Final delivery destination (city/address)",
  "hasIssue": false,
  "issueType": "delayed | customs_hold | damaged | missing_documents | weather | other | null",
  "issueDescription": "Description of issue if any",
  "isDelayed": false,
  "delayReason": "Reason for delay if delayed",
  "cargoDescription": "Description of cargo/goods",
  "weight": "Weight if mentioned (e.g., '25000 KG', '25 tons')",
  "volume": "Volume if mentioned (e.g., '40 CBM')",
  "notes": "Any additional notes or instructions",
  "confidence": 0.92
}

TRACKING STATUS MAPPING RULES:
- "booked" → Shipment booked, not yet picked up
- "picked_up" → Container picked up from shipper
- "at_origin_port" → At port waiting to load
- "loaded_on_vessel" → Loaded on ship
- "departed" → Vessel departed from origin
- "in_transit" → On the ocean/in transit
- "arrived_destination_port" → Arrived at destination port
- "customs_clearance" → Going through customs
- "released" → Released from customs
- "on_rail" → On train to inland destination
- "at_ramp" → Arrived at rail ramp
- "out_for_delivery" → Being delivered to consignee
- "delivered" → Delivered to final destination
- "unknown" → Cannot determine status

EXTRACTION RULES:
1. Forwarder name: The company SENDING this email (not Gesher, not supplier)
2. Container number: 4 letters + 7 digits format
3. Tracking status: Map the current status to one of the predefined values
4. Dates: Always return in YYYY-MM-DD format
5. LFD (Last Free Day): CRITICAL - extract if mentioned (avoid demurrage)
6. Issues: Set hasIssue=true if any problems mentioned (delays, holds, damage)
7. Confidence: 0.0 to 1.0 based on clarity of extraction

Return ONLY the JSON object, no other text.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert at extracting structured tracking data from freight forwarder emails. Return only valid JSON, no markdown formatting.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1, // Low temperature for deterministic extraction
    response_format: { type: 'json_object' },
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  console.log('[Freight Update Parser] AI Response:', responseText.substring(0, 200));

  try {
    const parsed = JSON.parse(responseText);

    // Map to our interface
    const result: ParsedFreightUpdate = {
      forwarderName: parsed.forwarderName || null,
      forwarderEmail: parsed.forwarderEmail || null,
      contactPerson: parsed.contactPerson || null,
      containerNumber: parsed.containerNumber || null,
      mblNumber: parsed.mblNumber || null,
      hblNumber: parsed.hblNumber || null,
      bookingNumber: parsed.bookingNumber || null,
      soNumber: parsed.soNumber || null,
      poNumber: parsed.poNumber || null,
      vesselName: parsed.vesselName || null,
      voyageNumber: parsed.voyageNumber || null,
      currentStatus: parsed.currentStatus || null,
      trackingStatus: parsed.trackingStatus || 'unknown',
      currentLocation: parsed.currentLocation || null,
      statusDescription: parsed.statusDescription || null,
      etaOriginPort: parsed.etaOriginPort || null,
      etdOriginPort: parsed.etdOriginPort || null,
      etaDestinationPort: parsed.etaDestinationPort || null,
      etdDestinationPort: parsed.etdDestinationPort || null,
      etaFinalDestination: parsed.etaFinalDestination || null,
      lfdDate: parsed.lfdDate || null,
      actualArrivalDate: parsed.actualArrivalDate || null,
      actualDeliveryDate: parsed.actualDeliveryDate || null,
      portOfLoading: parsed.portOfLoading || null,
      portOfDischarge: parsed.portOfDischarge || null,
      finalDestination: parsed.finalDestination || null,
      hasIssue: parsed.hasIssue || false,
      issueType: parsed.issueType || null,
      issueDescription: parsed.issueDescription || null,
      isDelayed: parsed.isDelayed || false,
      delayReason: parsed.delayReason || null,
      cargoDescription: parsed.cargoDescription || null,
      weight: parsed.weight || null,
      volume: parsed.volume || null,
      notes: parsed.notes || null,
      confidence: parsed.confidence || 0.8,
      extractionMethod: 'ai',
    };

    console.log('[Freight Update Parser] Extraction successful:', {
      forwarder: result.forwarderName,
      container: result.containerNumber,
      status: result.trackingStatus,
      confidence: result.confidence,
    });

    return result;
  } catch (parseError) {
    console.error('[Freight Update Parser] Failed to parse AI response:', parseError);
    throw new Error('Failed to parse AI response as JSON');
  }
}

// ============================================
// REGEX FALLBACK (Simple extraction)
// ============================================
