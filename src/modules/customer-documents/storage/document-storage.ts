/**
 * Document Storage Service
 *
 * Handles file uploads, downloads for customer documents.
 * Uses local server storage (uploads folder).
 */

import { writeFile, mkdir, readFile, stat, unlink, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// ============================================
// CONSTANTS
// ============================================

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'customer-documents');

// ============================================
// TYPES
// ============================================

export interface UploadResult {
  path: string;
  fullPath: string;
}

export interface StorageError {
  message: string;
  statusCode?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Ensure upload directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Generate storage path for a document
 */
export function generateStoragePath(
  customerId: string,
  documentTypeCode: string,
  version: number,
  fileName: string
): string {
  const date = new Date().toISOString().split('T')[0];
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${customerId}/${documentTypeCode.toLowerCase()}/v${version}_${date}_${sanitizedFileName}`;
}

/**
 * Extract customer ID from storage path
 */
export function extractCustomerIdFromPath(path: string): string | null {
  const parts = path.split('/');
  return parts[0] ?? null;
}

// ============================================
// STORAGE OPERATIONS
// ============================================

/**
 * Upload a file to storage
 */
export async function uploadFile(
  file: File,
  storagePath: string
): Promise<UploadResult> {
  try {
    const fullPath = path.join(UPLOAD_DIR, storagePath);
    const dirPath = path.dirname(fullPath);

    // Ensure directory exists
    await ensureDir(dirPath);

    // Convert File to Buffer and write
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(fullPath, buffer);

    return {
      path: storagePath,
      fullPath: `customer-documents/${storagePath}`,
    };
  } catch (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a file from buffer (for server-side operations)
 */
export async function uploadFileBuffer(
  buffer: Buffer,
  storagePath: string,
  _mimeType: string
): Promise<UploadResult> {
  try {
    const fullPath = path.join(UPLOAD_DIR, storagePath);
    const dirPath = path.dirname(fullPath);

    // Ensure directory exists
    await ensureDir(dirPath);

    // Write buffer to file
    await writeFile(fullPath, buffer);

    return {
      path: storagePath,
      fullPath: `customer-documents/${storagePath}`,
    };
  } catch (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get URL for downloading/viewing a file
 * Returns API endpoint URL for serving the file
 */
export async function getSignedUrl(
  storagePath: string,
  _expiresIn?: number
): Promise<string> {
  // Return API endpoint URL
  return `/api/documents/file?path=${encodeURIComponent(storagePath)}`;
}

/**
 * Get URLs for multiple files
 */
export async function getSignedUrls(
  storagePaths: string[],
  _expiresIn?: number
): Promise<Record<string, string>> {
  const urlMap: Record<string, string> = {};

  for (const storagePath of storagePaths) {
    urlMap[storagePath] = `/api/documents/file?path=${encodeURIComponent(storagePath)}`;
  }

  return urlMap;
}

/**
 * Download a file - returns file buffer
 */
export async function downloadFile(storagePath: string): Promise<Buffer> {
  try {
    const fullPath = path.join(UPLOAD_DIR, storagePath);

    // Check if file exists
    await stat(fullPath);

    // Read and return file
    return await readFile(fullPath);
  } catch (error) {
    console.error('Download error:', error);
    throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(storagePath: string): Promise<void> {
  try {
    const fullPath = path.join(UPLOAD_DIR, storagePath);
    await unlink(fullPath);
  } catch (error) {
    console.error('Delete error:', error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete multiple files from storage
 */
export async function deleteFiles(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) {
    return;
  }

  for (const storagePath of storagePaths) {
    try {
      const fullPath = path.join(UPLOAD_DIR, storagePath);
      await unlink(fullPath);
    } catch (error) {
      console.error(`Delete error for ${storagePath}:`, error);
      // Continue deleting other files even if one fails
    }
  }
}

/**
 * List files in a customer's folder
 */
export async function listCustomerFiles(customerId: string): Promise<string[]> {
  try {
    const customerDir = path.join(UPLOAD_DIR, customerId);

    if (!existsSync(customerDir)) {
      return [];
    }

    const files: string[] = [];

    // Recursively list files
    async function listDir(dir: string, prefix: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await listDir(path.join(dir, entry.name), entryPath);
        } else {
          files.push(`${customerId}/${entryPath}`);
        }
      }
    }

    await listDir(customerDir, '');
    return files;
  } catch (error) {
    console.error('List files error:', error);
    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if storage directory exists and is accessible
 */
export async function checkBucketAccess(): Promise<boolean> {
  try {
    await ensureDir(UPLOAD_DIR);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// EXPORT CONSTANTS
// ============================================

export const BUCKET_NAME = 'customer-documents';
export const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour (kept for compatibility)
