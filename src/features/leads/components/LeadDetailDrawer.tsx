'use client';

/**
 * LeadDetailDrawer Component
 *
 * Drawer component for viewing and editing lead details.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  Tag,
  ExternalLink,
  Handshake,
  Loader2,
  Send,
  Pencil,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import { getLead, getLeadNotes, addLeadNote, deleteLeadNote, updateLeadNote } from '../actions';
import { getPipedriveCompanyDomain } from '@/features/pipedrive/actions';
import { EditLeadDialog } from './EditLeadDialog';
import type { Lead, LeadNote, LeadStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface LeadDetailDrawerProps {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
  onConvert?: (lead: Lead) => void;
}

// ============================================
// HELPERS
// ============================================

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-500' },
  contacted: { label: 'Contacted', color: 'bg-yellow-500' },
  qualified: { label: 'Qualified', color: 'bg-green-500' },
  proposal: { label: 'Proposal', color: 'bg-purple-500' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-500' },
  deal: { label: 'Deal', color: 'bg-cyan-500' },
  converted: { label: 'Customer', color: 'bg-emerald-500' },
  lost: { label: 'Lost', color: 'bg-red-500' },
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================
// COMPONENT
// ============================================

export function LeadDetailDrawer({
  leadId,
  open,
  onClose,
  onConvert,
}: LeadDetailDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [pipedriveCompanyDomain, setPipedriveCompanyDomain] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Fetch Pipedrive company domain on mount
  useEffect(() => {
    const fetchPipedriveDomain = async () => {
      const result = await getPipedriveCompanyDomain();
      if (result.success && result.data?.companyDomain) {
        setPipedriveCompanyDomain(result.data.companyDomain);
      }
    };
    fetchPipedriveDomain();
  }, []);

  useEffect(() => {
    if (open && leadId) {
      loadLead();
      loadNotes();
    } else {
      setLead(null);
      setNotes([]);
      setNewNote('');
    }
  }, [open, leadId]);

  // ----------------------------------------
  // DATA LOADING
  // ----------------------------------------

  const loadLead = async () => {
    if (!leadId) return;

    setIsLoading(true);
    try {
      const result = await getLead(leadId);
      if (result.success && result.data) {
        setLead(result.data);
      } else {
        toast.error(result.error || 'Failed to load lead');
      }
    } catch (error) {
      console.error('Load lead error:', error);
      toast.error('Failed to load lead');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNotes = async () => {
    if (!leadId) return;

    try {
      const result = await getLeadNotes(leadId);
      if (result.success && result.data) {
        setNotes(result.data);
      }
    } catch (error) {
      console.error('Load notes error:', error);
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleAddNote = async () => {
    if (!leadId || !newNote.trim()) return;

    setIsAddingNote(true);
    try {
      const result = await addLeadNote(leadId, newNote.trim());
      if (result.success && result.data) {
        setNotes((prev) => [result.data!, ...prev]);
        setNewNote('');
        toast.success('Note added');
      } else {
        toast.error(result.error || 'Failed to add note');
      }
    } catch (error) {
      console.error('Add note error:', error);
      toast.error('Failed to add note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!leadId) return;

    try {
      const result = await deleteLeadNote(noteId, leadId);
      if (result.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.success('Note deleted');
      } else {
        toast.error(result.error || 'Failed to delete note');
      }
    } catch (error) {
      console.error('Delete note error:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleStartEdit = (note: LeadNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async () => {
    if (!leadId || !editingNoteId || !editingContent.trim()) return;

    setIsSavingEdit(true);
    try {
      const result = await updateLeadNote(editingNoteId, leadId, editingContent.trim());
      if (result.success && result.data) {
        setNotes((prev) =>
          prev.map((n) => (n.id === editingNoteId ? result.data! : n))
        );
        setEditingNoteId(null);
        setEditingContent('');
        toast.success('Note updated');
      } else {
        toast.error(result.error || 'Failed to update note');
      }
    } catch (error) {
      console.error('Update note error:', error);
      toast.error('Failed to update note');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConvert = () => {
    if (lead && onConvert) {
      onConvert(lead);
    }
  };

  const handleViewInPipedrive = () => {
    if (!lead || !pipedriveCompanyDomain) {
      toast.error('Unable to open Pipedrive');
      return;
    }

    // Build the Pipedrive URL based on which ID we have
    let pipedriveUrl: string;

    if (lead.pipedriveLeadId) {
      // Lead from Leads Inbox - use leads/inbox URL
      pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/leads/inbox/${lead.pipedriveLeadId}`;
    } else if (lead.pipedrivePersonId) {
      // Lead from Persons - use person URL
      pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/person/${lead.pipedrivePersonId}`;
    } else if (lead.pipedriveDealId) {
      // Lead from Deals - use deal URL
      pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/deal/${lead.pipedriveDealId}`;
    } else {
      toast.error('No Pipedrive link available');
      return;
    }

    // Open in new tab
    window.open(pipedriveUrl, '_blank', 'noopener,noreferrer');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  const statusInfo = lead ? statusConfig[lead.status] : null;
  const isConvertedOrDeal = lead?.status === 'converted' || lead?.status === 'deal';
  const hasPipedrive = !!(lead?.pipedriveLeadId || lead?.pipedrivePersonId || lead?.pipedriveDealId);

  return (
    <>
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Lead Details</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : lead ? (
          <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
            <div className="space-y-6 py-4">
              {/* Header */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{lead.name}</h2>
                  {statusInfo && (
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  )}
                </div>
                {lead.company && (
                  <p className="text-muted-foreground">{lead.company}</p>
                )}
              </div>

              <Separator />

              {/* Contact Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Contact Information
                </h3>
                <div className="space-y-2">
                  {lead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-primary hover:underline"
                      >
                        {lead.email}
                      </a>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${lead.phone}`}
                        className="text-primary hover:underline"
                      >
                        {lead.phone}
                      </a>
                    </div>
                  )}
                  {(lead.addressStreet || lead.addressCity) && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        {lead.addressStreet && <div>{lead.addressStreet}</div>}
                        {(lead.addressCity || lead.addressState || lead.addressPostalCode) && (
                          <div>
                            {[lead.addressCity, lead.addressState, lead.addressPostalCode]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                        {lead.addressCountry && <div>{lead.addressCountry}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Lead Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Lead Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      Value
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(lead.dealValue)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Tag className="h-4 w-4" />
                      Stage
                    </div>
                    <div className="font-medium">{lead.dealStage || '-'}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Expected Close
                    </div>
                    <div className="font-medium">
                      {formatDate(lead.expectedCloseDate)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Probability
                    </div>
                    <div className="font-medium">
                      {lead.dealProbability != null
                        ? `${lead.dealProbability}%`
                        : '-'}
                    </div>
                  </div>
                  {lead.dealPipeline && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Pipeline
                      </div>
                      <div className="font-medium">{lead.dealPipeline}</div>
                    </div>
                  )}
                  {lead.dealTitle && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Lead Title
                      </div>
                      <div className="font-medium">{lead.dealTitle}</div>
                    </div>
                  )}
                  {/* Labels from Pipedrive */}
                  {lead.pipedriveLabels && lead.pipedriveLabels.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Labels
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {lead.pipedriveLabels.map((label, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className={
                              label.toLowerCase() === 'hot'
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : label.toLowerCase() === 'warm'
                                ? 'bg-orange-100 text-orange-800 border-orange-200'
                                : label.toLowerCase() === 'cold'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : label.toLowerCase() === 'qualified'
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-gray-100 text-gray-800 border-gray-200'
                            }
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner Info - Show if Pipedrive owner exists */}
              {lead.pipedriveOwnerName && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                      Owner
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{lead.pipedriveOwnerName}</span>
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Source Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Source
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {lead.source?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || 'Unknown'}
                    </Badge>
                  </div>
                  {lead.sourceDetail && (
                    <p className="text-sm text-muted-foreground">
                      {lead.sourceDetail}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                  Notes
                </h3>

                {/* Add Note */}
                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || isAddingNote}
                  >
                    {isAddingNote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Notes List with Scrollbar */}
                {notes.length > 0 ? (
                  <div className="h-[280px] w-full overflow-y-auto rounded-md border p-2">
                    <div className="space-y-3">
                      {notes.map((note) => (
                        <div
                          key={note.id}
                          className="group relative rounded-lg border bg-muted/50 p-3"
                        >
                          {editingNoteId === note.id ? (
                            // Edit Mode
                            <div className="space-y-2">
                              <Textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                rows={3}
                                className="w-full"
                                autoFocus
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  disabled={isSavingEdit}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={!editingContent.trim() || isSavingEdit}
                                >
                                  {isSavingEdit ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Save'
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <>
                              {/* Dropdown Menu */}
                              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => handleStartEdit(note)}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteNote(note.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <p className="text-sm pr-8">{note.content}</p>
                              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{note.createdByName || 'System'}</span>
                                <span>•</span>
                                <span>{formatDateTime(note.createdAt)}</span>
                                {note.pipedriveNoteId && (
                                  <>
                                    <span>•</span>
                                    <span>From Pipedrive</span>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No notes yet. Add one above.
                  </p>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2">
                {!isConvertedOrDeal && (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(true)}
                    className="w-full"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Lead
                  </Button>
                )}
                {!isConvertedOrDeal && onConvert && (
                  <Button onClick={handleConvert} className="w-full">
                    <Handshake className="mr-2 h-4 w-4" />
                    Convert to Deal
                  </Button>
                )}
                {hasPipedrive && (
                  <Button
                    variant="outline"
                    onClick={handleViewInPipedrive}
                    className="w-full"
                    disabled={!pipedriveCompanyDomain}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View in Pipedrive
                  </Button>
                )}
              </div>

              {/* Metadata */}
              <div className="text-xs text-muted-foreground">
                <p>Created: {formatDateTime(lead.createdAt)}</p>
                <p>Updated: {formatDateTime(lead.updatedAt)}</p>
                {lead.convertedAt && (
                  <p>Converted: {formatDateTime(lead.convertedAt)}</p>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Lead not found</p>
          </div>
        )}
      </SheetContent>
    </Sheet>

    {/* Edit Lead Dialog */}
    <EditLeadDialog
      open={isEditDialogOpen}
      onClose={() => setIsEditDialogOpen(false)}
      lead={lead}
      onSuccess={() => {
        loadLead();
        loadNotes();
      }}
    />
  </>
  );
}
