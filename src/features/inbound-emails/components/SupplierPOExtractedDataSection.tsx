'use client';

/**
 * Supplier PO Extracted Data Section Component
 *
 * Displays AI-extracted supplier PO confirmation data with matching results.
 * Shows confidence score and matching indicators for low confidence cases.
 */

import { CheckCircle, AlertCircle, Package, Truck, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// ============================================
// TYPES
// ============================================

interface SupplierPOExtractedDataSectionProps {
  emailId: string;
  extractedData: {
    parsed: {
      supplierName: string | null;
      supplierEmail: string | null;
      poNumber: string | null;
      confirmationStatus: 'confirmed' | 'rejected' | 'partial' | 'unknown' | null;
      productionStatus: 'not_started' | 'in_production' | 'ready_to_ship' | 'shipped' | null;
      progressPercentage: number | null;
      expectedShipDate: string | null;
      actualShipDate: string | null;
      containerNumber: string | null;
      vesselName: string | null;
      voyageNumber: string | null;
      items: Array<{
        lineNumber: number;
        sku: string | null;
        productName: string | null;
        orderedQuantity: number;
        confirmedQuantity: number | null;
        unitPrice: number | null;
        lineTotal: number | null;
      }>;
      totalQuantity: number | null;
      totalAmount: number | null;
      notes: string | null;
      issuesOrConcerns: string | null;
    };
    matching: {
      supplier: {
        supplierId: string | null;
        supplierName: string;
        matchType: string;
        confidence: number;
      };
      purchaseOrder: {
        poId: string | null;
        poNumber: string;
        matchType: string;
        confidence: number;
        existingStatus: string | null;
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
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SupplierPOExtractedDataSection({
  emailId: _emailId,
  extractedData,
  confidence,
}: SupplierPOExtractedDataSectionProps) {
  const { parsed, matching } = extractedData;

  // Determine confidence level
  const confidenceLevel = confidence > 0.85 ? 'high' : confidence > 0.6 ? 'medium' : 'low';
  const confidenceColor =
    confidenceLevel === 'high'
      ? 'bg-green-100 text-green-800 border-green-200'
      : confidenceLevel === 'medium'
      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
      : 'bg-red-100 text-red-800 border-red-200';

  // Confirmation status badge
  const getConfirmationBadge = () => {
    switch (parsed.confirmationStatus) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 border-green-200">✅ Confirmed</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">❌ Rejected</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">⚠️ Partial</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">❓ Unknown</Badge>;
    }
  };

  // Production status badge
  const getProductionStatusBadge = () => {
    switch (parsed.productionStatus) {
      case 'not_started':
        return <Badge variant="outline">Not Started</Badge>;
      case 'in_production':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🔄 In Production</Badge>;
      case 'ready_to_ship':
        return <Badge className="bg-green-100 text-green-800 border-green-200">✅ Ready to Ship</Badge>;
      case 'shipped':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">🚢 Shipped</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="border-t pt-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">🤖 Auto-Extracted Supplier PO Data</h3>
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
        {/* Supplier */}
        <div className="flex items-start gap-2">
          {matching.supplier.matchType === 'exact' ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : matching.supplier.matchType === 'fuzzy' ? (
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Supplier</p>
            <p className="font-medium">{parsed.supplierName || 'Unknown'}</p>
            {parsed.supplierEmail && (
              <p className="text-xs text-muted-foreground">{parsed.supplierEmail}</p>
            )}
            {matching.supplier.matchType === 'fuzzy' && (
              <p className="text-xs text-yellow-600">
                Fuzzy match ({(matching.supplier.confidence * 100).toFixed(0)}% similarity)
              </p>
            )}
            {matching.supplier.matchType === 'not_found' && (
              <p className="text-xs text-red-600">Supplier not found in database</p>
            )}
          </div>
        </div>

        <Separator />

        {/* PO Number & Status */}
        <div className="grid grid-cols-2 gap-4">
          {/* PO Number */}
          <div className="flex items-start gap-2">
            {matching.purchaseOrder.matchType === 'exact' ? (
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
            ) : matching.purchaseOrder.matchType === 'fuzzy' ? (
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">PO Number</p>
              <p className="font-medium">{parsed.poNumber || 'Unknown'}</p>
              {matching.purchaseOrder.matchType === 'fuzzy' && (
                <p className="text-xs text-yellow-600">
                  Fuzzy match ({(matching.purchaseOrder.confidence * 100).toFixed(0)}%)
                </p>
              )}
              {matching.purchaseOrder.matchType === 'not_found' && (
                <p className="text-xs text-red-600">PO not found in database</p>
              )}
            </div>
          </div>

          {/* Confirmation Status */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
            {getConfirmationBadge()}
          </div>
        </div>

        <Separator />

        {/* Production Status */}
        {parsed.productionStatus && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Package className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Production Status</p>
                  {getProductionStatusBadge()}
                  {parsed.progressPercentage !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Progress: {parsed.progressPercentage}%
                    </p>
                  )}
                </div>
              </div>

              {/* Expected Ship Date */}
              {parsed.expectedShipDate && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Expected Ship Date</p>
                    <p className="font-medium">
                      {new Date(parsed.expectedShipDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Shipping Details */}
        {(parsed.containerNumber || parsed.vesselName || parsed.actualShipDate) && (
          <>
            <div className="flex items-start gap-2">
              <Truck className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground mb-2">Shipping Information</p>
                <div className="space-y-1 text-sm">
                  {parsed.containerNumber && (
                    <p>
                      <span className="font-medium">Container:</span> {parsed.containerNumber}
                    </p>
                  )}
                  {parsed.vesselName && (
                    <p>
                      <span className="font-medium">Vessel:</span> {parsed.vesselName}
                      {parsed.voyageNumber && ` (Voyage ${parsed.voyageNumber})`}
                    </p>
                  )}
                  {parsed.actualShipDate && (
                    <p>
                      <span className="font-medium">Shipped:</span>{' '}
                      {new Date(parsed.actualShipDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Items */}
        {parsed.items && parsed.items.length > 0 && (
          <>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Items ({parsed.items.length})
              </p>
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
                          <span className="font-medium">
                            {item.confirmedQuantity !== null
                              ? `${item.confirmedQuantity}/${item.orderedQuantity}`
                              : item.orderedQuantity}
                            x
                          </span>{' '}
                          {item.sku || item.productName || 'Unknown Product'}
                        </p>
                        {item.unitPrice && (
                          <p className="text-xs text-muted-foreground">
                            @ ${item.unitPrice.toLocaleString()}
                            {item.lineTotal && ` = $${item.lineTotal.toLocaleString()}`}
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
          </>
        )}

        {/* Totals */}
        {(parsed.totalQuantity !== null || parsed.totalAmount !== null) && (
          <>
            <div className="grid grid-cols-2 gap-4">
              {parsed.totalQuantity !== null && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Quantity</p>
                  <p className="text-xl font-bold">{parsed.totalQuantity.toLocaleString()} units</p>
                </div>
              )}
              {parsed.totalAmount !== null && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold">${parsed.totalAmount.toLocaleString()}</p>
                </div>
              )}
            </div>
            <Separator />
          </>
        )}

        {/* Notes & Issues */}
        {parsed.notes && (
          <>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Supplier Notes</p>
              <p className="text-sm text-muted-foreground">{parsed.notes}</p>
            </div>
            <Separator />
          </>
        )}

        {parsed.issuesOrConcerns && (
          <div>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800">Supplier Concerns:</p>
                    <p className="text-sm text-red-700 mt-1">{parsed.issuesOrConcerns}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Info Note */}
      <div className="mt-6 p-4 rounded-md bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-800">
          ℹ️ This email has been automatically processed. The purchase order has been{' '}
          {confidence >= 0.6 ? (
            <span className="font-medium">updated in the system</span>
          ) : (
            <span className="font-medium">saved for manual review</span>
          )}
          .
        </p>
      </div>
    </div>
  );
}
