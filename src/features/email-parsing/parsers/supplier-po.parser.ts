/**
 * Supplier PO Email Parser
 *
 * Extracts supplier purchase order confirmation and production update data from email content using AI.
 * Handles emails from suppliers (like Galileo) confirming POs and providing production status updates.
 */

import OpenAI from 'openai';
import type { ParsedSupplierPO } from '../types';

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
 * Parse supplier PO confirmation/update email using AI extraction
 */
export async function parseSupplierPOEmail(
  subject: string,
  body: string
): Promise<ParsedSupplierPO> {
  console.log('[Supplier PO Parser] Starting extraction');

  try {
    const extractedData = await extractWithAI(subject, body);
    return extractedData;
  } catch (error) {
    console.error('[Supplier PO Parser] AI extraction failed:', error);

    // Fallback: Return minimal data
    return {
      supplierName: null,
      supplierEmail: null,
      contactPerson: null,
      poNumber: null,
      confirmationDate: null,
      confirmationStatus: null,
      productionStatus: null,
      progressPercentage: null,
      items: [],
      expectedCompletionDate: null,
      expectedShipDate: null,
      actualShipDate: null,
      containerNumber: null,
      vesselName: null,
      voyageNumber: null,
      mblNumber: null,
      portOfLoading: null,
      portOfDischarge: null,
      etd: null,
      eta: null,
      totalQuantity: null,
      totalAmount: null,
      notes: body.substring(0, 500),
      issuesOrConcerns: null,
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
): Promise<ParsedSupplierPO> {
  const prompt = `
You are an expert at extracting supplier purchase order confirmation and production update data from emails.

IMPORTANT CONTEXT:
- These are emails FROM suppliers (manufacturers like Galileo, BKT, MRL Tyres) TO Gesher Distribution
- Supplier is CONFIRMING or UPDATING status on a PO that Gesher sent to them
- PO numbers format: GDC-PO-##### or similar (Gesher's PO number to supplier)
- Container numbers: 4 letters + 7 digits (e.g., CMAU9876543, TCLU8042633)
- Production status: not_started, in_production, ready_to_ship, shipped

Extract the following information from this email:

Email Subject: ${subject}
Email Body:
${body}

Extract and return ONLY a valid JSON object with this structure (no markdown, no code blocks):
{
  "supplierName": "Supplier/manufacturer company name (e.g., Galileo Wheels, BKT Tires)",
  "supplierEmail": "Supplier's email address",
  "contactPerson": "Contact person name (e.g., Alon, Rajesh)",
  "poNumber": "Gesher's PO number being confirmed (e.g., GDC-PO-12345, PO-2024-1234)",
  "confirmationDate": "Date of confirmation in YYYY-MM-DD format",
  "confirmationStatus": "confirmed | rejected | partial | unknown",
  "productionStatus": "not_started | in_production | ready_to_ship | shipped",
  "progressPercentage": 80,
  "items": [
    {
      "lineNumber": 1,
      "sku": "Product SKU (e.g., 290/85R38, 380/85R24)",
      "productName": "Product name",
      "description": "Item description",
      "orderedQuantity": 72,
      "confirmedQuantity": 72,
      "unitPrice": 850.00,
      "lineTotal": 61200.00,
      "confidence": 0.95
    }
  ],
  "expectedCompletionDate": "Production completion date in YYYY-MM-DD",
  "expectedShipDate": "Expected ship date in YYYY-MM-DD",
  "actualShipDate": "Actual ship date if shipped (YYYY-MM-DD) or null",
  "containerNumber": "Container number if assigned (e.g., CMAU9876543)",
  "vesselName": "Vessel name if known (e.g., Maersk Denver, MSC Istanbul)",
  "voyageNumber": "Voyage number if known (e.g., 245N, V123)",
  "mblNumber": "Master Bill of Lading number if available",
  "portOfLoading": "Port where container will be loaded (e.g., Mumbai, Nhava Sheva)",
  "portOfDischarge": "Destination port (e.g., Norfolk, Los Angeles)",
  "etd": "Expected Time of Departure in YYYY-MM-DD",
  "eta": "Expected Time of Arrival in YYYY-MM-DD",
  "totalQuantity": 72,
  "totalAmount": 61200.00,
  "notes": "Any additional notes or comments from supplier",
  "issuesOrConcerns": "Any issues, delays, or concerns mentioned",
  "confidence": 0.92
}

EXTRACTION RULES:
1. Supplier name: The company SENDING this email (Galileo, BKT, MRL, etc.) - NOT Gesher
2. PO number: Look for "PO", "P.O.", "Purchase Order", "Order #" - use Gesher's reference (GDC-PO-###)
3. Confirmation status:
   - "confirmed" if supplier accepts the order
   - "rejected" if supplier declines
   - "partial" if only some items confirmed
   - "unknown" if unclear
4. Production status:
   - "not_started" if not begun yet
   - "in_production" if actively manufacturing
   - "ready_to_ship" if production complete, waiting to ship
   - "shipped" if already sent
5. Progress percentage: Extract from phrases like "80% complete", "90% done"
6. Container number: Only if explicitly mentioned and assigned
7. Dates: Always return in YYYY-MM-DD format
8. Confidence: 0.0 to 1.0 based on clarity of extraction

Return ONLY the JSON object, no other text.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert at extracting structured data from supplier purchase order confirmation emails. Return only valid JSON, no markdown formatting.',
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

  console.log('[Supplier PO Parser] AI Response:', responseText.substring(0, 200));

  try {
    const parsed = JSON.parse(responseText);

    // Map to our interface
    const result: ParsedSupplierPO = {
      supplierName: parsed.supplierName || null,
      supplierEmail: parsed.supplierEmail || null,
      contactPerson: parsed.contactPerson || null,
      poNumber: parsed.poNumber || null,
      confirmationDate: parsed.confirmationDate || null,
      confirmationStatus: parsed.confirmationStatus || null,
      productionStatus: parsed.productionStatus || null,
      progressPercentage: parsed.progressPercentage || null,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item: any, index: number) => ({
            lineNumber: item.lineNumber || index + 1,
            sku: item.sku || null,
            productName: item.productName || null,
            description: item.description || null,
            orderedQuantity: item.orderedQuantity || 0,
            confirmedQuantity: item.confirmedQuantity || item.orderedQuantity || 0,
            unitPrice: item.unitPrice || null,
            lineTotal: item.lineTotal || null,
            confidence: item.confidence || 0.8,
          }))
        : [],
      expectedCompletionDate: parsed.expectedCompletionDate || null,
      expectedShipDate: parsed.expectedShipDate || null,
      actualShipDate: parsed.actualShipDate || null,
      containerNumber: parsed.containerNumber || null,
      vesselName: parsed.vesselName || null,
      voyageNumber: parsed.voyageNumber || null,
      mblNumber: parsed.mblNumber || null,
      portOfLoading: parsed.portOfLoading || null,
      portOfDischarge: parsed.portOfDischarge || null,
      etd: parsed.etd || null,
      eta: parsed.eta || null,
      totalQuantity: parsed.totalQuantity || null,
      totalAmount: parsed.totalAmount || null,
      notes: parsed.notes || null,
      issuesOrConcerns: parsed.issuesOrConcerns || null,
      confidence: parsed.confidence || 0.8,
      extractionMethod: 'ai',
    };

    console.log('[Supplier PO Parser] Extraction successful:', {
      supplier: result.supplierName,
      poNumber: result.poNumber,
      status: result.productionStatus,
      confidence: result.confidence,
    });

    return result;
  } catch (parseError) {
    console.error('[Supplier PO Parser] Failed to parse AI response:', parseError);
    throw new Error('Failed to parse AI response as JSON');
  }
}

// ============================================
// REGEX FALLBACK (Simple extraction)
// ============================================

