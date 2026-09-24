/**
 * Pick Ticket PDF Service
 *
 * Generates PDF from pick ticket data using Puppeteer.
 * Uses the Gesher Distribution theme template.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import { generatePickTicketTemplateHtml, type PickTicketPdfTemplateData } from '../templates/pick-ticket-pdf-template';

// Check if running in production/serverless or local development
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

export interface PickTicketPdfData {
  pickTicketNumber: string;
  createdAt: string;
  salesOrderNumber: string;
  customerName: string;
  shipToAddress: string;
  requiredDate: string | null;
  shippingMethod: string | null;
  warehouseName: string;
  warehouseCode: string;
  assignedTo: string | null;
  status?: string;
  totalWeight?: number;
  items: Array<{
    rowNum: number;
    sku: string;
    productName: string;
    binLocation?: string;
    quantity: number;
    uom: string;
    weight?: number;
  }>;
  notes?: string | null;
  customerPoNumber?: string | null;
}

/**
 * Generate Pick Ticket PDF
 * Returns base64 encoded PDF
 */
export async function generatePickTicketPdf(data: PickTicketPdfData): Promise<string> {
  const html = generatePickTicketHtml(data);

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
            const fs = await import('fs');
            if (fs.existsSync(path)) {
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
 * Generate HTML from pick ticket data using Ankur's Sales Order design pattern
 */
function generatePickTicketHtml(data: PickTicketPdfData): string {
  // Map old data structure to new template data
  const templateData: PickTicketPdfTemplateData = {
    pickTicketNumber: data.pickTicketNumber,
    createdAt: data.createdAt,
    status: data.status || 'pending',
    priority: 'Standard',
    salesOrderNumber: data.salesOrderNumber,
    customerName: data.customerName,
    customerPoNumber: data.customerPoNumber || null,
    warehouseName: data.warehouseName,
    warehouseCode: data.warehouseCode,
    assignedTo: data.assignedTo,
    shipToAddress: data.shipToAddress,
    requiredDate: data.requiredDate,
    shippingMethod: data.shippingMethod,
    items: data.items.map(item => ({
      rowNum: item.rowNum,
      sku: item.sku,
      productName: item.productName,
      binLocation: item.binLocation,
      quantityToPick: item.quantity,
      quantityPicked: undefined,
      uom: item.uom,
    })),
    notes: data.notes || null,
  };

  return generatePickTicketTemplateHtml(templateData);
}
