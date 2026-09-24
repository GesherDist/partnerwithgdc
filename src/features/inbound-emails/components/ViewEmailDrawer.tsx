'use client';

/**
 * View Email Drawer Component
 *
 * Displays email details, body, and attachments.
 * Allows extracting PDF attachments to create quotes.
 */

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  Paperclip,
  Download,
  FileText,
  Clock,
  User,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  getInboundEmail,
  getAttachmentUrl,
} from '@/features/inbound-emails/actions';
import type {
  InboundEmail,
  InboundEmailWithAttachments,
  InboundEmailAttachment,
} from '@/features/inbound-emails/types';
import { ExtractPOFromEmailDialog } from './ExtractPOFromEmailDialog';
import { format } from 'date-fns';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface ViewEmailDrawerProps {
  email: InboundEmail | null;
  open: boolean;
  onClose: () => void;
  onQuoteCreated?: () => void;
}

// ============================================
// ATTACHMENT ITEM COMPONENT
// ============================================

function AttachmentItem({
  attachment,
  onExtract,
}: {
  attachment: InboundEmailAttachment;
  onExtract: (attachment: InboundEmailAttachment) => void;
}) {
  const [downloading, setDownloading] = useState(false);

  // Check if file is actually stored (has stored_path)
  const hasFile = !!attachment.stored_path;

  const handleDownload = async () => {
    if (!hasFile) {
      toast.error('File not available. Enable "Include raw email content" in Postmark settings and resend the email.');
      return;
    }
    setDownloading(true);
    try {
      const result = await getAttachmentUrl(attachment.id);
      if (result.success && result.data) {
        window.open(result.data.url, '_blank');
      } else {
        toast.error(result.error || 'Failed to get download URL');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`flex items-center justify-between p-3 border rounded-lg ${hasFile ? 'bg-muted/30' : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded ${hasFile ? 'bg-primary/10' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
          <FileText className={`h-5 w-5 ${hasFile ? 'text-primary' : 'text-amber-600 dark:text-amber-400'}`} />
        </div>
        <div>
          <p className="font-medium text-sm">{attachment.filename}</p>
          <p className="text-xs text-muted-foreground">
            {attachment.mime_type} • {formatFileSize(attachment.size)}
            {!hasFile && <span className="text-amber-600 dark:text-amber-400 ml-2">(File not stored)</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={downloading || !hasFile}
          title={!hasFile ? 'File not available' : 'Download file'}
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        {attachment.is_pdf && !attachment.quote_id && (
          <Button
            size="sm"
            onClick={() => onExtract(attachment)}
            disabled={!hasFile}
            title={!hasFile ? 'File not available' : 'Generate a Quote from PDF'}
          >
            Generate a Quote
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
        {attachment.quote_id && (
          <Badge variant="secondary" className="gap-1">
            <FileText className="h-3 w-3" />
            Processed
          </Badge>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN DRAWER COMPONENT
// ============================================

export function ViewEmailDrawer({
  email,
  open,
  onClose,
  onQuoteCreated,
}: ViewEmailDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [emailDetails, setEmailDetails] = useState<InboundEmailWithAttachments | null>(null);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<InboundEmailAttachment | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  // Fetch email details when opened
  useEffect(() => {
    if (open && email) {
      fetchEmailDetails(email.id);
    } else {
      setEmailDetails(null);
    }
  }, [open, email]);

  const fetchEmailDetails = async (id: string) => {
    setLoading(true);
    try {
      const result = await getInboundEmail(id);
      if (result.success && result.data) {
        setEmailDetails(result.data);
      } else {
        toast.error(result.error || 'Failed to fetch email details');
      }
    } catch (error) {
      console.error('Error fetching email details:', error);
      toast.error('Failed to fetch email details');
    } finally {
      setLoading(false);
    }
  };

  const handleExtractPO = async (attachment: InboundEmailAttachment) => {
    try {
      // Get attachment URL
      const urlResult = await getAttachmentUrl(attachment.id);
      if (!urlResult.success || !urlResult.data) {
        toast.error(urlResult.error || 'Failed to get attachment URL');
        return;
      }

      // Set state and open extract dialog
      setSelectedAttachment(attachment);
      setAttachmentUrl(urlResult.data.url);
      setExtractDialogOpen(true);
    } catch (error) {
      console.error('Extract PO error:', error);
      toast.error('Failed to extract PO');
    }
  };

  const handleExtractSuccess = () => {
    // Close the extract dialog
    setExtractDialogOpen(false);
    setSelectedAttachment(null);
    setAttachmentUrl(null);

    // Notify parent (to refresh list if needed)
    onQuoteCreated?.();
  };

  if (!email) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Details
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : emailDetails ? (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-6 pb-6">
              {/* Email Header */}
              <div className="space-y-4">
                {/* Subject */}
                <div>
                  <h2 className="text-xl font-semibold">{emailDetails.subject}</h2>
                </div>

                {/* From */}
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-full">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {emailDetails.from_name || emailDetails.from_email}
                    </p>
                    {emailDetails.from_name && (
                      <p className="text-sm text-muted-foreground">
                        {emailDetails.from_email}
                      </p>
                    )}
                  </div>
                </div>

                {/* To */}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">To:</span>
                  <span>{emailDetails.to_email}</span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {format(new Date(emailDetails.received_at), 'PPpp')}
                </div>
              </div>

              <Separator />

              {/* Attachments */}
              {emailDetails.attachments && emailDetails.attachments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments ({emailDetails.attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {emailDetails.attachments.map((attachment) => (
                      <AttachmentItem
                        key={attachment.id}
                        attachment={attachment}
                        onExtract={handleExtractPO}
                      />
                    ))}
                  </div>
                </div>
              )}

              {emailDetails.attachments && emailDetails.attachments.length > 0 && (
                <Separator />
              )}

              {/* Email Body */}
              <div className="space-y-3">
                <h3 className="font-medium">Message</h3>
                {emailDetails.html_body ? (
                  <div
                    className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-lg overflow-auto"
                    dangerouslySetInnerHTML={{ __html: emailDetails.html_body }}
                  />
                ) : emailDetails.text_body ? (
                  <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg overflow-auto font-sans">
                    {emailDetails.text_body}
                  </pre>
                ) : (
                  <p className="text-muted-foreground italic">No message body</p>
                )}
              </div>

            </div>
          </ScrollArea>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            No email selected
          </div>
        )}
      </SheetContent>

      {/* Extract PO Dialog */}
      <ExtractPOFromEmailDialog
        open={extractDialogOpen}
        attachment={selectedAttachment}
        attachmentUrl={attachmentUrl}
        onClose={() => {
          setExtractDialogOpen(false);
          setSelectedAttachment(null);
          setAttachmentUrl(null);
        }}
        onSuccess={handleExtractSuccess}
      />
    </Sheet>
  );
}
