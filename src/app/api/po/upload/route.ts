/**
 * PO Upload API Route - AWS S3
 *
 * POST /api/po/upload - Upload PO PDF to AWS S3
 * GET /api/po/upload?file=<path> - Download/view uploaded file
 */

import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  successResponse,
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';
import { getS3Client, AWS_S3_BUCKET } from '@/shared/lib/aws/s3-client';

// ============================================
// CONSTANTS
// ============================================

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const SIGNED_URL_EXPIRY = 60 * 60 * 24 * 7; // 7 days (max allowed by AWS)

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
 * Convert S3 stream to Buffer
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// ============================================
// POST /api/po/upload
// ============================================

/**
 * Upload PO PDF to AWS S3
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

    // Generate unique filename with path
    const filename = generateFilename(file.name);
    const storagePath = quoteId
      ? `po-documents/quotes/${quoteId}/${filename}`
      : `po-documents/uploads/${filename}`;

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const s3Client = getS3Client();

    const uploadCommand = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: 'application/pdf',
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        quoteId: quoteId || 'none',
      },
    });

    await s3Client.send(uploadCommand);

    // Generate signed URL (valid for 1 year)
    const getCommand = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: storagePath,
    });

    const signedUrl = await getSignedUrl(s3Client, getCommand, {
      expiresIn: SIGNED_URL_EXPIRY,
    });

    return successResponse({
      path: storagePath,
      url: signedUrl,
      filename: filename,
      storage: 's3',
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
 * Download/view uploaded PO PDF from AWS S3
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

    // Validate path format (should start with po-documents/)
    if (!sanitizedPath.startsWith('po-documents/')) {
      return badRequestResponse('Invalid file path');
    }

    // Download from S3
    const s3Client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: sanitizedPath,
    });

    let response;
    try {
      response = await s3Client.send(command);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return notFoundResponse('File');
      }
      throw error;
    }

    if (!response.Body) {
      return notFoundResponse('File');
    }

    // Convert stream to buffer
    const buffer = await streamToBuffer(response.Body);

    // Get filename from path
    const filename = sanitizedPath.split('/').pop() || 'document.pdf';

    // Return file with appropriate headers
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('GET /api/po/upload error:', error);
    return internalErrorResponse('Failed to retrieve file');
  }
}
