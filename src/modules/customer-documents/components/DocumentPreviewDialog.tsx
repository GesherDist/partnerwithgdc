'use client';

/**
 * DocumentPreviewDialog Component
 *
 * Dialog to preview PDF and image documents.
 */

import { useState, useEffect } from 'react';
import { Loader2, Download, ExternalLink, FileText } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { getDocumentViewUrl } from '../actions';
import { isPreviewable, isPdf, isImage, MIME_TYPE_LABELS } from '../constants';
import type { DocumentPreviewDialogProps } from '../types';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS } from '../types';

// ============================================
// COMPONENT
// ============================================

export function DocumentPreviewDialog({
  document,
  open,
  onClose,
}: DocumentPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch signed URL when dialog opens
  useEffect(() => {
    if (open && document) {
      fetchUrl();
    } else {
      setUrl(null);
      setError(null);
    }
  }, [open, document?.id]);

  const fetchUrl = async () => {
    if (!document) {return;}

    setIsLoading(true);
    setError(null);

    try {
      const result = await getDocumentViewUrl(document.id);
      if (result.success && result.data) {
        setUrl(result.data);
      } else {
        setError(result.error || 'Failed to load document');
      }
    } catch {
      setError('Failed to load document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (url) {
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document?.fileName || 'document';
      link.click();
    }
  };

  const handleOpenNewTab = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (!document) {return null;}

  const canPreview = isPreviewable(document.mimeType);
  const fileTypeLabel = MIME_TYPE_LABELS[document.mimeType] || document.mimeType;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-lg">{document.fileName}</DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{document.documentTypeName}</span>
                <span>•</span>
                <span>{fileTypeLabel}</span>
                <span>•</span>
                <span>{document.formattedFileSize}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={DOCUMENT_STATUS_COLORS[document.status]}>
                {DOCUMENT_STATUS_LABELS[document.status]}
              </Badge>
              {document.version > 1 && (
                <Badge variant="outline">v{document.version}</Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Preview Content */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-lg border bg-muted/50">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={fetchUrl}>
                Try Again
              </Button>
            </div>
          ) : url && canPreview ? (
            isPdf(document.mimeType) ? (
              <iframe
                src={url}
                className="w-full h-[60vh]"
                title={document.fileName}
              />
            ) : isImage(document.mimeType) ? (
              <div className="flex items-center justify-center h-[60vh] p-4">
                <img
                  src={url}
                  alt={document.fileName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : null
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center p-6">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-2">
                Preview not available for this file type
              </p>
              <p className="text-sm text-muted-foreground mb-4">{fileTypeLabel}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {url && (
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleOpenNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in New Tab
            </Button>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
