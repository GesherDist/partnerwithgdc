/**
 * PO Extraction API Route
 *
 * POST /api/po/extract - Extract PO data from PDF images using Claude AI
 */

import { NextRequest } from 'next/server';
import { processPOExtraction } from '@/features/quotes/services/po-extract.service';
import {
  successResponse,
  badRequestResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';

// ============================================
// CONSTANTS
// ============================================

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 10;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

// ============================================
// POST /api/po/extract
// ============================================

/**
 * Extract PO data from PDF images
 *
 * Request body:
 * {
 *   images: string[] // base64 encoded PNG images
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('quotes.create');
    if (guard.response) {
      return guard.response;
    }

    // Parse request body
    const body = await request.json();

    // Validate images array
    if (!body.images || !Array.isArray(body.images)) {
      return badRequestResponse('Missing or invalid images array');
    }

    if (body.images.length === 0) {
      return badRequestResponse('At least one image is required');
    }

    if (body.images.length > MAX_IMAGES) {
      return badRequestResponse(`Maximum ${MAX_IMAGES} images allowed`);
    }

    // Validate each image
    for (let i = 0; i < body.images.length; i++) {
      const image = body.images[i];
      if (typeof image !== 'string') {
        return badRequestResponse(`Image at index ${i} is not a valid string`);
      }

      // Check base64 size (rough estimate: base64 is ~4/3 of original size)
      const estimatedSize = (image.length * 3) / 4;
      if (estimatedSize > MAX_IMAGE_SIZE_BYTES) {
        return badRequestResponse(
          `Image at index ${i} exceeds ${MAX_IMAGE_SIZE_MB}MB limit`
        );
      }
    }

    // Process PO extraction
    const result = await processPOExtraction(body.images);

    if (!result.success) {
      return badRequestResponse(result.error || 'Failed to extract PO data');
    }

    return successResponse(result.data);
  } catch (error) {
    console.error('POST /api/po/extract error:', error);
    return internalErrorResponse('Failed to extract PO data');
  }
}
