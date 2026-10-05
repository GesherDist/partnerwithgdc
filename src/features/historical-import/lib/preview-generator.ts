/**
 * HISTORICAL IMPORT - PREVIEW GENERATOR
 * ======================================
 * Generate quote, SO, PO previews from raw data
 */

import { RawExcelRow, QuotePreview, QuoteItemPreview } from '../types';

// ============================================================================
// GET PRODUCTS (cached)
// ============================================================================

let productsCache: {
  product38: { id: string; name: string; sku: string } | null;
  product24: { id: string; name: string; sku: string } | null;
} | null = null;

async function getProducts() {
  if (productsCache) return productsCache;

  try {
    const response = await fetch('/api/historical-import/get-products');
    if (!response.ok) throw new Error('Failed to fetch products');

    const data = await response.json();
    productsCache = {
      product38: data.product38,
      product24: data.product24,
    };
    return productsCache;
  } catch (error) {
    console.error('Error fetching products:', error);
    return {
      product38: null,
      product24: null,
    };
  }
}

// ============================================================================
// GENERATE QUOTE PREVIEWS
// ============================================================================

export async function generateQuotePreviews(
  validRows: RawExcelRow[]
): Promise<QuotePreview[]> {
  const products = await getProducts();

  if (!products.product38 || !products.product24) {
    throw new Error('Products not found. Please add 290/85R38 and 380/85R24 products first.');
  }

  const previews: QuotePreview[] = [];

  for (const row of validRows) {
    // Skip internal customers (warehouse inventory) - they don't need quotes
    if (row.isInternalCustomer || !row.customerId) {
      continue;
    }

    // Generate quote number
    // Generate quote number in format QT-YYYY-NNNNN
    // Extract SO number parts: SO2600024 -> year: 26, number: 00024
    const soMatch = row.loadNumber.match(/SO(\d{2})(\d{5})/);
    let quoteNumber: string;
    if (soMatch) {
      const year = '20' + soMatch[1]; // 26 -> 2026
      const number = soMatch[2]; // 00024
      quoteNumber = `QT-${year}-${number}`;
    } else {
      // Fallback if format doesn't match
      quoteNumber = row.loadNumber.replace('SO', 'QT-');
    }

    // Build quote items
    const items: QuoteItemPreview[] = [];

    if (row.qty38 > 0) {
      items.push({
        productId: products.product38.id,
        productName: products.product38.name,
        productSku: products.product38.sku,
        quantity: row.qty38,
        unitPrice: Math.round(row.price38 * 100), // Convert to cents
        lineTotal: Math.round(row.qty38 * row.price38 * 100),
      });
    }

    if (row.qty24 > 0) {
      items.push({
        productId: products.product24.id,
        productName: products.product24.name,
        productSku: products.product24.sku,
        quantity: row.qty24,
        unitPrice: Math.round(row.price24 * 100), // Convert to cents
        lineTotal: Math.round(row.qty24 * row.price24 * 100),
      });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

    // Quote date: Use ETA Port or Confirmed ETA as quote date (historical), or today
    let quoteDate: string;
    if (row.etaPort) {
      quoteDate = row.etaPort;
    } else if (row.confirmedEta) {
      quoteDate = row.confirmedEta;
    } else {
      quoteDate = new Date().toISOString().split('T')[0]!;
    }

    // Valid until date: Use Customer Due Date if available and after quote date
    let validUntilDate: string | null = null;
    if (row.customerDueDate) {
      // Ensure valid_until is after quote_date
      if (row.customerDueDate >= quoteDate) {
        validUntilDate = row.customerDueDate;
      } else {
        // If customer due date is before quote date, set valid_until to quote_date + 30 days
        const quoteDateObj = new Date(quoteDate);
        quoteDateObj.setDate(quoteDateObj.getDate() + 30);
        validUntilDate = quoteDateObj.toISOString().split('T')[0]!;
      }
    } else {
      // Default: quote date + 30 days
      const quoteDateObj = new Date(quoteDate);
      quoteDateObj.setDate(quoteDateObj.getDate() + 30);
      validUntilDate = quoteDateObj.toISOString().split('T')[0]!;
    }

    const preview: QuotePreview = {
      // Header
      quoteNumber,
      customerId: row.customerId!,
      customerName: row.customer,
      customerPO: row.customerPO,
      deliveryAddress: row.deliveryAddress,
      quoteDate: quoteDate,
      validUntil: validUntilDate,
      status: 'draft',
      terms: 'Net 30',
      notes: `Imported from ${row.sheetName}`,

      // Items
      items,

      // Totals
      subtotal,
      taxTotal: 0,
      grandTotal: subtotal,

      // Source
      sourceRow: row.rowIndex,
      loadNumber: row.loadNumber,
    };

    previews.push(preview);
  }

  return previews;
}

// ============================================================================
// UPDATE QUOTE PREVIEW
// ============================================================================

export function updateQuotePreview(
  preview: QuotePreview,
  updates: Partial<QuotePreview>
): QuotePreview {
  return { ...preview, ...updates };
}

// ============================================================================
// UPDATE QUOTE ITEM
// ============================================================================

export function updateQuoteItem(
  preview: QuotePreview,
  itemIndex: number,
  updates: Partial<QuoteItemPreview>
): QuotePreview {
  const updatedItems = [...preview.items];
  updatedItems[itemIndex] = { ...updatedItems[itemIndex]!, ...updates } as QuoteItemPreview;

  // Recalculate line total if qty or price changed
  if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
    const item = updatedItems[itemIndex]!;
    updatedItems[itemIndex]!.lineTotal = item.quantity * item.unitPrice;
  }

  // Recalculate totals
  const subtotal = updatedItems.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    ...preview,
    items: updatedItems,
    subtotal,
    grandTotal: subtotal + preview.taxTotal,
  };
}

// ============================================================================
// FORMAT CURRENCY
// ============================================================================

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
