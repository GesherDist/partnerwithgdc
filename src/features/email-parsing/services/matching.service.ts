/**
 * Email Data Matching Service
 *
 * Matches extracted email data with database records.
 */

import { createAdminClient } from '@/shared/lib/supabase/admin';
import type {
  ParsedCustomerPO,
  ParsedSupplierPO,
  MatchingResults,
  CustomerMatchResult,
  ProductMatchResult,
  SupplierPOMatchingResults,
  SupplierMatchResult,
  POMatchResult,
} from '../types';

// ============================================
// MAIN MATCHING FUNCTION
// ============================================

/**
 * Match parsed customer PO data with database records
 */
export async function matchCustomerPOData(
  parsedData: ParsedCustomerPO
): Promise<MatchingResults> {
  console.log('[Matching Service] Starting matching process');

  const supabase = createAdminClient();

  // Match customer
  const customerMatch = await matchCustomer(
    supabase,
    parsedData.customerName,
    parsedData.customerEmail
  );

  // Match products
  const productMatches = await matchProducts(supabase, parsedData.items);

  // Calculate overall confidence
  const overallConfidence = calculateOverallConfidence(customerMatch, productMatches);

  // Check for issues
  const issues: string[] = [];
  if (customerMatch.matchType === 'not_found') {
    issues.push(`Customer "${parsedData.customerName}" not found in database`);
  }
  if (customerMatch.matchType === 'fuzzy') {
    issues.push(`Customer match is fuzzy (${(customerMatch.confidence * 100).toFixed(0)}% confidence)`);
  }

  const notFoundProducts = productMatches.filter((p) => p.matchType === 'not_found');
  if (notFoundProducts.length > 0) {
    issues.push(
      `${notFoundProducts.length} product(s) not found: ${notFoundProducts
        .map((p) => p.sku)
        .join(', ')}`
    );
  }

  console.log('[Matching Service] Matching completed', {
    customerMatch: customerMatch.matchType,
    productsMatched: productMatches.filter((p) => p.matchType.includes('exact')).length,
    productsNotFound: notFoundProducts.length,
    overallConfidence,
  });

  return {
    customer: customerMatch,
    products: productMatches,
    overallConfidence,
    hasIssues: issues.length > 0,
    issues,
  };
}

// ============================================
// CUSTOMER MATCHING
// ============================================

async function matchCustomer(
  supabase: any,
  customerName: string | null,
  customerEmail: string | null
): Promise<CustomerMatchResult> {
  if (!customerName && !customerEmail) {
    return {
      customerId: null,
      customerName: 'Unknown',
      matchType: 'not_found',
      confidence: 0.0,
    };
  }

  // Try exact match by email first
  if (customerEmail) {
    const { data: emailMatch } = await supabase
      .from('customers')
      .select('id, customer_name, email')
      .eq('email', customerEmail)
      .eq('status', 'active')
      .single();

    if (emailMatch) {
      return {
        customerId: emailMatch.id,
        customerName: emailMatch.customer_name,
        matchType: 'exact',
        confidence: 1.0,
      };
    }
  }

  // Try exact match by name
  if (customerName) {
    const { data: nameMatch } = await supabase
      .from('customers')
      .select('id, customer_name, email')
      .ilike('customer_name', customerName)
      .eq('status', 'active')
      .single();

    if (nameMatch) {
      return {
        customerId: nameMatch.id,
        customerName: nameMatch.customer_name,
        matchType: 'exact',
        confidence: 1.0,
      };
    }
  }

  // Fuzzy match by name (partial match)
  if (customerName) {
    const { data: fuzzyMatches } = await supabase
      .from('customers')
      .select('id, customer_name, email')
      .ilike('customer_name', `%${customerName}%`)
      .eq('status', 'active')
      .limit(5);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      // Calculate similarity scores
      const withScores = fuzzyMatches.map((customer: any) => ({
        ...customer,
        similarity: calculateStringSimilarity(
          customerName.toLowerCase(),
          customer.customer_name.toLowerCase()
        ),
      }));

      // Sort by similarity
      withScores.sort((a: any, b: any) => b.similarity - a.similarity);

      const best = withScores[0];

      return {
        customerId: best.id,
        customerName: best.customer_name,
        matchType: 'fuzzy',
        confidence: best.similarity,
        suggestions: withScores.slice(0, 3).map((c: any) => ({
          id: c.id,
          name: c.customer_name,
          similarity: c.similarity,
        })),
      };
    }
  }

  // No match found
  return {
    customerId: null,
    customerName: customerName || 'Unknown',
    matchType: 'not_found',
    confidence: 0.0,
  };
}

