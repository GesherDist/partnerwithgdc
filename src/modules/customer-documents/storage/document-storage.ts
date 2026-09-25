/**
 * Document Storage Service - AWS S3
 *
 * Handles file uploads, downloads for customer documents.
 * Uses AWS S3 for cloud storage.
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, AWS_S3_BUCKET } from '@/shared/lib/aws/s3-client';

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
  return `customer-documents/${customerId}/${documentTypeCode.toLowerCase()}/v${version}_${date}_${sanitizedFileName}`;
}

/**
 * Extract customer ID from storage path
 */
export function extractCustomerIdFromPath(path: string): string | null {
  const parts = path.split('/');
  // Path format: customer-documents/customer-id/document-type/filename
  return parts[1] ?? null;
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
// STORAGE OPERATIONS
// ============================================

/**
 * Upload a file to S3
 */
export async function uploadFile(
  file: File,
  storagePath: string
): Promise<UploadResult> {
  try {
    const s3Client = getS3Client();

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    return {
      path: storagePath,
      fullPath: `s3://${AWS_S3_BUCKET}/${storagePath}`,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload a file from buffer (for server-side operations)
 */
export async function uploadFileBuffer(
  buffer: Buffer,
  storagePath: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    const s3Client = getS3Client();

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    return {
      path: storagePath,
      fullPath: `s3://${AWS_S3_BUCKET}/${storagePath}`,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get signed URL for downloading/viewing a file
 * Returns a pre-signed URL valid for 1 hour
 */
export async function getSignedUrl(
  storagePath: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  try {
    const s3Client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: storagePath,
    });

    // Generate signed URL
    const signedUrl = await getS3SignedUrl(s3Client, command, { expiresIn });

    return signedUrl;
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get URLs for multiple files
 */
export async function getSignedUrls(
  storagePaths: string[],
  expiresIn: number = 3600
): Promise<Record<string, string>> {
  const urlMap: Record<string, string> = {};

  // Generate signed URLs in parallel
  const promises = storagePaths.map(async (storagePath) => {
    try {
      const url = await getSignedUrl(storagePath, expiresIn);
      urlMap[storagePath] = url;
    } catch (error) {
      console.error(`Failed to get signed URL for ${storagePath}:`, error);
      urlMap[storagePath] = '';
    }
  });

  await Promise.all(promises);

  return urlMap;
}

/**
 * Download a file - returns file buffer
 */
export async function downloadFile(storagePath: string): Promise<Buffer> {
  try {
    const s3Client = getS3Client();

    const command = new GetObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: storagePath,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error('No file content returned from S3');
    }

    // Convert stream to buffer
    const buffer = await streamToBuffer(response.Body);

    return buffer;
  } catch (error) {
    console.error('S3 download error:', error);
    throw new Error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFile(storagePath: string): Promise<void> {
  try {
    const s3Client = getS3Client();

    const command = new DeleteObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: storagePath,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete multiple files from S3
 */
export async function deleteFiles(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) {
    return;
  }

  try {
    const s3Client = getS3Client();

    // S3 DeleteObjects can delete up to 1000 objects at once
    const command = new DeleteObjectsCommand({
      Bucket: AWS_S3_BUCKET,
      Delete: {
        Objects: storagePaths.map(path => ({ Key: path })),
        Quiet: true,
      },
    });

    await s3Client.send(command);
  } catch (error) {
    console.error('S3 batch delete error:', error);
    // Continue even if batch delete fails
    // Try deleting individually as fallback
    for (const storagePath of storagePaths) {
      try {
        await deleteFile(storagePath);
      } catch (err) {
        console.error(`Failed to delete ${storagePath}:`, err);
      }
    }
  }
}

/**
 * List files in a customer's folder
 */
export async function listCustomerFiles(customerId: string): Promise<string[]> {
  try {
    const s3Client = getS3Client();

    const prefix = `customer-documents/${customerId}/`;

    const command = new ListObjectsV2Command({
      Bucket: AWS_S3_BUCKET,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    // Extract file keys
    const files = response.Contents
      .map(item => item.Key)
      .filter((key): key is string => key !== undefined);

    return files;
  } catch (error) {
    console.error('S3 list files error:', error);
    throw new Error(`Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if S3 bucket exists and is accessible
 */
export async function checkBucketAccess(): Promise<boolean> {
  try {
    const s3Client = getS3Client();

    const command = new HeadBucketCommand({
      Bucket: AWS_S3_BUCKET,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('S3 bucket access check failed:', error);
    return false;
  }
}

// ============================================
// EXPORT CONSTANTS
// ============================================

export const BUCKET_NAME = AWS_S3_BUCKET;
export const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour
