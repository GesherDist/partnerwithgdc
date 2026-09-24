/**
 * Document Type Repository
 *
 * Database operations for document_types master table.
 */

import { db } from '@/shared/lib/supabase/database';
import type {
  DocumentType,
  DocumentTypeListItem,
  DocumentTypeDropdownItem,
} from '../types';

// ============================================
// DATABASE TYPES
// ============================================

interface DbDocumentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_required: boolean;
  requires_expiry: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// REPOSITORY
// ============================================

export const documentTypeRepository = {
  /**
   * Get all active document types
   */
  async getAll(): Promise<DocumentTypeListItem[]> {
    const { data, error } = await db
      .from('document_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching document types:', error);
      throw new Error(`Failed to fetch document types: ${error.message}`);
    }

    return (data || []).map(mapToListItem);
  },

  /**
   * Get document types for dropdown
   */
  async getForDropdown(): Promise<DocumentTypeDropdownItem[]> {
    const { data, error } = await db
      .from('document_types')
      .select('id, code, name, requires_expiry')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching document types for dropdown:', error);
      throw new Error(`Failed to fetch document types: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      requiresExpiry: row.requires_expiry,
    }));
  },

  /**
   * Get a document type by ID
   */
  async getById(id: string): Promise<DocumentType | null> {
    const { data, error } = await db
      .from('document_types')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching document type:', error);
      throw new Error(`Failed to fetch document type: ${error.message}`);
    }

    return mapToDocumentType(data);
  },

  /**
   * Get a document type by code
   */
  async getByCode(code: string): Promise<DocumentType | null> {
    const { data, error } = await db
      .from('document_types')
      .select('*')
      .eq('code', code)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error fetching document type by code:', error);
      throw new Error(`Failed to fetch document type: ${error.message}`);
    }

    return mapToDocumentType(data);
  },
};

// ============================================
// MAPPING FUNCTIONS
// ============================================

function mapToDocumentType(data: DbDocumentType): DocumentType {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    isRequired: data.is_required,
    requiresExpiry: data.requires_expiry,
    isActive: data.is_active,
    sortOrder: data.sort_order,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

function mapToListItem(data: DbDocumentType): DocumentTypeListItem {
  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    isRequired: data.is_required,
    requiresExpiry: data.requires_expiry,
    isActive: data.is_active,
  };
}
