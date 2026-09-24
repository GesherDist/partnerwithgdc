/**
 * Packing List PDF Template - Ankur's Design Pattern
 *
 * Clean, professional template matching Sales Order PDF design
 */

import { getGesherLogoBase64 } from '@/shared/lib/logo-utils';

export interface PackingListPdfTemplateData {
  // Packing List Information
  packingListNumber: string;
  createdAt: string;
  status: string;
  packedAt: string | null;
  packedBy: string | null;

  // Related Documents
  pickTicketNumber: string;
  salesOrderNumber: string;
  shipmentNumber: string | null;

  // Customer Information
  customerName: string;
  customerPoNumber: string | null;
  shipToAddress: string;

  // Package Information
  totalPackages: number;
  totalWeight: number | null;
  weightUnit: string;

  // Items (grouped by package)
  items: Array<{
    rowNum: number;
    sku: string;
    productName: string;
    packageNumber: number;
    quantityPacked: number;
    weight: number | null;
  }>;

  // Additional
  notes?: string | null;
}

/**
 * Generate Packing List HTML matching Ankur's Sales Order template
 */
export function generatePackingListTemplateHtml(data: PackingListPdfTemplateData): string {
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
    return address.replace(/,\s*/g, '<br>');
  };

  const formatWeight = (weight: number | null): string =>
    weight === null ? '-' : `${weight} ${data.weightUnit}`;

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  // Group items by package
  const packageNumbers = Array.from(
    new Set(data.items.map((item) => item.packageNumber))
  ).sort((a, b) => a - b);

  const packageSections = packageNumbers
    .map((packageNumber) => {
      const packageItems = data.items.filter(
        (item) => item.packageNumber === packageNumber
      );

      const rows = packageItems
        .map(
          (item) => `
    <tr>
      <td style="text-align: center; color: #111827; font-size: 11px;">${item.rowNum}.</td>
      <td style="color: #111827; font-size: 11px; font-weight: 500;">${escapeHtml(item.sku)}</td>
      <td style="color: #374151; font-size: 11px;">${escapeHtml(item.productName)}</td>
      <td style="text-align: center; color: #111827; font-size: 11px;">${item.quantityPacked}</td>
      <td style="text-align: center; color: #374151; font-size: 11px;">${formatWeight(item.weight)}</td>
      <td style="text-align: center;">
        <div style="width: 18px; height: 18px; border: 2px solid #374151; display: inline-block; border-radius: 3px;"></div>
      </td>
    </tr>
  `
        )
        .join('');

      return `
    <div style="margin-bottom: 20px;">
      <div style="background: #2563eb; color: white; padding: 8px 15px; font-size: 12px; font-weight: 600; border-radius: 4px 4px 0 0;">
        Package ${packageNumber} (${packageItems.length} items, ${packageItems.reduce((sum, item) => sum + item.quantityPacked, 0)} units)
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 30px;" class="text-center">#</th>
            <th style="width: 120px;">SKU</th>
            <th>Product Name</th>
            <th style="width: 70px;" class="text-center">Qty</th>
            <th style="width: 90px;" class="text-center">Weight</th>
            <th style="width: 70px;" class="text-center">Checked</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
    })
    .join('');

  const totalQty = data.items.reduce((sum, item) => sum + item.quantityPacked, 0);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Packing List - ${escapeHtml(data.packingListNumber)}</title>
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
      margin-bottom: 5px;
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
      <!-- Row 1: PACKING LIST Title -->
      <div class="row">
        <div class="col-6">
          <div class="header-title">PACKING LIST</div>
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

    <!-- Info Section: Order Info | Packing Info -->
    <div class="info-section">
      <div class="customer-section">
        <div class="row">
          <!-- Col-6: Order Information -->
          <div class="col-6">
            <div class="customer-box">
              <div class="customer-box-title">Order Information</div>
              <div class="customer-box-content">
                Sales Order: ${data.salesOrderNumber}<br>
                Pick Ticket: ${data.pickTicketNumber}<br>
                Customer: ${data.customerName}<br>
                ${data.customerPoNumber ? `Customer PO: ${data.customerPoNumber}<br>` : ''}
                Ship To: ${formatAddress(data.shipToAddress)}
              </div>
            </div>
          </div>

          <!-- Col-6: Packing Information -->
          <div class="col-6">
            <div class="customer-box">
              <div class="customer-box-title">Packing Information</div>
              <div class="customer-box-content">
                Packing List: ${data.packingListNumber}<br>
                Total Packages: ${data.totalPackages}<br>
                Total Weight: ${formatWeight(data.totalWeight)}<br>
                Packed At: ${formatDate(data.packedAt)}<br>
                Packed By: ${data.packedBy || '-'}
                ${data.shipmentNumber ? `<br>Shipment: ${data.shipmentNumber}` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Packing List Details Section -->
      <div class="details-section">
        <div class="row">
          <!-- Col-4: Document Info -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Document Details</div>
              <div class="details-row">PL Number: ${data.packingListNumber}</div>
              <div class="details-row">Created: ${formatDate(data.createdAt)}</div>
              <div class="details-row">Status: ${data.status}</div>
            </div>
          </div>

          <!-- Col-4: Package Summary -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Package Summary</div>
              <div class="details-row">Total Packages: ${data.totalPackages}</div>
              <div class="details-row">Total Items: ${data.items.length}</div>
              <div class="details-row">Total Quantity: ${totalQty}</div>
            </div>
          </div>

          <!-- Col-4: Shipment Info -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Shipment</div>
              <div class="details-row">${data.shipmentNumber || 'Not shipped yet'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Package Sections -->
    <div style="margin-top: 15px;">
      ${packageSections}
    </div>

    <!-- Summary -->
    <div class="summary-section">
      <div class="summary-row">Total Packages: ${data.totalPackages}</div>
      <div class="summary-row">Total Items: ${data.items.length}</div>
      <div class="summary-row">Total Quantity: ${totalQty}</div>
      <div class="summary-row">Total Weight: ${formatWeight(data.totalWeight)}</div>
    </div>

    ${data.notes ? `
    <!-- Notes -->
    <div class="notes-section">
      <div class="notes-title">📝 Notes</div>
      <div class="notes-text">${escapeHtml(data.notes)}</div>
    </div>
    ` : ''}

    <!-- Signature Section -->
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Packed By / Date</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">Received By / Date</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
