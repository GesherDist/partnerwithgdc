/**
 * PO Extraction Service
 *
 * Extracts Purchase Order data from PDF images using OpenAI GPT-4o Vision.
 * Server-side only.
 */

import OpenAI from 'openai';
import type {
  ExtractedPOData,
  ProcessedPOData,
  ProductMatch,
  CustomerMatch,
} from '../types/po-extract.types';
import { db } from '@/shared/lib/supabase/database';

// ============================================
// CONSTANTS
// ============================================

const MODEL = 'gpt-4o';

const EXTRACTION_PROMPT = `You are a Purchase Order data extractor for an agricultural tire distribution company (Gesher Distribution). Analyze these PO document images and extract all relevant information.

CONTEXT: This is a Purchase Order sent BY A CUSTOMER to Gesher Distribution. We need to identify WHO IS PLACING THE ORDER (the customer/buyer).

Extract the following data:
1. PO Number - The purchase order number/ID
2. PO Date - The date on the purchase order
3. Customer/Buyer Information - The company PLACING/SENDING the order (this is NOT Gesher Distribution, NOT the manufacturer)
4. Ship To Address - Where the order should be delivered
5. Line Items - All products/items being ordered

CRITICAL - IDENTIFYING THE CUSTOMER:
- The CUSTOMER is the company PLACING the order (the buyer who sends this PO)
- Look for: Company letterhead at top, "From:", "Buyer:", "Ordered By:", "Bill To:" sections
- The customer is typically shown in the HEADER or TOP of the PO document
- DO NOT use "To:" or "Vendor:" sections - those show who RECEIVES the PO (Gesher Distribution)
- DO NOT extract manufacturer names from product descriptions (like "Galileo", "BKT", etc.) - those are tire manufacturers, NOT customers
- Common customers: Lindsay Irrigation Solutions, irrigation companies, agricultural equipment dealers

For CUSTOMER (Billing), extract address with SEPARATE fields:
- name: Company name of the BUYER (who is placing this order)
- address: Street address only (e.g., "214 East 2nd Street")
- city: City name
- state: State abbreviation (e.g., "CO", "NE")
- zip: ZIP/Postal code

For SHIP TO, extract address with SEPARATE fields:
- name: Recipient name or company (where goods should be delivered)
- address: Street address only
- city: City name
- state: State abbreviation
- zip: ZIP/Postal code

For LINE ITEMS, extract:
- sku: The item number/code (e.g., "1831204", "A112380ND8")
- vendorItemNo: Look for "Vendor ItemNo:" field (e.g., "290/85R38")
- tireSize: Extract tire size pattern from description or vendor item (e.g., "290/85R38", "380/85R24", "11.2X38")
- description: Full product description
- quantity: Number of items
- unitPrice: Price per unit
- total: Line total

TIRE SIZE PATTERNS TO LOOK FOR:
- Metric format: "290/85R38", "380/85R24", "320/85R36"
- Imperial format: "11.2X38", "14.9X24", "11.2-38"
- Combined: "290/85-38CW (11.2X38CW)"

IMPORTANT:
- For prices, return numeric values only (no currency symbols)
- For quantities, return numeric values only
- If a field is not found, return null
- Confidence score should reflect how clearly you could read the document (0-100)
- The tire size is CRITICAL for matching products - extract it carefully from descriptions
- PARSE ADDRESSES INTO SEPARATE FIELDS - do not put entire address in one field
- NEVER use manufacturer names (Galileo, BKT, Titan, etc.) as customer names - those appear in product descriptions only

Return ONLY valid JSON in this exact format with no additional text:
{
  "confidence": 85,
  "poNumber": "PO-12345",
  "poDate": "2024-08-06",
  "customer": {
    "name": "Lindsay Irrigation Solutions, LLC",
    "address": "214 East 2nd Street",
    "city": "Lindsay",
    "state": "NE",
    "zip": "68644"
  },
  "shipTo": {
    "name": "Lindsay Irrigation Solutions, LLC",
    "address": "214 East 2nd Street",
    "city": "Lindsay",
    "state": "NE",
    "zip": "68644"
  },
  "lineItems": [
    {
      "sku": "1831204",
      "vendorItemNo": "290/85R38",
      "tireSize": "290/85R38",
      "description": "WHEEL ASSY, 11.2X38, GALILEO",
      "quantity": 72,
      "unitPrice": 1428.00,
      "total": 102816.00
    }
  ]
}`;

