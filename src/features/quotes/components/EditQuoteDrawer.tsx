'use client';

/**
 * EditQuoteModal Component
 *
 * Modal for editing existing quotes.
 */

import { useState, useEffect } from 'react';
import { Loader2, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import { QuoteForm } from './QuoteForm';
import { getQuote, updateQuoteFromData, updateQuoteItems, getQuoteMasterData, getPODocumentSignedUrl } from '../actions';
import { quoteToFormValues, formToCreateDTO, type QuoteFormInput } from '../lib/schemas';
import type { QuoteWithItems } from '../types';

// ============================================
// TYPES
// ============================================

interface EditQuoteDrawerProps {
  open: boolean;
  onClose: () => void;
  quoteId: string | null;
  onSuccess?: () => void;
}

interface MasterData {
  customers: Array<{
    id: string;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  products: Array<{
    id: string;
    sku: string;
    name: string;
    description: string | null;
    unitPrice: number;
    itemType: 'inventory' | 'non_inventory' | 'service';
  }>;
  salesReps: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

// ============================================
// COMPONENT
// ============================================

export function EditQuoteDrawer({ open, onClose, quoteId, onSuccess }: EditQuoteDrawerProps) {
  const [quote, setQuote] = useState<QuoteWithItems | null>(null);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>(undefined);
  const [poDocumentUrl, setPoDocumentUrl] = useState<string | null>(null);
  const [_isFormValid, setIsFormValid] = useState(false);

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

  // Fetch quote and master data when drawer opens
  useEffect(() => {
    if (open && quoteId) {
      fetchData();
    }
  }, [open, quoteId]);

  const fetchData = async () => {
    if (!quoteId) {
      return;
    }

    setIsLoading(true);
    setServerErrors(undefined);
    try {
      const [quoteResult, masterDataResult] = await Promise.all([
        getQuote(quoteId),
        getQuoteMasterData(),
      ]);

      if (quoteResult.success && quoteResult.data) {
        setQuote(quoteResult.data);
      } else {
        toast.error('Failed to load quote');
        onClose();
        return;
      }

      if (masterDataResult.success && masterDataResult.data) {
        setMasterData(masterDataResult.data);
      } else {
        toast.error('Failed to load form data');
        onClose();
        return;
      }
    } catch {
      toast.error('Failed to load data');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: QuoteFormInput) => {
    if (!quoteId || !quote) {
      return;
    }

    setIsSubmitting(true);
    setServerErrors(undefined);
    try {
      // Update quote header
      const dto = formToCreateDTO(data);
      const headerResult = await updateQuoteFromData(quoteId, {
        quoteDate: dto.quoteDate,
        validUntil: dto.validUntil,
        customerId: dto.customerId,
        salesRepId: dto.salesRepId,
        currencyCode: dto.currencyCode,
        billingAddress: dto.billingAddress,
        shippingAddress: dto.shippingAddress,
        customerNotes: dto.customerNotes,
        internalNotes: dto.internalNotes,
        termsAndConditions: dto.termsAndConditions,
      });

      if (!headerResult.success) {
        // Handle validation errors
        if (headerResult.errors) {
          setServerErrors(headerResult.errors);
          const errorCount = Object.keys(headerResult.errors).length;
          toast.error(`Validation failed: ${errorCount} field${errorCount > 1 ? 's' : ''} need${errorCount === 1 ? 's' : ''} correction`, {
            description: 'Please check the highlighted fields above.',
          });
        } else {
          toast.error(headerResult.error || 'Failed to update quote');
        }
        return;
      }

      // Update quote items
      const itemsResult = await updateQuoteItems(quoteId, dto.items);

      if (itemsResult.success) {
        toast.success('Quote updated successfully');
        onSuccess?.();
        onClose();
      } else {
        toast.error(itemsResult.error || 'Failed to update quote items');
      }
    } catch {
      toast.error('Failed to update quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setQuote(null);
      onClose();
    }
  };

  // Convert quote to form values
  const getInitialData = (): Partial<QuoteFormInput> | undefined => {
    if (!quote) {
      return undefined;
    }

    return quoteToFormValues({
      ...quote,
      quoteDate: new Date(quote.quoteDate),
      validUntil: quote.validUntil ? new Date(quote.validUntil) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="flex max-h-[90vh] h-[90vh] w-full max-w-6xl flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : `Edit ${quote?.quoteNumber || 'Quote'}`}
          </DialogTitle>
          <DialogDescription>
            {quote?.customer?.name || 'Update quote information'}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 h-0 min-h-0">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="space-y-8">
                {/* Info Section Skeleton */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-px w-full" />
                  <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                {/* Address Section Skeleton */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-px w-full" />
                  <div className="grid grid-cols-2 gap-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                </div>
                {/* Items Section Skeleton */}
                <div className="space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-px w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </div>
            ) : quote && masterData ? (
              <>
                <QuoteForm
                  mode="edit"
                  initialData={getInitialData()}
                  customers={masterData.customers}
                  products={masterData.products}
                  salesReps={masterData.salesReps}
                  onSubmit={handleSubmit}
                  onCancel={handleClose}
                  isSubmitting={isSubmitting}
                  serverErrors={serverErrors}
                  onValidationChange={setIsFormValid}
                />

                {/* PO Document Viewer */}
                {quote.poDocumentUrl && poDocumentUrl && (
                  <Card className="mt-6">
                    <CardHeader className="pb-3 pt-4 px-4">
                      <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PO Document
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            Purchase Order document attached to this quote
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => window.open(poDocumentUrl, '_blank')}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Open in New Tab
                          </Button>
                        </div>
                        <div className="rounded-lg border overflow-hidden bg-muted/20">
                          <iframe
                            src={poDocumentUrl}
                            className="w-full h-[400px]"
                            title="PO Document"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  Failed to load quote. Please try again.
                </p>
                <Button variant="outline" onClick={fetchData}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {!isLoading && quote && masterData && (
          <>
            <Separator />
            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <div className="flex w-full items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="quote-form"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
