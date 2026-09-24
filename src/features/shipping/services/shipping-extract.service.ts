/**
 * Shipping Extraction Service
 *
 * Extracts shipping tracking data from forwarded emails using OpenAI GPT-4o.
 * Server-side only.
 */

import OpenAI from 'openai';
import type {
  ShippingEmailExtraction,
  ShipmentTrackingStatus,
  ShipmentIssueType,
} from '../types';

// ============================================
// CONSTANTS
// ============================================

const MODEL = 'gpt-4o';

// Status keywords for fallback detection
const STATUS_KEYWORDS: Record<ShipmentTrackingStatus, string[]> = {
  booked: ['booked', 'booking confirmed', 'booking received'],
  container_picked: ['container picked', 'picked up', 'gated out', 'empty pickup'],
  loaded_on_vessel: ['loaded', 'on board', 'vessel loaded', 'shipped on board'],
  departed_origin: ['departed', 'sailed', 'vessel departed', 'etd'],
  in_transit: ['in transit', 'en route', 'sailing', 'on water'],
  arrived_port: ['arrived', 'port arrival', 'vessel arrived', 'discharged', 'pod arrival'],
  customs_clearance: ['customs', 'clearance', 'cleared customs', 'cfs'],
  on_rail: ['rail', 'train', 'intermodal', 'on train', 'rail departure'],
  at_ramp: ['at ramp', 'arrived ramp', 'ramp arrival', 'destination ramp'],
  out_for_delivery: ['out for delivery', 'dispatched', 'en route to consignee', 'dray'],
  delivered: ['delivered', 'pod', 'proof of delivery', 'delivery confirmed'],
  exception: ['exception', 'problem', 'issue', 'failed'],
};

// Issue keywords for fallback detection
const ISSUE_KEYWORDS: Record<ShipmentIssueType, string[]> = {
  container_damaged: ['damaged', 'damage', 'broken', 'wet damage', 'cargo damage'],
  transload_required: ['transload', 'trans-load', 'transfer cargo', 'new container'],
  customs_hold: ['customs hold', 'held by customs', 'inspection', 'exam'],
  delayed: ['delayed', 'delay', 'postponed', 'behind schedule', 'rolled'],
  lfd_approaching: ['last free day', 'lfd', 'free time expiring', 'demurrage warning'],
  demurrage_risk: ['demurrage', 'storage charges', 'detention', 'per diem'],
  address_change: ['address change', 'new address', 'delivery address', 'update address'],
  additional_charges: ['additional charge', 'extra charge', 'surcharge', 'chassis fee'],
};

const EXTRACTION_PROMPT = `You are a shipping logistics expert AI. Extract shipping tracking information from forwarded emails.

IMPORTANT CONTEXT:
- These are emails between SEAIR Global (freight forwarder), Galileo (supplier in India), and Gesher Distribution (importer in USA)
- Container numbers format: 4 letters + 7 digits (e.g., TCLU8042633, SEGU4010515, CMAU9623325)
- MBL format: SEAOTB##### or similar shipping line formats
- SO numbers format: Either SO-YYYY-NNNNN (e.g., SO-2026-00003) OR SO####### (e.g., SO2600012) - Gesher's Sales Order reference. Preserve the original format from email!

CRITICAL - TRANSLOAD HANDLING:
- Look for "NEW CONT#", "NEW CONTAINER", "new container" in subject or body
- If transload occurred, the NEW container number is the CURRENT/ACTIVE one
- Set containerNumber to the NEW container (the one goods are currently in)
- Set isTransload to true
- Put the ORIGINAL container in the statusDescription for reference

EXTRACT THE FOLLOWING:

1. Container Number (CRITICAL - if transload, use the NEW container number!)
2. MBL Number (Master Bill of Lading)
3. SO Number (Sales Order - Gesher's reference, usually in subject)
4. Vessel Name & Voyage Number
5. ETA to US Port
6. ETA to Rail Ramp (if applicable)
7. LFD (Last Free Day) - CRITICAL for avoiding demurrage charges
8. Current Status (from the list below)
9. Current Location
10. Any Issues or Exceptions

STATUS VALUES (choose the most recent/current one):
- booked: Shipment booked, not yet picked
- container_picked: Container collected from port/yard
- loaded_on_vessel: On the ship
- departed_origin: Ship has sailed from origin port
- in_transit: On the ocean
- arrived_port: Arrived at US port (POD)
- customs_clearance: Going through customs
- on_rail: On train to inland destination
- at_ramp: Arrived at rail ramp
- out_for_delivery: Being delivered to consignee
- delivered: Delivered to final destination
- exception: Problem occurred (use only if there's a blocking issue)

ISSUE TYPES (if any issue detected):
- container_damaged: Physical damage to container or cargo
- transload_required: Cargo needs to move to new container
- customs_hold: Held by customs for inspection
- delayed: Behind schedule
- lfd_approaching: Last Free Day is within 3 days
- demurrage_risk: Risk of storage charges
- address_change: Delivery address changed
- additional_charges: Extra fees needed

DATE FORMAT: Return dates as YYYY-MM-DD (e.g., 2025-08-25)

Return ONLY valid JSON in this exact format:
{
  "containerNumber": "TCLU8042633",
  "mblNumber": "SEAOTB17624",
  "soNumber": "SO-2026-00003",
  "vesselName": "MSC VESSEL NAME",
  "voyageNumber": "ABC123",
  "etaPort": "2025-08-25",
  "etaRamp": "2025-08-28",
  "lfdDate": "2025-08-30",
  "deliveryDate": null,
  "detectedStatus": "in_transit",
  "statusDescription": "Vessel departed from Nhava Sheva, currently in transit to US port",
  "currentLocation": "At Sea - Indian Ocean",
  "hasIssue": false,
  "issueType": null,
  "issueDescription": null,
  "isTransload": false,
  "newContainerNumber": null,
  "confidence": 0.95,
  "keyPoints": [
    "Container departed origin port",
    "ETA to US port is Aug 25",
    "LFD is Aug 30"
  ]
}`;

