'use client';

/**
 * Auto-Extracted Data Section Component
 *
 * Displays AI-extracted customer PO data with matching results.
 * Shows confidence score and allows approval/rejection.
 */

import { useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

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

  const { parsed, matching } = extractedData;

  // Determine confidence level
  const confidenceLevel = confidence > 0.85 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
  const confidenceColor =
    confidenceLevel === 'high'
      ? 'bg-green-100 text-green-800 border-green-200'
      : confidenceLevel === 'medium'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200';

  // Handle approve - Create quote from extracted data
  const handleApprove = async () => {
    setApproving(true);
    try {
      console.log('[AutoExtractedDataSection] Creating quote from email:', emailId);

      // Call API to create quote
      const response = await fetch('/api/quotes/from-extracted-email', {
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
        throw new Error(result.error || 'Failed to create quote');
      }

      console.log('[AutoExtractedDataSection] Quote created:', result);

      toast.success(`Quote ${result.quoteNumber} created successfully! (${result.itemsCreated} items)`);

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
            {parsed.items.map((item, idx) => {
              const productMatch = matching.products[idx];
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Total */}
        {parsed.total !== null && (
          <>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">${parsed.total.toLocaleString()}</p>
            </div>
            <Separator />
          </>
        )}

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
      <div className="flex gap-3 mt-6">
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
      </div>
    </div>
  );
}
