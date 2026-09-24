'use client';

/**
 * UploadDocumentDrawer Component
 *
 * Drawer for uploading a new customer document.
 */

import { useState, useCallback, useRef } from 'react';
import { Loader2, Upload, X, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';

import { useDocumentTypes } from '../hooks';
import { uploadDocument, replaceDocument } from '../actions';
import {
  ACCEPT_STRING,
  MAX_FILE_SIZE,
  MAX_FILE_SIZE_LABEL,
  formatFileSize,
  isAllowedMimeType,
  MIME_TYPE_LABELS,
} from '../constants';
import type { UploadDocumentDrawerProps, CustomerDocumentListItem } from '../types';

// ============================================
// EXTENDED PROPS (for replace mode)
// ============================================

interface ExtendedUploadDocumentDrawerProps extends UploadDocumentDrawerProps {
  mode?: 'upload' | 'replace';
  documentToReplace?: CustomerDocumentListItem | null;
}

// ============================================
// COMPONENT
// ============================================

export function UploadDocumentDrawer({
  customerId,
  open,
  onClose,
  onSuccess,
  mode = 'upload',
  documentToReplace = null,
}: ExtendedUploadDocumentDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [file, setFile] = useState<File | null>(null);
  const [documentTypeId, setDocumentTypeId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------
  // DATA
  // ----------------------------------------

  const { data: documentTypes, isLoading: typesLoading } = useDocumentTypes();

  // ----------------------------------------
  // HELPERS
  // ----------------------------------------

  const resetForm = useCallback(() => {
    setFile(null);
    setDocumentTypeId('');
    setExpiryDate('');
    setRemarks('');
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (!isAllowedMimeType(file.type)) {
      return `File type "${file.type}" is not allowed. Please upload a PDF, image, Word document, or Excel file.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size (${formatFileSize(file.size)}) exceeds the maximum allowed size of ${MAX_FILE_SIZE_LABEL}.`;
    }
    return null;
  }, []);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleClose = () => {
    if (isSubmitting) {return;}
    resetForm();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setFileError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const error = validateFile(selectedFile);
    if (error) {
      setFileError(error);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setFile(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setFileError('Please select a file to upload');
      return;
    }

    if (mode === 'upload' && !documentTypeId) {
      toast.error('Please select a document type');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (mode === 'replace' && documentToReplace) {
        formData.append('documentId', documentToReplace.id);
        if (expiryDate) {formData.append('expiryDate', expiryDate);}
        if (remarks) {formData.append('remarks', remarks);}

        const result = await replaceDocument(formData);

        if (result.success && result.data) {
          toast.success('Document replaced successfully');
          resetForm();
          onSuccess?.(result.data);
          onClose();
        } else {
          toast.error(result.error || 'Failed to replace document');
        }
      } else {
        formData.append('customerId', customerId);
        formData.append('documentTypeId', documentTypeId);
        if (expiryDate) {formData.append('expiryDate', expiryDate);}
        if (remarks) {formData.append('remarks', remarks);}

        const result = await uploadDocument(formData);

        if (result.success && result.data) {
          toast.success('Document uploaded successfully');
          resetForm();
          onSuccess?.(result.data);
          onClose();
        } else {
          toast.error(result.error || 'Failed to upload document');
        }
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  const isReplace = mode === 'replace' && documentToReplace;
  const title = isReplace ? 'Replace Document' : 'Upload Document';
  const description = isReplace
    ? `Replace "${documentToReplace.fileName}" with a new version`
    : 'Upload a new compliance document';
  const submitLabel = isReplace ? 'Replace' : 'Upload';

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[500px]"
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-xl font-semibold">{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="px-6 py-6 space-y-6">
              {/* Document Type (only for upload mode) */}
              {!isReplace && (
                <div className="space-y-2">
                  <Label htmlFor="documentType">
                    Document Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={documentTypeId}
                    onValueChange={setDocumentTypeId}
                    disabled={typesLoading}
                  >
                    <SelectTrigger id="documentType">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="file">
                  File <span className="text-destructive">*</span>
                </Label>

                {file ? (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {MIME_TYPE_LABELS[file.type] || file.type} • {formatFileSize(file.size)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, images, Word, Excel up to {MAX_FILE_SIZE_LABEL}
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept={ACCEPT_STRING}
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {fileError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{fileError}</AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Set if this document expires (e.g., tax exemption certificates).
                </p>
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any notes about this document..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <Separator />
          <SheetFooter className="flex-shrink-0 border-t px-6 py-4">
            <div className="flex w-full items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !file}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitLabel}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
