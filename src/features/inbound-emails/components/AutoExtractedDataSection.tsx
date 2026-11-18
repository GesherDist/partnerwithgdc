'use client';

/**
 * Auto-Extracted Data Section Component
 *
 * Displays AI-extracted customer PO data with matching results.
 * Shows confidence score and allows approval/rejection.
 */

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { toast } from 'sonner';
import { INBOX_PERMISSIONS } from '../lib/permissions';
import { useAuthStore } from '@/shared/stores/auth.store';
import { getProducts } from '@/features/products/actions';
import { getCustomers } from '@/features/customers/actions';
import { createQuoteFromData } from '@/features/quotes/actions';

// ============================================
// TYPES
// ============================================

interface ProductOption {
  id: string;
  sku: string;
  name: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

/** One editable quote line: what the AI proposed, after any correction. */
interface EditableLine {
  productId: string | null;
  quantity: number;
  unitPrice: number;
}

interface AutoExtractedDataSectionProps {
  emailId: string;
  extractedData: {
    parsed: {
      customerName: string | null;
      poNumber: string | null;
      items: Array<{
        sku: string | null;
        productName: string | null;
        quantity: number;
        unitPrice: number | null;
        lineTotal: number | null;
      }>;
      total: number | null;
      shipTo: {
        address: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
      };
      requiredDate: string | null;
      notes: string | null;
    };
    matching: {
      customer: {
        customerId: string | null;
        customerName: string;
        matchType: string;
        confidence: number;
      };
      products: Array<{
        productId: string | null;
        sku: string;
        matchType: string;
        confidence: number;
      }>;
      overallConfidence: number;
      hasIssues: boolean;
      issues: string[];
    };
  };
  confidence: number;
  onQuoteCreated?: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function AutoExtractedDataSection({
  emailId,
  extractedData,
  confidence,
  onQuoteCreated,
}: AutoExtractedDataSectionProps) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  // Corrections Jenny makes before approving. Seeded from what the AI matched,
  // so leaving everything alone reproduces the AI's own proposal.
  const [customerId, setCustomerId] = useState<string | null>(
    extractedData.matching?.customer?.customerId ?? null
  );
  const [lines, setLines] = useState<EditableLine[]>(() =>
    (extractedData.parsed.items ?? []).map((item, idx) => ({
      productId: (extractedData.matching.products ?? [])[idx]?.productId ?? null,
      quantity: item.quantity ?? 0,
      unitPrice: item.unitPrice ?? 0,
    }))
  );
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const { hasPermission } = useAuthStore();

  // The drawer swaps one email for another without ever unmounting this
  // component (ViewEmailDrawer refetches in place and never clears
  // emailDetails in between), so the state above would otherwise still hold
  // the previous email's products while showing this email's items - and
  // approving would raise a quote for the wrong products. Re-seed during
  // render, which is React's own pattern for resetting state on a prop
  // change: no stale frame, no extra paint.
  const [seededForEmailId, setSeededForEmailId] = useState(emailId);
  if (seededForEmailId !== emailId) {
    setSeededForEmailId(emailId);
    setCustomerId(extractedData.matching?.customer?.customerId ?? null);
    setLines(
      (extractedData.parsed.items ?? []).map((item, idx) => ({
        productId: (extractedData.matching.products ?? [])[idx]?.productId ?? null,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
      }))
    );
  }
  const canApprove = hasPermission(INBOX_PERMISSIONS.createQuote);
  const canReject = hasPermission(INBOX_PERMISSIONS.update);

  const { parsed, matching } = extractedData;

