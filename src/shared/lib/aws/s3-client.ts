/**
 * AWS S3 Client Configuration
 *
 * Singleton S3 client for file storage operations.
 * Used across the application for document uploads, downloads, and deletions.
 */

import { S3Client } from '@aws-sdk/client-s3';

// ============================================
// CONSTANTS
// ============================================

export const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || 'gesher-documents';
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// ============================================
// S3 CLIENT SINGLETON
// ============================================

let s3Client: S3Client | null = null;

/**
 * Get S3 client instance (singleton pattern)
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    // Validate required environment variables
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error(
        'AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
      );
    }

    if (!process.env.AWS_S3_BUCKET) {
      console.warn(
        'AWS_S3_BUCKET not set, using default: gesher-documents'
      );
    }

    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3Client;
}

/**
 * Reset S3 client (useful for testing)
 */
export function resetS3Client(): void {
  s3Client = null;
}
