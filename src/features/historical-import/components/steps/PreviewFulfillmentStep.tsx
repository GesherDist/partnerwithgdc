/**
 * STEP 5: PREVIEW FULFILLMENT
 * ============================
 * Review PO, Pick Ticket, and Shipment previews
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
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
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  ClipboardList,
  Truck,
  Info,
} from 'lucide-react';
import { ImportWizardState } from '../../types';
import {
  generatePOPreviews,
  generatePickTicketPreviews,
  generateShipmentPreviews,
  getFulfillmentStats,
} from '../../lib/fulfillment-preview-generator';
import { formatCurrency } from '../../lib/preview-generator';
import { importHistoricalData } from '../../actions';

// ============================================================================
// PROPS
// ============================================================================

interface PreviewFulfillmentStepProps {
  state: ImportWizardState;
  updateState: (updates: Partial<ImportWizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PreviewFulfillmentStep({
  state,
  updateState,
  onNext,
  onBack,
}: PreviewFulfillmentStepProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // GENERATE PREVIEWS ON MOUNT
  // ============================================================================

  useEffect(() => {
    async function generatePreviews() {
      if (
        state.poPreviews.length > 0 ||
        state.pickTicketPreviews.length > 0 ||
        state.shipmentPreviews.length > 0
      ) {
        return; // Already generated
      }

      setIsGenerating(true);
      setError(null);

      try {
        // Build map of loadNumber -> rawRow
        const rawRowsMap = new Map();
        state.rawRows.forEach((row) => {
          rawRowsMap.set(row.loadNumber, row);
        });

        // Get internal customer rows (warehouse inventory - no customer, no SO)
        const internalCustomerRows = state.rawRows.filter((row) => row.isInternalCustomer);

        // Generate all previews in parallel
        const [poPreviews, pickTicketPreviews] = await Promise.all([
          generatePOPreviews(state.soPreviews, internalCustomerRows, rawRowsMap),
          generatePickTicketPreviews(state.soPreviews),
        ]);

        // Generate shipment previews (depends on POs)
        const shipmentPreviews = await generateShipmentPreviews(
          state.soPreviews,
          poPreviews,
          rawRowsMap
        );

        updateState({
          poPreviews,
          pickTicketPreviews,
          shipmentPreviews,
        });
      } catch (err) {
        console.error('Error generating fulfillment previews:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate previews');
      } finally {
        setIsGenerating(false);
      }
    }

    generatePreviews();
  }, [
    state.poPreviews.length,
    state.pickTicketPreviews.length,
    state.shipmentPreviews.length,
    state.soPreviews,
    state.rawRows,
    updateState,
  ]);

  // ============================================================================
  // IMPORT HANDLER
  // ============================================================================

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);

    try {
      const result = await importHistoricalData({
        quotes: state.quotePreviews,
        salesOrders: state.soPreviews,
        purchaseOrders: state.poPreviews,
        pickTickets: state.pickTicketPreviews,
        shipments: state.shipmentPreviews,
      });

      // Update state with result
      updateState({ result });

      // Go to complete step
      onNext();
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

  // ============================================================================
  // STATISTICS
  // ============================================================================

  const stats = getFulfillmentStats(
    state.poPreviews,
    state.pickTicketPreviews,
    state.shipmentPreviews
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-lg font-semibold">Generating fulfillment previews...</p>
        <p className="text-sm text-muted-foreground">
          Creating PO, Pick Ticket, and Shipment previews
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Review Fulfillment Previews</h3>
        <p className="text-sm text-muted-foreground">
          Review Purchase Orders, Pick Tickets, and Shipments that will be created
        </p>
      </div>

      {/* Import Error Alert */}
      {error && !isGenerating && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPOs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalPOItems} items total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Pick Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPickTickets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.totalPickTicketItems} items to pick
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Shipments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalShipments}</div>
            <p className="text-xs text-muted-foreground mt-1">Tracking records</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          These records will be created automatically when you complete the import. Review each
          tab to verify the details.
        </AlertDescription>
      </Alert>

      {/* Tabs */}
      <Tabs defaultValue="purchase-orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="purchase-orders">
            Purchase Orders ({stats.totalPOs})
          </TabsTrigger>
          <TabsTrigger value="pick-tickets">
            Pick Tickets ({stats.totalPickTickets})
          </TabsTrigger>
          <TabsTrigger value="shipments">
            Shipments ({stats.totalShipments})
          </TabsTrigger>
        </TabsList>

        {/* Purchase Orders Tab */}
        <TabsContent value="purchase-orders" className="space-y-4">
          {state.poPreviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchase orders will be created (no manufacturer items)
            </div>
          ) : (
            state.poPreviews.map((po, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-mono text-lg">{po.poNumber}</CardTitle>
                      <CardDescription className="mt-1">
                        Vendor: {po.vendorName} • SO: {po.salesOrderNumber}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{po.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {po.items.map((item, itemIdx) => (
                        <TableRow key={itemIdx}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="font-mono text-sm">{item.productSku}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.lineTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-semibold">
                          Grand Total:
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          {formatCurrency(po.grandTotal)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Pick Tickets Tab */}
        <TabsContent value="pick-tickets" className="space-y-4">
          {state.pickTicketPreviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pick tickets will be created (no GDC inventory items)
            </div>
          ) : (
            state.pickTicketPreviews.map((pt, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="font-mono text-lg">{pt.salesOrderNumber}</CardTitle>
                      <CardDescription className="mt-1">
                        Location: {pt.locationName}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{pt.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Quantity to Pick</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pt.items.map((item, itemIdx) => (
                        <TableRow key={itemIdx}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell className="font-mono text-sm">{item.productSku}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {item.quantityToPick}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Shipments Tab */}
        <TabsContent value="shipments" className="space-y-4">
          {state.shipmentPreviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shipments will be created
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SO Number</TableHead>
                  <TableHead>Container Numbers</TableHead>
                  <TableHead>Delivery Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shipped Date</TableHead>
                  <TableHead>Est. Delivery</TableHead>
                  <TableHead>Actual Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.shipmentPreviews.map((shipment, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono font-semibold">{shipment.salesOrderNumber}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {shipment.containerNumbers || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate" title={shipment.deliveryAddress}>
                      {shipment.deliveryAddress || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {(shipment.loadStatus || shipment.status).toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {shipment.shippedDate || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {shipment.estimatedDeliveryDate || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {shipment.actualDeliveryDate || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack} disabled={isImporting}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleImport} size="lg" disabled={isImporting}>
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              Create All Records
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
