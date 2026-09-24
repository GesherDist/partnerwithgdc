'use client';

/**
 * CustomerDocumentsTab Component
 *
 * Main tab component for displaying and managing customer documents.
 */

import { useState, useCallback, useEffect } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/shared/stores';

import { Button } from '@/shared/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';

import { EmptyDocuments } from './EmptyDocuments';
import { CustomerDocumentsTable } from './CustomerDocumentsTable';
import { UploadDocumentDrawer } from './UploadDocumentDrawer';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';

import { useCustomerDocuments } from '../hooks';
import { archiveDocument, getDocumentViewUrl } from '../actions';
import type { CustomerDocumentsTabProps, CustomerDocumentListItem } from '../types';

// ============================================
// COMPONENT
// ============================================

export function CustomerDocumentsTab({ customerId }: CustomerDocumentsTabProps) {
  const { hasPermission } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canUpload = hasMounted && hasPermission('customers.upload_document');
  const canView = hasMounted && hasPermission('customers.view_document');
  const canDownload = hasMounted && hasPermission('customers.download_document');
  const canReplace = hasMounted && hasPermission('customers.replace_document');
  const canArchive = hasMounted && hasPermission('customers.archive_document');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<CustomerDocumentListItem | null>(null);
  const [replaceDocument, setReplaceDocument] = useState<CustomerDocumentListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CustomerDocumentListItem | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // ----------------------------------------
  // DATA
  // ----------------------------------------

  const { data: documents, isLoading, isError, error, refetch } = useCustomerDocuments(customerId);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleUploadClick = () => {
    setIsUploadDrawerOpen(true);
  };

  const handleUploadClose = () => {
    setIsUploadDrawerOpen(false);
  };

  const handleUploadSuccess = () => {
    refetch();
  };

  const handleReplaceClick = (document: CustomerDocumentListItem) => {
    setReplaceDocument(document);
  };

  const handleReplaceClose = () => {
    setReplaceDocument(null);
  };

  const handleReplaceSuccess = () => {
    setReplaceDocument(null);
    refetch();
  };

  const handleView = (document: CustomerDocumentListItem) => {
    setPreviewDocument(document);
  };

  const handlePreviewClose = () => {
    setPreviewDocument(null);
  };

  const handleDownload = useCallback(async (document: CustomerDocumentListItem) => {
    try {
      const result = await getDocumentViewUrl(document.id);
      if (result.success && result.data) {
        const link = window.document.createElement('a');
        link.href = result.data;
        link.download = document.fileName;
        link.click();
      } else {
        toast.error(result.error || 'Failed to download document');
      }
    } catch {
      toast.error('Failed to download document');
    }
  }, []);

  const handleArchiveClick = (document: CustomerDocumentListItem) => {
    setArchiveTarget(document);
  };

  const handleArchiveCancel = () => {
    setArchiveTarget(null);
  };

  const handleArchiveConfirm = useCallback(async () => {
    if (!archiveTarget) {return;}

    setIsArchiving(true);
    try {
      const result = await archiveDocument(archiveTarget.id, customerId);
      if (result.success) {
        toast.success('Document archived successfully');
        setArchiveTarget(null);
        refetch();
      } else {
        toast.error(result.error || 'Failed to archive document');
      }
    } catch {
      toast.error('Failed to archive document');
    } finally {
      setIsArchiving(false);
    }
  }, [archiveTarget, customerId, refetch]);

  // ----------------------------------------
  // RENDER: LOADING
  // ----------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ----------------------------------------
  // RENDER: ERROR
  // ----------------------------------------

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-destructive mb-4">{error?.message || 'Failed to load documents'}</p>
        <Button variant="outline" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }

  // ----------------------------------------
  // RENDER: CONTENT
  // ----------------------------------------

  // Filter out archived documents by default (could add toggle later)
  const activeDocuments = documents.filter((doc) => doc.status !== 'archived');
  const hasDocuments = activeDocuments.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      {hasDocuments && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Documents ({activeDocuments.length})</h3>
          {canUpload && (
            <Button size="sm" onClick={handleUploadClick}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      {hasDocuments ? (
        <CustomerDocumentsTable
          documents={activeDocuments}
          onView={canView ? handleView : undefined}
          onDownload={canDownload ? handleDownload : undefined}
          onReplace={canReplace ? handleReplaceClick : undefined}
          onArchive={canArchive ? handleArchiveClick : undefined}
        />
      ) : (
        <EmptyDocuments onUploadClick={canUpload ? handleUploadClick : undefined} />
      )}

      {/* Upload Drawer */}
      <UploadDocumentDrawer
        customerId={customerId}
        open={isUploadDrawerOpen}
        onClose={handleUploadClose}
        onSuccess={handleUploadSuccess}
      />

      {/* Replace Drawer */}
      <UploadDocumentDrawer
        customerId={customerId}
        open={!!replaceDocument}
        onClose={handleReplaceClose}
        onSuccess={handleReplaceSuccess}
        mode="replace"
        documentToReplace={replaceDocument}
      />

      {/* Preview Dialog */}
      <DocumentPreviewDialog
        document={previewDocument}
        open={!!previewDocument}
        onClose={handlePreviewClose}
      />

      {/* Archive Confirmation */}
      <AlertDialog open={!!archiveTarget} onOpenChange={() => setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{archiveTarget?.fileName}</strong>?
              The document will be hidden from the active list but can still be accessed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleArchiveCancel} disabled={isArchiving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchiveConfirm}
              disabled={isArchiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArchiving ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