// ============================================
// PRODUCT MATCHING
// ============================================

async function matchProducts(
  supabase: any,
  items: Array<{ sku: string | null; productName: string | null; quantity: number }>
): Promise<ProductMatchResult[]> {
  const results: ProductMatchResult[] = [];

  for (const item of items) {
    const match = await matchSingleProduct(supabase, item.sku, item.productName);
    results.push(match);
  }

  return results;
}

async function matchSingleProduct(
  supabase: any,
  sku: string | null,
  productName: string | null
): Promise<ProductMatchResult> {
  if (!sku && !productName) {
    return {
      productId: null,
      sku: 'Unknown',
      productName: null,
      matchType: 'not_found',
      confidence: 0.0,
    };
  }

  // Try exact SKU match first
  if (sku) {
    const { data: skuMatch } = await supabase
      .from('products')
      .select('id, sku, product_name')
      .eq('sku', sku)
      .eq('status', 'active')
      .single();

    if (skuMatch) {
      return {
        productId: skuMatch.id,
        sku: skuMatch.sku,
        productName: skuMatch.product_name,
        matchType: 'exact_sku',
        confidence: 1.0,
      };
    }

    // Try fuzzy SKU match (case-insensitive, partial)
    const { data: fuzzySKUMatches } = await supabase
      .from('products')
      .select('id, sku, product_name')
      .ilike('sku', `%${sku}%`)
      .eq('status', 'active')
      .limit(5);

    if (fuzzySKUMatches && fuzzySKUMatches.length > 0) {
      const best = fuzzySKUMatches[0];
      const similarity = calculateStringSimilarity(
        sku.toLowerCase(),
        best.sku.toLowerCase()
      );

      return {
        productId: best.id,
        sku: best.sku,
        productName: best.product_name,
        matchType: 'fuzzy_sku',
        confidence: similarity,
        suggestions: fuzzySKUMatches.slice(0, 3).map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.product_name,
          similarity: calculateStringSimilarity(
            sku.toLowerCase(),
            p.sku.toLowerCase()
          ),
        })),
      };
    }
  }

  // Try exact name match
  if (productName) {
    const { data: nameMatch } = await supabase
      .from('products')
      .select('id, sku, product_name')
      .ilike('product_name', productName)
      .eq('status', 'active')
      .single();

    if (nameMatch) {
      return {
        productId: nameMatch.id,
        sku: nameMatch.sku,
        productName: nameMatch.product_name,
        matchType: 'exact_name',
        confidence: 0.95,
      };
    }

    // Try fuzzy name match
    const { data: fuzzyNameMatches } = await supabase
      .from('products')
      .select('id, sku, product_name')
      .ilike('product_name', `%${productName}%`)
      .eq('status', 'active')
      .limit(5);

    if (fuzzyNameMatches && fuzzyNameMatches.length > 0) {
      const best = fuzzyNameMatches[0];
      const similarity = calculateStringSimilarity(
        productName.toLowerCase(),
        best.product_name.toLowerCase()
      );

      return {
        productId: best.id,
        sku: best.sku,
        productName: best.product_name,
        matchType: 'fuzzy_name',
        confidence: similarity,
        suggestions: fuzzyNameMatches.slice(0, 3).map((p: any) => ({
          id: p.id,
          sku: p.sku,
          name: p.product_name,
          similarity: calculateStringSimilarity(
            productName.toLowerCase(),
            p.product_name.toLowerCase()
          ),
        })),
      };
    }
  }

  // No match found
  return {
    productId: null,
    sku: sku || 'Unknown',
    productName: productName,
    matchType: 'not_found',
    confidence: 0.0,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate string similarity using Levenshtein distance
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;

  const matrix: number[][] = [];

  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len1; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1
        );
      }
    }
  }

  const distance = matrix[len2]![len1]!;
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
  customerMatch: CustomerMatchResult,
  productMatches: ProductMatchResult[]
): number {
  if (productMatches.length === 0) {
    return customerMatch.confidence * 0.5; // 50% weight if no products
  }

  const productConfidenceSum = productMatches.reduce((sum, p) => sum + p.confidence, 0);
  const avgProductConfidence = productConfidenceSum / productMatches.length;

  // Weighted average: 40% customer, 60% products
  return customerMatch.confidence * 0.4 + avgProductConfidence * 0.6;
}

