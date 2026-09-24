/**
 * Operations Dashboard PDF Export Utility
 *
 * Generates PDF reports from the dashboard with exact visual layout.
 * Uses html2canvas to capture the DOM and jspdf to generate PDF.
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// ============================================
// TYPES
// ============================================

export interface PDFExportOptions {
  filename?: string;
  title?: string;
  includeTimestamp?: boolean;
  quality?: number; // 1-4, higher = better quality but larger file
  orientation?: 'portrait' | 'landscape';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Suppress console errors temporarily during PDF generation
 * html2canvas throws errors for oklch colors which we can safely ignore
 */
function suppressConsoleErrors(): () => void {
  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';
    // Suppress oklch color parsing errors from html2canvas
    if (message.includes('oklch') || message.includes('color function')) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    const message = args[0]?.toString() || '';
    if (message.includes('oklch') || message.includes('color function')) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // Return restore function
  return () => {
    console.error = originalError;
    console.warn = originalWarn;
  };
}

// ============================================
// PDF EXPORT FUNCTIONS
// ============================================

/**
 * Export a DOM element to PDF
 */
export async function exportElementToPDF(
  element: HTMLElement,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    filename = 'operations-dashboard',
    title = 'Operations Dashboard Report',
    includeTimestamp = true,
    quality = 2,
    orientation = 'landscape',
  } = options;

  // Show loading state
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'visible';

  // Suppress console errors for oklch color warnings
  const restoreConsole = suppressConsoleErrors();

  try {
    // Capture the element as canvas
    const canvas = await html2canvas(element, {
      scale: quality,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (el) => {
        // Ignore elements that might cause issues
        return el.classList?.contains('pdf-ignore') ||
               el.classList?.contains('fixed') ||
               el.tagName === 'IFRAME';
      },
      // Ensure full capture including scrolled content
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    // Calculate PDF dimensions
    const imgWidth = orientation === 'landscape' ? 297 : 210; // A4 dimensions in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    // Add title and timestamp
    const pageWidth = pdf.internal.pageSize.getWidth();
    const date = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, 14, 15);

    if (includeTimestamp) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated: ${date}`, pageWidth - 14, 15, { align: 'right' });
    }

    // Add image
    const imgData = canvas.toDataURL('image/png');
    const startY = 22;
    const availableHeight = pdf.internal.pageSize.getHeight() - startY - 10;

    // Check if content fits on one page
    if (imgHeight <= availableHeight) {
      // Fits on one page
      pdf.addImage(imgData, 'PNG', 7, startY, imgWidth - 14, imgHeight);
    } else {
      // Multiple pages needed
      let remainingHeight = canvas.height;
      let yPosition = 0;
      let pageNum = 0;

      const pageHeightPx = (availableHeight / imgWidth) * canvas.width;

      while (remainingHeight > 0) {
        if (pageNum > 0) {
          pdf.addPage();
          // Add header on each page
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(128, 128, 128);
          pdf.text(`${title} - Page ${pageNum + 1}`, 14, 10);
        }

        // Create a canvas for this page slice
        const pageCanvas = document.createElement('canvas');
        const ctx = pageCanvas.getContext('2d');

        const sliceHeight = Math.min(pageHeightPx, remainingHeight);
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        if (ctx) {
          ctx.drawImage(
            canvas,
            0, yPosition,
            canvas.width, sliceHeight,
            0, 0,
            canvas.width, sliceHeight
          );

          const sliceData = pageCanvas.toDataURL('image/png');
          const sliceImgHeight = (sliceHeight * (imgWidth - 14)) / canvas.width;

          pdf.addImage(
            sliceData,
            'PNG',
            7,
            pageNum === 0 ? startY : 15,
            imgWidth - 14,
            sliceImgHeight
          );
        }

        yPosition += sliceHeight;
        remainingHeight -= sliceHeight;
        pageNum++;
      }
    }

    // Add footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 5,
        { align: 'center' }
      );
    }

    // Generate filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const finalFilename = `${filename}-${dateStr}.pdf`;

    // Download PDF
    pdf.save(finalFilename);
  } finally {
    document.body.style.overflow = originalOverflow;
    restoreConsole();
  }
}

/**
 * Export the operations dashboard content to PDF
 * This finds the main dashboard content and exports it
 */
export async function exportDashboardToPDF(
  containerId: string = 'operations-dashboard-content',
  options: PDFExportOptions = {}
): Promise<void> {
  const element = document.getElementById(containerId);

  if (!element) {
    console.error(`Element with id "${containerId}" not found`);
    throw new Error('Dashboard content not found');
  }

  await exportElementToPDF(element, {
    filename: 'operations-dashboard-report',
    title: 'Operations Dashboard Report',
    orientation: 'landscape',
    ...options,
  });
}

/**
 * Export a specific tab content to PDF
 */
export async function exportTabToPDF(
  tabName: string,
  options: PDFExportOptions = {}
): Promise<void> {
  // Find the active tab content
  const tabContent = document.querySelector('[data-state="active"][role="tabpanel"]') as HTMLElement;

  if (!tabContent) {
    console.error('Active tab content not found');
    throw new Error('Tab content not found');
  }

  const titles: Record<string, string> = {
    'executive-summary': 'Executive Summary Report',
    'shipment-overview': 'Shipment Overview Report',
    'supplier-schedule': 'Supplier Schedule Report',
    'gdc1-inventory': 'GDC 1 Inventory Report',
  };

  await exportElementToPDF(tabContent, {
    filename: `operations-${tabName}`,
    title: titles[tabName] || 'Operations Report',
    orientation: tabName === 'executive-summary' ? 'portrait' : 'landscape',
    ...options,
  });
}

/**
 * Export full page (all visible content) to PDF
 */
export async function exportFullPageToPDF(
  options: PDFExportOptions = {}
): Promise<void> {
  // Find the dashboard content by ID first
  let mainContent = document.getElementById('operations-dashboard-content') as HTMLElement;

  // Fallback to other selectors
  if (!mainContent) {
    mainContent = document.querySelector('main') as HTMLElement ||
                  document.querySelector('.flex.flex-col.gap-6.p-6') as HTMLElement;
  }

  if (!mainContent) {
    console.error('Main content not found');
    throw new Error('Page content not found');
  }

  await exportElementToPDF(mainContent, {
    filename: 'operations-dashboard-full',
    title: 'Operations Dashboard - Full Report',
    orientation: 'landscape',
    quality: 2,
    ...options,
  });
}
