/**
 * Dealer Allocation PDF Generation Service
 *
 * Generates PDF for items allocated to a specific platinum dealer
 * Uses the SAME format as Sales Order PDF for consistency
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { existsSync } from 'fs';
import { getGesherLogoBase64 } from '@/shared/lib/logo-utils';

export interface DealerAllocationPdfItem {
  sku: string;
  description: string;
  quantity: number;
  fulfillmentSource: 'platinum_dealer_inventory' | 'platinum_dealer_fulfillment';
  locationName?: string;
  locationAddress?: string;
  notes?: string;
}

export interface DealerAllocationPdfData {
  // Sales Order info
  salesOrderNumber: string;
  salesOrderDate: string;
  customerName: string;
  customerPoNumber?: string;
  requestedDeliveryDate?: string;

  // Customer address
  customerAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  // Dealer info
  dealerName: string;
  dealerContactName?: string;
  dealerEmail: string;

  // Allocated items (ONLY items for this dealer)
  items: DealerAllocationPdfItem[];

  // Optional notes
  specialInstructions?: string;
}

// Check if running in production/serverless or local development
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

/**
 * Generate dealer allocation PDF
 * Returns base64 encoded PDF
 */
export async function generateDealerAllocationPdf(
  data: DealerAllocationPdfData
): Promise<string> {
  const html = generateDealerAllocationHtml(data);

  let browser = null;

  try {
    // Launch browser - different config for local vs production
    if (isProduction) {
      // Serverless environment (Vercel, AWS Lambda)
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Local development - use installed Chrome
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.CHROME_PATH,
      ].filter(Boolean);

      let executablePath: string | undefined;
      for (const path of possiblePaths) {
        if (path) {
          try {
            if (existsSync(path)) {
              executablePath = path;
              break;
            }
          } catch {
            // Continue to next path
          }
        }
      }

      if (!executablePath) {
        throw new Error('Chrome not found. Please install Chrome or set CHROME_PATH environment variable.');
      }

      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    return Buffer.from(pdfBuffer).toString('base64');
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Generate HTML for dealer allocation PDF
 * Uses EXACT SAME CSS/format as Sales Order PDF
 */
function generateDealerAllocationHtml(data: DealerAllocationPdfData): string {
  const logoBase64 = getGesherLogoBase64();

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const formatAddress = (address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }): string => {
    if (!address) return '-';
    const parts = [];
    if (address.street) parts.push(address.street);
    const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
    if (cityLine) parts.push(cityLine);
    if (address.country && address.country !== 'US') parts.push(address.country);
    return parts.join('<br>') || '-';
  };

  // Calculate total quantity
  const totalQuantity = data.items.reduce((sum, item) => sum + item.quantity, 0);

  // Items table rows (with Source column)
  const itemsRows = data.items
    .map(
      (item, index) => `
    <tr>
      <td style="text-align: center; color: #111827; font-size: 11px;">${index + 1}.</td>
      <td style="color: #111827; font-size: 11px; font-weight: 500;">
        ${item.description || item.sku}
      </td>
      <td style="color: #374151; font-size: 11px;">
        ${item.sku}
      </td>
      <td style="text-align: center; color: #111827; font-size: 11px;">
        ${item.fulfillmentSource === 'platinum_dealer_inventory' ? 'Inventory' : 'Fulfillment'}
      </td>
      <td style="text-align: right; color: #111827; font-size: 11px; font-weight: 600;">
        ${item.quantity}
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Allocation - ${data.salesOrderNumber}</title>
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

    .details-label {
      color: #6b7280;
    }

    .customer-po-box {
      background: #f3f4f6;
      padding: 12px 15px;
      border-radius: 0;
    }

    .customer-po-label {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 6px;
    }

    .customer-po-text {
      font-size: 11px;
      color: #374151;
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
      font-weight: 700;
      color: #111827;
      margin-right: 40px;
    }

    .total-value {
      font-weight: 700;
      color: #111827;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <!-- Row 1: ORDER ALLOCATION Title (Col-12) -->
      <div class="row">
        <div class="col-6">
            <div class="header-title">ORDER ALLOCATION</div>
            <!-- Row 2: Address + Contact + Logo -->
            <div class="row">
              <!-- Col-3: Company & Address -->
              <div class="col-6">
                <div class="company-name">Gesher Distribution, Inc</div>
                <div class="company-address">
                  11511 E Caley Ave<br>
                  Attn: Travis Vap<br>
                  Centennial, CO 80111-6935
                </div>
              </div>

              <!-- Col-3: Contact Info -->
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
                <div style="font-size: 64px; font-weight: 700; color: #1f2937; font-family: Georgia, serif; margin-top: 0; padding-top: 0;">GDC</div>
                <div style="font-size: 11px; color: #6b7280; letter-spacing: 2px; margin-top: 5px;">GESHER DISTRIBUTION INC.</div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Dealer & Order Info Section -->
    <div class="info-section">
      <div class="customer-section">
        <div class="row">
          <!-- Col-4: Bill To (Gesher) -->
          <div class="col-4">
            <div class="customer-box">
              <div class="customer-box-title">Bill To</div>
              <div class="customer-box-content">
                <strong>Travis Vap</strong><br>
                Gesher Distribution, Inc<br>
                11511 E Caley Ave<br>
                Centennial, CO 80111-6935
              </div>
            </div>
          </div>

          <!-- Col-4: Dealer Info -->
          <div class="col-4">
            <div class="customer-box">
              <div class="customer-box-title">Assigned Dealer</div>
              <div class="customer-box-content">
                <strong>${data.dealerName}</strong><br>
                ${data.dealerContactName ? `Contact: ${data.dealerContactName}<br>` : ''}
                Email: ${data.dealerEmail}
              </div>
            </div>
          </div>

          <!-- Col-4: Customer Info -->
          <div class="col-4">
            <div class="customer-box">
              <div class="customer-box-title">End Customer</div>
              <div class="customer-box-content">
                ${data.customerName}<br>
                ${formatAddress(data.customerAddress)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Order Details Section: 3 Columns -->
      <div class="details-section">
        <div class="row">
          <!-- Col-4: Sales Order info -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Sales Order info</div>
              <div class="details-row">SO Number: ${data.salesOrderNumber}</div>
              <div class="details-row">Date: ${formatDate(data.salesOrderDate)}</div>
            </div>
          </div>

          <!-- Col-4: Delivery info -->
          <div class="col-4">
            <div class="details-box">
              <div class="details-title">Delivery info</div>
              <div class="details-row">
                ${data.requestedDeliveryDate ? `Requested: ${formatDate(data.requestedDeliveryDate)}` : 'Date: TBD'}
              </div>
            </div>
          </div>

          <!-- Col-4: Customer PO -->
          <div class="col-4">
            <div class="customer-po-box">
              <div class="customer-po-label">Customer PO:</div>
              <div class="customer-po-text">${data.customerPoNumber || '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50px;" class="text-center">#</th>
          <th style="width: 180px;">Product name</th>
          <th>Description</th>
          <th style="width: 120px;" class="text-center">Source</th>
          <th style="width: 100px;" class="text-right">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Total -->
    <div class="total-section">
      <div class="total-row">
        <span class="total-label">Total Allocated</span>
        <span class="total-value">${totalQuantity} units</span>
      </div>
    </div>

    ${
      data.specialInstructions
        ? `
    <!-- Special Instructions -->
    <div style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 12px 16px; margin-top: 16px; border-radius: 4px;">
      <div style="font-size: 12px; font-weight: 600; color: #92400e; margin-bottom: 6px;">Special Instructions:</div>
      <div style="font-size: 11px; color: #78350f; line-height: 1.5;">${data.specialInstructions}</div>
    </div>
    `
        : ''
    }
  </div>
</body>
</html>
  `.trim();
}
