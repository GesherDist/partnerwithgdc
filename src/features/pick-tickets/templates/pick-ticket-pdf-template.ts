/**
 * Pick Ticket PDF Template - Ankur's Design Pattern
 *
 * Clean, professional template matching Sales Order PDF design
 */

import { getGesherLogoBase64 } from '@/shared/lib/logo-utils';

export interface PickTicketPdfTemplateData {
  // Pick Ticket Information
  pickTicketNumber: string;
  createdAt: string;
  status: string;
  priority?: string;

  // Sales Order Information
  salesOrderNumber: string;
  customerName: string;
  customerPoNumber: string | null;

  // Warehouse Information
  warehouseName: string;
  warehouseCode: string;
  assignedTo: string | null;

  // Shipping Information
  shipToAddress: string;
  requiredDate: string | null;
  shippingMethod?: string | null;

  // Items
  items: Array<{
    rowNum: number;
    sku: string;
    productName: string;
    binLocation?: string;
    quantityToPick: number;
    quantityPicked?: number;
    uom: string;
  }>;

  // Additional
  notes?: string | null;
}

/**
 * Generate Pick Ticket HTML matching Ankur's Sales Order template
 */
export function generatePickTicketTemplateHtml(data: PickTicketPdfTemplateData): string {
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

  const formatAddress = (address: string): string => {
    // Format: "Street\nCity, State,\nZIP"
    // Keep city and state on same line, only break before ZIP
    const parts = address.split(',').map(p => p.trim());

    if (parts.length >= 3) {
      // Street, City, State ZIP format
      const street = parts[0];
      const city = parts[1];
      const stateZip = parts.slice(2).join(', ');
      return `${street}<br>${city}, ${stateZip}`;
    }

    // Fallback: replace all commas with breaks
    return address.replace(/,\s*/g, '<br>');
  };

  const extractShipToLocation = (address: string): string => {
    // Extract city and state for brief display
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3 && parts[2]) {
      // Return "City, State" (e.g., "Omaha, NE")
      const statePart = parts[2].split(' ')[0];
      return `${parts[1]}, ${statePart}`;
    }
    return parts.length >= 2 && parts[1] ? parts[1] : '-';
  };

  // Items table rows
  const itemsRows = data.items.map((item) => `
    <tr>
      <td style="text-align: center; color: #111827; font-size: 11px;">${item.rowNum}.</td>
      <td style="color: #111827; font-size: 11px; font-weight: 500;">
        ${item.sku}
      </td>
      <td style="color: #374151; font-size: 11px;">
        ${item.productName}
      </td>
      <td style="text-align: center; color: #111827; font-size: 11px;">
        ${item.binLocation || '-'}
      </td>
      <td style="text-align: center; color: #111827; font-size: 11px;">
        ${item.quantityToPick}
      </td>
      <td style="text-align: center; color: #374151; font-size: 11px;">
        ${item.uom}
      </td>
      <td style="text-align: center; color: #111827; font-size: 11px;">
        <div style="width: 18px; height: 18px; border: 2px solid #374151; display: inline-block; border-radius: 3px;"></div>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pick Ticket - ${data.pickTicketNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
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

    .col-3 { flex: 0 0 25%; max-width: 25%; }
    .col-4 { flex: 0 0 33.333333%; max-width: 33.333333%; }
    .col-6 { flex: 0 0 50%; max-width: 50%; }
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

    .info-section {
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

    /* Order Details Section */
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

    .items-table tbody tr {
      border-bottom: 1px solid #e5e7eb;
    }

    .items-table tbody tr:last-child {
      border-bottom: none;
    }

    .items-table tbody td {
      padding: 10px 12px;
    }

    /* Summary Section */
    .summary-section {
      text-align: right;
      padding: 10px 12px;
      border-top: 2px solid #e5e7eb;
      margin-bottom: 20px;
    }

    .summary-row {
      padding: 5px 0;
      font-size: 11px;
      color: #374151;
    }

    /* Notes Section */
    .notes-section {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
    }

    .notes-title {
      font-size: 11px;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .notes-text {
      font-size: 11px;
      color: #78350f;
      line-height: 1.6;
    }

    /* Signature Section */
    .signature-section {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .signature-box {
      display: inline-block;
      width: 45%;
      margin-right: 5%;
    }

    .signature-box:last-child {
      margin-right: 0;
    }

    .signature-line {
      border-bottom: 2px solid #111827;
      height: 50px;
      margin-bottom: 8px;
    }

    .signature-label {
      font-size: 10px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <!-- Row 1: PICK TICKET Title -->
      <div class="row">
        <div class="col-6">
          <div class="header-title">PICK TICKET</div>
          <!-- Company & Contact Info -->
          <div class="row">
            <!-- Col-6: Company & Address -->
            <div class="col-6">
              <div class="company-name">Gesher Distribution, Inc</div>
              <div class="company-address">
                11511 E Caley Ave<br>
                Attn: Travis Vap<br>
                Centennial, CO 80111-6935
              </div>
            </div>

            <!-- Col-6: Contact Info -->
            <div class="col-6">
              <div class="contact-info">
                accounting@partnerwithgdc.com<br>
                +1 (917) 374-7389<br>
                https://partnerwithgdc.com
              </div>
            </div>
          </div>
        </div>

        <!-- Col-6: Logo -->
        <div class="col-6" style="padding-top: 0; margin-top: 0;">
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

    <!-- Info Section: Warehouse Info | Order Info -->
    <div class="info-section">
      <div class="customer-section">
        <div class="row">
          <!-- Col-6: Warehouse Information -->
          <div class="col-6">
            <div class="customer-box">
              <div class="customer-box-title">Warehouse</div>
              <div class="customer-box-content">
                ${data.warehouseName}<br>
                Location Code: ${data.warehouseCode}<br>
                ${data.assignedTo ? `Assigned To: ${data.assignedTo}` : ''}
              </div>
            </div>
          </div>

          <!-- Col-6: Order Information -->
          <div class="col-6">
            <div class="customer-box">
              <div class="customer-box-title">Order Details</div>
              <div class="customer-box-content">
                Sales Order: ${data.salesOrderNumber}<br>
                Customer: ${data.customerName}<br>
                ${data.customerPoNumber ? `Customer PO: ${data.customerPoNumber}<br>` : ''}
                Customer address: ${formatAddress(data.shipToAddress)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pick Ticket Details Section: 3 Columns -->
      <div class="details-section">
        <div class="row">
          <!-- Col-4: Pick Ticket Info -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Pick Ticket</div>
              <div class="details-row">PT Number: ${data.pickTicketNumber}</div>
              <div class="details-row">Created: ${formatDate(data.createdAt)}</div>
              <div class="details-row">Status: ${data.status}</div>
            </div>
          </div>

          <!-- Col-4: Shipping Info -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Shipping Info</div>
              <div class="details-row">Ship To: ${extractShipToLocation(data.shipToAddress)}</div>
              <div class="details-row">Method: ${data.shippingMethod || 'Standard'}</div>
              <div class="details-row">Delivery: ${formatDate(data.requiredDate)}</div>
            </div>
          </div>

          <!-- Col-4: Additional Info -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Priority</div>
              <div class="details-row">${data.priority || 'Standard'}</div>
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
          <th style="width: 120px;">SKU</th>
          <th>Product Name</th>
          <th style="width: 100px;" class="text-center">Bin Location</th>
          <th style="width: 60px;" class="text-center">Qty</th>
          <th style="width: 50px;" class="text-center">UOM</th>
          <th style="width: 70px;" class="text-center">Picked</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Summary -->
    <div class="summary-section">
      <div class="summary-row">Total Items: ${data.items.length}</div>
      <div class="summary-row">Total Quantity: ${data.items.reduce((sum, item) => sum + item.quantityToPick, 0)}</div>
    </div>

    ${data.notes ? `
    <!-- Notes -->
    <div class="notes-section">
      <div class="notes-title">⚠️ Special Instructions</div>
      <div class="notes-text">${data.notes}</div>
    </div>
    ` : ''}

    <!-- Signature Section -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Picked By / Date</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Verified By / Date</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
