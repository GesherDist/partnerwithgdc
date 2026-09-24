'use client';

/**
 * DocumentActions Component
 *
 * Dropdown menu with actions for a document row.
 */

import { MoreHorizontal, Eye, Download, RefreshCw, Archive } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import type { DocumentActionsProps } from '../types';

// ============================================
// COMPONENT
// ============================================

export function DocumentActions({
  document,
  onView,
  onDownload,
  onReplace,
  onArchive,
}: DocumentActionsProps) {
  const isArchived = document.status === 'archived';

  // Check if any actions are available
  const hasAnyAction = onView || onDownload || onReplace || onArchive;

  // Don't render if no actions available
  if (!hasAnyAction) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem onClick={onView}>
            <Eye className="mr-2 h-4 w-4" />
            View
          </DropdownMenuItem>
        )}
        {onDownload && (
          <DropdownMenuItem onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
        )}
        {!isArchived && (onReplace || onArchive) && (
          <>
            {(onView || onDownload) && <DropdownMenuSeparator />}
            {onReplace && (
              <DropdownMenuItem onClick={onReplace}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Replace
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem
                onClick={onArchive}
                className="text-destructive focus:text-destructive"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
