'use client';

/**
 * CustomerDocumentsTable Component
 *
 * Table displaying customer documents with actions.
 */

import { FileText, AlertTriangle, Clock } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

import { DocumentActions } from './DocumentActions';
import { isPreviewable, MIME_TYPE_LABELS } from '../constants';
import type { CustomerDocumentListItem } from '../types';
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS } from '../types';

// ============================================
// TYPES
// ============================================

interface CustomerDocumentsTableProps {
  documents: CustomerDocumentListItem[];
  onView?: (document: CustomerDocumentListItem) => void;
  onDownload?: (document: CustomerDocumentListItem) => void;
  onReplace?: (document: CustomerDocumentListItem) => void;
  onArchive?: (document: CustomerDocumentListItem) => void;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const label = MIME_TYPE_LABELS[mimeType] || 'Document';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="rounded-lg bg-muted p-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) {return <span className="text-muted-foreground">-</span>;}

  const date = new Date(expiryDate);
  const isExpired = isPast(date);
  const daysUntilExpiry = differenceInDays(date, new Date());
  const isExpiringSoon = !isExpired && daysUntilExpiry <= 30;

  if (isExpired) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Expired
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Expired on {format(date, 'MMM d, yyyy')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (isExpiringSoon) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
              <Clock className="h-3 w-3" />
              {daysUntilExpiry} days
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Expires on {format(date, 'MMM d, yyyy')}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span>{format(date, 'MMM d, yyyy')}</span>;
}

// ============================================
// COMPONENT
// ============================================

export function CustomerDocumentsTable({
  documents,
  onView,
  onDownload,
  onReplace,
  onArchive,
}: CustomerDocumentsTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow
                key={document.id}
                className={document.status === 'archived' ? 'opacity-60' : ''}
              >
                {/* Icon */}
                <TableCell>
                  <FileTypeIcon mimeType={document.mimeType} />
                </TableCell>

                {/* Document Name */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => isPreviewable(document.mimeType) && onView?.(document)}
                      className={`font-medium text-left ${
                        isPreviewable(document.mimeType)
                          ? 'hover:underline cursor-pointer text-primary'
                          : ''
                      }`}
                      disabled={!isPreviewable(document.mimeType)}
                    >
                      {document.fileName}
                    </button>
                    {document.version > 1 && (
                      <Badge variant="outline" className="text-xs">
                        v{document.version}
                      </Badge>
                    )}
                  </div>
                  {document.remarks && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                      {document.remarks}
                    </p>
                  )}
                </TableCell>

                {/* Document Type */}
                <TableCell>
                  <Badge variant="secondary">{document.documentTypeName}</Badge>
                </TableCell>

                {/* File Size */}
                <TableCell className="text-muted-foreground">
                  {document.formattedFileSize}
                </TableCell>

                {/* Expiry */}
                <TableCell>
                  <ExpiryBadge expiryDate={document.expiryDate} />
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge className={DOCUMENT_STATUS_COLORS[document.status]}>
                    {DOCUMENT_STATUS_LABELS[document.status]}
                  </Badge>
                </TableCell>

                {/* Uploaded Date */}
                <TableCell className="text-muted-foreground text-sm">
                  <div>{format(new Date(document.uploadedAt), 'MMM d, yyyy')}</div>
                  {document.uploadedByName && (
                    <div className="text-xs">{document.uploadedByName}</div>
                  )}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <DocumentActions
                    document={document}
                    onView={onView ? () => onView(document) : undefined}
                    onDownload={onDownload ? () => onDownload(document) : undefined}
                    onReplace={onReplace ? () => onReplace(document) : undefined}
                    onArchive={onArchive ? () => onArchive(document) : undefined}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
