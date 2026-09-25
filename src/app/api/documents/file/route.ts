/**
 * Document File API Route - AWS S3
 *
 * GET /api/documents/file?path=<path> - Download/view document file from S3
 */

import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import {
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';
import { getS3Client, AWS_S3_BUCKET } from '@/shared/lib/aws/s3-client';

// ============================================
// CONSTANTS
// ============================================

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

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

/**
 * Get file extension from path
 */
function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot !== -1 ? filePath.substring(lastDot).toLowerCase() : '';
}

/**
 * Get filename from S3 key
 */
function getFilename(key: string): string {
  const parts = key.split('/');
  return parts[parts.length - 1] || 'document';
}

// ============================================
// GET /api/documents/file
// ============================================

/**
 * Download/view document file from S3
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication + permission
    const guard = await requirePermission('customers.view_module');
    if (guard.response) {
      return guard.response;
    }

    // Get file path from query
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return badRequestResponse('File path is required');
    }

    // Sanitize path to prevent directory traversal
    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/^\//, '');

    // Validate path format (should start with customer-documents/)
    if (!sanitizedPath.startsWith('customer-documents/')) {
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
    const fileBuffer = await streamToBuffer(response.Body);

    // Determine MIME type
    const ext = getFileExtension(sanitizedPath);
    const mimeType = MIME_TYPES[ext] || response.ContentType || 'application/octet-stream';

    // Get filename
    const filename = getFilename(sanitizedPath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('GET /api/documents/file error:', error);
    return internalErrorResponse('Failed to retrieve file');
  }
}
