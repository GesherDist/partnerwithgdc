/**
 * Customer PO Email Parser
 *
 * Extracts customer purchase order data from email content using AI.
 */

import OpenAI from 'openai';
import type { ParsedCustomerPO, ParsedLineItem } from '../types';

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
 * Parse customer PO email using AI extraction
 */
export async function parseCustomerPOEmail(
  subject: string,
  body: string
): Promise<ParsedCustomerPO> {
  console.log('[Customer PO Parser] Starting extraction');

  try {
    const extractedData = await extractWithAI(subject, body);
    return extractedData;
  } catch (error) {
    console.error('[Customer PO Parser] AI extraction failed:', error);

    // Fallback: Return minimal data
    return {
      customerName: null,
      customerEmail: null,
      contactPerson: null,
      poNumber: null,
      poDate: null,
      requiredDate: null,
      items: [],
      shipTo: {
        address: null,
        city: null,
        state: null,
        zip: null,
        country: 'USA',
      },
      subtotal: null,
      tax: null,
      total: null,
      notes: body.substring(0, 500),
      specialInstructions: null,
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
): Promise<ParsedCustomerPO> {
  const prompt = `
You are an expert at extracting purchase order data from customer emails.

Extract the following information from this email:

Email Subject: ${subject}
Email Body:
${body}

Extract and return ONLY a valid JSON object with this structure (no markdown, no code blocks):
{
  "customerName": "Company name placing the order",
  "customerEmail": "Customer's email address",
  "contactPerson": "Contact person name if mentioned",
  "poNumber": "Purchase order number (e.g., PO-2024-1234, LIN-2024-1234)",
  "poDate": "Order date in YYYY-MM-DD format",
  "requiredDate": "Required/ship by date in YYYY-MM-DD format",
  "items": [
    {
      "lineNumber": 1,
      "sku": "Product SKU or model number",
      "productName": "Product name/description",
      "description": "Full item description",
      "quantity": 100,
      "unitPrice": 1200.00,
      "lineTotal": 120000.00,
      "confidence": 0.95
    }
  ],
  "shipTo": {
    "address": "Street address",
    "city": "City name",
    "state": "State code (e.g., NE, KS)",
    "zip": "ZIP code",
    "country": "USA"
  },
  "subtotal": 120000.00,
  "tax": 0.00,
  "total": 120000.00,
  "notes": "Any additional notes or comments",
  "specialInstructions": "Special delivery or handling instructions",
  "confidence": 0.92
}

IMPORTANT RULES:
1. customerName = the company PLACING the order (NOT Gesher, NOT the manufacturer)
2. Extract ALL line items with quantities and prices
3. For tire products, look for patterns like "290/85R38", "380/85R24", etc.
4. If a field cannot be determined, use null
5. confidence (0.0-1.0) indicates how confident you are in the extraction
6. Set higher confidence (>0.9) for clearly structured POs
7. Set lower confidence (<0.7) for informal emails or unclear data
8. Return ONLY the JSON object, no additional text or markdown
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a data extraction expert. Extract purchase order information and return ONLY valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.1, // Low temperature for consistent extraction
  });

  const responseText = completion.choices[0]?.message?.content || '{}';

  // Clean response (remove markdown code blocks if present)
  const cleanedText = responseText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const parsed: ParsedCustomerPO = JSON.parse(cleanedText);

  // Set extraction method
  parsed.extractionMethod = 'ai';

  console.log('[Customer PO Parser] AI extraction completed', {
    confidence: parsed.confidence,
    itemCount: parsed.items?.length || 0,
  });

  return parsed;
}

// ============================================
// REGEX FALLBACK (Simple extraction)
// ============================================

export function extractPONumberRegex(text: string): string | null {
  // Common PO number patterns
  const patterns = [
    /PO[#:\s-]*([A-Z0-9-]+)/i,
    /Purchase\s+Order[#:\s-]*([A-Z0-9-]+)/i,
    /Order\s+Number[#:\s-]*([A-Z0-9-]+)/i,
    /P\.O\.[#:\s-]*([A-Z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

export function extractTireQuantities(text: string): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];

  // Pattern: "100x 290/85R38" or "100 units of 290/85R38" or "290/85R38 x 100"
  const pattern1 = /(\d+)\s*(?:x|units?\s+of)?\s*([\d/]+R\d+)/gi;
  const pattern2 = /([\d/]+R\d+)\s*(?:x|qty:?)\s*(\d+)/gi;

  let lineNumber = 1;

  // Process first pattern: "100x 290/85R38" or "100 units of 290/85R38"
  let match;
  while ((match = pattern1.exec(text)) !== null) {
    if (match[1] && match[2]) {
      const qty = parseInt(match[1], 10);
      const sku = match[2];

      if (!isNaN(qty) && sku) {
        items.push({
          lineNumber: lineNumber++,
          sku,
          productName: `Tire ${sku}`,
          description: null,
          quantity: qty,
          unitPrice: null,
          lineTotal: null,
          confidence: 0.7,
        });
      }
    }
  }

  // Process second pattern: "290/85R38 x 100" (reversed order)
  while ((match = pattern2.exec(text)) !== null) {
    if (match[1] && match[2]) {
      const sku = match[1]; // SKU is first in this pattern
      const qty = parseInt(match[2], 10); // Quantity is second

      if (!isNaN(qty) && sku) {
        items.push({
          lineNumber: lineNumber++,
          sku,
          productName: `Tire ${sku}`,
          description: null,
          quantity: qty,
          unitPrice: null,
          lineTotal: null,
          confidence: 0.7,
        });
      }
    }
  }

  return items;
}
