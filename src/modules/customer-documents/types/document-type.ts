/**
 * Document Type Types
 *
 * Types for the document_types master table.
 */

// ============================================
// ENTITY TYPE
// ============================================

export interface DocumentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  requiresExpiry: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// LIST ITEM TYPE
// ============================================

export interface DocumentTypeListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isRequired: boolean;
  requiresExpiry: boolean;
  isActive: boolean;
}

// ============================================
// DROPDOWN ITEM TYPE
// ============================================

export interface DocumentTypeDropdownItem {
  id: string;
  code: string;
  name: string;
  requiresExpiry: boolean;
}
