/**
 * MIME Types Constants
 *
 * Allowed file types for document uploads.
 */

// ============================================
// ALLOWED MIME TYPES
// ============================================

export const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',

  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',

  // Documents
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

// ============================================
// MIME TYPE LABELS
// ============================================

export const MIME_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF Document',
  'image/jpeg': 'JPEG Image',
  'image/png': 'PNG Image',
  'image/gif': 'GIF Image',
  'image/webp': 'WebP Image',
  'image/tiff': 'TIFF Image',
  'application/msword': 'Word Document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
  'application/vnd.ms-excel': 'Excel Spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
};

// ============================================
// FILE EXTENSIONS
// ============================================

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.tiff',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
] as const;

export const ACCEPT_STRING = ALLOWED_EXTENSIONS.join(',');

// ============================================
// PREVIEWABLE TYPES
// ============================================

export const PREVIEWABLE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export function isPreviewable(mimeType: string): boolean {
  return PREVIEWABLE_MIME_TYPES.includes(mimeType as typeof PREVIEWABLE_MIME_TYPES[number]);
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

// ============================================
// FILE SIZE LIMITS
// ============================================

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_LABEL = '10MB';

// ============================================
// HELPER FUNCTIONS
// ============================================

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) {return '0 Bytes';}

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  const ext = parts.at(-1);
  return parts.length > 1 && ext ? `.${ext.toLowerCase()}` : '';
}