// ============================================
// OPENAI EXTRACTION
// ============================================

/**
 * Extract PO data from base64 images using OpenAI GPT-4o Vision
 */
export async function extractPOFromImages(
  images: string[]
): Promise<{ success: boolean; data?: ExtractedPOData; error?: string }> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: 'OPENAI_API_KEY not configured',
      };
    }

    const openai = new OpenAI({ apiKey });

    // Build content array with images
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = images.map(
      (base64Image) => ({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/png;base64,${base64Image}`,
          detail: 'high' as const,
        },
      })
    );

    // Add text prompt
    content.push({
      type: 'text' as const,
      text: EXTRACTION_PROMPT,
    });

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    });

    // Extract text response
    const textContent = response.choices[0]?.message?.content;
    if (!textContent) {
      return {
        success: false,
        error: 'No response from OpenAI',
      };
    }

    // Parse JSON response
    const jsonText = textContent.trim();
    // Handle potential markdown code blocks
    const cleanJson = jsonText
      .replace(/^```json\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    const extractedData = JSON.parse(cleanJson) as ExtractedPOData;

    // Validate required fields
    if (!extractedData.lineItems || !Array.isArray(extractedData.lineItems)) {
      return {
        success: false,
        error: 'Invalid response structure: missing lineItems array',
      };
    }

    return {
      success: true,
      data: extractedData,
    };
  } catch (error: unknown) {
    console.error('PO extraction error:', error);

    // Parse OpenAI API errors for user-friendly messages
    let errorMessage = 'Failed to extract PO data';

    if (error && typeof error === 'object') {
      const err = error as { status?: number; message?: string; error?: { type?: string; message?: string } };

      if (err.status === 401) {
        errorMessage = 'AI service authentication failed. Invalid API key.';
      } else if (err.status === 429) {
        // Check if it's a credits issue vs rate limit
        const errMsg = err.message || err.error?.message || '';
        if (errMsg.toLowerCase().includes('no credits remaining') || errMsg.toLowerCase().includes('insufficient_quota')) {
          errorMessage = 'OpenAI API credits exhausted. Please add credits at platform.openai.com/settings/organization/billing to continue using PO extraction.';
        } else {
          errorMessage = 'AI service rate limit exceeded. Please try again in a few minutes.';
        }
      } else if (err.status === 503) {
        errorMessage = 'AI service is currently unavailable. Please try again.';
      } else if (err.message) {
        // Check for quota errors in message
        if (err.message.toLowerCase().includes('no credits remaining') || err.message.toLowerCase().includes('insufficient_quota')) {
          errorMessage = 'OpenAI API credits exhausted. Please add credits at platform.openai.com/settings/organization/billing to continue using PO extraction.';
        } else {
          errorMessage = err.message;
        }
      } else if (err.error?.message) {
        errorMessage = err.error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================
// PRODUCT MATCHING
// ============================================

/**
 * Normalize tire size for comparison
 * Converts various formats to a standard format
 * e.g., "290/85R38" -> "290/85R38", "290/85-38" -> "290/85R38"
 */
function normalizeTireSize(tireSize: string): string {
  if (!tireSize) {
    return '';
  }

  // Convert to uppercase and remove extra spaces
  let normalized = tireSize.toUpperCase().trim();

  // Remove common suffixes like "CW"
  normalized = normalized.replace(/CW$/i, '');

  // Normalize separators: "290/85-38" -> "290/85R38"
  // Match pattern like "290/85-38" or "290/85 38"
  const metricPattern = /(\d+)\/(\d+)[\-\s]?(\d+)/;
  const metricMatch = normalized.match(metricPattern);
  if (metricMatch) {
    return `${metricMatch[1]}/${metricMatch[2]}R${metricMatch[3]}`;
  }

  // Already in correct format like "290/85R38"
  return normalized;
}

/**
 * Extract tire size patterns from text
 * Looks for patterns like "290/85R38", "11.2X38", "380/85R24"
 */
function extractTireSizeFromText(text: string): string | null {
  if (!text) {
    return null;
  }

  // Metric format: 290/85R38, 290/85-38, 320/85R36
  const metricPattern = /\b(\d{3}\/\d{2}[R\-]?\d{2})/i;
  const metricMatch = text.match(metricPattern);
  if (metricMatch && metricMatch[1]) {
    return normalizeTireSize(metricMatch[1]);
  }

  // Imperial format: 11.2X38, 14.9X24, 11.2-38
  const imperialPattern = /\b(\d+\.\d+[X\-]\d{2})/i;
  const imperialMatch = text.match(imperialPattern);
  if (imperialMatch && imperialMatch[1]) {
    return imperialMatch[1].toUpperCase();
  }

  return null;
}

/**
 * Match extracted SKUs with products in database
 * Priority: 1) Exact SKU, 2) Tire Size, 3) Description
 */
export async function matchProducts(
  lineItems: ExtractedPOData['lineItems']
): Promise<ProductMatch[]> {
  const matches: ProductMatch[] = [];

  for (const item of lineItems) {
    let match: ProductMatch = {
      productId: null,
      sku: item.sku || '',
      name: item.description,
      description: item.description,
      quantity: item.quantity,
      unitPrice: 0,
      extractedUnitPrice: item.unitPrice,
      matched: false,
      matchConfidence: 0,
    };

    // Step 1: Try to find product by exact SKU
    if (item.sku) {
      const { data: product } = await db
        .from('products')
        .select('id, sku, name, base_price, tire_size')
        .ilike('sku', item.sku)
        .is('deleted_at', null)
        .single();

      if (product) {
        match = {
          ...match,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unitPrice: product.base_price,
          matched: true,
          matchConfidence: 100,
        };
        matches.push(match);
        continue;
      }
    }

    // Step 2: Try to match by tire size
    // Get tire size from extraction or parse from description/vendorItemNo
    let tireSize = item.tireSize || item.vendorItemNo || null;

    // If no tire size, try to extract from description
    if (!tireSize && item.description) {
      tireSize = extractTireSizeFromText(item.description);
    }

    if (tireSize) {
      const normalizedTireSize = normalizeTireSize(tireSize);

      // Try exact tire_size match
      const { data: tireSizeProducts } = await db
        .from('products')
        .select('id, sku, name, base_price, tire_size')
        .is('deleted_at', null)
        .limit(10);

      if (tireSizeProducts && tireSizeProducts.length > 0) {
        // Find best match by comparing normalized tire sizes
        for (const product of tireSizeProducts) {
          if (product.tire_size) {
            const productTireSize = normalizeTireSize(product.tire_size);
            if (productTireSize === normalizedTireSize) {
              match = {
                ...match,
                productId: product.id,
                sku: product.sku,
                name: product.name,
                unitPrice: product.base_price,
                matched: true,
                matchConfidence: 95,
              };
              break;
            }

            // Check if tire size is contained (partial match)
            if (productTireSize.includes(normalizedTireSize) ||
                normalizedTireSize.includes(productTireSize)) {
              match = {
                ...match,
                productId: product.id,
                sku: product.sku,
                name: product.name,
                unitPrice: product.base_price,
                matched: true,
                matchConfidence: 80,
              };
            }
          }
        }
      }

      if (match.matched) {
        matches.push(match);
        continue;
      }
    }

    // Step 3: Try fuzzy match on SKU
    if (!match.matched && item.sku) {
      const { data: fuzzyProducts } = await db
        .from('products')
        .select('id, sku, name, base_price')
        .ilike('sku', `%${item.sku}%`)
        .is('deleted_at', null)
        .limit(1);

      if (fuzzyProducts && fuzzyProducts.length > 0 && fuzzyProducts[0]) {
        const fuzzyProduct = fuzzyProducts[0];
        match = {
          ...match,
          productId: fuzzyProduct.id,
          sku: fuzzyProduct.sku,
          name: fuzzyProduct.name,
          unitPrice: fuzzyProduct.base_price,
          matched: true,
          matchConfidence: 70,
        };
        matches.push(match);
        continue;
      }
    }

    // Step 4: Try matching by description keywords
    if (!match.matched && item.description) {
      const { data: descProducts } = await db
        .from('products')
        .select('id, sku, name, base_price')
        .or(`name.ilike.%${item.description.slice(0, 30)}%`)
        .is('deleted_at', null)
        .limit(1);

      if (descProducts && descProducts.length > 0 && descProducts[0]) {
        const descProduct = descProducts[0];
        match = {
          ...match,
          productId: descProduct.id,
          sku: descProduct.sku,
          name: descProduct.name,
          unitPrice: descProduct.base_price,
          matched: true,
          matchConfidence: 50,
        };
      }
    }

    matches.push(match);
  }

  return matches;
}

// ============================================
// CUSTOMER MATCHING
// ============================================

/**
 * Match extracted customer name with customers in database
 */
export async function matchCustomer(
  customerName: string | null
): Promise<CustomerMatch> {
  const defaultMatch: CustomerMatch = {
    customerId: null,
    name: customerName || 'Unknown',
    matched: false,
    matchConfidence: 0,
  };

  if (!customerName) {
    return defaultMatch;
  }

  // Try exact match
  const { data: exactMatch } = await db
    .from('customers')
    .select('id, name')
    .ilike('name', customerName)
    .is('deleted_at', null)
    .single();

  if (exactMatch) {
    return {
      customerId: exactMatch.id,
      name: exactMatch.name,
      matched: true,
      matchConfidence: 100,
    };
  }

  // Try fuzzy match
  const searchName = customerName.slice(0, 30);
  const { data: fuzzyMatches } = await db
    .from('customers')
    .select('id, name')
    .ilike('name', `%${searchName}%`)
    .is('deleted_at', null)
    .limit(1);

  if (fuzzyMatches && fuzzyMatches.length > 0 && fuzzyMatches[0]) {
    const fuzzyMatch = fuzzyMatches[0];
    return {
      customerId: fuzzyMatch.id,
      name: fuzzyMatch.name,
      matched: true,
      matchConfidence: 70,
    };
  }

  return defaultMatch;
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

/**
 * Process PO extraction with product and customer matching
 */
export async function processPOExtraction(
  images: string[]
): Promise<{ success: boolean; data?: ProcessedPOData; error?: string }> {
  // Extract PO data from images
  const extractionResult = await extractPOFromImages(images);

  if (!extractionResult.success || !extractionResult.data) {
    return {
      success: false,
      error: extractionResult.error || 'Failed to extract PO data',
    };
  }

  const extraction = extractionResult.data;

  // Match products
  const products = await matchProducts(extraction.lineItems);

  // Match customer
  const customer = await matchCustomer(extraction.customer?.name);

  // Calculate match stats
  const matchedCount = products.filter((p) => p.matched).length;
  const unmatchedCount = products.length - matchedCount;

  return {
    success: true,
    data: {
      extraction,
      customer,
      products,
      matchedCount,
      unmatchedCount,
    },
  };
}
