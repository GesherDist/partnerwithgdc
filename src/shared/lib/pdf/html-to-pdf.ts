/**
 * HTML to PDF
 *
 * Shared Puppeteer renderer for the document PDFs (pick ticket, packing list,
 * sales order). Server-side only.
 *
 * Locally it drives an installed Chrome; on Vercel/Lambda it uses the bundled
 * @sparticuz/chromium binary.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

/**
 * Locate a usable Chrome on the local machine.
 */
async function findLocalChrome(): Promise<string> {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH,
  ].filter((path): path is string => Boolean(path));

  const fs = await import('fs');

  for (const path of possiblePaths) {
    try {
      if (fs.existsSync(path)) {
        return path;
      }
    } catch {
      // Try the next candidate
    }
  }

  throw new Error(
    'Chrome not found. Please install Chrome or set CHROME_PATH environment variable.'
  );
}

/**
 * Render an HTML document to a base64-encoded A4 PDF.
 */
export async function htmlToPdfBase64(html: string): Promise<string> {
  let browser = null;

  try {
    if (isProduction) {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      browser = await puppeteer.launch({
        executablePath: await findLocalChrome(),
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
