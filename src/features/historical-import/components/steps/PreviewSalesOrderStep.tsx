/**
 * STEP 4: PREVIEW SALES ORDERS
 * =============================
 * Review and edit sales order previews before creation
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
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
import { Badge } from '@/shared/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  Save,
  X,
  Package,
  Warehouse,
  Truck,
  Info,
} from 'lucide-react';
import { ImportWizardState, SalesOrderPreview } from '../../types';
import {
  generateSalesOrderPreviews,
  updateSOPreview,
  updateSOItem,
  getFulfillmentSummary,
} from '../../lib/so-preview-generator';
import { formatCurrency } from '../../lib/preview-generator';

// ============================================================================
// PROPS
// ============================================================================

interface PreviewSalesOrderStepProps {
  state: ImportWizardState;
  updateState: (updates: Partial<ImportWizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================================
// FULFILLMENT SOURCE OPTIONS
// ============================================================================

const FULFILLMENT_SOURCES = [
  {
    value: 'manufacturer',
    label: 'Manufacturer (Direct)',
    icon: Truck,
    description: 'Will create Purchase Order',
  },
  {
    value: 'gdc_inventory',
    label: 'GDC Inventory',
    icon: Warehouse,
    description: 'Will create Pick Ticket',
  },
  {
    value: 'platinum_dealer_inventory',
    label: 'Platinum Dealer Inventory',
    icon: Package,
    description: 'Dealer has inventory',
  },
  {
    value: 'platinum_dealer_fulfillment',
    label: 'Platinum Dealer Fulfillment',
    icon: Package,
    description: 'Dealer will fulfill',
  },
] as const;

// ============================================================================
// SHIPPING METHODS
// ============================================================================

const SHIPPING_METHODS = [
  'Freight - LTL',
  'Freight - FTL',
  'Ocean Container',
  'Customer Pickup',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function PreviewSalesOrderStep({
  state,
  updateState,
  onNext,
  onBack,
}: PreviewSalesOrderStepProps) {
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<SalesOrderPreview>>({});
  const [currentPage, setCurrentPage] = useState(0);

  // ============================================================================
  // GENERATE PREVIEWS ON MOUNT
  // ============================================================================

  useEffect(() => {
    if (state.soPreviews.length > 0) return; // Already generated

    // Build map of loadNumber -> rawRow
    const rawRowsMap = new Map();
    state.rawRows.forEach((row) => {
      rawRowsMap.set(row.loadNumber, row);
    });

    const previews = generateSalesOrderPreviews(state.quotePreviews, rawRowsMap);
    updateState({ soPreviews: previews });
  }, [state.soPreviews.length, state.quotePreviews, state.rawRows, updateState]);

  // ============================================================================
  // EDIT HANDLERS
  // ============================================================================

  const startEdit = (index: number) => {
    const so = state.soPreviews[index]!;
    setEditingOrder(index);
    setEditData({
      orderNumber: so.orderNumber,
      customerPO: so.customerPO,
      shippingAddress: so.shippingAddress,
      shippingMethod: so.shippingMethod,
      expectedDeliveryDate: so.expectedDeliveryDate,
      notes: so.notes,
    });
  };

  const saveEdit = () => {
    if (editingOrder !== null) {
      const updated = updateSOPreview(state.soPreviews[editingOrder]!, editData);
      const newPreviews = [...state.soPreviews];
      newPreviews[editingOrder] = updated;
      updateState({ soPreviews: newPreviews });
      setEditingOrder(null);
      setEditData({});
    }
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setEditData({});
  };

  const updateItemField = (
    soIndex: number,
    itemIndex: number,
    field: string,
    value: any
  ) => {
    const so = state.soPreviews[soIndex]!;
    const updated = updateSOItem(so, itemIndex, { [field]: value });
    const newPreviews = [...state.soPreviews];
    newPreviews[soIndex] = updated;
    updateState({ soPreviews: newPreviews });
  };

  // ============================================================================
  // PAGINATION
  // ============================================================================

  const totalPages = state.soPreviews.length;
  const currentSO = state.soPreviews[currentPage];

  // ============================================================================
  // RENDER
  // ============================================================================

  if (state.soPreviews.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Alert>
          <AlertDescription>
            No sales orders to create. All orders are for warehouse inventory (GDC/Gesher) or have validation errors.
          </AlertDescription>
        </Alert>
        <div className="text-sm text-muted-foreground">
          <p>This is normal if you're importing warehouse inventory or purchase orders without customer sales.</p>
          <p className="mt-4 font-medium">You can still create Purchase Orders and Shipments in the next steps.</p>
        </div>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext}>
            Skip to Fulfillment
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const isEditing = editingOrder === currentPage;
  const fulfillmentSummary = currentSO ? getFulfillmentSummary(currentSO) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Sales Order Previews</h3>
          <p className="text-sm text-muted-foreground">
            Review sales order details and select fulfillment sources
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Order {currentPage + 1} of {totalPages}
        </div>
      </div>

      {/* Sales Order Preview Card */}
      {currentSO && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>
                  <span className="font-mono">{currentSO.orderNumber}</span>
                </CardTitle>
                <CardDescription className="mt-1">
                  Customer: {currentSO.customerName} • Series: {currentSO.orderSeries}
                </CardDescription>
              </div>
              <div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => startEdit(currentPage)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer PO</Label>
                {isEditing ? (
                  <Input
                    value={editData.customerPO || ''}
                    onChange={(e) => setEditData({ ...editData, customerPO: e.target.value })}
                  />
                ) : (
                  <div className="text-sm">{currentSO.customerPO || 'N/A'}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery Date</Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editData.expectedDeliveryDate || ''}
                    onChange={(e) =>
                      setEditData({ ...editData, expectedDeliveryDate: e.target.value })
                    }
                  />
                ) : (
                  <div className="text-sm">{currentSO.expectedDeliveryDate || 'N/A'}</div>
                )}
              </div>
            </div>

            {/* Shipping */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Shipping Method</Label>
                {isEditing ? (
                  <Select
                    value={editData.shippingMethod || currentSO.shippingMethod}
                    onValueChange={(value) => setEditData({ ...editData, shippingMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIPPING_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm">{currentSO.shippingMethod}</div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="text-sm">
                  <Badge variant="secondary">{currentSO.status}</Badge>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="space-y-2">
              <Label>Shipping Address</Label>
              {isEditing ? (
                <Textarea
                  value={editData.shippingAddress || ''}
                  onChange={(e) => setEditData({ ...editData, shippingAddress: e.target.value })}
                  rows={2}
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  {currentSO.shippingAddress || 'No address'}
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="space-y-2">
              <Label>Order Items & Fulfillment</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[250px]">Fulfillment Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentSO.items.map((item, itemIndex) => {
                    const source = FULFILLMENT_SOURCES.find((s) => s.value === item.fulfillmentSource);
                    return (
                      <TableRow key={itemIndex}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {item.productSku}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(item.lineTotal)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.fulfillmentSource}
                            onValueChange={(value) =>
                              updateItemField(currentPage, itemIndex, 'fulfillmentSource', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FULFILLMENT_SOURCES.map((source) => {
                                const SourceIcon = source.icon;
                                return (
                                  <SelectItem key={source.value} value={source.value}>
                                    <div className="flex items-center gap-2">
                                      <SourceIcon className="w-4 h-4" />
                                      <span>{source.label}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-muted-foreground mt-1">
                            {source?.description}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Fulfillment Summary */}
            {fulfillmentSummary && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">This will create:</div>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {fulfillmentSummary.willCreatePO && (
                      <li>Purchase Order (for manufacturer direct items)</li>
                    )}
                    {fulfillmentSummary.willCreatePickTicket && (
                      <li>Pick Ticket (for GDC inventory items)</li>
                    )}
                    {fulfillmentSummary.hasPlatinumDealer && (
                      <li>Platinum Dealer Notification (for dealer items)</li>
                    )}
                    <li>Shipment Tracking</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

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
                  {currentSO.notes || 'No notes'}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(currentSO.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>{formatCurrency(currentSO.taxTotal)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(currentSO.grandTotal)}</span>
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
          Previous
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
          Next
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
