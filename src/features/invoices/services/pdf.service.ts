/**
 * Invoice PDF Service
 *
 * Generates PDF from invoice data using Puppeteer.
 * Similar to Sales Order PDF but for invoices.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

import { generateInvoiceHtml, type InvoicePdfData } from './pdf-template';

// Re-export the type so it can be imported from this module
export type { InvoicePdfData };

// Check if running in production/serverless or local development
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

/**
 * Generate Invoice PDF
 * Returns base64 encoded PDF
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<string> {
  const html = generateInvoiceHtml(data);

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
