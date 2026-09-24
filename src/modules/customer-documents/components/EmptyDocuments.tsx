'use client';

/**
 * EmptyDocuments Component
 *
 * Empty state displayed when customer has no documents.
 */

import { FileText, Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

// ============================================
// TYPES
// ============================================

interface EmptyDocumentsProps {
  onUploadClick?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function EmptyDocuments({ onUploadClick }: EmptyDocumentsProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No documents uploaded</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {onUploadClick
          ? 'Upload compliance documents such as W-9, tax exemption certificates, credit applications, and signed terms.'
          : 'No documents have been uploaded for this customer.'}
      </p>
      {onUploadClick && (
        <Button onClick={onUploadClick}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      )}
    </div>
  );
}
