'use client';

/**
 * ViewQuoteDrawer Component
 *
 * Read-only drawer to view quote details.
 * Fetches full quote data with items when opened.
 */

import { useEffect, useState } from 'react';
import { Loader2, MapPin, FileText, Calendar, User, Building2, ArrowRight, ExternalLink, Warehouse, AlertTriangle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

import { getQuote, getPODocumentSignedUrl } from '../actions';
import { getInventoryByProductIds } from '@/features/inventory/actions';
import type { InventoryListItem } from '@/features/inventory/types';
import type { QuoteWithItems } from '../types';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_COLORS } from '../types';

// ============================================
// TYPES
// ============================================

interface ViewQuoteDrawerProps {
  quoteId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (quote: QuoteWithItems) => void;
  onConvert?: (quote: QuoteWithItems) => void;
  onSubmitForApproval?: (quote: QuoteWithItems) => void;
  onApprove?: (quote: QuoteWithItems) => void;
  onReject?: (quote: QuoteWithItems) => void;
  isConverting?: boolean;
  isSubmitting?: boolean;
  isApproving?: boolean;
  isRejecting?: boolean;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDate(date: Date | string | null): string {
  if (!date) {return '-';}
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value || value === '-') {return null;}
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {children}
      </CardContent>
    </Card>
  );
}

