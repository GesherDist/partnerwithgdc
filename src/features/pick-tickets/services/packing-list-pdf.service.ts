/**
 * Packing List PDF Service
 *
 * Generates PDF from packing list data using Puppeteer.
 * Uses Ankur's Sales Order design pattern.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import { generatePackingListTemplateHtml, type PackingListPdfTemplateData } from '../templates/packing-list-pdf-template';

// Check if running in production/serverless or local development
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

export interface PackingListPdfData {
  packingListNumber: string;
  createdAt: string;
  status: string;
  packedAt: string | null;
  packedBy: string | null;

  pickTicketNumber: string;
  salesOrderNumber: string;
  customerName: string;
  customerPoNumber: string | null;
  shipToAddress: string;
  shipmentNumber: string | null;

  totalPackages: number;
  totalWeight: number | null;
  weightUnit: string;

  items: Array<{
    rowNum: number;
    sku: string;
    productName: string;
    packageNumber: number;
    quantityPacked: number;
    weight: number | null;
  }>;
  notes?: string | null;
}

/**
 * Generate Packing List PDF
 * Returns base64 encoded PDF
 */
export async function generatePackingListPdf(
  data: PackingListPdfData
): Promise<string> {
  const html = generatePackingListHtml(data);

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
 * Generate HTML from packing list data using Ankur's Sales Order design pattern
 */
function generatePackingListHtml(data: PackingListPdfData): string {
  // Map old data structure to new template data
  const templateData: PackingListPdfTemplateData = {
    packingListNumber: data.packingListNumber,
    createdAt: data.createdAt,
    status: data.status,
    packedAt: data.packedAt,
    packedBy: data.packedBy,
    pickTicketNumber: data.pickTicketNumber,
    salesOrderNumber: data.salesOrderNumber,
    shipmentNumber: data.shipmentNumber,
    customerName: data.customerName,
    customerPoNumber: data.customerPoNumber,
    shipToAddress: data.shipToAddress,
    totalPackages: data.totalPackages,
    totalWeight: data.totalWeight,
    weightUnit: data.weightUnit,
    items: data.items.map(item => ({
      rowNum: item.rowNum,
      sku: item.sku,
      productName: item.productName,
      packageNumber: item.packageNumber,
      quantityPacked: item.quantityPacked,
      weight: item.weight,
    })),
    notes: data.notes || null,
  };

  return generatePackingListTemplateHtml(templateData);
}