  // The dropdowns need the real catalogue. A failed load is not fatal: the
  // AI's own match still shows and can still be approved, only the correction
  // dropdowns stay empty.
  useEffect(() => {
    let cancelled = false;

    const loadLists = async () => {
      try {
        const [productResult, customerResult] = await Promise.all([
          getProducts({ status: 'active', limit: 500 }),
          getCustomers({ status: 'active', limit: 500 }),
        ]);

        if (cancelled) {
          return;
        }

        if (productResult.success && productResult.data?.data) {
          setProducts(
            productResult.data.data.map((product) => ({
              id: product.id,
              sku: product.sku,
              name: product.name,
            }))
          );
        }

        if (customerResult.success && customerResult.data?.data) {
          setCustomers(
            customerResult.data.data.map((customer) => ({
              id: customer.id,
              name: customer.name,
            }))
          );
        }
      } catch (error) {
        console.error('[AutoExtractedDataSection] Failed to load products/customers:', error);
      } finally {
        if (!cancelled) {
          setLoadingLists(false);
        }
      }
    };

    loadLists();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateLine = (index: number, patch: Partial<EditableLine>) => {
    setLines((current) =>
      current.map((line, idx) => (idx === index ? { ...line, ...patch } : line))
    );
  };

  // The quote total is always the sum of the lines that will actually be
  // created, never the AI's own total - those two drift apart as soon as one
  // line is unmatched or corrected.
  const computedTotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines]
  );

  const unmatchedCount = lines.filter((line) => !line.productId).length;

  // Determine confidence level
  const confidenceLevel = confidence > 0.85 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
  const confidenceColor =
    confidenceLevel === 'high'
      ? 'bg-green-100 text-green-800 border-green-200'
      : confidenceLevel === 'medium'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200';

  /**
   * Creates the quote from the reviewed data.
   *
   * Nov 16 2026: this goes through createQuoteFromData -> quoteService.create()
   * - the same path the PDF "Generate a Quote" flow uses - instead of the old
   * /api/quotes/from-extracted-email route, which inserted into `quotes` and
   * `quote_items` directly. That raw path skipped validation and the audit
   * row, and it dropped unmatched lines while keeping the AI's full total, so
   * the quote header and its lines disagreed.
   */
  const handleApprove = async () => {
    // Checked here so the user gets one clear sentence rather than a Zod dump
    if (!customerId) {
      toast.error('Select a customer before creating the quote.');
      return;
    }
    if (lines.length === 0) {
      toast.error('This email has no line items to quote.');
      return;
    }
    const firstUnmatched = lines.findIndex((line) => !line.productId);
    if (firstUnmatched !== -1) {
      toast.error(`Select a product for line ${firstUnmatched + 1} before creating the quote.`);
      return;
    }
    const firstBadQty = lines.findIndex((line) => !Number.isInteger(line.quantity) || line.quantity <= 0);
    if (firstBadQty !== -1) {
      toast.error(`Line ${firstBadQty + 1} needs a whole quantity greater than 0.`);
      return;
    }
    const firstBadPrice = lines.findIndex((line) => !(line.unitPrice > 0));
    if (firstBadPrice !== -1) {
      toast.error(`Line ${firstBadPrice + 1} needs a unit price greater than 0.`);
      return;
    }

    setApproving(true);
    try {
      const items = lines.map((line, idx) => {
        const product = products.find((p) => p.id === line.productId);
        const parsedItem = (parsed.items ?? [])[idx];
        return {
          productId: line.productId as string,
          sku: product?.sku ?? parsedItem?.sku ?? '',
          description: product?.name ?? parsedItem?.productName ?? null,
          quantity: line.quantity,
          unitCode: 'EA',
          // The schema stores money as whole cents
          unitPrice: Math.round(line.unitPrice * 100),
          discountPercent: 0,
          taxRate: 0,
        };
      });

      const result = await createQuoteFromData({
        quoteDate: new Date(),
        validUntil: null,
        customerId,
        salesRepId: null,
        currencyCode: 'USD',
        status: 'draft' as const,
        billingAddress: { street: null, city: null, state: null, postalCode: null, country: 'US' },
        shippingAddress: {
          street: parsed.shipTo?.address || null,
          city: parsed.shipTo?.city || null,
          state: parsed.shipTo?.state || null,
          postalCode: parsed.shipTo?.zip || null,
          country: 'US',
        },
        items,
        customerNotes: [
          parsed.poNumber ? `PO Reference: ${parsed.poNumber}` : null,
          parsed.requiredDate ? `Customer required date: ${parsed.requiredDate}` : null,
        ]
          .filter(Boolean)
          .join('\n') || null,
        internalNotes: `Created from an AI-extracted email. Email ID: ${emailId}. Extraction confidence: ${(confidence * 100).toFixed(0)}%.`,
        termsAndConditions: null,
        poDocumentUrl: null,
        customerPoNumber: parsed.poNumber || null,
      });

      if (!result.success) {
        console.error('[AutoExtractedDataSection] Quote creation failed:', result.error, result.errors);
        toast.error(result.error || 'Failed to create quote');
        return;
      }

      toast.success(`Quote created successfully (${items.length} item${items.length === 1 ? '' : 's'})`);

      // Call callback to refresh or navigate
      if (onQuoteCreated) {
        onQuoteCreated();
      }
    } catch (error) {
      console.error('[AutoExtractedDataSection] Failed to create quote:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create quote');
    } finally {
      setApproving(false);
    }
  };

