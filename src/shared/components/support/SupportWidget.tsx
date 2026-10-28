'use client';

/**
 * Support Widget
 *
 * Floating "Help" button on every dashboard page. Jenny writes a message to
 * Jaimin and can attach screenshots or PDFs (pick, drag and drop, or paste);
 * the current page is added automatically.
 *
 * Shows on all dashboard pages for logged-in users. Currently UI preview only -
 * sending does not upload, save or email anything yet.
 * TODO: Upload files, save to database, email Jaimin (Postmark).
 */

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, FileText, LifeBuoy, MessageCircle, Paperclip, Upload, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores/auth.store';

const MAX_LENGTH = 2000;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];

interface Attachment {
  id: string;
  file: File;
  url: string;
  isImage: boolean;
}

/** "/sales-orders/123" → "Sales Orders" */
function pageLabel(pathname: string): string {
  const first = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  return first
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportWidget() {
  const pathname = usePathname();
  const appUser = useAuthStore((state) => state.appUser);
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [sent, setSent] = useState(false);

  // Free the preview URLs when the widget goes away
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => () => attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  // Show Help button in both development and production (user must be logged in)
  if (!appUser) {
    return null;
  }

  const addFiles = (files: File[]) => {
    setFileError(null);
    const room = MAX_FILES - attachments.length;
    if (room <= 0) {
      setFileError(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    const next: Attachment[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setFileError(`${file.name}: only images (PNG, JPG, GIF, WebP) and PDF files.`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setFileError(`${file.name} is larger than 5 MB.`);
        continue;
      }
      if (next.length >= room) {
        setFileError(`You can attach up to ${MAX_FILES} files.`);
        break;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/'),
      });
    }
    setAttachments((current) => [...current, ...next]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const gone = current.find((a) => a.id === id);
      if (gone) {
        URL.revokeObjectURL(gone.url);
      }
      return current.filter((a) => a.id !== id);
    });
    setFileError(null);
  };

  const reset = () => {
    attachments.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
    setMessage('');
    setFileError(null);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSent(false);
    }
  };

  const handleSend = () => {
    // Preview: nothing is uploaded, saved or emailed yet
    reset();
    setSent(true);
  };

  // Ctrl+V a screenshot straight into the message box
  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button size="lg" className="rounded-full shadow-lg gap-2 pl-4 pr-5">
            <MessageCircle className="h-5 w-5" />
            Help
          </Button>
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="end"
          sideOffset={12}
          className="w-[380px] overflow-hidden p-0 shadow-xl"
          // Keep the form open while a file preview is shown
          onInteractOutside={(e) => preview && e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <div className="mt-0.5 rounded-full bg-primary-foreground/15 p-1.5">
              <LifeBuoy className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">Help &amp; Support</p>
              <p className="text-xs text-primary-foreground/80">Message Jaimin. You will get a reply by email.</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
              onClick={() => handleOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <div className="rounded-full bg-emerald-50 p-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold">Message sent</p>
              <p className="text-xs text-muted-foreground">Jaimin will get back to you by email.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSent(false)}>
                Send another message
              </Button>
            </div>
          ) : (
            <div
              className="space-y-4 px-4 py-4"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="support-message">What do you need help with?</Label>
                <Textarea
                  id="support-message"
                  rows={4}
                  maxLength={MAX_LENGTH}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="For example: SO 41 is not showing in the GDC 1 tab"
                  className="resize-none"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Tip: paste a screenshot with Ctrl+V</span>
                  <span>
                    {message.length}/{MAX_LENGTH}
                  </span>
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => {
                    addFiles(Array.from(e.target.files ?? []));
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={attachments.length >= MAX_FILES}
                  className={cn(
                    'flex w-full flex-col items-center gap-1 rounded-md border border-dashed px-3 py-3 text-center transition-colors',
                    'hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50',
                    dragging && 'border-primary bg-primary/5'
                  )}
                >
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">
                    {dragging ? 'Drop files here' : 'Attach screenshots or files'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    PNG, JPG, PDF · up to {MAX_FILES} files, 5 MB each
                  </span>
                </button>

                {fileError && <p className="text-xs text-destructive">{fileError}</p>}

                {attachments.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {attachments.map((a) => (
                      <div key={a.id} className="group relative overflow-hidden rounded-md border bg-muted/40">
                        <button
                          type="button"
                          onClick={() => setPreview(a)}
                          className="block h-20 w-full"
                          title={`Preview ${a.file.name}`}
                        >
                          {a.isImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.url} alt={a.file.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-1 px-1">
                              <FileText className="h-6 w-6 text-red-600" />
                              <span className="w-full truncate text-[10px] text-muted-foreground">{a.file.name}</span>
                            </div>
                          )}
                        </button>
                        <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1 py-0.5 text-[10px] text-white">
                          {fileSize(a.file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                          title="Remove"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <div className="min-w-0 text-[11px] text-muted-foreground">
                  <p className="truncate">
                    Page: <span className="font-medium text-foreground">{pageLabel(pathname)}</span>
                  </p>
                  {attachments.length > 0 && (
                    <p className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {attachments.length} file{attachments.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                <Button size="sm" disabled={!message.trim()} onClick={handleSend}>
                  Send message
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Large preview */}
      <Dialog open={Boolean(preview)} onOpenChange={(next) => !next && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="truncate pr-6 text-sm">{preview?.file.name}</DialogTitle>
          {preview &&
            (preview.isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt={preview.file.name} className="max-h-[70vh] w-full rounded-md object-contain" />
            ) : (
              <iframe src={preview.url} title={preview.file.name} className="h-[70vh] w-full rounded-md border" />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
