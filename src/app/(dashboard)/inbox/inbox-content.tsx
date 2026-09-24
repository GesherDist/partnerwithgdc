'use client';

/**
 * Inbox Content Component
 *
 * Client component for displaying and managing inbound emails.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Paperclip,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Inbox as InboxIcon,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getInboundEmails,
  deleteInboundEmail,
} from '@/features/inbound-emails/actions';
import type { InboundEmail } from '@/features/inbound-emails/types';
import { ViewEmailDrawer } from '@/features/inbound-emails/components/ViewEmailDrawer';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

// ============================================
// STATUS BADGE COMPONENT
// ============================================

function StatusBadge({
  totalPdfAttachments = 0,
  processedPdfAttachments = 0,
}: {
  totalPdfAttachments?: number;
  processedPdfAttachments?: number;
}) {
  // If no PDF attachments, show "No PDFs"
  if (totalPdfAttachments === 0) {
    return (
      <Badge variant="outline" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        No PDFs
      </Badge>
    );
  }

  // All processed
  if (processedPdfAttachments === totalPdfAttachments) {
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Processed
      </Badge>
    );
  }

  // Partially processed
  if (processedPdfAttachments > 0) {
    return (
      <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-200">
        <Clock className="h-3 w-3" />
        ({processedPdfAttachments}/{totalPdfAttachments})
      </Badge>
    );
  }

  // None processed - Pending
  return (
    <Badge variant="secondary" className="gap-1">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

// ============================================
// MAIN INBOX CONTENT COMPONENT
// ============================================

export function InboxContent() {
  // State
  const [emails, setEmails] = useState<InboundEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<InboundEmail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });

  // Fetch emails
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getInboundEmails({
        page: meta.page,
        limit: meta.limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm || undefined,
      });

      if (result.success && result.data) {
        setEmails(result.data.data);
        setMeta(result.data.meta);
      } else {
        toast.error(result.error || 'Failed to fetch emails');
      }
    } catch (error) {
      console.error('Error fetching emails:', error);
      toast.error('Failed to fetch emails');
    } finally {
      setLoading(false);
    }
  }, [meta.page, meta.limit, statusFilter, searchTerm]);

  // Initial fetch
  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Handle view email
  const handleViewEmail = (email: InboundEmail) => {
    setSelectedEmail(email);
    setIsDrawerOpen(true);
  };

  // Handle delete email click - opens confirmation dialog
  const handleDeleteClick = (email: InboundEmail) => {
    setEmailToDelete(email);
    setDeleteDialogOpen(true);
  };

  // Confirm delete email
  const handleConfirmDelete = async () => {
    if (!emailToDelete) {
      return;
    }

    setIsDeleting(true);
    const result = await deleteInboundEmail(emailToDelete.id);

    if (result.success) {
      toast.success('Email deleted');
      fetchEmails();
    } else {
      toast.error(result.error || 'Failed to delete email');
    }

    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setEmailToDelete(null);
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setMeta((prev) => ({ ...prev, page: 1 }));
    fetchEmails();
  };

  // Handle drawer close
  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedEmail(null);
  };

  // Handle quote created from email
  const handleQuoteCreated = () => {
    fetchEmails();
    handleDrawerClose();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <InboxIcon className="h-6 w-6" />
            Inbox
          </h1>
          <p className="text-muted-foreground">
            Manage inbound emails and extract PO documents
          </p>
        </div>
        <Button onClick={fetchEmails} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by subject or sender..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="received">Pending</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      {/* Email List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Emails ({meta.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No emails yet</h3>
              <p className="text-muted-foreground mt-1">
                Send an email to your inbound address to get started
              </p>
              <code className="mt-4 px-4 py-2 bg-muted rounded-md text-sm">
                gesher_dev@inbound.gesher.dev-build.in
              </code>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[100px]">Attachments</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[150px]">Received</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow
                    key={email.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewEmail(email)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[280px]">
                          {email.from_name || email.from_email}
                        </span>
                        {email.from_name && (
                          <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                            {email.from_email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="truncate max-w-[400px] block">
                        {email.subject}
                      </span>
                    </TableCell>
                    <TableCell>
                      {email.has_attachments ? (
                        <Badge variant="outline" className="gap-1">
                          <Paperclip className="h-3 w-3" />
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        totalPdfAttachments={email.total_pdf_attachments}
                        processedPdfAttachments={email.processed_pdf_attachments}
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(email.received_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewEmail(email);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(email);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => setMeta((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setMeta((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Email Drawer */}
      <ViewEmailDrawer
        email={selectedEmail}
        open={isDrawerOpen}
        onClose={handleDrawerClose}
        onQuoteCreated={handleQuoteCreated}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this email
              {emailToDelete?.subject && (
                <>: <span className="font-medium">&quot;{emailToDelete.subject}&quot;</span></>
              )}
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
