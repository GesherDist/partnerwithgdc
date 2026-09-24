'use client';

/**
 * Quotes Page Content
 *
 * Client component for managing quotes.
 * Uses server actions to fetch real data.
 *
 * State Management:
 * - Page component owns drawer state
 * - Quotes are fetched via useQuotes hook
 * - Data flows down via props
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
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

import {
  QuotesTable,
  ViewQuoteDrawer,
  CreateQuoteDrawer,
  EditQuoteDrawer,
  useQuotes,
  UploadPODialog,
} from '@/features/quotes';
import { ApproveQuoteDialog } from '@/features/quotes/components/ApproveQuoteDialog';
import {
  deleteQuote,
  convertQuoteToSalesOrder,
  submitQuoteForApproval,
  createQuoteFromData,
  findOrCreateCustomerFromPO,
  findOrCreateProductFromPO,
  savePOExtraction,
} from '@/features/quotes/actions';
import type { QuoteListItem, QuoteStatus, QuoteWithItems } from '@/features/quotes/types';
import { QUOTE_STATUS_LABELS } from '@/features/quotes/types';
import type { ProcessedPOData } from '@/features/quotes/types/po-extract.types';

// ============================================
// COMPONENT
// ============================================

export function QuotesPageContent() {
  const { hasPermission, appUser, isSuperAdmin } = useAuthStore();

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

  const canCreate = hasMounted && hasPermission('quotes.create');
  const canViewDetail = hasMounted && hasPermission('quotes.view_detail');
  const canEdit = hasMounted && hasPermission('quotes.edit');
  const canDelete = hasMounted && hasPermission('quotes.delete');
  const canApprove = hasMounted && hasPermission('quotes.approve');
  const canSubmitForApproval = hasMounted && hasPermission('quotes.submit_for_approval');
  const canConvertToOrder = hasMounted && hasPermission('quotes.convert_to_order');

  // ----------------------------------------
  // ROLE-BASED DEFAULT FILTER
  // ----------------------------------------

  // Finance role should default to pending_approval quotes
  const isFinanceRole = appUser?.role?.name?.toLowerCase() === 'finance';
  const defaultStatusFilter: QuoteStatus | 'all' = isFinanceRole ? 'pending_approval' : 'all';

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  // Drawer states
  const [isViewDrawerOpen, setIsViewDrawerOpen] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Upload PO dialog state
  const [isUploadPODialogOpen, setIsUploadPODialogOpen] = useState(false);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<QuoteListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Convert confirmation
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [quoteToConvert, setQuoteToConvert] = useState<QuoteListItem | QuoteWithItems | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Submit for approval
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);

  // Approval dialog
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [quoteToApprove, setQuoteToApprove] = useState<QuoteListItem | QuoteWithItems | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');

  // Filters - use role-based default
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>(defaultStatusFilter);
  const [hasSetInitialFilter, setHasSetInitialFilter] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Set filter to pending_approval for Finance role once user is loaded
  useEffect(() => {
    if (!hasSetInitialFilter && appUser?.role?.name) {
      const roleName = appUser.role.name.toLowerCase();
      if (roleName === 'finance') {
        setStatusFilter('pending_approval');
      }
      setHasSetInitialFilter(true);
    }
  }, [appUser?.role?.name, hasSetInitialFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Memoize params to prevent unnecessary re-renders
  const quotesParams = useMemo(() => ({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    page,
    limit: pageSize,
  }), [statusFilter, page, pageSize]);

  // Quotes list with status filter and pagination
  const {
    data: quotes,
    meta,
    isLoading: isQuotesLoading,
    refetch: refetchQuotes,
  } = useQuotes(quotesParams);

  // ----------------------------------------
  // SHARED PO PROCESSING FUNCTION
  // ----------------------------------------

  const processExtractedPOData = useCallback(async (data: ProcessedPOData) => {
    try {
      // Step 1: Find or create customer
      let customerId = data.customer.customerId;
      let customerCreated = false;

      if (!data.customer.matched || !customerId) {
        // Customer not matched - try to find or create
        const customerName = data.extraction.customer?.name;

        if (!customerName) {
          toast.error('No customer name found in PO. Please create the quote manually.');
          return;
        }

        const customerResult = await findOrCreateCustomerFromPO(
          customerName,
          data.extraction.customer?.address,
          data.extraction.customer?.city,
          data.extraction.customer?.state,
          data.extraction.customer?.zip
        );

        if (!customerResult.success || !customerResult.data) {
          toast.error(customerResult.error || 'Failed to find or create customer');
          return;
        }

        customerId = customerResult.data.customerId;
        customerCreated = customerResult.data.created;

        if (customerCreated) {
          toast.info(`New customer "${customerResult.data.customerName}" created`);
        }
      }

      // Step 2: Process ALL products - find or create unmatched ones
      const quoteItems: Array<{
        productId: string;
        sku: string;
        description: string | null;
        quantity: number;
        unitCode: string;
        unitPrice: number;
        discountPercent: number;
        taxRate: number;
      }> = [];

      let productsCreated = 0;

      for (const product of data.products) {
        if (product.matched && product.productId) {
          // Product already matched - use it directly
          quoteItems.push({
            productId: product.productId,
            sku: product.sku,
            description: product.description || null,
            quantity: product.quantity,
            unitCode: 'EA',
            unitPrice: product.unitPrice || Math.round(product.extractedUnitPrice * 100),
            discountPercent: 0,
            taxRate: 0,
          });
        } else {
          // Product not matched - find or create
          const extractedItem = data.extraction.lineItems.find(
            (item) => item.description === product.description
          );

          const productResult = await findOrCreateProductFromPO(
            product.sku || null,
            product.description,
            extractedItem?.tireSize || extractedItem?.vendorItemNo || null,
            product.extractedUnitPrice,
            product.baseCost ?? null // Pass base cost if provided during edit
          );

          if (productResult.success && productResult.data) {
            quoteItems.push({
              productId: productResult.data.productId,
              sku: productResult.data.sku,
              description: product.description || null,
              quantity: product.quantity,
              unitCode: 'EA',
              unitPrice: productResult.data.unitPrice,
              discountPercent: 0,
              taxRate: 0,
            });

            if (productResult.data.created) {
              productsCreated++;
            }
          } else {
            // Failed to create product - log detailed error
            console.error('Failed to process product:', {
              sku: product.sku,
              description: product.description,
              error: productResult.error,
              fullResult: productResult,
            });
            toast.error(`Failed to process product ${product.sku}: ${productResult.error}`);
          }
        }
      }

      if (quoteItems.length === 0) {
        toast.error('No products could be processed. Please create the quote manually.');
        return;
      }

      if (productsCreated > 0) {
        toast.info(`${productsCreated} new product(s) created`);
      }

      // Step 3: Transform extracted data to quote format
      const quoteData = {
        quoteDate: data.extraction.poDate
          ? new Date(data.extraction.poDate)
          : new Date(),
        validUntil: null,
        customerId,
        salesRepId: null,
        currencyCode: 'USD',
        status: 'draft' as const,
        billingAddress: {
          street: data.extraction.customer?.address || null,
          city: data.extraction.customer?.city || null,
          state: data.extraction.customer?.state || null,
          postalCode: data.extraction.customer?.zip || null,
          country: 'US',
        },
        shippingAddress: {
          street: data.extraction.shipTo?.address || null,
          city: data.extraction.shipTo?.city || null,
          state: data.extraction.shipTo?.state || null,
          postalCode: data.extraction.shipTo?.zip || null,
          country: 'US',
        },
        items: quoteItems,
        customerNotes: data.extraction.poNumber
          ? `PO Reference: ${data.extraction.poNumber}`
          : null,
        internalNotes: `Created from PO upload. Extraction confidence: ${data.extraction.confidence}%${
          customerCreated ? '. Customer was auto-created.' : ''
        }${productsCreated > 0 ? `. ${productsCreated} product(s) auto-created.` : ''}`,
        termsAndConditions: null,
        poDocumentUrl: null, // Will be set after upload
      };

      // Step 4: Upload the PDF file if available
      if (data.pdfFile) {
        try {
          const formData = new FormData();
          formData.append('file', data.pdfFile);

          const uploadResponse = await fetch('/api/po/upload', {
            method: 'POST',
            body: formData,
          });

          const uploadResult = await uploadResponse.json();

          if (uploadResponse.ok && uploadResult.success) {
            quoteData.poDocumentUrl = uploadResult.data.url;
          } else {
            console.error('Failed to upload PO document:', uploadResult.error);
            // Continue without the document URL - don't fail the whole process
          }
        } catch (uploadError) {
          console.error('Error uploading PO document:', uploadError);
          // Continue without the document URL - don't fail the whole process
        }
      }

      // Step 5: Create the quote
      const result = await createQuoteFromData(quoteData);

      if (result.success && result.data) {
        // Step 6: Save extraction data to database
        try {
          const extractionResult = await savePOExtraction({
            quoteId: result.data.id,
            pdfFilename: data.pdfFile?.name,
            pdfUrl: quoteData.poDocumentUrl || undefined,
            confidence: data.extraction.confidence,
            poNumber: data.extraction.poNumber,
            poDate: data.extraction.poDate,
            customer: data.extraction.customer,
            shipTo: data.extraction.shipTo,
            lineItems: data.extraction.lineItems.map((item) => ({
              sku: item.sku,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              tireSize: item.tireSize,
            })),
            matchedCustomer: {
              customerId: customerId || null,
              name: data.customer.name,
              matched: data.customer.matched,
            },
            matchedProducts: data.products.map((p) => ({
              productId: p.productId,
              sku: p.sku,
              name: p.name,
              matched: p.matched,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
            })),
            // Store complete raw extraction data
            rawJson: {
              extraction: data.extraction,
              customer: data.customer,
              products: data.products,
              matchedCount: data.matchedCount,
              unmatchedCount: data.unmatchedCount,
            },
          });

          if (!extractionResult.success) {
            console.error('Failed to save extraction data:', extractionResult.error);
          }
        } catch (extractionError) {
          console.error('Error saving extraction data:', extractionError);
          // Don't fail the whole process if extraction save fails
        }

        toast.success('Quote created from PO successfully');
        refetchQuotes();
      } else {
        toast.error(result.error || 'Failed to create quote');
      }
    } catch (error) {
      console.error('Create quote from PO error:', error);
      toast.error('Failed to create quote from PO data');
    }
  }, [refetchQuotes]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  // Create
  const handleCreateClick = () => {
    setIsCreateDrawerOpen(true);
  };

  const handleCreateDrawerClose = useCallback(() => {
    setIsCreateDrawerOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    refetchQuotes();
  }, [refetchQuotes]);

  // Upload PO
  const handleUploadPOClick = () => {
    setIsUploadPODialogOpen(true);
  };

  const handleUploadPODialogClose = useCallback(() => {
    setIsUploadPODialogOpen(false);
  }, []);

  // Wrapper for UploadPODialog that calls the shared processing function
  const handleUploadPOSuccess = useCallback(async (data: ProcessedPOData) => {
    await processExtractedPOData(data);
  }, [processExtractedPOData]);

  // View
  const handleView = useCallback((quote: QuoteListItem) => {
    setSelectedQuoteId(quote.id);
    setIsViewDrawerOpen(true);
  }, []);

  const handleViewDrawerClose = useCallback(() => {
    setIsViewDrawerOpen(false);
    setSelectedQuoteId(null);
  }, []);

  // Edit (can be triggered from view drawer or table actions)
  const handleEdit = useCallback((quote: QuoteListItem | QuoteWithItems) => {
    setSelectedQuoteId(quote.id);
    setIsViewDrawerOpen(false); // Close view drawer if open
    setIsEditDrawerOpen(true);
  }, []);

  const handleEditDrawerClose = useCallback(() => {
    setIsEditDrawerOpen(false);
    setSelectedQuoteId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    refetchQuotes();
  }, [refetchQuotes]);

  // Delete
  const handleDeleteClick = useCallback((quote: QuoteListItem) => {
    setQuoteToDelete(quote);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!quoteToDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteQuote(quoteToDelete.id);
      if (result.success) {
        toast.success(`Quote ${quoteToDelete.quoteNumber} deleted`);
        refetchQuotes();
      } else {
        toast.error(result.error || 'Failed to delete quote');
      }
    } catch {
      toast.error('Failed to delete quote');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setQuoteToDelete(null);
  };

  // Convert to Sales Order
  const handleConvertClick = useCallback((quote: QuoteListItem | QuoteWithItems) => {
    setQuoteToConvert(quote);
    setConvertDialogOpen(true);
  }, []);

  const handleConvertConfirm = async () => {
    if (!quoteToConvert) {
      console.log('[Quote Convert] No quote to convert');
      return;
    }

    console.log('[Quote Convert] Starting conversion for quote:', quoteToConvert.id);
    console.log('[Quote Convert] Converting quote to Sales Order:', quoteToConvert);

    // Simple 1:1 conversion - no splitting
    await convertSingleQuoteToSO(quoteToConvert.id);
  };

  const convertSingleQuoteToSO = async (quoteId: string) => {
    setIsConverting(true);
    try {
      const result = await convertQuoteToSalesOrder(quoteId);
      if (result.success && result.data) {
        toast.success(`Quote converted to Sales Order successfully`);
        refetchQuotes();
        setIsViewDrawerOpen(false);
      } else {
        toast.error(result.error || 'Failed to convert quote');
      }
    } catch {
      toast.error('Failed to convert quote');
    } finally {
      setIsConverting(false);
      setQuoteToConvert(null);
    }
  };

  const handleConvertCancel = () => {
    setConvertDialogOpen(false);
    setQuoteToConvert(null);
  };

  // Submit for Approval
  const handleSubmitForApproval = useCallback(async (quote: QuoteListItem | QuoteWithItems) => {
    setIsSubmittingForApproval(true);
    try {
      const result = await submitQuoteForApproval(quote.id);
      if (result.success) {
        toast.success(`Quote ${quote.quoteNumber} submitted for approval`);
        refetchQuotes();
        setIsViewDrawerOpen(false); // Close view drawer if open
      } else {
        toast.error(result.error || 'Failed to submit quote for approval');
      }
    } catch {
      toast.error('Failed to submit quote for approval');
    } finally {
      setIsSubmittingForApproval(false);
    }
  }, [refetchQuotes]);

  // Approve Quote
  const handleApproveClick = useCallback((quote: QuoteListItem | QuoteWithItems) => {
    setQuoteToApprove(quote);
    setApprovalAction('approve');
    setApprovalDialogOpen(true);
  }, []);

  // Reject Quote
  const handleRejectClick = useCallback((quote: QuoteListItem | QuoteWithItems) => {
    setQuoteToApprove(quote);
    setApprovalAction('reject');
    setApprovalDialogOpen(true);
  }, []);

  const handleApprovalDialogClose = useCallback(() => {
    setApprovalDialogOpen(false);
    setQuoteToApprove(null);
  }, []);

  const handleApprovalSuccess = useCallback(() => {
    refetchQuotes();
    setIsViewDrawerOpen(false); // Close view drawer if open
  }, [refetchQuotes]);

  // Row click (opens view drawer)
  const handleRowClick = useCallback((quote: QuoteListItem) => {
    handleView(quote);
  }, [handleView]);

  const handleRefresh = () => {
    refetchQuotes();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as QuoteStatus | 'all');
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Quotes"
        description="Manage customer quotes and proposals."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isQuotesLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isQuotesLoading ? 'animate-spin' : ''}`} />
            </Button>
            {canCreate && (
              <>
                <Button variant="outline" onClick={handleUploadPOClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload PO
                </Button>
                <Button onClick={handleCreateClick}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Quote
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Quotes Table */}
      <QuotesTable
        data={quotes}
        isLoading={isQuotesLoading}
        isSuperAdmin={hasMounted && isSuperAdmin()}
        onRowClick={canViewDetail ? handleRowClick : undefined}
        onView={canViewDetail ? handleView : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDeleteClick : undefined}
        onConvert={canConvertToOrder ? handleConvertClick : undefined}
        onSubmitForApproval={canSubmitForApproval ? handleSubmitForApproval : undefined}
        onApprove={canApprove ? handleApproveClick : undefined}
        onReject={canApprove ? handleRejectClick : undefined}
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(1); // Reset to first page when page size changes
          },
        }}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* View Quote Drawer */}
      <ViewQuoteDrawer
        quoteId={selectedQuoteId}
        open={isViewDrawerOpen}
        onClose={handleViewDrawerClose}
        onEdit={canEdit ? handleEdit : undefined}
        onConvert={canConvertToOrder ? handleConvertClick : undefined}
        onSubmitForApproval={canSubmitForApproval ? handleSubmitForApproval : undefined}
        onApprove={canApprove ? handleApproveClick : undefined}
        onReject={canApprove ? handleRejectClick : undefined}
        isConverting={isConverting}
        isSubmitting={isSubmittingForApproval}
      />

      {/* Create Quote Drawer */}
      <CreateQuoteDrawer
        open={isCreateDrawerOpen}
        onClose={handleCreateDrawerClose}
        onSuccess={handleCreateSuccess}
      />

      {/* Upload PO Dialog */}
      <UploadPODialog
        open={isUploadPODialogOpen}
        onClose={handleUploadPODialogClose}
        onSuccess={handleUploadPOSuccess}
      />

      {/* Edit Quote Drawer */}
      <EditQuoteDrawer
        open={isEditDrawerOpen}
        onClose={handleEditDrawerClose}
        quoteId={selectedQuoteId}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete quote{' '}
              <span className="font-semibold">{quoteToDelete?.quoteNumber}</span>?
              This action cannot be undone. Only draft quotes can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert Confirmation Dialog */}
      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert Quote to Sales Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to convert quote{' '}
              <span className="font-semibold">{quoteToConvert?.quoteNumber}</span>{' '}
              to a sales order? This will create a new sales order and mark the quote as converted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConvertCancel} disabled={isConverting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConvertConfirm}
              disabled={isConverting}
            >
              {isConverting ? 'Converting...' : 'Convert to Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve/Reject Quote Dialog */}
      <ApproveQuoteDialog
        open={approvalDialogOpen}
        onClose={handleApprovalDialogClose}
        quoteId={quoteToApprove?.id || null}
        quoteNumber={quoteToApprove?.quoteNumber || null}
        action={approvalAction}
        onSuccess={handleApprovalSuccess}
      />
    </div>
  );
}