  // Handle reject - Mark email as rejected
  const handleReject = async () => {
    setRejecting(true);
    try {
      console.log('[AutoExtractedDataSection] Rejecting email:', emailId);

      // Call API to reject email
      const response = await fetch('/api/inbound-emails/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject email');
      }

      console.log('[AutoExtractedDataSection] Email rejected');

      toast.success('Email marked as rejected');

      // Call callback to refresh
      if (onQuoteCreated) {
        onQuoteCreated();
      }
    } catch (error) {
      console.error('[AutoExtractedDataSection] Failed to reject email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reject email');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="border-t pt-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">🤖 Auto-Extracted Data</h3>
          <Badge className={confidenceColor}>
            {(confidence * 100).toFixed(0)}% Confidence
          </Badge>
        </div>
      </div>

      {/* Issues Warning */}
      {matching.hasIssues && (
        <Card className="mb-4 border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Issues Found:</p>
                <ul className="list-disc list-inside mt-2 text-sm text-yellow-700">
                  {matching.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extracted Data Display */}
      <div className="space-y-4">
        {/* Customer */}
        <div className="flex items-start gap-2">
          {matching.customer.matchType === 'exact' ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : matching.customer.matchType === 'fuzzy' ? (
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Customer</p>
            <p className="font-medium">{parsed.customerName || 'Unknown'}</p>
            {matching.customer.matchType === 'fuzzy' && (
              <p className="text-xs text-yellow-600">
                Fuzzy match ({(matching.customer.confidence * 100).toFixed(0)}% similarity)
              </p>
            )}
            {matching.customer.matchType === 'not_found' && (
              <p className="text-xs text-red-600">Customer not found in database</p>
            )}
            {/* Correct the customer the AI picked, or set one it could not find */}
            <div className="mt-2">
              <Select
                value={customerId ?? ''}
                onValueChange={(value) => setCustomerId(value || null)}
                disabled={approving || rejecting}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue
                    placeholder={loadingLists ? 'Loading customers...' : 'Select a customer'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {/* Same for the customer the AI already matched */}
                  {customerId && !customers.some((customer) => customer.id === customerId) && (
                    <SelectItem value={customerId}>
                      {matching.customer?.customerName || 'AI matched customer'}
                    </SelectItem>
                  )}
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* PO Number */}
        {parsed.poNumber && (
          <>
            <div>
              <p className="text-sm font-medium text-muted-foreground">PO Number</p>
              <p className="font-medium">{parsed.poNumber}</p>
            </div>
            <Separator />
          </>
        )}

        {/* Items */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-2">Items</p>
          <div className="space-y-2">
            {(parsed.items ?? []).map((item, idx) => {
              const productMatch = (matching.products ?? [])[idx];
              const isExactMatch = productMatch?.matchType?.includes('exact');

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                >
                  {isExactMatch ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{item.quantity}x</span>{' '}
                      {item.sku || item.productName || 'Unknown Product'}
                    </p>
                    {item.unitPrice && (
                      <p className="text-xs text-muted-foreground">
                        @ ${item.unitPrice.toLocaleString()} ={' '}
                        ${(item.lineTotal || 0).toLocaleString()}
                      </p>
                    )}
                    {!isExactMatch && productMatch && (
                      <p className="text-xs text-yellow-600">
                        {productMatch.matchType === 'not_found'
                          ? 'Product not found in database'
                          : `Fuzzy match (${(productMatch.confidence * 100).toFixed(0)}%)`}
                      </p>
                    )}

                    {/* Map this line to a real product, and correct qty/price */}
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_5rem_7rem] gap-2">
                      <Select
                        value={lines[idx]?.productId ?? ''}
                        onValueChange={(value) => updateLine(idx, { productId: value || null })}
                        disabled={approving || rejecting}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue
                            placeholder={loadingLists ? 'Loading products...' : 'Select a product'}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Keep the AI's match selectable even if the
                              catalogue could not be loaded, so the dropdown
                              never looks empty while a product IS chosen */}
                          {lines[idx]?.productId &&
                            !products.some((product) => product.id === lines[idx]?.productId) && (
                              <SelectItem value={lines[idx]?.productId as string}>
                                {productMatch?.sku || item.sku || 'AI matched product'}
                              </SelectItem>
                            )}
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.sku} - {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        className="h-8 text-xs"
                        aria-label={`Quantity for line ${idx + 1}`}
                        value={lines[idx]?.quantity ?? 0}
                        onChange={(e) =>
                          updateLine(idx, { quantity: Number.parseInt(e.target.value, 10) || 0 })
                        }
                        disabled={approving || rejecting}
                      />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-8 text-xs"
                        aria-label={`Unit price for line ${idx + 1}`}
                        value={lines[idx]?.unitPrice ?? 0}
                        onChange={(e) =>
                          updateLine(idx, { unitPrice: Number.parseFloat(e.target.value) || 0 })
                        }
                        disabled={approving || rejecting}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Total - summed from the lines above, so it always matches the
            quote that will be created */}
        <div>
          <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-bold">
            ${computedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {parsed.total !== null && Math.abs(parsed.total - computedTotal) > 0.01 && (
            <p className="text-xs text-yellow-600 mt-1">
              The email stated ${parsed.total.toLocaleString()}. This quote uses the lines above.
            </p>
          )}
        </div>
        <Separator />

        {/* Ship To */}
        {(parsed.shipTo.address || parsed.shipTo.city) && (
          <>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Ship To</p>
              <p className="text-sm">
                {parsed.shipTo.address && <>{parsed.shipTo.address}<br /></>}
                {parsed.shipTo.city && (
                  <>
                    {parsed.shipTo.city}
                    {parsed.shipTo.state && `, ${parsed.shipTo.state}`}
                    {parsed.shipTo.zip && ` ${parsed.shipTo.zip}`}
                  </>
                )}
              </p>
            </div>
            <Separator />
          </>
        )}

        {/* Required Date */}
        {parsed.requiredDate && (
          <>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Required By</p>
              <p className="font-medium">
                {new Date(parsed.requiredDate).toLocaleDateString()}
              </p>
            </div>
            <Separator />
          </>
        )}

        {/* Notes */}
        {parsed.notes && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Notes</p>
            <p className="text-sm text-muted-foreground">{parsed.notes}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {(canApprove || canReject) && (
        <div className="mt-6 space-y-2">
          {canApprove && unmatchedCount > 0 && (
            <p className="text-xs text-yellow-700">
              {unmatchedCount} line{unmatchedCount === 1 ? '' : 's'} still need a product selected.
            </p>
          )}
          <div className="flex gap-3">
          {canApprove && (
            <Button
              onClick={handleApprove}
              disabled={approving || rejecting}
              className="flex-1"
            >
              {approving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Quote...
                </>
              ) : (
                <>✅ Approve & Create Quote</>
              )}
            </Button>
          )}
          {canReject && (
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={approving || rejecting}
            >
              {rejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>❌ Reject</>
              )}
            </Button>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
