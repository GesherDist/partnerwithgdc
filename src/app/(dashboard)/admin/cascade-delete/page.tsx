'use client';

/**
 * Cascade Delete Admin Tool
 *
 * Single-page admin interface for safely deleting Customers, Quotes, Sales Orders,
 * Purchase Orders, and Shipments with all their related data.
 *
 * Accepts entity numbers (e.g., PO-2600064, CUST-GALILEO) instead of UUIDs.
 */

import { useState } from 'react';
import { AlertTriangle, Trash2, Search, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

type EntityType = 'customer' | 'quote' | 'sales_order' | 'purchase_order' | 'shipment';

interface PreviewData {
  counts: Record<string, number>;
  totalRecords: number;
  entityData: Record<string, unknown>;
  entityId: string; // UUID returned from preview
}

interface DeleteResult {
  deletedCounts: Record<string, number>;
  totalDeleted: number;
  entityName?: string;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  customer: 'Customer',
  quote: 'Quote',
  sales_order: 'Sales Order',
  purchase_order: 'Purchase Order',
  shipment: 'Shipment',
};

const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
  customer:
    'Delete a customer and all related quotes, sales orders, pick tickets, packing lists, and shipments.',
  quote:
    'Delete a quote and all sales orders created from it, including related data.',
  sales_order:
    'Delete a sales order and all related pick tickets, packing lists, and shipments.',
  purchase_order:
    'Delete a purchase order and all related items. Shipments linked to this PO will be unlinked, not deleted.',
  shipment:
    'Delete a shipment and all related items and status history. Emails, packing lists, and invoices will be unlinked, not deleted.',
};

const ENTITY_PLACEHOLDERS: Record<EntityType, string> = {
  customer: 'CUST-GALILEO',
  quote: 'QT-2600064',
  sales_order: 'C-SO-2600064',
  purchase_order: 'PO-2600064',
  shipment: 'SO2600023',
};

const ENTITY_INPUT_LABELS: Record<EntityType, string> = {
  customer: 'Customer Code',
  quote: 'Quote Number',
  sales_order: 'Sales Order Number',
  purchase_order: 'PO Number',
  shipment: 'Shipment Number',
};