// ============================================
// OPENAI EXTRACTION
// ============================================

/**
 * Extract shipping info from email using OpenAI GPT-4o
 */
export async function extractShippingInfo(
  emailSubject: string,
  emailBody: string
): Promise<ShippingEmailExtraction> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[Shipping] OPENAI_API_KEY not configured');
      return fallbackExtraction(emailSubject, emailBody);
    }

    const openai = new OpenAI({ apiKey });

    const userPrompt = `Extract shipping information from this forwarded email:

SUBJECT: ${emailSubject}

BODY:
${emailBody}

Return ONLY valid JSON, no markdown code blocks or additional text.`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      temperature: 0.1,
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[Shipping] No response from OpenAI');
      return fallbackExtraction(emailSubject, emailBody);
    }

    // Parse JSON response
    const jsonText = content.trim();
    // Handle potential markdown code blocks
    const cleanJson = jsonText
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    const extracted = JSON.parse(cleanJson) as ShippingEmailExtraction;

    // Validate and enhance with keyword detection
    const fullText = emailSubject + ' ' + emailBody;

    // If no status detected, try keyword detection
    if (!extracted.detectedStatus) {
      const keywordStatus = detectStatusFromKeywords(fullText);
      if (keywordStatus) {
        extracted.detectedStatus = keywordStatus;
      } else {
        extracted.detectedStatus = 'in_transit'; // Default
      }
    }

    // Check for issues via keywords if AI didn't detect
    if (!extracted.hasIssue) {
      const detectedIssue = detectIssueFromKeywords(fullText);
      if (detectedIssue) {
        extracted.hasIssue = true;
        extracted.issueType = detectedIssue;
      }
    }

    return extracted;
  } catch (error) {
    console.error('[Shipping] Extraction error:', error);
    return fallbackExtraction(emailSubject, emailBody);
  }
}

// ============================================
// FALLBACK EXTRACTION (Regex-based)
// ============================================

/**
 * Fallback extraction using regex patterns
 * Used when OpenAI API fails or is not available
 */
