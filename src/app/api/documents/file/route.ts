/**
 * Document File API Route
 *
 * GET /api/documents/file?path=<path> - Download/view document file
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import {
  badRequestResponse,
  notFoundResponse,
  internalErrorResponse,
} from '@/shared/lib/api/response';
import { requirePermission } from '@/shared/lib/auth';

// ============================================
// CONSTANTS
// ============================================

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'customer-documents');

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
// GET /api/documents/file
// ============================================

/**
 * Download/view document file
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
    const fullPath = path.join(UPLOAD_DIR, sanitizedPath);

    // Ensure file is within upload directory (security check)
    const normalizedUploadDir = path.normalize(UPLOAD_DIR);
    const normalizedFullPath = path.normalize(fullPath);

    if (!normalizedFullPath.startsWith(normalizedUploadDir)) {
      return badRequestResponse('Invalid file path');
    }

    // Check if file exists
    try {
      await stat(fullPath);
    } catch {
      return notFoundResponse('File');
    }

    // Read file
    const fileBuffer = await readFile(fullPath);

    // Determine MIME type
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${path.basename(fullPath)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('GET /api/documents/file error:', error);
    return internalErrorResponse('Failed to retrieve file');
  }
}
