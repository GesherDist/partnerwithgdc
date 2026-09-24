/**
 * Customer Documents Validation Schemas
 *
 * Zod schemas for document operations.
 */

import { z } from 'zod';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '../constants';

// ============================================
// DOCUMENT STATUS
// ============================================

export const documentStatusSchema = z.enum([
  'active',
  'archived',
  'expired',
  'pending_review',
]);

// ============================================
// UPLOAD DOCUMENT SCHEMA
// ============================================

export const uploadDocumentSchema = z.object({
  documentTypeId: z.string().uuid('Please select a document type'),
  expiryDate: z.string().optional().nullable(),
  remarks: z.string().max(500, 'Remarks must be 500 characters or less').optional().nullable(),
});

// ============================================
// UPDATE DOCUMENT SCHEMA
// ============================================

export const updateDocumentSchema = z.object({
  expiryDate: z.string().optional().nullable(),
  status: documentStatusSchema.optional(),
  remarks: z.string().max(500, 'Remarks must be 500 characters or less').optional().nullable(),
});

// ============================================
// FILE VALIDATION
// ============================================

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return {
      valid: false,
      error: 'File type not allowed. Please upload PDF, images, or Office documents.',
    };
  }

  return { valid: true };
}

// ============================================
// TYPE EXPORTS
// ============================================

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
