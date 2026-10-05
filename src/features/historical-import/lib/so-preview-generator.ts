/**
 * HISTORICAL IMPORT - SALES ORDER PREVIEW GENERATOR
 * ==================================================
 * Generate sales order previews from quote previews
 */

import {
  QuotePreview,
  SalesOrderPreview,
  SalesOrderItemPreview,
} from '../types';

// ============================================================================
// GENERATE SO PREVIEWS FROM QUOTES
// ============================================================================

export function generateSalesOrderPreviews(
  quotePreviews: QuotePreview[],
  rawRowsMap: Map<string, any> // Map of loadNumber -> rawRow for PO, address, etc.
): SalesOrderPreview[] {
  const previews: SalesOrderPreview[] = [];

  for (const quote of quotePreviews) {
    const rawRow = rawRowsMap.get(quote.loadNumber);

    // Build SO items
    const items: SalesOrderItemPreview[] = quote.items.map((quoteItem) => ({
      productId: quoteItem.productId,
      productName: quoteItem.productName,
      productSku: quoteItem.productSku,
      quantity: quoteItem.quantity,
      unitPrice: quoteItem.unitPrice,
      lineTotal: quoteItem.lineTotal,
      taxRate: 0, // Default tax rate (0%)
      customerQty: quoteItem.quantity, // Customer's actual order quantity (same as quantity for historical import)
      fulfillmentSource: 'manufacturer', // Historical import - all items from Galileo (manufacturer)
    }));

    const preview: SalesOrderPreview = {
      // Header
      orderNumber: quote.loadNumber,
      customerId: quote.customerId,
      customerName: quote.customerName,
      quoteId: null, // Will be populated after quote creation
      customerPO: rawRow?.customerPO || '',
      orderSeries: rawRow?.orderSeries || '',
      status: mapStatus(rawRow?.status),

      // Dates
      orderDate: quote.quoteDate, // SO order date from quote date

      // Delivery
      shippingAddress: rawRow?.deliveryAddress || '',
      shippingMethod: 'Freight - LTL', // Default shipping method
      expectedDeliveryDate: rawRow?.customerDueDate || null,

      // Items
      items,

      // Totals
      subtotal: quote.subtotal,
      taxTotal: quote.taxTotal,
      grandTotal: quote.grandTotal,

      // Notes
      notes: quote.notes,

      // Source
      sourceRow: quote.sourceRow,
      loadNumber: quote.loadNumber,
    };

    previews.push(preview);
  }

  return previews;
}

// ============================================================================
// MAP STATUS
// ============================================================================

function mapStatus(excelStatus: string | undefined): string {
  if (!excelStatus) return 'confirmed';

  const statusMap: Record<string, string> = {
    AVAILABLE: 'confirmed',
    OPEN: 'confirmed',
    'IN TRANSIT': 'processing',
    INVOICED: 'delivered',
    SOLD: 'delivered',
    DELIVERED: 'delivered',
  };

  return statusMap[excelStatus.toUpperCase()] || 'confirmed';
}

// ============================================================================
// UPDATE SO PREVIEW
// ============================================================================

export function updateSOPreview(
  preview: SalesOrderPreview,
  updates: Partial<SalesOrderPreview>
): SalesOrderPreview {
  return { ...preview, ...updates };
}

// ============================================================================
// UPDATE SO ITEM
// ============================================================================

export function updateSOItem(
  preview: SalesOrderPreview,
  itemIndex: number,
  updates: Partial<SalesOrderItemPreview>
): SalesOrderPreview {
  const updatedItems = [...preview.items];
  updatedItems[itemIndex] = { ...updatedItems[itemIndex]!, ...updates } as SalesOrderItemPreview;

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
// GET FULFILLMENT SUMMARY
// ============================================================================

export function getFulfillmentSummary(preview: SalesOrderPreview): {
  hasManufacturer: boolean;
  hasGDCInventory: boolean;
  hasPlatinumDealer: boolean;
  willCreatePO: boolean;
  willCreatePickTicket: boolean;
} {
  const fulfillmentSources = new Set(preview.items.map((item) => item.fulfillmentSource));

  const hasManufacturer = fulfillmentSources.has('manufacturer');
  const hasGDCInventory = fulfillmentSources.has('gdc_inventory');
  const hasPlatinumDealer =
    fulfillmentSources.has('platinum_dealer_inventory') ||
    fulfillmentSources.has('platinum_dealer_fulfillment');

  return {
    hasManufacturer,
    hasGDCInventory,
    hasPlatinumDealer,
    willCreatePO: hasManufacturer,
    willCreatePickTicket: hasGDCInventory,
  };
}
