/**
 * STEP 3: PREVIEW QUOTES
 * =======================
 * Review and edit quote previews before creation
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Edit2,
  Save,
  X,
} from 'lucide-react';
import { ImportWizardState, QuotePreview } from '../../types';
import { getValidRows } from '../../lib/validator';
import {
  generateQuotePreviews,
  updateQuotePreview,
  updateQuoteItem,
  formatCurrency,
} from '../../lib/preview-generator';

// ============================================================================
// PROPS
// ============================================================================

interface PreviewQuoteStepProps {
  state: ImportWizardState;
  updateState: (updates: Partial<ImportWizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PreviewQuoteStep({
  state,
  updateState,
  onNext,
  onBack,
}: PreviewQuoteStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingQuote, setEditingQuote] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<QuotePreview>>({});
  const [currentPage, setCurrentPage] = useState(0);

  // ============================================================================
  // GENERATE PREVIEWS ON MOUNT
  // ============================================================================

  useEffect(() => {
    async function generatePreviews() {
      if (state.quotePreviews.length > 0) return; // Already generated

      setIsGenerating(true);
      try {
        const validRows = getValidRows(state.rawRows);
        const previews = await generateQuotePreviews(validRows);
        updateState({ quotePreviews: previews });
      } catch (error) {
        console.error('Error generating previews:', error);
        updateState({ error: error instanceof Error ? error.message : 'Failed to generate previews' });
      } finally {
        setIsGenerating(false);
      }
    }

    generatePreviews();
  }, [state.quotePreviews.length, state.rawRows, updateState]);

  // ============================================================================
  // EDIT HANDLERS
  // ============================================================================

  const startEditQuote = (index: number) => {
    const quote = state.quotePreviews[index]!;
    setEditingQuote(index);
    setEditData({
      quoteNumber: quote.quoteNumber,
      customerPO: quote.customerPO,
      deliveryAddress: quote.deliveryAddress,
      validUntil: quote.validUntil,
      terms: quote.terms,
      notes: quote.notes,
    });
  };

  const saveQuoteEdit = () => {
    if (editingQuote !== null) {
      const updated = updateQuotePreview(state.quotePreviews[editingQuote]!, editData);
      const newPreviews = [...state.quotePreviews];
      newPreviews[editingQuote] = updated;
      updateState({ quotePreviews: newPreviews });
      setEditingQuote(null);
      setEditData({});
    }
  };

  const cancelQuoteEdit = () => {
    setEditingQuote(null);
    setEditData({});
  };

  const updateItem = (quoteIndex: number, itemIndex: number, field: string, value: any) => {
    const quote = state.quotePreviews[quoteIndex]!;
    const updated = updateQuoteItem(quote, itemIndex, { [field]: value });
    const newPreviews = [...state.quotePreviews];
    newPreviews[quoteIndex] = updated;
    updateState({ quotePreviews: newPreviews });
  };

  // ============================================================================
  // PAGINATION
  // ============================================================================

  const totalPages = state.quotePreviews.length;
  const currentQuote = state.quotePreviews[currentPage];

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-lg font-semibold">Generating quote previews...</p>
        <p className="text-sm text-muted-foreground">This may take a moment</p>
      </div>
    );
  }

  if (state.quotePreviews.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Alert>
          <AlertDescription>
            No quotes to create. All orders are for warehouse inventory (GDC/Gesher) or have validation errors.
          </AlertDescription>
        </Alert>
        <div className="text-sm text-muted-foreground">
          <p>This is normal if you're importing:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Warehouse inventory (customer = GDC, Gesher)</li>
            <li>Purchase Orders without customer sales</li>
          </ul>
          <p className="mt-4 font-medium">You can still create Purchase Orders and Shipments in the next steps.</p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext}>
            Skip to Purchase Orders
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const isEditing = editingQuote === currentPage;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Quote Previews</h3>
          <p className="text-sm text-muted-foreground">
            Review and edit quote details before creation
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Quote {currentPage + 1} of {totalPages}
        </div>
      </div>

      {/* Quote Preview Card */}
      {currentQuote && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>
                  {isEditing ? (
                    <Input
                      value={editData.quoteNumber || ''}
                      onChange={(e) => setEditData({ ...editData, quoteNumber: e.target.value })}
                      className="font-mono text-lg"
                    />
                  ) : (
                    <span className="font-mono">{currentQuote.quoteNumber}</span>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  Customer: {currentQuote.customerName} • Customer PO: {currentQuote.customerPO || 'N/A'} • Source: {currentQuote.loadNumber}
                </CardDescription>
              </div>
              <div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveQuoteEdit}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelQuoteEdit}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => startEditQuote(currentPage)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Quote Details */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Customer PO</Label>
                {isEditing ? (
                  <Input
                    value={editData.customerPO || ''}
                    onChange={(e) => setEditData({ ...editData, customerPO: e.target.value })}
                  />
                ) : (
                  <div className="text-sm font-mono">{currentQuote.customerPO || 'N/A'}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editData.validUntil || ''}
                    onChange={(e) => setEditData({ ...editData, validUntil: e.target.value })}
                  />
                ) : (
                  <div className="text-sm">{currentQuote.validUntil || 'N/A'}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Terms</Label>
                {isEditing ? (
                  <Input
                    value={editData.terms || ''}
                    onChange={(e) => setEditData({ ...editData, terms: e.target.value })}
                  />
                ) : (
                  <div className="text-sm">{currentQuote.terms}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="text-sm">
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Ready to Create
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-2">
              <Label>Delivery Address</Label>
              {isEditing ? (
                <Textarea
                  value={editData.deliveryAddress || ''}
                  onChange={(e) => setEditData({ ...editData, deliveryAddress: e.target.value })}
                  rows={2}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {currentQuote.deliveryAddress || 'No address provided'}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              {isEditing ? (
                <Textarea
                  value={editData.notes || ''}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={2}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {currentQuote.notes || 'No notes'}
                </div>
              )}
            </div>

            {/* Quote Items */}
            <div className="space-y-2">
              <Label>Quote Items</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentQuote.items.map((item, itemIndex) => (
                    <TableRow key={itemIndex}>
                      <TableCell>{item.productName}</TableCell>
                      <TableCell className="font-mono text-sm">{item.productSku}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              currentPage,
                              itemIndex,
                              'quantity',
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20 h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={(item.unitPrice / 100).toFixed(2)}
                          onChange={(e) =>
                            updateItem(
                              currentPage,
                              itemIndex,
                              'unitPrice',
                              Math.round(parseFloat(e.target.value) * 100) || 0
                            )
                          }
                          className="w-24 h-8 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(currentQuote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>{formatCurrency(currentQuote.taxTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(currentQuote.grandTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous Quote
        </Button>
        <span className="text-sm text-muted-foreground">
          {currentPage + 1} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={currentPage === totalPages - 1}
        >
          Next Quote
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext}>
          Approve & Continue
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
