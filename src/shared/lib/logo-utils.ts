/**
 * Logo Utilities
 *
 * Provides base64 encoded Gesher Distribution logo for PDF generation
 */

import fs from 'fs';
import path from 'path';

/**
 * Get Gesher Distribution logo as base64 data URI
 *
 * This is used in PDF generation where we need to embed the logo directly
 * in the HTML as PDFs can't load external images reliably
 */
export function getGesherLogoBase64(): string {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'assets', 'gesher-logo.png');

    // Check if file exists
    if (!fs.existsSync(logoPath)) {
      console.warn('Logo file not found at:', logoPath);
      return ''; // Return empty string if logo not found
    }

    // Read file and convert to base64
    const logoBuffer = fs.readFileSync(logoPath);
    const base64Logo = logoBuffer.toString('base64');

    // Return as data URI
    return `data:image/png;base64,${base64Logo}`;
  } catch (error) {
    console.error('Error loading logo:', error);
    return ''; // Return empty string on error
  }
}

/**
 * Get fallback SVG logo (text-based GDC logo)
 * Used when image logo is not available
 */
export function getFallbackLogoSvg(): string {
  return `
    <svg width="60" height="60" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" rx="16" fill="#23604c"/>
      <text x="100" y="110" font-family="Arial, sans-serif" font-size="80"
            font-weight="bold" fill="white" text-anchor="middle"
            dominant-baseline="middle">GD</text>
    </svg>
  `;
}
