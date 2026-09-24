'use client';

/**
 * DealDetailDrawer Component
 *
 * Drawer for displaying deal details.
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Handshake,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  Target,
  Trash2,
  ExternalLink,
  CheckCircle,
  XCircle,
  UserPlus,
  MapPin,
  Pencil,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Separator } from '@/shared/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

import { getDeal, getDealNotes, addDealNote, deleteDealNote, markDealAsWon, markDealAsLost } from '../actions';
import { getPipedriveCompanyDomain } from '@/features/pipedrive/actions';
import type { Deal, DealNote, DealStatus } from '../types';
import { ConvertDealToCustomerDialog } from './ConvertDealToCustomerDialog';
import { EditDealDialog } from './EditDealDialog';

// ============================================
// TYPES
// ============================================

interface DealDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  dealId: string | null;
  onRefresh?: () => void;
}

// ============================================
// HELPERS
// ============================================

const statusColors: Record<DealStatus, string> = {
  open: 'bg-blue-100 text-blue-800 border-blue-200',
  won: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  lost: 'bg-red-100 text-red-800 border-red-200',
};

function formatCurrency(value: number | null | undefined, currency?: string): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================
// COMPONENT
// ============================================

export function DealDetailDrawer({
  open,
  onClose,
  dealId,
  onRefresh,
}: DealDetailDrawerProps) {
  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [deal, setDeal] = useState<Deal | null>(null);
  const [notes, setNotes] = useState<DealNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pipedriveCompanyDomain, setPipedriveCompanyDomain] = useState<string | null>(null);
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

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
    if (open && dealId) {
      fetchDeal();
      fetchNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dealId]);

  // ----------------------------------------
  // FETCH FUNCTIONS
  // ----------------------------------------

  const fetchDeal = async () => {
    if (!dealId) return;

    setIsLoading(true);
    try {
      const result = await getDeal(dealId);
      if (result.success) {
        setDeal(result.data);
      } else {
        toast.error('Failed to load deal');
      }
    } catch (error) {
      console.error('Error fetching deal:', error);
      toast.error('Failed to load deal');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotes = async () => {
    if (!dealId) return;

    try {
      const result = await getDealNotes(dealId);
      if (result.success) {
        setNotes(result.data);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleAddNote = async () => {
    if (!dealId || !newNote.trim()) return;

    setIsAddingNote(true);
    try {
      const result = await addDealNote(dealId, newNote.trim());
      if (result.success) {
        setNotes((prev) => [result.data, ...prev]);
        setNewNote('');
        toast.success('Note added');
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!dealId) return;

    try {
      const result = await deleteDealNote(noteId, dealId);
      if (result.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        toast.success('Note deleted');
      } else {
        toast.error('Failed to delete note');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleMarkAsWon = async () => {
    if (!dealId) return;

    setIsUpdating(true);
    try {
      const result = await markDealAsWon(dealId);
      if (result.success) {
        setDeal(result.data);
        toast.success('Deal marked as won!');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to update deal');
      }
    } catch (error) {
      console.error('Mark as won error:', error);
      toast.error('Failed to update deal');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkAsLost = async () => {
    if (!dealId) return;

    setIsUpdating(true);
    try {
      const result = await markDealAsLost(dealId);
      if (result.success) {
        setDeal(result.data);
        toast.success('Deal marked as lost');
        onRefresh?.();
      } else {
        toast.error(result.error || 'Failed to update deal');
      }
    } catch (error) {
      console.error('Mark as lost error:', error);
      toast.error('Failed to update deal');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewInPipedrive = () => {
    if (!pipedriveCompanyDomain || !deal?.pipedriveDealId) {
      toast.error('Unable to open Pipedrive');
      return;
    }

    const pipedriveUrl = `https://${pipedriveCompanyDomain}.pipedrive.com/deal/${deal.pipedriveDealId}`;
    window.open(pipedriveUrl, '_blank', 'noopener,noreferrer');
  };

  const handleConvertToCustomer = () => {
    setIsConvertDialogOpen(true);
  };

  const handleConvertSuccess = (_customerId: string, _quoteId: string) => {
    setIsConvertDialogOpen(false);
    onRefresh?.();
    onClose();
  };

  const handleConvertCancel = () => {
    setIsConvertDialogOpen(false);
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5" />
            Deal Details
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : deal ? (
          <div className="mt-6 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-xl font-semibold">{deal.title}</h2>
              {deal.organizationName && (
                <p className="text-muted-foreground">{deal.organizationName}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge className={statusColors[deal.status]}>
                  {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                </Badge>
                {deal.pipedriveDealId && (
                  <Badge variant="outline" className="text-xs">
                    Pipedrive
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Quick Actions - Status Update */}
            {deal.status === 'open' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAsWon}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                    Mark as Won
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAsLost}
                    disabled={isUpdating}
                    className="w-full"
                  >
                    <XCircle className="mr-2 h-4 w-4 text-red-600" />
                    Mark as Lost
                  </Button>
                </div>
                <Separator />
              </>
            )}

            {/* Contact Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                Contact Information
              </h3>
              <div className="space-y-2">
                {deal.contactEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{deal.contactEmail}</span>
                  </div>
                )}
                {deal.contactPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{deal.contactPhone}</span>
                  </div>
                )}
                {(deal.organizationAddressStreet || deal.organizationAddressCity) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      {deal.organizationAddressStreet && (
                        <div>{deal.organizationAddressStreet}</div>
                      )}
                      {(deal.organizationAddressCity || deal.organizationAddressState || deal.organizationAddressPostalCode) && (
                        <div>
                          {[
                            deal.organizationAddressCity,
                            deal.organizationAddressState,
                            deal.organizationAddressPostalCode
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      )}
                      {deal.organizationAddressCountry && (
                        <div>{deal.organizationAddressCountry}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Deal Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                Deal Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    Value
                  </div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(deal.value, deal.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Stage</div>
                  <div className="font-medium">{deal.stageName || '-'}</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    Expected Close
                  </div>
                  <div className="font-medium">{formatDate(deal.expectedCloseDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Probability</div>
                  <div className="font-medium">
                    {deal.probability != null ? `${deal.probability}%` : '-'}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Target className="h-4 w-4" />
                    Pipeline
                  </div>
                  <div className="font-medium">{deal.pipelineName || '-'}</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Source */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                Source
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {deal.pipedriveDealId ? 'Pipedrive' : 'API'}
                </Badge>
              </div>
            </div>

            {/* Lost Reason */}
            {deal.status === 'lost' && deal.lostReason && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase text-muted-foreground">Lost Reason</h3>
                  <p className="text-red-600">{deal.lostReason}</p>
                </div>
              </>
            )}

            <Separator />

            {/* Notes */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">
                Notes
              </h3>

              {/* Add Note */}
              <div className="space-y-2 mb-4">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isAddingNote}
                >
                  {isAddingNote ? 'Adding...' : 'Add Note'}
                </Button>
              </div>

              {/* Notes List */}
              <div className="h-[200px] w-full overflow-y-auto rounded-md border p-2">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No notes yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="group relative rounded-lg border p-3 text-sm hover:bg-muted/50"
                      >
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {note.createdByName || 'Unknown'} -{' '}
                            {formatDate(note.createdAt)}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Note
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {note.pipedriveNoteId && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            Synced to Pipedrive
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Bottom Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(true)}
                className="w-full"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit Deal
              </Button>

              {deal.status === 'won' && !deal.customerId ? (
                <Button
                  variant="default"
                  onClick={handleConvertToCustomer}
                  className="w-full"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Convert to Customer
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled
                  className="w-full opacity-50"
                  title={deal.customerId ? 'Already converted to customer' : 'Only won deals can be converted'}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {deal.customerId ? 'Already Converted' : 'Convert to Customer'}
                </Button>
              )}

              {deal.pipedriveDealId && pipedriveCompanyDomain ? (
                <Button
                  variant="outline"
                  onClick={handleViewInPipedrive}
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View in Pipedrive
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled
                  className="w-full opacity-50"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View in Pipedrive
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Deal not found</p>
          </div>
        )}

        {/* Convert to Customer Dialog */}
        <ConvertDealToCustomerDialog
          open={isConvertDialogOpen}
          onClose={handleConvertCancel}
          deal={deal}
          onSuccess={handleConvertSuccess}
        />

        {/* Edit Deal Dialog */}
        <EditDealDialog
          open={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          deal={deal}
          onSuccess={() => {
            fetchDeal();
            onRefresh?.();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
