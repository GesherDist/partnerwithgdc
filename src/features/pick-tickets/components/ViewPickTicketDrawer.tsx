'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Progress } from '@/shared/components/ui/progress';
import {
  Pencil,
  Play,
  Package,
  Warehouse,
  User,
  FileText,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
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
import { cn } from '@/shared/lib/utils';
import { PdfViewerModal } from '@/shared/components/pdf-viewer';
import { usePickTicket } from '../hooks/usePickTicket';
import { createPackingListFromPickTicket } from '../actions/packing-list.actions';
import { completePicking, startPicking, pickItem, transitionPickTicketStatus } from '../actions';
import {
  PICK_TICKET_STATUS_COLORS,
  PICK_TICKET_STATUS_LABELS,
  PICK_TICKET_PRIORITY_COLORS,
  PICK_TICKET_PRIORITY_LABELS,
} from '../types';
import type { ViewPickTicketDrawerProps } from '../types';

export function ViewPickTicketDrawer({
  open,
  onClose,
  pickTicketId,
  onEdit,
  // onStartPicking is accepted for API compatibility but unused: this drawer
  // starts picking through its own handleStartPicking below.
  onPackingListCreated,
}: ViewPickTicketDrawerProps) {
  const { data: pickTicket, isLoading, refetch } = usePickTicket(open ? pickTicketId : null);
  const [isCreatingPackingList, setIsCreatingPackingList] = useState(false);
  const [isStartingPicking, setIsStartingPicking] = useState(false);
  const [isCompletingPicking, setIsCompletingPicking] = useState(false);
  const [pickingItemId, setPickingItemId] = useState<string | null>(null);
  const [showShippedEditConfirm, setShowShippedEditConfirm] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfModalType, setPdfModalType] = useState<'pickTicket' | 'packingList'>('pickTicket');

  // Allow editing for all statuses except cancelled (per Ankur/Jenny feedback Aug 26)
  const canEdit = pickTicket && pickTicket.status !== 'cancelled';
  const isShipped = pickTicket?.status === 'shipped';
  const canStartPicking = pickTicket && pickTicket.status === 'assigned';

  // Show "Complete Picking" button when status is 'picking' or 'picked' AND no packing list exists
  const canCompletePicking = pickTicket &&
    ['picking', 'picked'].includes(pickTicket.status) &&
    !pickTicket.packingList;

  // Show "Create Packing List" button ONLY when status is exactly 'picked' AND no packing list exists
  const canCreatePackingList = pickTicket &&
    pickTicket.status === 'picked' &&
    !pickTicket.packingList;

  const handleViewPdf = () => {
    if (!pickTicket) { return; }
    setPdfModalType('pickTicket');
    setShowPdfModal(true);
  };

  const handleViewPackingListPdf = () => {
    if (!pickTicket?.packingList) { return; }
    setPdfModalType('packingList');
    setShowPdfModal(true);
  };

  const handleCreatePackingList = async () => {
    if (!pickTicket) { return; }

    setIsCreatingPackingList(true);
    try {
      const result = await createPackingListFromPickTicket(pickTicket.id);
      if (result.success) {
        toast.success('Packing list created successfully');
        refetch();
        onPackingListCreated?.();
      } else {
        toast.error(result.error || 'Failed to create packing list');
      }
    } catch {
      toast.error('Failed to create packing list');
    } finally {
      setIsCreatingPackingList(false);
    }
  };

  const handleStartPicking = async () => {
    if (!pickTicket) { return; }

    setIsStartingPicking(true);
    try {
      const result = await startPicking(pickTicket.id);
      if (result.success) {
        toast.success('Picking started');
        refetch();
      } else {
        toast.error(result.error || 'Failed to start picking');
      }
    } catch {
      toast.error('Failed to start picking');
    } finally {
      setIsStartingPicking(false);
    }
  };

  const handleCompletePicking = async () => {
    if (!pickTicket) { return; }

    setIsCompletingPicking(true);
    try {
      const result = await completePicking(pickTicket.id);
      if (result.success) {
        toast.success('Picking completed and shipped successfully');
        refetch();
        onClose();
      } else {
        toast.error(result.error || 'Failed to complete picking');
      }
    } catch {
      toast.error('Failed to complete picking');
    } finally {
      setIsCompletingPicking(false);
    }
  };

  const handlePickItem = async (itemId: string, currentPicked: number, quantityToPick: number, increment: number) => {
    if (!pickTicket) { return; }

    const newQuantity = Math.max(0, Math.min(quantityToPick, currentPicked + increment));
    if (newQuantity === currentPicked) { return; }

    setPickingItemId(itemId);
    try {
      const result = await pickItem(pickTicket.id, {
        pickTicketItemId: itemId,
        quantityPicked: newQuantity,
      });
      if (result.success) {
        // Check if all items will now be fully picked after this update
        const allItemsPicked = pickTicket.items.every((item) => {
          if (item.id === itemId) {
            // Use the new quantity for this item
            return newQuantity >= item.quantityToPick;
          }
          // Use current quantity for other items
          return item.quantityPicked >= item.quantityToPick;
        });

        // Auto-transition to 'picked' status when all items are picked
        if (allItemsPicked && pickTicket.status === 'picking') {
          const transitionResult = await transitionPickTicketStatus(pickTicket.id, 'picked');
          if (transitionResult.success) {
            toast.success('All items picked! Ready to complete.');
          }
        }

        refetch();
      } else {
        toast.error(result.error || 'Failed to update picked quantity');
      }
    } catch {
      toast.error('Failed to update picked quantity');
    } finally {
      setPickingItemId(null);
    }
  };

  const handlePickAll = async (itemId: string, quantityToPick: number) => {
    await handlePickItem(itemId, 0, quantityToPick, quantityToPick);
  };

  const handleDirectInput = async (itemId: string, value: string, quantityToPick: number) => {
    const newQuantity = parseInt(value, 10);
    if (isNaN(newQuantity) || newQuantity < 0) {
      return;
    }
    const clampedQuantity = Math.min(newQuantity, quantityToPick);
    await handlePickItem(itemId, 0, quantityToPick, clampedQuantity);
  };

  // Check if picking is active (can pick items)
  const canPickItems = pickTicket && pickTicket.status === 'picking';

  // Calculate progress
  const totalQuantity = pickTicket?.items.reduce((sum, item) => sum + item.quantityToPick, 0) || 0;
  const pickedQuantity = pickTicket?.items.reduce((sum, item) => sum + item.quantityPicked, 0) || 0;
  const progressPercentage = totalQuantity > 0 ? Math.round((pickedQuantity / totalQuantity) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </>
              ) : pickTicket ? (
                <>
                  <SheetTitle className="text-xl">{pickTicket.pickTicketNumber}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {new Date(pickTicket.createdAt).toLocaleDateString()}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-6 space-y-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : pickTicket ? (
          <div className="mt-6 space-y-6">
            {/* Progress Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Picking Progress
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items Picked</span>
                  <span className="font-medium">{pickedQuantity} / {totalQuantity}</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            </div>

            <Separator />

            {/* Sales Order Information */}
            {pickTicket.salesOrder && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Sales Order
                </h3>
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium font-mono">{pickTicket.salesOrder.orderNumber}</p>
                    <p className="text-muted-foreground">{pickTicket.salesOrder.customerName}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Priority:</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium',
                        PICK_TICKET_PRIORITY_COLORS[pickTicket.priority]
                      )}
                    >
                      {PICK_TICKET_PRIORITY_LABELS[pickTicket.priority]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-medium',
                        PICK_TICKET_STATUS_COLORS[pickTicket.status]
                      )}
                    >
                      {PICK_TICKET_STATUS_LABELS[pickTicket.status]}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Warehouse & Assignment */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Warehouse & Assignment
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Warehouse className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Warehouse</p>
                    <p className="font-medium">
                      {pickTicket.warehouse?.name || 'Not specified'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Assigned To</p>
                    <p className="font-medium">
                      {pickTicket.assignedContact
                        ? pickTicket.assignedContact.name
                        : pickTicket.assignedUser
                        ? `${pickTicket.assignedUser.firstName} ${pickTicket.assignedUser.lastName}`
                        : <span className="italic text-muted-foreground">Unassigned</span>
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items ({pickTicket.items.length})
              </h3>
              <div className="space-y-2">
                {pickTicket.items.map((item) => {
                  const isPicked = item.quantityPicked >= item.quantityToPick;
                  const isPartial = item.quantityPicked > 0 && item.quantityPicked < item.quantityToPick;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg',
                        isPicked ? 'bg-emerald-50' : isPartial ? 'bg-amber-50' : 'bg-muted/50'
                      )}
                    >
                      {isPicked ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
                      ) : isPartial ? (
                        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{item.sku}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {item.description}
                              </p>
                            )}
                            {item.binLocation && (
                              <p className="text-xs text-blue-600 mt-1">
                                Bin: {item.binLocation}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex items-center gap-2">
                            {canPickItems && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handlePickItem(item.id, item.quantityPicked, item.quantityToPick, -1)}
                                  disabled={item.quantityPicked === 0 || pickingItemId === item.id}
                                >
                                  -
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handlePickItem(item.id, item.quantityPicked, item.quantityToPick, 1)}
                                  disabled={item.quantityPicked >= item.quantityToPick || pickingItemId === item.id}
                                >
                                  +
                                </Button>
                                <Input
                                  type="number"
                                  min={0}
                                  max={item.quantityToPick}
                                  defaultValue={item.quantityPicked}
                                  key={`${item.id}-${item.quantityPicked}`}
                                  className="h-7 w-16 text-center text-sm px-1"
                                  disabled={pickingItemId === item.id}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val > item.quantityToPick) {
                                      e.target.value = String(item.quantityToPick);
                                    }
                                    if (!isNaN(val) && val < 0) {
                                      e.target.value = '0';
                                    }
                                  }}
                                  onBlur={(e) => handleDirectInput(item.id, e.target.value, item.quantityToPick)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleDirectInput(item.id, (e.target as HTMLInputElement).value, item.quantityToPick);
                                    }
                                  }}
                                />
                                <span className="text-sm text-muted-foreground">/ {item.quantityToPick}</span>
                                {!isPicked && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handlePickAll(item.id, item.quantityToPick)}
                                    disabled={pickingItemId === item.id}
                                  >
                                    All
                                  </Button>
                                )}
                              </div>
                            )}
                            {!canPickItems && (
                              <p className={cn(
                                'text-sm font-medium min-w-[50px]',
                                isPicked ? 'text-emerald-600' : ''
                              )}>
                                {pickingItemId === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin inline" />
                                ) : (
                                  `${item.quantityPicked} / ${item.quantityToPick}`
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes & Instructions */}
            {(pickTicket.notes || pickTicket.specialInstructions) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {pickTicket.specialInstructions && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Special Instructions
                      </h3>
                      <p className="text-sm whitespace-pre-wrap bg-amber-50 p-3 rounded-lg border border-amber-200">
                        {pickTicket.specialInstructions}
                      </p>
                    </div>
                  )}
                  {pickTicket.notes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{pickTicket.notes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {canStartPicking && (
                  <Button
                    onClick={handleStartPicking}
                    disabled={isStartingPicking}
                    className="flex-1"
                  >
                    {isStartingPicking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Start Picking
                  </Button>
                )}
                {canCreatePackingList && (
                  <Button
                    onClick={handleCreatePackingList}
                    disabled={isCreatingPackingList}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isCreatingPackingList ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardList className="mr-2 h-4 w-4" />
                    )}
                    Create Packing List
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canCompletePicking && (
                  <Button
                    onClick={handleCompletePicking}
                    disabled={isCompletingPicking}
                    variant="outline"
                  >
                    {isCompletingPicking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Complete Picking
                  </Button>
                )}
                <Button
                  onClick={handleViewPdf}
                  variant="outline"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  View PDF
                </Button>
                {pickTicket.packingList && (
                  <Button
                    onClick={handleViewPackingListPdf}
                    variant="outline"
                    className="border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800"
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Packing List PDF
                  </Button>
                )}
                {onEdit && canEdit && (
                  <Button
                    onClick={() => {
                      if (isShipped) {
                        setShowShippedEditConfirm(true);
                      } else {
                        onEdit(pickTicket);
                      }
                    }}
                    variant="outline"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Pick ticket not found
          </div>
        )}

        {/* Confirmation dialog for editing shipped pick tickets */}
        <AlertDialog open={showShippedEditConfirm} onOpenChange={setShowShippedEditConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit shipped pick ticket?</AlertDialogTitle>
              <AlertDialogDescription>
                This pick ticket has already been shipped. Editing shipped records may affect
                inventory tracking and shipment history.
                <br />
                <br />
                Are you sure you want to make changes to this shipped pick ticket?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowShippedEditConfirm(false);
                  if (pickTicket && onEdit) {
                    onEdit(pickTicket);
                  }
                }}
              >
                Yes, Edit Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* PDF Viewer Modal */}
        {pickTicket && (
          <PdfViewerModal
            open={showPdfModal}
            onClose={() => setShowPdfModal(false)}
            pdfUrl={
              pdfModalType === 'pickTicket'
                ? `/api/pick-tickets/${pickTicket.id}/pdf`
                : `/api/packing-lists/${pickTicket.packingList?.id}/pdf`
            }
            title={
              pdfModalType === 'pickTicket'
                ? `Pick Ticket - ${pickTicket.pickTicketNumber}`
                : `Packing List - ${pickTicket.packingList?.packingListNumber || ''}`
            }
            fileName={
              pdfModalType === 'pickTicket'
                ? `PickTicket-${pickTicket.pickTicketNumber}.pdf`
                : `PackingList-${pickTicket.packingList?.packingListNumber || ''}.pdf`
            }
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
