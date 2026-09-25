/**
 * Invoice PDF Template
 *
 * Clean, professional template for invoices (similar to Sales Order design)
 */

import { getGesherLogoBase64 } from '@/shared/lib/logo-utils';

export interface InvoicePdfData {
  // Invoice Information
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  salesOrderNumber: string | null;
  customerPoNumber: string | null;
  status: string;

  // Customer Information
  customerName: string;
  customerCode: string;
  customerEmail?: string | null;
  customerPhone?: string | null;

  // Addresses
  billingAddress: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };
  shippingAddress: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  };

  // Invoice Items
  items: Array<{
    rowNum: number;
    sku: string;
    description: string;
    quantity: number;
    unitCode: string;
    unitPrice: number; // in cents
    discountPercent: number;
    lineTotal: number; // in cents
    allocations?: Array<{
      source: string;
      locationName: string | null;
      quantity: number;
    }>;
  }>;

  // Totals (in cents)
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCost: number;
  grandTotal: number;
  amountPaid: number;
  amountDue: number;

  // Additional
  customerNotes?: string | null;
  paymentTerms?: string | null;
}

/**
 * Generate Invoice HTML
 */
export function generateInvoiceHtml(data: InvoicePdfData): string {
  const logoBase64 = getGesherLogoBase64();

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const formatAddress = (address: {
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  }): string => {
    const parts = [];
    if (address.street) parts.push(address.street);
    const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
    if (cityLine) parts.push(cityLine);
    if (address.country && address.country !== 'US') parts.push(address.country);
    return parts.join('<br>') || 'Address not provided';
  };

  // Items table rows with allocation breakdown
  const itemsRows = data.items.map((item) => {
    const mainRow = `
      <tr>
        <td style="text-align: center; color: #111827; font-size: 11px;">${item.rowNum}.</td>
        <td style="color: #111827; font-size: 11px; font-weight: 500;">
          ${item.description || '-'} (${item.sku})
        </td>
        <td style="color: #374151; font-size: 11px;">
          ${item.description || '-'}
        </td>
        <td style="text-align: center; color: #111827; font-size: 11px;">
          ${item.quantity}
        </td>
        <td style="text-align: right; color: #111827; font-size: 11px;">
          ${formatCurrency(item.unitPrice)}
        </td>
        <td style="text-align: right; color: #111827; font-size: 11px;">
          ${formatCurrency(item.lineTotal)}
        </td>
      </tr>
    `;

    // Add allocation breakdown rows if allocations exist
    const allocationRows = item.allocations && item.allocations.length > 0
      ? item.allocations.map((allocation) => `
          <tr style="background-color: #f9fafb;">
            <td></td>
            <td colspan="2" style="padding-left: 30px; color: #6b7280; font-size: 10px; font-style: italic;">
              → ${allocation.source}${allocation.locationName ? ` (${allocation.locationName})` : ''}
            </td>
            <td style="text-align: center; color: #6b7280; font-size: 10px; font-style: italic;">
              ${allocation.quantity}
            </td>
            <td></td>
            <td></td>
          </tr>
        `).join('')
      : '';

    return mainRow + allocationRows;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice - ${data.invoiceNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 30px;
      color: #1f2937;
      background: white;
      padding: 10px 10px;
      line-height: 1.4;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    /* Bootstrap-style Grid System */
    .row {
      display: flex;
      flex-wrap: wrap;
      margin-left: -10px;
      margin-right: -10px;
      align-items: flex-start;
    }

    .col-1 { flex: 0 0 8.333333%; max-width: 8.333333%; }
    .col-2 { flex: 0 0 16.666667%; max-width: 16.666667%; }
    .col-3 { flex: 0 0 25%; max-width: 25%; }
    .col-4 { flex: 0 0 33.333333%; max-width: 33.333333%; }
    .col-5 { flex: 0 0 41.666667%; max-width: 41.666667%; }
    .col-6 { flex: 0 0 50%; max-width: 50%; }
    .col-7 { flex: 0 0 58.333333%; max-width: 58.333333%; }
    .col-8 { flex: 0 0 66.666667%; max-width: 66.666667%; }
    .col-9 { flex: 0 0 75%; max-width: 75%; }
    .col-10 { flex: 0 0 83.333333%; max-width: 83.333333%; }
    .col-11 { flex: 0 0 91.666667%; max-width: 91.666667%; }
    .col-12 { flex: 0 0 100%; max-width: 100%; }

    [class*="col-"] {
      padding-left: 10px;
      padding-right: 10px;
      align-self: flex-start;
    }

    /* Header */
    .header {
      margin-bottom: 15px;
      padding-bottom: 10px;
    }

    .header-title {
      font-size: 20px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 10px;
      letter-spacing: 0.5px;
    }

    .company-name {
      font-weight: 600;
      color: #111827;
      margin-bottom: 3px;
      font-size: 12px;
    }

    .company-address {
      color: #374151;
      font-size: 11px;
      line-height: 1.5;
      margin-bottom: 0;
    }

    .contact-info {
      font-size: 11px;
      color: #374151;
      line-height: 1.6;
      text-align: left;
      padding-top: 0;
    }

    .logo-wrapper {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      margin: 0;
      padding: 0;
      line-height: 1;
    }

    .logo-container {
      width: 100%;
      max-width: 280px;
      margin: 0;
      padding: 0;
      line-height: 1;
    }

    .logo-container img {
      width: 100%;
      height: auto;
      display: block;
      margin-top: 0;
      padding-top: 0;
    }

    /* Customer Section */
    .customer-section {
      border-bottom: dotted 1px black;
    }

    .info-section{
      background: #f3f4f6;
    }

    .customer-box {
      background: #f3f4f6;
      padding: 12px 15px;
      border-radius: 0;
    }

    .customer-box-title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
    }

    .customer-box-content {
      color: #374151;
      font-size: 12px;
      line-height: 1.5;
      font-weight: 400;
    }

    /* Details Section */
    .details-section {
      margin-bottom: 30px;
    }

    .details-box {
      background: #f3f4f6;
      padding: 12px 15px;
      border-radius: 0;
    }

    .details-title {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
    }

    .details-row {
      font-size: 11px;
      color: #374151;
      margin-bottom: 3px;
      line-height: 1.4;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      margin-top: 15px;
    }

    .items-table thead {
      background: white;
      border-bottom: 2px solid #e5e7eb;
    }

    .items-table th {
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      color: #374151;
    }

    .items-table th.text-center {
      text-align: center;
    }

    .items-table th.text-right {
      text-align: right;
    }

    .items-table tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }

    .items-table tbody tr:last-child {
      border-bottom: none;
    }

    .items-table tbody td {
      padding: 10px 12px;
    }

    /* Total Section */
    .total-section {
      text-align: right;
      padding: 10px 12px;
      border-top: 2px solid #e5e7eb;
    }

    .total-row {
      padding: 5px 0;
      font-size: 13px;
    }

    .total-label {
      font-weight: 600;
      color: #111827;
      margin-right: 40px;
    }

    .total-value {
      font-weight: 600;
      color: #111827;
      font-size: 13px;
    }

    .total-row.grand {
      border-top: 2px solid #e5e7eb;
      margin-top: 10px;
      padding-top: 10px;
    }

    .total-row.grand .total-label,
    .total-row.grand .total-value {
      font-weight: 700;
      font-size: 14px;
    }

    .total-row.due {
      background: #fef3c7;
      padding: 10px;
      margin-top: 10px;
    }

    .total-row.due .total-label,
    .total-row.due .total-value {
      font-weight: 700;
      font-size: 15px;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="row">
        <div class="col-6">
          <div class="header-title">INVOICE</div>
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
        <div class="col-6" style="padding-top: 0; margin-top: 0;">
          <div class="logo-wrapper">
            <div class="logo-container">
              ${logoBase64 ? `<img src="${logoBase64}" alt="GDC Logo" />` : `
                <div style="font-size: 64px; font-weight: 700; color: #1f2937; font-family: Georgia, serif; margin-top: 0; padding-top: 0;">GDC</div>
                <div style="font-size: 11px; color: #6b7280; letter-spacing: 2px; margin-top: 5px;">GESHER DISTRIBUTION INC.</div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Customer Section -->
    <div class="info-section">
      <div class="customer-section">
        <div class="row">
          <div class="col-6">
            <div class="customer-box">
              <div class="customer-box-title">Bill to</div>
              <div class="customer-box-content">
                ${data.customerName}<br>
                ${formatAddress(data.billingAddress)}
              </div>
            </div>
          </div>
          <div class="col-6">
            <div class="customer-box">
              <div class="customer-box-title">Ship to</div>
              <div class="customer-box-content">
                ${data.customerName}<br>
                ${formatAddress(data.shippingAddress)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Invoice Details -->
      <div class="details-section">
        <div class="row">
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Invoice details</div>
              <div class="details-row">Invoice no.: ${data.invoiceNumber}</div>
              <div class="details-row">Invoice date: ${formatDate(data.invoiceDate)}</div>
              <div class="details-row">Terms: ${data.paymentTerms || 'Net 30'}</div>
            </div>
          </div>
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Due date</div>
              <div class="details-row" style="font-weight: 700; color: #dc2626;">
                ${formatDate(data.dueDate)}
              </div>
            </div>
          </div>
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Reference</div>
              <div class="details-row">Sales Order: ${data.salesOrderNumber || '-'}</div>
              <div class="details-row">Customer PO: ${data.customerPoNumber || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 30px;" class="text-center">#</th>
          <th style="width: 180px;">Product or service</th>
          <th>Description</th>
          <th style="width: 50px;" class="text-center">Qty</th>
          <th style="width: 90px;" class="text-right">Rate</th>
          <th style="width: 100px;" class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="total-section">
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">${formatCurrency(data.subtotal)}</span>
      </div>
      ${data.discountTotal > 0 ? `
      <div class="total-row">
        <span class="total-label">Discount</span>
        <span class="total-value">-${formatCurrency(data.discountTotal)}</span>
      </div>
      ` : ''}
      ${data.taxTotal > 0 ? `
      <div class="total-row">
        <span class="total-label">Tax</span>
        <span class="total-value">${formatCurrency(data.taxTotal)}</span>
      </div>
      ` : ''}
      ${data.shippingCost > 0 ? `
      <div class="total-row">
        <span class="total-label">Shipping</span>
        <span class="total-value">${formatCurrency(data.shippingCost)}</span>
      </div>
      ` : ''}
      <div class="total-row grand">
        <span class="total-label">Total</span>
        <span class="total-value">${formatCurrency(data.grandTotal)}</span>
      </div>
      ${data.amountPaid > 0 ? `
      <div class="total-row">
        <span class="total-label">Amount Paid</span>
        <span class="total-value">-${formatCurrency(data.amountPaid)}</span>
      </div>
      ` : ''}
      <div class="total-row due">
        <span class="total-label">Amount Due</span>
        <span class="total-value">${formatCurrency(data.amountDue)}</span>
      </div>
    </div>

    ${data.customerNotes ? `
    <div style="margin-top: 30px; padding: 15px; background: #f9fafb; border-left: 3px solid #2563eb;">
      <div style="font-size: 12px; font-weight: 600; color: #111827; margin-bottom: 5px;">Notes:</div>
      <div style="font-size: 11px; color: #374151; line-height: 1.6;">${data.customerNotes}</div>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `;
}