function AddressDisplay({ label, address }: {
  label: string;
  address: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }
}) {
  const hasAddress = address.street || address.city || address.state;
  if (!hasAddress) {return null;}

  const lines = [
    address.street,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);

  return (
    <div className="flex items-start gap-3">
      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {lines.map((line, i) => (
          <p key={i} className="text-sm font-medium text-foreground">{line}</p>
        ))}
      </div>
    </div>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ViewQuoteDrawer({
  quoteId,
  open,
  onClose,
  onEdit,
  onConvert,
  onSubmitForApproval,
  onApprove,
  onReject,
  isConverting = false,
  isSubmitting = false,
  isApproving = false,
  isRejecting = false,
}: ViewQuoteDrawerProps) {
  const { hasPermission, isSuperAdmin } = useAuthStore();

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canEditPermission = hasMounted && hasPermission('quotes.edit');
  const canApprovePermission = hasMounted && hasPermission('quotes.approve');
  const canSubmitForApprovalPermission = hasMounted && hasPermission('quotes.submit_for_approval');
  const canConvertToOrderPermission = hasMounted && hasPermission('quotes.convert_to_order');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poDocumentUrl, setPoDocumentUrl] = useState<string | null>(null);

  // Inventory status
  const [inventoryData, setInventoryData] = useState<InventoryListItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Fetch signed URL for PO document when quote has one
  useEffect(() => {
    const fetchPoDocumentUrl = async () => {
      if (quote?.poDocumentUrl) {
        const result = await getPODocumentSignedUrl(quote.poDocumentUrl);
        if (result.success && result.data) {
          setPoDocumentUrl(result.data.url);
        }
      } else {
        setPoDocumentUrl(null);
      }
    };
    fetchPoDocumentUrl();
  }, [quote?.poDocumentUrl]);

  useEffect(() => {
    if (open && quoteId) {
      fetchQuote();
    } else {
      setQuote(null);
      setError(null);
      setInventoryData([]);
      setShowInventory(false);
    }
  }, [open, quoteId]);

  // Filter to ONLY inventory-type products (exclude service and non_inventory)
  // Products with itemType = 'service' or 'non_inventory' should NOT appear in Inventory Status
  const inventoryTypeItems = quote?.items?.filter(
    (item) => item.itemType === 'inventory'
  ) || [];

  // Fetch inventory when showInventory is toggled or quote changes
  useEffect(() => {
    const fetchInventory = async () => {
      if (!showInventory || inventoryTypeItems.length === 0) {
        return;
      }

      setIsLoadingInventory(true);
      try {
        // Only fetch inventory for inventory-type products
        const productIds = inventoryTypeItems.map((item) => item.productId);
        const result = await getInventoryByProductIds(productIds);
        if (result.success && result.data) {
          setInventoryData(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch inventory:', err);
      } finally {
        setIsLoadingInventory(false);
      }
    };

    fetchInventory();
  }, [showInventory, inventoryTypeItems.length]);

  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const fetchQuote = async () => {
    if (!quoteId) {return;}

    setIsLoading(true);
    setError(null);

    try {
      const result = await getQuote(quoteId);
      if (result.success && result.data) {
        setQuote(result.data);
      } else {
        setError(result.error || 'Failed to load quote');
      }
    } catch {
      setError('Failed to load quote');
    } finally {
      setIsLoading(false);
    }
  };

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleEdit = () => {
    if (quote) {
      onEdit?.(quote);
    }
  };

  const handleConvert = () => {
    if (quote) {
      onConvert?.(quote);
    }
  };

  const handleSubmitForApproval = () => {
    if (quote) {
      onSubmitForApproval?.(quote);
    }
  };

  const handleApprove = () => {
    if (quote) {
      onApprove?.(quote);
    }
  };

  const handleReject = () => {
    if (quote) {
      onReject?.(quote);
    }
  };

  // Can only edit draft quotes (and must have permission)
  const canEdit = quote && quote.status === 'draft' && canEditPermission;
  // Can submit draft quotes for approval (and must have submit_for_approval permission)
  const canSubmitForApproval = quote && quote.status === 'draft' && canSubmitForApprovalPermission;
  // Can approve/reject pending_approval quotes (and must have approve permission)
  const canApproveReject = quote && quote.status === 'pending_approval' && canApprovePermission;
  // ONLY Super Admin can convert to Sales Order (from any status)
  const canConvert = quote && isSuperAdmin() && canConvertToOrderPermission;

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[700px] md:max-w-[850px] lg:max-w-[950px]"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : quote?.quoteNumber || 'Quote Details'}
          </SheetTitle>
          <SheetDescription>
            {quote?.customer?.name || 'View quote information'}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={fetchQuote} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : quote ? (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={QUOTE_STATUS_COLORS[quote.status]}>
                    {QUOTE_STATUS_LABELS[quote.status]}
                  </Badge>
                  {quote.salesOrder && (
                    <Badge variant="outline" className="gap-1">
                      <ArrowRight className="h-3 w-3" />
                      {quote.salesOrder.orderNumber}
                    </Badge>
                  )}
                </div>

                {/* Quote Info */}
                <Section title="Quote Information">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem
                      label="Quote Number"
                      value={quote.quoteNumber}
                      icon={<FileText className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Quote Date"
                      value={formatDate(quote.quoteDate)}
                      icon={<Calendar className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Valid Until"
                      value={formatDate(quote.validUntil)}
                      icon={<Calendar className="h-4 w-4" />}
                    />
                  </div>
                </Section>

                {/* Customer & Sales Rep */}
                <Section title="Customer & Sales">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoItem
                      label="Customer"
                      value={quote.customer?.name}
                      icon={<Building2 className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Sales Representative"
                      value={quote.salesRep ? `${quote.salesRep.firstName} ${quote.salesRep.lastName}` : null}
                      icon={<User className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Customer PO Number"
                      value={quote.customerPoNumber || '-'}
                      icon={<FileText className="h-4 w-4" />}
                    />
                  </div>
                </Section>

                {/* Addresses */}
                <Section title="Addresses">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AddressDisplay
                      label="Billing Address"
                      address={{
                        street: quote.billingAddressStreet,
                        city: quote.billingAddressCity,
                        state: quote.billingAddressState,
                        postalCode: quote.billingAddressPostalCode,
                        country: quote.billingAddressCountry,
                      }}
                    />
                    <AddressDisplay
                      label="Shipping Address"
                      address={{
                        street: quote.shippingAddressStreet,
                        city: quote.shippingAddressCity,
                        state: quote.shippingAddressState,
                        postalCode: quote.shippingAddressPostalCode,
                        country: quote.shippingAddressCountry,
                      }}
                    />
                  </div>
                </Section>

                {/* Quote Items */}
                <Section title="Quote Items">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Product</TableHead>
                          <TableHead className="text-right font-semibold">Qty</TableHead>
                          <TableHead className="text-right font-semibold">Unit Price</TableHead>
                          <TableHead className="text-right font-semibold">Disc %</TableHead>
                          <TableHead className="text-right font-semibold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {quote.items.map((item) => {
                          const isServiceOrNonInventory = item.itemType === 'service' || item.itemType === 'non_inventory';
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-foreground">{item.sku}</p>
                                  <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {isServiceOrNonInventory ? '-' : item.quantity}
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                              <TableCell className="text-right">
                                {isServiceOrNonInventory ? '-' : `${item.discountPercent}%`}
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(item.lineTotal)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Section>

                {/* Inventory Status - Show before selecting product source */}
                {/* Only show if there are inventory-type products */}
                {quote.status !== 'converted' && inventoryTypeItems.length > 0 && (
                  <Section title="Inventory Status">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Check inventory availability before selecting product source
                        </p>
                        <Button
                          variant={showInventory ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => setShowInventory(!showInventory)}
                          disabled={isLoadingInventory}
                        >
                          {isLoadingInventory ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Warehouse className="h-4 w-4 mr-2" />
                          )}
                          {showInventory ? 'Hide Inventory' : 'Check Inventory'}
                        </Button>
                      </div>

                      {showInventory && (
                        <div className="rounded-md border overflow-hidden">
                          {isLoadingInventory ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : inventoryData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                              <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                              <p className="text-sm text-muted-foreground">No inventory records found</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Consider ordering directly from supplier
                              </p>
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="font-semibold">Product</TableHead>
                                  <TableHead className="font-semibold">Location</TableHead>
                                  <TableHead className="text-right font-semibold">On Hand</TableHead>
                                  <TableHead className="text-right font-semibold">Allocated</TableHead>
                                  <TableHead className="text-right font-semibold">Available</TableHead>
                                  <TableHead className="text-center font-semibold">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {/* Only show inventory-type products */}
                                {inventoryTypeItems.map((item) => {
                                  const itemInventory = inventoryData.filter(
                                    (inv) => inv.productId === item.productId
                                  );

                                  if (itemInventory.length === 0) {
                                    return (
                                      <TableRow key={item.id}>
                                        <TableCell>
                                          <div>
                                            <p className="font-medium">{item.sku}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Need: {item.quantity}
                                            </p>
                                          </div>
                                        </TableCell>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                                          No inventory records
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                            Direct Order
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  }

                                  return itemInventory.map((inv, idx) => {
                                    const canFulfill = inv.available >= item.quantity;
                                    return (
                                      <TableRow key={`${item.id}-${inv.id}`}>
                                        {idx === 0 && (
                                          <TableCell rowSpan={itemInventory.length}>
                                            <div>
                                              <p className="font-medium">{item.sku}</p>
                                              <p className="text-xs text-muted-foreground">
                                                Need: {item.quantity}
                                              </p>
                                            </div>
                                          </TableCell>
                                        )}
                                        <TableCell>
                                          <div className="flex items-center gap-2">
                                            <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm">{inv.locationName}</span>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{inv.onHand}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{inv.allocated}</TableCell>
                                        <TableCell className="text-right font-semibold">
                                          <span className={inv.available < item.quantity ? 'text-amber-600' : 'text-green-600'}>
                                            {inv.available}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {canFulfill ? (
                                            <Badge className="bg-green-50 text-green-700 border-green-200 gap-1">
                                              <CheckCircle2 className="h-3 w-3" />
                                              Can Fulfill
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                                              <AlertTriangle className="h-3 w-3" />
                                              Partial ({inv.available}/{item.quantity})
                                            </Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  });
                                })}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* Quote Totals */}
                <Section title="Quote Summary">
                  <div className="space-y-3 max-w-xs ml-auto">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                    </div>
                    {quote.discountTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-destructive">-{formatCurrency(quote.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">{formatCurrency(quote.taxTotal)}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between text-base font-semibold">
                        <span>Grand Total</span>
                        <span className="text-primary">{formatCurrency(quote.grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Notes */}
                {(quote.customerNotes || quote.internalNotes || quote.termsAndConditions) && (
                  <Section title="Notes">
                    <div className="space-y-4">
                      {quote.customerNotes && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Notes</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{quote.customerNotes}</p>
                        </div>
                      )}
                      {quote.internalNotes && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Internal Notes</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">{quote.internalNotes}</p>
                        </div>
                      )}
                      {quote.termsAndConditions && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Terms & Conditions</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-40 overflow-y-auto">{quote.termsAndConditions}</p>
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* PO Document */}
                {quote.poDocumentUrl && poDocumentUrl && (
                  <Section title="PO Document">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Purchase Order document attached to this quote
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(poDocumentUrl, '_blank')}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Open in New Tab
                        </Button>
                      </div>
                      <div className="rounded-lg border overflow-hidden bg-muted/20">
                        <iframe
                          src={poDocumentUrl}
                          className="w-full h-[500px]"
                          title="PO Document"
                        />
                      </div>
                    </div>
                  </Section>
                )}

                {/* Conversion Info */}
                {quote.status === 'converted' && quote.salesOrder && (
                  <Section title="Conversion" className="border-teal-500/50">
                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-md p-3">
                      <p className="text-sm font-medium">
                        Converted to Sales Order: {quote.salesOrder.orderNumber}
                      </p>
                      {quote.convertedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Converted on {formatDate(quote.convertedAt)}
                        </p>
                      )}
                    </div>
                  </Section>
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {quote && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {canApproveReject && onReject && (
                <Button variant="destructive" onClick={handleReject} disabled={isRejecting}>
                  {isRejecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    'Reject'
                  )}
                </Button>
              )}
              {canApproveReject && onApprove && (
                <Button variant="default" onClick={handleApprove} disabled={isApproving}>
                  {isApproving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    'Approve'
                  )}
                </Button>
              )}
              {canSubmitForApproval && onSubmitForApproval && (
                <Button variant="secondary" onClick={handleSubmitForApproval} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit for Approval'
                  )}
                </Button>
              )}
              {canConvert && onConvert && (
                <div className="flex flex-col gap-1">
                  <Button variant="secondary" onClick={handleConvert} disabled={isConverting}>
                    {isConverting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        Convert to Order
                        <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-200">
                          Admin Only
                        </Badge>
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Super Admin privilege - converts from any status
                  </p>
                </div>
              )}
              {canEdit && onEdit && (
                <Button onClick={handleEdit}>
                  Edit Quote
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
