/**
 * PDF to Images Converter
 *
 * Converts PDF pages to base64 PNG images using pdfjs-dist.
 * Runs client-side in the browser only.
 */

// ============================================
// CONSTANTS
// ============================================

const MAX_PAGES = 5;
const RENDER_SCALE = 2.0; // Higher scale for better OCR quality
const IMAGE_QUALITY = 0.92;

// ============================================
// TYPES
// ============================================

export interface PdfConversionResult {
  success: boolean;
  images: string[]; // base64 encoded PNG images
  pageCount: number;
  processedPages: number;
  error?: string;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Convert PDF file to base64 PNG images
 * @param file - PDF file to convert
 * @param maxPages - Maximum number of pages to convert (default: 5)
 * @returns Array of base64 encoded PNG images
 */
export async function convertPdfToImages(
  file: File,
  maxPages: number = MAX_PAGES
): Promise<PdfConversionResult> {
  try {
    // Validate file type
    if (file.type !== 'application/pdf') {
      return {
        success: false,
        images: [],
        pageCount: 0,
        processedPages: 0,
        error: 'File must be a PDF',
      };
    }

    // Dynamic import pdfjs-dist (browser-only)
    const pdfjsLib = await import('pdfjs-dist');

    // Configure worker using jsDelivr CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;
    const pagesToProcess = Math.min(pageCount, maxPages);
    const images: string[] = [];

    // Process each page
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render page to canvas
      const renderContext = {
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport: viewport,
      };
      await page.render(renderContext as Parameters<typeof page.render>[0]).promise;

      // Convert canvas to base64 PNG
      const base64Image = canvas.toDataURL('image/png', IMAGE_QUALITY);
      // Remove the data URL prefix (data:image/png;base64,)
      const base64Data = base64Image.split(',')[1] ?? '';
      if (base64Data) {
        images.push(base64Data);
      }

      // Clean up
      canvas.remove();
    }

    return {
      success: true,
      images,
      pageCount,
      processedPages: pagesToProcess,
    };
  } catch (error) {
    console.error('PDF conversion error:', error);
    return {
      success: false,
      images: [],
      pageCount: 0,
      processedPages: 0,
      error: error instanceof Error ? error.message : 'Failed to convert PDF',
    };
  }
}

/**
 * Get PDF page count without rendering
 * @param file - PDF file
 * @returns Number of pages in the PDF
 */
export async function getPdfPageCount(file: File): Promise<number> {
  try {
    // Dynamic import pdfjs-dist (browser-only)
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    return pdfDoc.numPages;
  } catch {
    return 0;
  }
}
