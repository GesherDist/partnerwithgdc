/**
 * Purchase Order PDF Service (Ankur's email, Nov 6 2026)
 *
 * Maps a purchase order to the PDF template and renders it with the shared
 * Puppeteer renderer. Used by GET /api/purchase-orders/[id]/pdf (view /
 * download) and by the supplier email (attachment). Server-side only.
 */

import { htmlToPdfBase64 } from '@/shared/lib/pdf';
import { generatePurchaseOrderHtml, type PurchaseOrderPdfData } from './pdf-template';
import type { PurchaseOrderWithItems } from '../types';

/** Date or date string → YYYY-MM-DD (UTC), else null */
function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function buildPurchaseOrderPdfData(po: PurchaseOrderWithItems): PurchaseOrderPdfData {
  const items = [...po.items].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    poNumber: po.poNumber,
    poDate: isoDate(po.poDate),
    expectedDeliveryDate: isoDate(po.expectedDeliveryDate),
    status: po.status,
    orderSeries: po.orderSeries ?? po.salesOrder?.orderSeries ?? null,
    salesOrderNumber: po.salesOrder?.orderNumber ?? null,
    currencyCode: po.currencyCode || 'USD',

    supplierNames: [...new Set(items.map((i) => i.supplierName).filter((n): n is string => Boolean(n)))],
    vendorAddress: {
      street: po.vendorAddressStreet,
      city: po.vendorAddressCity,
      state: po.vendorAddressState,
      postalCode: po.vendorAddressPostalCode,
      country: po.vendorAddressCountry,
    },

    shipToName: po.warehouse?.name ?? null,
    shipToAddress: {
      street: po.shipToAddressStreet,
      city: po.shipToAddressCity,
      state: po.shipToAddressState,
      postalCode: po.shipToAddressPostalCode,
      country: po.shipToAddressCountry,
    },

    items: items.map((item, index) => ({
      rowNum: index + 1,
      sku: item.sku,
      description: item.description || item.sku,
      supplierName: item.supplierName,
      quantity: item.quantityOrdered,
      unitCode: item.unitCode,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),

    subtotal: po.subtotal,
    taxTotal: po.taxTotal,
    shippingCost: po.shippingCost,
    grandTotal: po.grandTotal,

    vendorNotes: po.vendorNotes,
  };
}

/** Returns the PDF as base64 */
export async function generatePurchaseOrderPdf(po: PurchaseOrderWithItems): Promise<string> {
  return htmlToPdfBase64(generatePurchaseOrderHtml(buildPurchaseOrderPdfData(po)));
}

/** File-name-safe PO number */
export function purchaseOrderPdfFileName(poNumber: string): string {
  return `PurchaseOrder-${poNumber.replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`;
}
