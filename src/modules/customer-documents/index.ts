/**
 * Customer Documents Module - Public API
 *
 * This module handles customer compliance document management including
 * upload, preview, versioning, and archival.
 */

// Components (primary exports for UI usage)
export { CustomerDocumentsTab } from './components';

// Types (for type-safe integration)
export type {
  CustomerDocument,
  CustomerDocumentListItem,
  CustomerDocumentWithType,
  DocumentStatus,
  UploadDocumentDTO,
  ReplaceDocumentDTO,
  UpdateDocumentDTO,
  CustomerDocumentsTabProps,
  UploadDocumentDrawerProps,
  DocumentPreviewDialogProps,
  DocumentActionsProps,
} from './types';

export type {
  DocumentType,
  DocumentTypeListItem,
  DocumentTypeDropdownItem,
} from './types';

export {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABELS,
  DOCUMENT_STATUS_COLORS,
} from './types';

// Actions (for server-side usage)
export {
  getDocumentTypes,
  getCustomerDocuments,
  getCustomerDocument,
  getDocumentViewUrl,
  getMissingRequiredDocuments,
  uploadDocument,
  replaceDocument,
  archiveDocument,
} from './actions';

// Hooks (for client-side data fetching)
export { useCustomerDocuments, useDocumentTypes } from './hooks';

// Constants (for validation and display)
export {
  ALLOWED_MIME_TYPES,
  PREVIEWABLE_MIME_TYPES,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  isPreviewable,
  isAllowedMimeType,
  formatFileSize,
} from './constants';