export default function CascadeDeletePage() {
  const [entityType, setEntityType] = useState<EntityType>('customer');
  const [entityNumber, setEntityNumber] = useState('');
  const [deleteAuditLogs, setDeleteAuditLogs] = useState(true);

  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [deleteResult, setDeleteResult] = useState<DeleteResult | null>(null);

  // Reset state when entity type changes
  const handleEntityTypeChange = (value: EntityType) => {
    setEntityType(value);
    setEntityNumber('');
    setPreviewData(null);
    setError(null);
    setDeleteResult(null);
  };

  // Preview what will be deleted
  const handlePreview = async () => {
    if (!entityNumber.trim()) {
      setError(`Please enter a ${ENTITY_INPUT_LABELS[entityType].toLowerCase()}`);
      return;
    }

    setLoading(true);
    setError(null);
    setPreviewData(null);

    try {
      const response = await fetch('/api/cascade-delete/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityNumber: entityNumber.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to preview delete');
        return;
      }

      setPreviewData({
        counts: data.counts,
        totalRecords: data.totalRecords,
        entityData: data.entityData,
        entityId: data.entityId, // Store UUID for delete
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to preview delete'
      );
    } finally {
      setLoading(false);
    }
  };

  // Get the API endpoint for delete based on entity type
  const getDeleteEndpoint = (type: EntityType, id: string): string => {
    switch (type) {
      case 'customer':
        return `/api/customers/${id}/cascade-delete`;
      case 'quote':
        return `/api/quotes/${id}/cascade-delete`;
      case 'sales_order':
        return `/api/sales-orders/${id}/cascade-delete`;
      case 'purchase_order':
        return `/api/purchase-orders/${id}/cascade-delete`;
      case 'shipment':
        return `/api/shipments/${id}/cascade-delete`;
      default:
        return '';
    }
  };

  // Execute cascade delete
  const handleDelete = async () => {
    if (!previewData) return;

    setLoading(true);
    setError(null);
    setShowConfirmDialog(false);

    try {
      const endpoint = getDeleteEndpoint(entityType, previewData.entityId);

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteAuditLogs,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to delete');
        return;
      }

      setDeleteResult({
        deletedCounts: data.deletedCounts,
        totalDeleted: data.totalDeleted,
        entityName:
          data.customerName ||
          data.quoteNumber ||
          data.orderNumber ||
          data.poNumber ||
          data.shipmentNumber,
      });

      // Clear form
      setEntityNumber('');
      setPreviewData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  // Format count display label
  const formatCountLabel = (key: string): string => {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get entity display name from preview data
  const getEntityDisplayName = (): string => {
    if (!previewData?.entityData) return 'Unknown';

    const data = previewData.entityData;
    return (
      (data.name as string) ||
      (data.customer_code as string) ||
      (data.quote_number as string) ||
      (data.order_number as string) ||
      (data.po_number as string) ||
      (data.shipment_number as string) ||
      'Unknown'
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cascade Delete Admin Tool</h1>
        <p className="text-muted-foreground">
          Safely delete entities and all their related data. Always preview
          before deleting.
        </p>
      </div>

      {/* Delete Success Alert */}
      {deleteResult && (
        <Alert className="mb-6 border-green-500 bg-green-50">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-800">Delete Successful</AlertTitle>
          <AlertDescription className="text-green-700">
            Successfully deleted {deleteResult.totalDeleted} records
            {deleteResult.entityName && ` for ${deleteResult.entityName}`}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Entity to Delete</CardTitle>
          <CardDescription>
            Choose the type of entity you want to delete and enter its number/code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Entity Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="entity-type">Entity Type</Label>
            <Select value={entityType} onValueChange={handleEntityTypeChange}>
              <SelectTrigger id="entity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="sales_order">Sales Order</SelectItem>
                <SelectItem value="purchase_order">Purchase Order</SelectItem>
                <SelectItem value="shipment">Shipment</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {ENTITY_DESCRIPTIONS[entityType]}
            </p>
          </div>

          {/* Entity Number Input */}
          <div className="space-y-2">
            <Label htmlFor="entity-number">
              {ENTITY_INPUT_LABELS[entityType]}
            </Label>
            <div className="flex gap-2">
              <Input
                id="entity-number"
                type="text"
                placeholder={ENTITY_PLACEHOLDERS[entityType]}
                value={entityNumber}
                onChange={(e) => {
                  setEntityNumber(e.target.value);
                  setPreviewData(null);
                  setError(null);
                  setDeleteResult(null);
                }}
                className="font-mono text-sm"
              />
              <Button
                onClick={handlePreview}
                disabled={loading || !entityNumber.trim()}
                variant="outline"
              >
                <Search className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Example: {ENTITY_PLACEHOLDERS[entityType]}
            </p>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="delete-audit-logs"
              checked={deleteAuditLogs}
              onCheckedChange={(checked) =>
                setDeleteAuditLogs(checked === true)
              }
            />
            <Label
              htmlFor="delete-audit-logs"
              className="text-sm font-normal cursor-pointer"
            >
              Delete audit logs too (recommended for complete cleanup)
            </Label>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview Display */}
          {previewData && (
            <Alert className="border-orange-500 bg-orange-50">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <AlertTitle className="text-orange-800">
                Warning: This will delete {previewData.totalRecords} records
              </AlertTitle>
              <AlertDescription>
                <div className="mt-3 space-y-2">
                  <p className="font-semibold text-orange-900">
                    {ENTITY_LABELS[entityType]}: {getEntityDisplayName()}
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {Object.entries(previewData.counts)
                      .filter(([, count]) => count > 0)
                      .map(([key, count]) => (
                        <div
                          key={key}
                          className="flex justify-between text-sm"
                        >
                          <span className="text-orange-800">
                            {formatCountLabel(key)}:
                          </span>
                          <span className="font-semibold text-orange-900">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                  <div className="border-t border-orange-200 mt-3 pt-3">
                    <div className="flex justify-between font-bold text-orange-900">
                      <span>Total Records:</span>
                      <span>{previewData.totalRecords}</span>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setEntityNumber('');
                setPreviewData(null);
                setError(null);
                setDeleteResult(null);
              }}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowConfirmDialog(true)}
              disabled={!previewData || loading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {ENTITY_LABELS[entityType]}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Cascade Delete
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the{' '}
              {ENTITY_LABELS[entityType].toLowerCase()} and{' '}
              {previewData?.totalRecords} related records.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="font-semibold mb-2">Are you absolutely sure?</p>
            <p className="text-sm text-muted-foreground">
              You are about to delete this {ENTITY_LABELS[entityType].toLowerCase()} and all its related data.
            </p>
            {previewData && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm font-mono text-red-900">
                  {getEntityDisplayName()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Yes, Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