// ============================================
// SUPPLIER PO MATCHING
// ============================================

/**
 * Match parsed supplier PO data with database records
 */
export async function matchSupplierPOData(
  parsedData: ParsedSupplierPO
): Promise<SupplierPOMatchingResults> {
  console.log('[Supplier Matching] Starting matching process');

  const supabase = createAdminClient();

  // Match supplier
  const supplierMatch = await matchSupplier(
    supabase,
    parsedData.supplierName,
    parsedData.supplierEmail
  );

  // Match purchase order
  const poMatch = await matchPurchaseOrder(supabase, parsedData.poNumber, supplierMatch.supplierId);

  // Match products (for verification)
  const productMatches = await matchProducts(
    supabase,
    parsedData.items.map((item: any) => ({
      sku: item.sku,
      productName: item.productName,
      quantity: item.orderedQuantity || item.confirmedQuantity || 0,
    }))
  );

  // Calculate overall confidence
  const overallConfidence = calculateSupplierPOConfidence(
    supplierMatch,
    poMatch,
    productMatches
  );

  // Check for issues
  const issues: string[] = [];
  if (supplierMatch.matchType === 'not_found') {
    issues.push(`Supplier "${parsedData.supplierName}" not found in database`);
  }
  if (poMatch.matchType === 'not_found') {
    issues.push(`Purchase Order "${parsedData.poNumber}" not found in database`);
  }
  if (poMatch.matchType === 'fuzzy') {
    issues.push(`PO match is fuzzy (${(poMatch.confidence * 100).toFixed(0)}% confidence)`);
  }

  console.log('[Supplier Matching] Matching completed', {
    supplierMatch: supplierMatch.matchType,
    poMatch: poMatch.matchType,
    overallConfidence,
  });

  return {
    supplier: supplierMatch,
    purchaseOrder: poMatch,
    products: productMatches,
    overallConfidence,
    hasIssues: issues.length > 0,
    issues,
  };
}

/**
 * Match supplier by name and email
 */
async function matchSupplier(
  supabase: any,
  supplierName: string | null,
  supplierEmail: string | null
): Promise<SupplierMatchResult> {
  if (!supplierName && !supplierEmail) {
    return {
      supplierId: null,
      supplierName: 'Unknown',
      matchType: 'not_found',
      confidence: 0.0,
    };
  }

  // Try exact match by email first
  if (supplierEmail) {
    const { data: emailMatch } = await supabase
      .from('suppliers')
      .select('id, supplier_name, email')
      .eq('email', supplierEmail)
      .eq('status', 'active')
      .single();

    if (emailMatch) {
      return {
        supplierId: emailMatch.id,
        supplierName: emailMatch.supplier_name,
        matchType: 'exact',
        confidence: 1.0,
      };
    }
  }

  // Try exact match by name
  if (supplierName) {
    const { data: nameMatch } = await supabase
      .from('suppliers')
      .select('id, supplier_name, email')
      .ilike('supplier_name', supplierName)
      .eq('status', 'active')
      .single();

    if (nameMatch) {
      return {
        supplierId: nameMatch.id,
        supplierName: nameMatch.supplier_name,
        matchType: 'exact',
        confidence: 1.0,
      };
    }
  }

  // Fuzzy match by name
  if (supplierName) {
    const { data: fuzzyMatches } = await supabase
      .from('suppliers')
      .select('id, supplier_name, email')
      .ilike('supplier_name', `%${supplierName}%`)
      .eq('status', 'active')
      .limit(5);

    if (fuzzyMatches && fuzzyMatches.length > 0) {
      const withScores = fuzzyMatches.map((supplier: any) => ({
        ...supplier,
        similarity: calculateStringSimilarity(
          supplierName.toLowerCase(),
          supplier.supplier_name.toLowerCase()
        ),
      }));

      withScores.sort((a: any, b: any) => b.similarity - a.similarity);
      const best = withScores[0];

      return {
        supplierId: best.id,
        supplierName: best.supplier_name,
        matchType: 'fuzzy',
        confidence: best.similarity,
        suggestions: withScores.slice(0, 3).map((s: any) => ({
          id: s.id,
          name: s.supplier_name,
          similarity: s.similarity,
        })),
      };
    }
  }

  // No match found
  return {
    supplierId: null,
    supplierName: supplierName || 'Unknown',
    matchType: 'not_found',
    confidence: 0.0,
  };
}

