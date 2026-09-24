/**
 * Customer Document Service
 *
 * Business logic layer for customer documents.
 */

import { customerDocumentRepository } from '../repositories/customer-document.repository';
import { documentTypeRepository } from '../repositories/document-type.repository';
import {
  uploadFile,
  getSignedUrl,
  generateStoragePath,
} from '../storage/document-storage';
import {
  uploadDocumentSchema,
  updateDocumentSchema,
  validateFile,
} from '../lib/schemas';
import type {
  CustomerDocument,
  CustomerDocumentListItem,
  UpdateDocumentDTO,
  DocumentTypeDropdownItem,
} from '../types';

// ============================================
// TYPES
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

interface UploadParams {
  customerId: string;
  documentTypeId: string;
  file: File;
  expiryDate?: string | null;
  remarks?: string | null;
}

interface ReplaceParams {
  documentId: string;
  file: File;
  expiryDate?: string | null;
  remarks?: string | null;
}

// ============================================
// SERVICE
// ============================================

export const customerDocumentService = {
  /**
   * Get all document types for dropdown
   */
  async getDocumentTypes(): Promise<ServiceResult<DocumentTypeDropdownItem[]>> {
    try {
      const types = await documentTypeRepository.getForDropdown();
      return { success: true, data: types };
    } catch (error) {
      console.error('CustomerDocumentService.getDocumentTypes error:', error);
      return { success: false, error: 'Failed to fetch document types' };
    }
  },

  /**
   * Get all documents for a customer
   */
  async getByCustomerId(customerId: string): Promise<ServiceResult<CustomerDocumentListItem[]>> {
    try {
      const documents = await customerDocumentRepository.getByCustomerId(customerId);
      return { success: true, data: documents };
    } catch (error) {
      console.error('CustomerDocumentService.getByCustomerId error:', error);
      return { success: false, error: 'Failed to fetch documents' };
    }
  },

  /**
   * Get a single document by ID
   */
  async getById(id: string): Promise<ServiceResult<CustomerDocumentListItem>> {
    try {
      const document = await customerDocumentRepository.getByIdWithType(id);
      if (!document) {
        return { success: false, error: 'Document not found' };
      }
      return { success: true, data: document };
    } catch (error) {
      console.error('CustomerDocumentService.getById error:', error);
      return { success: false, error: 'Failed to fetch document' };
    }
  },

  /**
   * Upload a new document
   */
  async upload(
    params: UploadParams,
    userId?: string
  ): Promise<ServiceResult<CustomerDocument>> {
    try {
      const { customerId, documentTypeId, file, expiryDate, remarks } = params;

      // Validate input
      const validation = uploadDocumentSchema.safeParse({
        documentTypeId,
        expiryDate,
        remarks,
      });

      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Validate file
      const fileValidation = validateFile(file);
      if (!fileValidation.valid) {
        return {
          success: false,
          error: fileValidation.error,
        };
      }

      // Get document type for path generation
      const documentType = await documentTypeRepository.getById(documentTypeId);
      if (!documentType) {
        return { success: false, error: 'Invalid document type' };
      }

      // Check if there's an existing active document of this type
      const existing = await customerDocumentRepository.getActiveByCustomerAndType(
        customerId,
        documentTypeId
      );

      let version = 1;
      let parentId: string | null = null;

      if (existing) {
        // Archive the existing document
        await customerDocumentRepository.archive(existing.id, userId);
        version = existing.version + 1;
        parentId = existing.id;
      }

      // Generate storage path
      const storagePath = generateStoragePath(
        customerId,
        documentType.code,
        version,
        file.name
      );

      // Upload file to storage
      const uploadResult = await uploadFile(file, storagePath);

      // Create document record
      const document = await customerDocumentRepository.create(
        {
          customerId,
          documentTypeId,
          fileName: file.name,
          filePath: uploadResult.path,
          mimeType: file.type,
          fileSize: file.size,
          expiryDate: expiryDate || null,
          remarks: remarks || null,
          version,
          parentId,
        },
        userId
      );

      return { success: true, data: document };
    } catch (error) {
      console.error('CustomerDocumentService.upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload document',
      };
    }
  },

  /**
   * Replace an existing document
   */
  async replace(
    params: ReplaceParams,
    userId?: string
  ): Promise<ServiceResult<CustomerDocument>> {
    try {
      const { documentId, file, expiryDate, remarks } = params;

      // Get existing document
      const existing = await customerDocumentRepository.getById(documentId);
      if (!existing) {
        return { success: false, error: 'Document not found' };
      }

      // Validate file
      const fileValidation = validateFile(file);
      if (!fileValidation.valid) {
        return {
          success: false,
          error: fileValidation.error,
        };
      }

      // Get document type
      const documentType = await documentTypeRepository.getById(existing.documentTypeId);
      if (!documentType) {
        return { success: false, error: 'Invalid document type' };
      }

      // Archive the existing document
      await customerDocumentRepository.archive(existing.id, userId);

      const version = existing.version + 1;

      // Generate storage path
      const storagePath = generateStoragePath(
        existing.customerId,
        documentType.code,
        version,
        file.name
      );

      // Upload file to storage
      const uploadResult = await uploadFile(file, storagePath);

      // Create new document record
      const document = await customerDocumentRepository.create(
        {
          customerId: existing.customerId,
          documentTypeId: existing.documentTypeId,
          fileName: file.name,
          filePath: uploadResult.path,
          mimeType: file.type,
          fileSize: file.size,
          expiryDate: expiryDate ?? existing.expiryDate,
          remarks: remarks ?? existing.remarks,
          version,
          parentId: existing.id,
        },
        userId
      );

      return { success: true, data: document };
    } catch (error) {
      console.error('CustomerDocumentService.replace error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replace document',
      };
    }
  },

  /**
   * Update document metadata
   */
  async update(
    id: string,
    data: UpdateDocumentDTO,
    userId?: string
  ): Promise<ServiceResult<CustomerDocument>> {
    try {
      // Validate input
      const validation = updateDocumentSchema.safeParse(data);
      if (!validation.success) {
        return {
          success: false,
          error: 'Validation failed',
          errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
        };
      }

      // Check if document exists
      const existing = await customerDocumentRepository.getById(id);
      if (!existing) {
        return { success: false, error: 'Document not found' };
      }

      const document = await customerDocumentRepository.update(id, data, userId);
      return { success: true, data: document };
    } catch (error) {
      console.error('CustomerDocumentService.update error:', error);
      return { success: false, error: 'Failed to update document' };
    }
  },

  /**
   * Archive a document
   */
  async archive(id: string, userId?: string): Promise<ServiceResult<CustomerDocument>> {
    try {
      const existing = await customerDocumentRepository.getById(id);
      if (!existing) {
        return { success: false, error: 'Document not found' };
      }

      const document = await customerDocumentRepository.archive(id, userId);
      return { success: true, data: document };
    } catch (error) {
      console.error('CustomerDocumentService.archive error:', error);
      return { success: false, error: 'Failed to archive document' };
    }
  },

  /**
   * Get signed URL for viewing/downloading
   */
  async getViewUrl(id: string): Promise<ServiceResult<string>> {
    try {
      const document = await customerDocumentRepository.getById(id);
      if (!document) {
        return { success: false, error: 'Document not found' };
      }

      const url = await getSignedUrl(document.filePath);
      return { success: true, data: url };
    } catch (error) {
      console.error('CustomerDocumentService.getViewUrl error:', error);
      return { success: false, error: 'Failed to generate URL' };
    }
  },

  /**
   * Get missing required documents for a customer
   */
  async getMissingRequired(customerId: string): Promise<ServiceResult<string[]>> {
    try {
      const missing = await customerDocumentRepository.getMissingRequiredDocuments(customerId);
      return { success: true, data: missing };
    } catch (error) {
      console.error('CustomerDocumentService.getMissingRequired error:', error);
      return { success: false, error: 'Failed to check required documents' };
    }
  },

  /**
   * Get documents expiring soon
   */
  async getExpiringSoon(
    customerId: string,
    daysAhead: number = 30
  ): Promise<ServiceResult<CustomerDocumentListItem[]>> {
    try {
      const documents = await customerDocumentRepository.getExpiringDocuments(
        customerId,
        daysAhead
      );
      return { success: true, data: documents };
    } catch (error) {
      console.error('CustomerDocumentService.getExpiringSoon error:', error);
      return { success: false, error: 'Failed to fetch expiring documents' };
    }
  },

  /**
   * Get version history for a document
   */
  async getVersionHistory(documentId: string): Promise<ServiceResult<CustomerDocumentListItem[]>> {
    try {
      const history = await customerDocumentRepository.getVersionHistory(documentId);
      return { success: true, data: history };
    } catch (error) {
      console.error('CustomerDocumentService.getVersionHistory error:', error);
      return { success: false, error: 'Failed to fetch version history' };
    }
  },
};

export type CustomerDocumentService = typeof customerDocumentService;
