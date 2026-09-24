/**
 * Customer Document Types
 *
 * Types for customer documents including DTOs and display types.
 */

import type { DocumentType } from './document-type';

// ============================================
// STATUS ENUM
// ============================================

export type DocumentStatus = 'active' | 'archived' | 'expired' | 'pending_review';

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  'active',
  'archived',
  'expired',
  'pending_review',
];

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  active: 'Active',
  archived: 'Archived',
  expired: 'Expired',
  pending_review: 'Pending Review',
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  archived: 'bg-slate-100 text-slate-700',
  expired: 'bg-red-100 text-red-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
};

// ============================================
// ENTITY TYPE
// ============================================

export interface CustomerDocument {
  id: string;
  customerId: string;
  documentTypeId: string;

  // File Information
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;

  // Metadata
  expiryDate: string | null;
  status: DocumentStatus;
  remarks: string | null;

  // Version Tracking
  version: number;
  parentId: string | null;

  // Audit
  uploadedBy: string | null;
  uploadedAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ============================================
// WITH RELATIONS TYPE
// ============================================

export interface CustomerDocumentWithType extends CustomerDocument {
  documentType: DocumentType;
}

// ============================================
// LIST ITEM TYPE (for table display)
// ============================================

export interface CustomerDocumentListItem {
  id: string;
  customerId: string;
  documentTypeId: string;
  documentTypeCode: string;
  documentTypeName: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  formattedFileSize: string;
  expiryDate: string | null;
  status: DocumentStatus;
  remarks: string | null;
  version: number;
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedAt: Date;
}

// ============================================
// DTOs
// ============================================

export interface UploadDocumentDTO {
  customerId: string;
  documentTypeId: string;
  file: File;
  expiryDate?: string | null;
  remarks?: string | null;
}

export interface ReplaceDocumentDTO {
  documentId: string;
  file: File;
  expiryDate?: string | null;
  remarks?: string | null;
}

export interface UpdateDocumentDTO {
  expiryDate?: string | null;
  status?: DocumentStatus;
  remarks?: string | null;
}

// ============================================
// CREATE DTO (Internal - after file upload)
// ============================================

export interface CreateCustomerDocumentDTO {
  customerId: string;
  documentTypeId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  expiryDate?: string | null;
  remarks?: string | null;
  version?: number;
  parentId?: string | null;
}

// ============================================
// FORM VALUES
// ============================================

export interface UploadDocumentFormValues {
  documentTypeId: string;
  file: File | null;
  expiryDate: string;
  remarks: string;
}

export const DEFAULT_UPLOAD_FORM_VALUES: UploadDocumentFormValues = {
  documentTypeId: '',
  file: null,
  expiryDate: '',
  remarks: '',
};

// ============================================
// SERVICE RESULT TYPES
// ============================================

export interface DocumentUploadResult {
  document: CustomerDocument;
  signedUrl: string;
}

// ============================================
// COMPONENT PROPS
// ============================================

export interface CustomerDocumentsTabProps {
  customerId: string;
}

export interface UploadDocumentDrawerProps {
  customerId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: (document: CustomerDocument) => void;
}

export interface DocumentPreviewDialogProps {
  document: CustomerDocumentListItem | null;
  open: boolean;
  onClose: () => void;
}

export interface DocumentActionsProps {
  document: CustomerDocumentListItem;
  onView?: () => void;
  onDownload?: () => void;
  onReplace?: () => void;
  onArchive?: () => void;
}
