/**
 * Customer Document Repository
 *
 * Database operations for customer_documents table.
 */

import { db } from '@/shared/lib/supabase/database';
import { formatFileSize } from '../constants';
import type {
  CustomerDocument,
  CustomerDocumentListItem,
  CreateCustomerDocumentDTO,
  UpdateDocumentDTO,
  DocumentStatus,
} from '../types';

// ============================================
// DATABASE TYPES
// ============================================

interface DbCustomerDocument {
  id: string;
  customer_id: string;
  document_type_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  expiry_date: string | null;
  status: DocumentStatus;
  remarks: string | null;
  version: number;
  parent_id: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface DbCustomerDocumentWithType extends DbCustomerDocument {
  document_types: {
    code: string;
    name: string;
  };
}

// ============================================
// REPOSITORY
// ============================================

export const customerDocumentRepository = {
  /**
   * Get all documents for a customer
   */
  async getByCustomerId(customerId: string): Promise<CustomerDocumentListItem[]> {
    const { data, error } = await db
      .from('customer_documents')
      .select(`
        *,
        document_types (
          code,
          name
        )
      `)
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching customer documents:', error);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return (data || []).map(mapToListItem);
  },

  /**
   * Get active documents for a customer (only latest version per type)
   */
  async getActiveByCustomerId(customerId: string): Promise<CustomerDocumentListItem[]> {
    const { data, error } = await db
      .from('customer_documents')
      .select(`
        *,
        document_types (
          code,
          name
        )
      `)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('Error fetching active customer documents:', error);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return (data || []).map(mapToListItem);
  },

  /**
   * Get a single document by ID
   */
  async getById(id: string): Promise<CustomerDocument | null> {
    const { data, error } = await db
      .from('customer_documents')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching document:', error);
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    return mapToDocument(data);
  },

  /**
   * Get a document with type info
   */
  async getByIdWithType(id: string): Promise<CustomerDocumentListItem | null> {
    const { data, error } = await db
      .from('customer_documents')
      .select(`
        *,
        document_types (
          code,
          name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching document:', error);
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    return mapToListItem(data as DbCustomerDocumentWithType);
  },

  /**
   * Get existing active document for a customer and type
   */
  async getActiveByCustomerAndType(
    customerId: string,
    documentTypeId: string
  ): Promise<CustomerDocument | null> {
    const { data, error } = await db
      .from('customer_documents')
      .select('*')
      .eq('customer_id', customerId)
      .eq('document_type_id', documentTypeId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching document:', error);
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    return mapToDocument(data);
  },

  /**
   * Create a new document record
   */
  async create(
    data: CreateCustomerDocumentDTO,
    userId?: string
  ): Promise<CustomerDocument> {
    const { data: result, error } = await db
      .from('customer_documents')
      .insert({
        customer_id: data.customerId,
        document_type_id: data.documentTypeId,
        file_name: data.fileName,
        file_path: data.filePath,
        mime_type: data.mimeType,
        file_size: data.fileSize,
        expiry_date: data.expiryDate || null,
        remarks: data.remarks || null,
        version: data.version || 1,
        parent_id: data.parentId || null,
        uploaded_by: userId || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      throw new Error(`Failed to create document: ${error.message}`);
    }

    return mapToDocument(result);
  },

  /**
   * Update a document
   */
  async update(
    id: string,
    data: UpdateDocumentDTO,
    _userId?: string
  ): Promise<CustomerDocument> {
    const updateData: Record<string, unknown> = {};

    if (data.expiryDate !== undefined) {updateData.expiry_date = data.expiryDate;}
    if (data.status !== undefined) {updateData.status = data.status;}
    if (data.remarks !== undefined) {updateData.remarks = data.remarks;}

    // Always update updated_at (trigger will handle this, but being explicit)
    updateData.updated_at = new Date().toISOString();

    const { data: result, error } = await db
      .from('customer_documents')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      console.error('Error updating document:', error);
      throw new Error(`Failed to update document: ${error.message}`);
    }

    return mapToDocument(result);
  },

  /**
   * Archive a document (soft status change)
   */
  async archive(id: string, userId?: string): Promise<CustomerDocument> {
    return this.update(id, { status: 'archived' }, userId);
  },

  /**
   * Soft delete a document
   */
  async softDelete(id: string, _userId?: string): Promise<void> {
    const { error } = await db
      .from('customer_documents')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'archived',
      })
      .eq('id', id);

    if (error) {
      console.error('Error deleting document:', error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  },

  /**
   * Get version history for a document
   */
  async getVersionHistory(documentId: string): Promise<CustomerDocumentListItem[]> {
    // First get the document to find the chain
    const document = await this.getById(documentId);
    if (!document) {return [];}

    // Get all documents in the version chain
    const { data, error } = await db
      .from('customer_documents')
      .select(`
        *,
        document_types (
          code,
          name
        )
      `)
      .eq('customer_id', document.customerId)
      .eq('document_type_id', document.documentTypeId)
      .order('version', { ascending: true });

    if (error) {
      console.error('Error fetching version history:', error);
      throw new Error(`Failed to fetch version history: ${error.message}`);
    }

    return (data || []).map(mapToListItem);
  },

  /**
   * Check if customer has all required documents
   */
  async getMissingRequiredDocuments(customerId: string): Promise<string[]> {
    // Get required document types
    const { data: requiredTypes, error: typesError } = await db
      .from('document_types')
      .select('id, name')
      .eq('is_required', true)
      .eq('is_active', true);

    if (typesError) {
      throw new Error(`Failed to fetch required types: ${typesError.message}`);
    }

    // Get customer's active documents
    const { data: customerDocs, error: docsError } = await db
      .from('customer_documents')
      .select('document_type_id')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (docsError) {
      throw new Error(`Failed to fetch customer documents: ${docsError.message}`);
    }

    const existingTypeIds = new Set((customerDocs || []).map((d) => d.document_type_id));
    const missingTypes = (requiredTypes || [])
      .filter((t) => !existingTypeIds.has(t.id))
      .map((t) => t.name);

    return missingTypes;
  },

  /**
   * Get documents expiring soon
   */
  async getExpiringDocuments(
    customerId: string,
    daysAhead: number = 30
  ): Promise<CustomerDocumentListItem[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await db
      .from('customer_documents')
      .select(`
        *,
        document_types (
          code,
          name
        )
      `)
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .order('expiry_date', { ascending: true });

    if (error) {
      console.error('Error fetching expiring documents:', error);
      throw new Error(`Failed to fetch expiring documents: ${error.message}`);
    }

    return (data || []).map(mapToListItem);
  },
};

// ============================================
// MAPPING FUNCTIONS
// ============================================

function mapToDocument(data: DbCustomerDocument): CustomerDocument {
  return {
    id: data.id,
    customerId: data.customer_id,
    documentTypeId: data.document_type_id,
    fileName: data.file_name,
    filePath: data.file_path,
    mimeType: data.mime_type,
    fileSize: data.file_size,
    expiryDate: data.expiry_date,
    status: data.status,
    remarks: data.remarks,
    version: data.version,
    parentId: data.parent_id,
    uploadedBy: data.uploaded_by,
    uploadedAt: new Date(data.uploaded_at),
    updatedAt: new Date(data.updated_at),
    deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
  };
}

function mapToListItem(data: DbCustomerDocumentWithType): CustomerDocumentListItem {
  return {
    id: data.id,
    customerId: data.customer_id,
    documentTypeId: data.document_type_id,
    documentTypeCode: data.document_types?.code || '',
    documentTypeName: data.document_types?.name || '',
    fileName: data.file_name,
    filePath: data.file_path,
    mimeType: data.mime_type,
    fileSize: data.file_size,
    formattedFileSize: formatFileSize(data.file_size),
    expiryDate: data.expiry_date,
    status: data.status,
    remarks: data.remarks,
    version: data.version,
    uploadedBy: data.uploaded_by,
    uploadedByName: null, // Would need join with users table
    uploadedAt: new Date(data.uploaded_at),
  };
}
