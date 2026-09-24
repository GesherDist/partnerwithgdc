/**
 * Customer Document Server Actions
 *
 * Server actions for customer document operations.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/shared/lib/supabase/server';
import { customerDocumentService } from '../services/customer-document.service';
import type {
  CustomerDocument,
  CustomerDocumentListItem,
  DocumentTypeDropdownItem,
} from '../types';

// ============================================
// TYPES
// ============================================

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

// ============================================
// READ ACTIONS
// ============================================

/**
 * Get all document types for dropdown
 */
export async function getDocumentTypes(): Promise<ActionResult<DocumentTypeDropdownItem[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await customerDocumentService.getDocumentTypes();
    return result;
  } catch (error) {
    console.error('Error fetching document types:', error);
    return { success: false, error: 'Failed to fetch document types' };
  }
}

/**
 * Get all documents for a customer
 */
export async function getCustomerDocuments(
  customerId: string
): Promise<ActionResult<CustomerDocumentListItem[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await customerDocumentService.getByCustomerId(customerId);
    return result;
  } catch (error) {
    console.error('Error fetching customer documents:', error);
    return { success: false, error: 'Failed to fetch documents' };
  }
}

/**
 * Get a single document
 */
export async function getCustomerDocument(
  id: string
): Promise<ActionResult<CustomerDocumentListItem>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await customerDocumentService.getById(id);
    return result;
  } catch (error) {
    console.error('Error fetching document:', error);
    return { success: false, error: 'Failed to fetch document' };
  }
}

/**
 * Get signed URL for viewing/downloading
 */
export async function getDocumentViewUrl(id: string): Promise<ActionResult<string>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await customerDocumentService.getViewUrl(id);
    return result;
  } catch (error) {
    console.error('Error getting document URL:', error);
    return { success: false, error: 'Failed to get document URL' };
  }
}

/**
 * Get missing required documents
 */
export async function getMissingRequiredDocuments(
  customerId: string
): Promise<ActionResult<string[]>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await customerDocumentService.getMissingRequired(customerId);
    return result;
  } catch (error) {
    console.error('Error checking required documents:', error);
    return { success: false, error: 'Failed to check required documents' };
  }
}

// ============================================
// WRITE ACTIONS
// ============================================

/**
 * Upload a new document
 */
export async function uploadDocument(
  formData: FormData
): Promise<ActionResult<CustomerDocument>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const customerId = formData.get('customerId') as string;
    const documentTypeId = formData.get('documentTypeId') as string;
    const file = formData.get('file') as File;
    const expiryDate = formData.get('expiryDate') as string | null;
    const remarks = formData.get('remarks') as string | null;

    if (!customerId || !documentTypeId || !file) {
      return { success: false, error: 'Missing required fields' };
    }

    const result = await customerDocumentService.upload(
      {
        customerId,
        documentTypeId,
        file,
        expiryDate: expiryDate || null,
        remarks: remarks || null,
      },
      user.id
    );

    if (result.success) {
      revalidatePath(`/customers/${customerId}`);
    }

    return result;
  } catch (error) {
    console.error('Error uploading document:', error);
    return { success: false, error: 'Failed to upload document' };
  }
}

/**
 * Replace an existing document
 */
export async function replaceDocument(
  formData: FormData
): Promise<ActionResult<CustomerDocument>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const documentId = formData.get('documentId') as string;
    const file = formData.get('file') as File;
    const expiryDate = formData.get('expiryDate') as string | null;
    const remarks = formData.get('remarks') as string | null;

    if (!documentId || !file) {
      return { success: false, error: 'Missing required fields' };
    }

    const result = await customerDocumentService.replace(
      {
        documentId,
        file,
        expiryDate: expiryDate || null,
        remarks: remarks || null,
      },
      user.id
    );

    if (result.success && result.data) {
      revalidatePath(`/customers/${result.data.customerId}`);
    }

    return result;
  } catch (error) {
    console.error('Error replacing document:', error);
    return { success: false, error: 'Failed to replace document' };
  }
}

/**
 * Archive a document
 */
export async function archiveDocument(
  id: string,
  customerId: string
): Promise<ActionResult<CustomerDocument>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const result = await customerDocumentService.archive(id, user.id);

    if (result.success) {
      revalidatePath(`/customers/${customerId}`);
    }

    return result;
  } catch (error) {
    console.error('Error archiving document:', error);
    return { success: false, error: 'Failed to archive document' };
  }
}
