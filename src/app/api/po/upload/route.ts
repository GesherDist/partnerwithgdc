/**
 * PO Upload API Route
 *
 * POST /api/po/upload - Upload PO PDF to Supabase Storage
 * GET /api/po/upload?file=<path> - Download/view uploaded file
 *
 * Note: Uses Supabase Storage instead of local filesystem
 * to work properly in serverless environments (Vercel)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';
import { createAdminClient } from '@/shared/lib/supabase/admin';

// ============================================
// CONSTANTS
// ============================================

const BUCKET_NAME = 'po-documents';
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate unique filename
 */
function generateFilename(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${timestamp}_${random}_${sanitizedName}`;
}

/**
 * Ensure storage bucket exists
 */
async function ensureBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();

  const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false, // Private bucket - requires auth to access
      fileSizeLimit: MAX_FILE_SIZE_BYTES,
      allowedMimeTypes: ['application/pdf'],
    });

    if (error && !error.message.includes('already exists')) {
      console.error('Error creating bucket:', error);
      throw error;
    }
  }
}

// ============================================
// POST /api/po/upload
// ============================================

/**
 * Upload PO PDF to Supabase Storage
 *
 * Request: FormData with 'file' field
 * Response: { path: string, url: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('quotes.create');
    if (guard.response) {
      return guard.response;
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const quoteId = formData.get('quoteId') as string | null;

    // Validate file
    if (!file) {
      return badRequestResponse('No file provided');
    }

    if (file.type !== 'application/pdf') {
      return badRequestResponse('Only PDF files are allowed');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return badRequestResponse(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`);
    }

    // Create Supabase admin client
    const supabase = createAdminClient();

    // Ensure bucket exists
    await ensureBucket(supabase);

    // Generate unique filename with path
    const filename = generateFilename(file.name);
    const storagePath = quoteId
      ? `quotes/${quoteId}/${filename}`
      : `uploads/${filename}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      return internalErrorResponse(`Failed to upload file: ${error.message}`);
    }

    // Get signed URL (valid for 1 year)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      // Fall back to path-based URL if signed URL fails
      return successResponse({
        path: data.path,
        url: `${BUCKET_NAME}/${storagePath}`,
        filename: filename,
        storage: 'supabase',
      });
    }

    return successResponse({
      path: data.path,
      url: signedUrlData.signedUrl,
      filename: filename,
      storage: 'supabase',
    });
  } catch (error) {
    console.error('POST /api/po/upload error:', error);
    return internalErrorResponse('Failed to upload file');
  }
}

// ============================================
// GET /api/po/upload?file=<path>
// ============================================

/**
 * Download/view uploaded PO PDF from Supabase Storage
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('quotes.view_module');
    if (guard.response) {
      return guard.response;
    }

    // Get file path from query
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('file');

    if (!filePath) {
      return badRequestResponse('File path is required');
    }

    // Sanitize path to prevent directory traversal
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\//, '');

    // Create Supabase admin client
    const supabase = createAdminClient();

    // Download file from Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .download(sanitizedPath);

    if (error) {
      console.error('Supabase Storage download error:', error);
      return notFoundResponse('File');
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${sanitizedPath.split('/').pop()}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('GET /api/po/upload error:', error);
    return internalErrorResponse('Failed to retrieve file');
  }
}