/**
 * Match purchase order by PO number and supplier
 */
async function matchPurchaseOrder(
  supabase: any,
  poNumber: string | null,
  supplierId: string | null
): Promise<POMatchResult> {
  if (!poNumber) {
    return {
      poId: null,
      poNumber: 'Unknown',
      matchType: 'not_found',
      confidence: 0.0,
      existingStatus: null,
    };
  }

  // Try exact match by PO number
  let query = supabase
    .from('purchase_orders')
    .select('id, po_number, status')
    .eq('po_number', poNumber)
    .in('status', ['draft', 'sent', 'confirmed', 'in_production', 'ready_to_ship', 'partial', 'in_transit']);

  // If we have supplier ID, add that filter
  if (supplierId) {
    // Note: PO has items with supplier_id, we'll check via join
    const { data: exactMatch } = await query.single();

    if (exactMatch) {
      return {
        poId: exactMatch.id,
        poNumber: exactMatch.po_number,
        matchType: 'exact',
        confidence: 1.0,
        existingStatus: exactMatch.status,
      };
    }
  } else {
    const { data: exactMatch } = await query.single();

    if (exactMatch) {
      return {
        poId: exactMatch.id,
        poNumber: exactMatch.po_number,
        matchType: 'exact',
        confidence: 1.0,
        existingStatus: exactMatch.status,
      };
    }
  }

  // Try fuzzy match by PO number (case-insensitive, partial)
  const { data: fuzzyMatches } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status')
    .ilike('po_number', `%${poNumber}%`)
    .in('status', ['draft', 'sent', 'confirmed', 'in_production', 'ready_to_ship', 'partial', 'in_transit'])
    .limit(5);

  if (fuzzyMatches && fuzzyMatches.length > 0) {
    const withScores = fuzzyMatches.map((po: any) => ({
      ...po,
      similarity: calculateStringSimilarity(
        poNumber.toLowerCase(),
        po.po_number.toLowerCase()
      ),
    }));

    withScores.sort((a: any, b: any) => b.similarity - a.similarity);
    const best = withScores[0];

    return {
      poId: best.id,
      poNumber: best.po_number,
      matchType: 'fuzzy',
      confidence: best.similarity,
      existingStatus: best.status,
      suggestions: withScores.slice(0, 3).map((p: any) => ({
        id: p.id,
        poNumber: p.po_number,
        similarity: p.similarity,
      })),
    };
  }

  // No match found
  return {
    poId: null,
    poNumber: poNumber,
    matchType: 'not_found',
    confidence: 0.0,
    existingStatus: null,
  };
}

/**
 * Calculate overall confidence for supplier PO matching
 */
function calculateSupplierPOConfidence(
  supplierMatch: SupplierMatchResult,
  poMatch: POMatchResult,
  productMatches: ProductMatchResult[]
): number {
  // Weighted: 50% PO match, 30% supplier match, 20% products
  const poWeight = 0.5;
  const supplierWeight = 0.3;
  const productWeight = 0.2;

  const productConfidence =
    productMatches.length > 0
      ? productMatches.reduce((sum, p) => sum + p.confidence, 0) / productMatches.length
      : 0.5;

  return (
    poMatch.confidence * poWeight +
    supplierMatch.confidence * supplierWeight +
    productConfidence * productWeight
  );
}
