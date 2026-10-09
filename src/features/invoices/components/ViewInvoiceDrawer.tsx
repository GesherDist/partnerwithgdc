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
import { Pencil, CreditCard, Building2, MapPin, Package, Calendar, FileText, User, Truck, Loader2, ExternalLink, CheckCircle2, FileDown } from 'lucide-react';
import { PdfViewerModal } from '@/shared/components/pdf-viewer/PdfViewerModal';
import { cn } from '@/shared/lib/utils';
import { useInvoice } from '../hooks/useInvoice';
import { pushInvoiceToQuickBooks } from '../actions';
import { INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS } from '../types';
import type { ViewInvoiceDrawerProps } from '../types';

export function ViewInvoiceDrawer({
  open,
  onClose,
  invoiceId,
  onEdit,
  onRecordPayment,
}: ViewInvoiceDrawerProps) {
  const { data: invoice, isLoading, refetch } = useInvoice(open ? invoiceId : null);
  const [isPushingToQbo, setIsPushingToQbo] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const handleViewPdf = () => {
    if (!invoiceId || !invoice) return;
    setShowPdfModal(true);
  };

  const handlePushToQuickBooks = async () => {
    if (!invoiceId) return;

    setIsPushingToQbo(true);
    try {
      const result = await pushInvoiceToQuickBooks(invoiceId);
      if (result.success) {
        toast.success('Invoice pushed to QuickBooks successfully');
        refetch(); // Refresh to show updated QBO status
      } else {
        toast.error(result.error || 'Failed to push invoice to QuickBooks');
      }
    } catch (error) {
      toast.error('Failed to push invoice to QuickBooks');
    } finally {
      setIsPushingToQbo(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              {isLoading ? (
                <>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </>
              ) : invoice ? (
                <>
                  <SheetTitle className="text-xl">{invoice.invoiceNumber}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {new Date(invoice.invoiceDate).toLocaleDateString()}
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
        ) : invoice ? (
          <div className="mt-6 space-y-6">
            {/* Customer Information */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Customer
              </h3>
              <div className="flex items-start gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{invoice.customer?.name || 'Unknown'}</p>
                  {invoice.customer?.customerCode && (
                    <p className="text-muted-foreground font-mono text-xs">
                      {invoice.customer.customerCode}
                    </p>
                  )}
                </div>
              </div>

              {/* Status & Invoice Type */}
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-medium',
                      INVOICE_STATUS_COLORS[invoice.status]
                    )}
                  >
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs font-medium',
                      invoice.invoiceType === 'commission'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    )}
                  >
                    {INVOICE_TYPE_LABELS[invoice.invoiceType] || 'Customer Invoice'}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Sales Rep */}
            {invoice.salesRepName && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Sales Representative
                </h3>
                <div className="flex items-start gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="font-medium">{invoice.salesRepName}</p>
                </div>
              </div>
            )}

            {invoice.salesRepName && <Separator />}

            {/* Dates */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dates
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Invoice Date</p>
                    <p className="font-medium">
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {invoice.dueDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className={cn(
                        'font-medium',
                        invoice.status === 'overdue' && 'text-red-600'
                      )}>
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                {invoice.deliveryDate && (
                  <div className="flex items-start gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Delivery Date</p>
                      <p className="font-medium">
                        {new Date(invoice.deliveryDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Order Information & Bill To */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Order Information
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {/* Sales Order */}
                {invoice.salesOrder ? (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Sales Order</p>
                      <p className="font-medium">{invoice.salesOrder.orderNumber}</p>
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                {/* Customer PO */}
                {invoice.salesOrder?.customerPoNumber ? (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Customer PO</p>
                      <p className="font-medium">{invoice.salesOrder.customerPoNumber}</p>
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                {/* Bill To */}
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Bill To</p>
                    {/* Show invoice billing address if available, otherwise show customer address */}
                    {invoice.billingAddressStreet || invoice.billingAddressCity ? (
                      <div className="font-medium">
                        {invoice.billingAddressStreet && <p>{invoice.billingAddressStreet}</p>}
                        {(invoice.billingAddressCity || invoice.billingAddressState || invoice.billingAddressPostalCode) && (
                          <p>
                            {[
                              invoice.billingAddressCity,
                              invoice.billingAddressState,
                              invoice.billingAddressPostalCode,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                        {invoice.billingAddressCountry && <p>{invoice.billingAddressCountry}</p>}
                      </div>
                    ) : invoice.customer ? (
                      <div className="font-medium">
                        {/* Fallback to customer address */}
                        {invoice.customer.address1 && <p>{invoice.customer.address1}</p>}
                        {invoice.customer.address2 && <p>{invoice.customer.address2}</p>}
                        {(invoice.customer.city || invoice.customer.state || invoice.customer.zip) && (
                          <p>
                            {[
                              invoice.customer.city,
                              invoice.customer.state,
                              invoice.customer.zip,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                        {(invoice.customer.country || invoice.billingAddressCountry) && (
                          <p>{invoice.customer.country || invoice.billingAddressCountry}</p>
                        )}
                        {!invoice.customer.address1 && !invoice.customer.city && invoice.billingAddressCountry && (
                          <p>{invoice.billingAddressCountry}</p>
                        )}
                      </div>
                    ) : (
                      <p className="font-medium">
                        {invoice.billingAddressCountry || <span className="text-muted-foreground italic">No address</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Items ({invoice.items.length})
              </h3>
              <div className="space-y-2">
                {invoice.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{item.sku}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-medium">
                          ${(item.lineTotal / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.quantity} x ${(item.unitPrice / 100).toFixed(2)}
                        {item.discountPercent > 0 && (
                          <span className="text-amber-600 ml-1">
                            (-{item.discountPercent}%)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${(invoice.subtotal / 100).toFixed(2)}</span>
              </div>
              {invoice.discountTotal > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Discount</span>
                  <span>-${(invoice.discountTotal / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>${(invoice.taxTotal / 100).toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Grand Total</span>
                <span>${(invoice.grandTotal / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Amount Paid</span>
                <span>${(invoice.amountPaid / 100).toFixed(2)}</span>
              </div>
              <div className={cn(
                'flex justify-between font-semibold',
                invoice.balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'
              )}>
                <span>Balance Due</span>
                <span>${(invoice.balanceDue / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Payments */}
            {invoice.payments.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Payments ({invoice.payments.length})
                  </h3>
                  <div className="space-y-2">
                    {invoice.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-start justify-between p-3 bg-emerald-50 rounded-lg text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            ${(payment.amount / 100).toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(payment.paymentDate).toLocaleDateString()}
                            {payment.paymentMethod && ` - ${payment.paymentMethod}`}
                          </p>
                        </div>
                        {payment.referenceNumber && (
                          <span className="font-mono text-xs text-muted-foreground">
                            #{payment.referenceNumber}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {(invoice.customerNotes || invoice.internalNotes) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {invoice.customerNotes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Customer Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{invoice.customerNotes}</p>
                    </div>
                  )}
                  {invoice.internalNotes && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Internal Notes
                      </h3>
                      <p className="text-sm whitespace-pre-wrap">{invoice.internalNotes}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* QuickBooks Status */}
            {invoice.quickbooksInvoiceId && (
              <>
                <Separator />
                <a
                  href={`https://app.qbo.intuit.com/app/invoice?txnId=${invoice.quickbooksInvoiceId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <div className="flex-1">
                    <p className="font-medium text-emerald-700">Invoice shared in QuickBooks</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {invoice.quickbooksInvoiceId}
                      {invoice.quickbooksLastSync && (
                        <> | Last sync: {new Date(invoice.quickbooksLastSync).toLocaleString()}</>
                      )}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-emerald-600" />
                </a>
              </>
            )}

            {/* Actions */}
            <Separator />
            <div className="flex flex-col gap-2">
              {/* Row 1: Edit, View PDF, Share to QuickBooks */}
              <div className="grid grid-cols-3 gap-2">
                {/* Edit Button */}
                {onEdit && ['draft', 'sent'].includes(invoice.status) ? (
                  <Button onClick={() => onEdit(invoice)} variant="outline" size="sm">
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit
                  </Button>
                ) : (
                  <div />
                )}

                {/* View PDF Button */}
                <Button
                  onClick={handleViewPdf}
                  variant="outline"
                  size="sm"
                >
                  <FileDown className="mr-1.5 h-4 w-4" />
                  View PDF
                </Button>

                {/* QuickBooks Push Button */}
                {!invoice.quickbooksInvoiceId && invoice.status !== 'cancelled' ? (
                  <Button
                    onClick={handlePushToQuickBooks}
                    variant="outline"
                    size="sm"
                    disabled={isPushingToQbo}
                  >
                    {isPushingToQbo ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        QuickBooks
                      </>
                    )}
                  </Button>
                ) : (
                  <div />
                )}
              </div>

              {/* Row 2: Record Payment (full width) */}
              {onRecordPayment && ['sent', 'partial', 'overdue'].includes(invoice.status) && (
                <Button onClick={() => onRecordPayment(invoice)} className="w-full">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Record Payment
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            Invoice not found
          </div>
        )}
      </SheetContent>

      {/* PDF Viewer Modal */}
      {invoice && (
        <PdfViewerModal
          open={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          pdfUrl={`/api/invoices/${invoiceId}/pdf`}
          title={`Invoice ${invoice.invoiceNumber}`}
          fileName={`${invoice.invoiceNumber}.pdf`}
        />
      )}
    </Sheet>
  );
}