function fallbackExtraction(
  subject: string,
  body: string
): ShippingEmailExtraction {
  const fullText = subject + ' ' + body;

  // Check for transload scenario - look for NEW CONT# or NEW CONTAINER patterns
  const isTransload = /transload|trans-load|new\s*cont(ainer)?#?/i.test(fullText);

  // Extract NEW container number first (for transload scenarios)
  // Patterns: "NEW CONT# CMAU9623325", "NEW CONTAINER CMAU9623325", "new container CMAU9623325"
  const newContainerMatch = fullText.match(/NEW\s*CONT(?:AINER)?#?\s*([A-Z]{4}\d{7})/i);

  // Extract original container number (CNTR # or CONTAINER #)
  const originalContainerMatch = fullText.match(/CNTR\s*#?\s*([A-Z]{4}\d{7})/i);

  // Fallback: find any container number
  const anyContainerMatch = fullText.match(/\b([A-Z]{4}\d{7})\b/);

  // Determine which container to use as primary
  // If transload, prefer NEW container; otherwise use original or any found
  let primaryContainer: string | null = null;
  let newContainerNumber: string | null = null;

  if (isTransload && newContainerMatch?.[1]) {
    // Transload: NEW container is the active one
    primaryContainer = newContainerMatch[1];
    newContainerNumber = newContainerMatch[1];
  } else if (originalContainerMatch?.[1]) {
    primaryContainer = originalContainerMatch[1];
  } else if (anyContainerMatch?.[1]) {
    primaryContainer = anyContainerMatch[1];
  }

  // If we found a new container but primary is still original, swap them
  if (newContainerMatch?.[1] && primaryContainer !== newContainerMatch[1]) {
    newContainerNumber = newContainerMatch[1];
    // For transload completed emails, use new container as primary
    if (/transload.*completed|completed.*transload/i.test(fullText)) {
      primaryContainer = newContainerMatch[1];
    }
  }

  // MBL number: Various formats
  const mblMatch = fullText.match(/\b(SEAOTB\d+|[A-Z]{6,}\d{5,})\b/i);

  // SO number: SO-YYYY-NNNNN or SO####### format
  // Examples: SO-2026-00003, SO2600028
  const soMatch = fullText.match(/\b(SO-\d{4}-\d{5}|SO\d{7})\b/i);

  // Dates: Various formats
  const datePattern = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4})\b/g;
  const dates = fullText.match(datePattern) || [];

  // Detect status and issues from keywords
  let detectedStatus = detectStatusFromKeywords(fullText) || 'in_transit';
  const detectedIssue = detectIssueFromKeywords(fullText);

  // If transload completed, update status
  if (/transload.*completed|completed.*transload/i.test(fullText)) {
    detectedStatus = 'at_ramp'; // Transload typically happens at ramp
  }

  // Build status description
  let statusDescription = 'Extracted via fallback method - manual review recommended';
  if (isTransload && originalContainerMatch?.[1] && newContainerMatch?.[1]) {
    statusDescription = `Transloaded from ${originalContainerMatch[1]} to ${newContainerMatch[1]}`;
  }

  return {
    containerNumber: primaryContainer,
    mblNumber: mblMatch?.[1] || null,
    soNumber: soMatch?.[1]?.toUpperCase() || null,
    vesselName: null,
    voyageNumber: null,
    etaPort: dates[0] ? formatDate(dates[0]) : null,
    etaRamp: dates[1] ? formatDate(dates[1]) : null,
    lfdDate: null,
    deliveryDate: null,
    detectedStatus,
    statusDescription,
    currentLocation: null,
    hasIssue: detectedIssue !== null || isTransload,
    issueType: isTransload ? 'transload_required' : detectedIssue,
    issueDescription: isTransload
      ? `Transload: Original ${originalContainerMatch?.[1] || 'unknown'} → New ${newContainerMatch?.[1] || 'unknown'}`
      : (detectedIssue ? `Detected: ${detectedIssue}` : null),
    isTransload,
    newContainerNumber,
    confidence: 0.5, // Slightly higher confidence with better extraction
    keyPoints: [
      'Fallback extraction used',
      isTransload ? `Transload detected: ${newContainerNumber || 'new container'}` : null,
      'Manual review recommended',
    ].filter(Boolean) as string[],
  };
}

/**
 * Detect status from keywords in text
 */
function detectStatusFromKeywords(text: string): ShipmentTrackingStatus | null {
  const lowerText = text.toLowerCase();

  // Check in reverse order (most specific first)
  const statusOrder: ShipmentTrackingStatus[] = [
    'delivered',
    'out_for_delivery',
    'at_ramp',
    'on_rail',
    'customs_clearance',
    'arrived_port',
    'in_transit',
    'departed_origin',
    'loaded_on_vessel',
    'container_picked',
    'booked',
  ];

  for (const status of statusOrder) {
    const keywords = STATUS_KEYWORDS[status];
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return status;
    }
  }

  return null;
}

/**
 * Detect issue from keywords in text
 */
function detectIssueFromKeywords(text: string): ShipmentIssueType | null {
  const lowerText = text.toLowerCase();

  for (const [issue, keywords] of Object.entries(ISSUE_KEYWORDS)) {
    if (keywords.some((kw) => lowerText.includes(kw))) {
      return issue as ShipmentIssueType;
    }
  }

  return null;
}

/**
 * Format date string to YYYY-MM-DD
 */
function formatDate(dateStr: string): string | null {
  try {
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }

    const isoDate = date.toISOString().split('T')[0];
    return isoDate ?? null;
  } catch {
    return null;
  }
}
