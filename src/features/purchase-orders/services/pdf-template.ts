/**
 * Purchase Order PDF Template
 *
 * Same look as the Sales Order PDF (Ankur's template): Gesher header + logo,
 * Supplier | Ship to boxes, PO details, items table, totals. Internal notes are
 * not printed (the PDF goes to the supplier).
 */

import { getGesherLogoBase64 } from '@/shared/lib/logo-utils';

interface PdfAddress {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}

export interface PurchaseOrderPdfData {
  poNumber: string;
  poDate: string | null;
  expectedDeliveryDate: string | null;
  status: string;
  orderSeries: string | null;
  salesOrderNumber: string | null;
  currencyCode: string;

  supplierNames: string[];
  vendorAddress: PdfAddress;

  shipToName: string | null;
  shipToAddress: PdfAddress;

  items: Array<{
    rowNum: number;
    sku: string;
    description: string;
    supplierName: string | null;
    quantity: number;
    unitCode: string;
    unitPrice: number; // cents
    lineTotal: number; // cents
  }>;

  // Totals (cents)
  subtotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;

  vendorNotes: string | null;
}

/** Escape user-entered text before it goes into the HTML */
function esc(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** YYYY-MM-DD (or ISO) → MM/DD/YYYY, without a timezone shift */
function formatDate(value: string | null): string {
  if (!value) {
    return '-';
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : esc(value);
}

function formatAddress(address: PdfAddress): string {
  const parts: string[] = [];
  if (address.street) {
    parts.push(esc(address.street));
  }
  const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
  if (cityLine) {
    parts.push(esc(cityLine));
  }
  if (address.country && address.country !== 'US') {
    parts.push(esc(address.country));
  }
  return parts.join('<br>') || 'Address not provided';
}

export function generatePurchaseOrderHtml(data: PurchaseOrderPdfData): string {
  const logoBase64 = getGesherLogoBase64();
  const currency = data.currencyCode || 'USD';
  const money = (cents: number): string =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100);

  const showSupplierColumn = new Set(data.items.map((i) => i.supplierName).filter(Boolean)).size > 1;

  const itemsRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="text-align: center;">${item.rowNum}.</td>
        <td style="font-weight: 500;">${esc(item.sku)}</td>
        <td style="color: #374151;">${esc(item.description || '-')}</td>
        ${showSupplierColumn ? `<td style="color: #374151;">${esc(item.supplierName || '-')}</td>` : ''}
        <td style="text-align: center;">${item.quantity} ${esc(item.unitCode || '')}</td>
        <td style="text-align: right;">${money(item.unitPrice)}</td>
        <td style="text-align: right;">${money(item.lineTotal)}</td>
      </tr>`
    )
    .join('');

  const totalRows = [
    ['Subtotal', data.subtotal],
    ...(data.taxTotal ? [['Tax', data.taxTotal] as [string, number]] : []),
    ...(data.shippingCost ? [['Shipping', data.shippingCost] as [string, number]] : []),
  ]
    .map(
      ([label, value]) => `
      <div class="total-row sub">
        <span class="total-label">${label}</span>
        <span class="total-value">${money(value as number)}</span>
      </div>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Order - ${esc(data.poNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937; background: white; padding: 10px; line-height: 1.4;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .row { display: flex; margin-left: -10px; margin-right: -10px; align-items: flex-start; }
    .col-4 { flex: 0 0 33.333333%; max-width: 33.333333%; padding: 0 10px; }
    .col-6 { flex: 0 0 50%; max-width: 50%; padding: 0 10px; }
    .header { margin-bottom: 15px; padding-bottom: 10px; }
    .header-title { font-size: 20px; font-weight: 700; color: #2563eb; margin-bottom: 10px; letter-spacing: 0.5px; }
    .company-name { font-weight: 600; color: #111827; margin-bottom: 3px; font-size: 12px; }
    .company-address, .contact-info { color: #374151; font-size: 11px; line-height: 1.6; }
    .logo-wrapper { display: flex; justify-content: flex-end; }
    .logo-container { width: 100%; max-width: 280px; }
    .logo-container img { width: 100%; height: auto; display: block; }
    .info-section { background: #f3f4f6; }
    .party-section { border-bottom: dotted 1px black; }
    .box { background: #f3f4f6; padding: 12px 15px; }
    .box-title { font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 6px; }
    .box-content { color: #374151; font-size: 12px; line-height: 1.5; }
    .details-title { font-size: 12px; font-weight: 700; color: #111827; margin-bottom: 6px; }
    .details-row { font-size: 11px; color: #374151; margin-bottom: 3px; }
    .items-table { width: 100%; border-collapse: collapse; margin: 15px 0 20px; }
    .items-table thead { border-bottom: 2px solid #e5e7eb; }
    .items-table th { padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; color: #374151; }
    .items-table td { padding: 10px 12px; font-size: 11px; color: #111827; }
    .items-table tbody tr { border-bottom: 1px solid #e5e7eb; }
    .items-table tbody tr:last-child { border-bottom: none; }
    .total-section { text-align: right; padding: 10px 12px; border-top: 2px solid #e5e7eb; }
    .total-row { padding: 4px 0; font-size: 13px; }
    .total-row.sub { font-size: 11px; color: #374151; }
    .total-row.sub .total-label, .total-row.sub .total-value { font-weight: 500; font-size: 11px; }
    .total-label { font-weight: 700; color: #111827; margin-right: 40px; }
    .total-value { font-weight: 700; color: #111827; font-size: 14px; display: inline-block; min-width: 110px; }
    .notes { margin-top: 20px; font-size: 11px; color: #374151; }
    .notes-title { font-weight: 700; color: #111827; margin-bottom: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="row">
        <div class="col-6">
          <div class="header-title">PURCHASE ORDER</div>
          <div class="row">
            <div class="col-6">
              <div class="company-name">Gesher Distribution, Inc</div>
              <div class="company-address">
                11511 E Caley Ave<br>
                Attn: Travis Vap<br>
                Centennial, CO 80111-6935
              </div>
            </div>
            <div class="col-6">
              <div class="contact-info">
                accounting@partnerwithgdc.com<br>
                +1 (917) 374-7389<br>
                https://partnerwithgdc.com
              </div>
            </div>
          </div>
        </div>
        <div class="col-6">
          <div class="logo-wrapper">
            <div class="logo-container">
              ${logoBase64 ? `<img src="${logoBase64}" alt="GDC Logo" />` : `
                <div style="font-size: 64px; font-weight: 700; color: #1f2937; font-family: Georgia, serif;">GDC</div>
                <div style="font-size: 11px; color: #6b7280; letter-spacing: 2px; margin-top: 5px;">GESHER DISTRIBUTION INC.</div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-section">
      <div class="party-section">
        <div class="row">
          <div class="col-6">
            <div class="box">
              <div class="box-title">Supplier</div>
              <div class="box-content">
                ${data.supplierNames.length ? data.supplierNames.map(esc).join(', ') : 'Not assigned'}<br>
                ${formatAddress(data.vendorAddress)}
              </div>
            </div>
          </div>
          <div class="col-6">
            <div class="box">
              <div class="box-title">Ship to</div>
              <div class="box-content">
                ${data.shipToName ? `${esc(data.shipToName)}<br>` : ''}
                ${formatAddress(data.shipToAddress)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-4">
          <div class="box">
            <div class="details-title">Purchase Order details</div>
            <div class="details-row">PO no.: ${esc(data.poNumber)}</div>
            <div class="details-row">Date: ${formatDate(data.poDate)}</div>
          </div>
        </div>
        <div class="col-4">
          <div class="box">
            <div class="details-title">Delivery</div>
            <div class="details-row">Expected delivery: ${formatDate(data.expectedDeliveryDate)}</div>
            ${data.orderSeries ? `<div class="details-row">Order cycle: ${esc(data.orderSeries)}</div>` : ''}
          </div>
        </div>
        <div class="col-4">
          <div class="box">
            <div class="details-title">Sales Order</div>
            <div class="details-row">${data.salesOrderNumber ? esc(data.salesOrderNumber) : '-'}</div>
          </div>
        </div>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          <th style="width: 140px;">Product</th>
          <th>Description</th>
          ${showSupplierColumn ? '<th style="width: 120px;">Supplier</th>' : ''}
          <th style="width: 70px; text-align: center;">Qty</th>
          <th style="width: 90px; text-align: right;">Rate</th>
          <th style="width: 100px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <div class="total-section">
      ${totalRows}
      <div class="total-row">
        <span class="total-label">Total</span>
        <span class="total-value">${money(data.grandTotal)}</span>
      </div>
    </div>

    ${data.vendorNotes ? `
    <div class="notes">
      <div class="notes-title">Notes</div>
      <div>${esc(data.vendorNotes).replace(/\n/g, '<br>')}</div>
    </div>` : ''}
  </div>
</body>
</html>
  `;
}
