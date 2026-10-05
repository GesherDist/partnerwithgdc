/**
 * STEP 2: REVIEW RAW DATA
 * ========================
 * Review and edit parsed data before creating quotes
 */

'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ImportWizardState, RawExcelRow } from '../../types';
import { getValidRows } from '../../lib/validator';

// ============================================================================
// PROPS
// ============================================================================

interface ReviewDataStepProps {
  state: ImportWizardState;
  updateState: (updates: Partial<ImportWizardState>) => void;
  updateRow: (rowIndex: number, updates: Partial<RawExcelRow>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewDataStep({
  state,
  updateState: _updateState,
  updateRow,
  onNext,
  onBack,
}: ReviewDataStepProps) {
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<RawExcelRow>>({});

  const validation = state.validation;
  const validRows = getValidRows(state.rawRows);

  // ============================================================================
  // EDIT HANDLERS
  // ============================================================================

  const startEdit = (row: RawExcelRow) => {
    setEditingRow(row.rowIndex);
    setEditData({
      customer: row.customer,
      customerPO: row.customerPO,
      qty38: row.qty38,
      qty24: row.qty24,
      price38: row.price38,
      price24: row.price24,
      deliveryAddress: row.deliveryAddress,
      status: row.status,
    });
  };

  const saveEdit = async () => {
    if (editingRow !== null) {
      await updateRow(editingRow, editData);
      setEditingRow(null);
      setEditData({});
    }
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditData({});
  };

  // ============================================================================
  // ROW STATUS BADGE
  // ============================================================================

  const getRowStatusBadge = (row: RawExcelRow) => {
    if (row.isInternalCustomer) {
      return (
        <Badge variant="secondary" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          Internal
        </Badge>
      );
    }

    if (row.isValid && row.customerExists) {
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Valid
        </Badge>
      );
    }

    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="w-3 h-3" />
        Invalid
      </Badge>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!validation) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No validation data available
      </div>
    );
  }

  const canProceed = validRows.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-2xl font-bold">{validation.summary.totalRows}</div>
          <div className="text-sm text-muted-foreground">Total Orders</div>
        </div>
        <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
          <div className="text-2xl font-bold text-green-600">{validation.summary.validRows}</div>
          <div className="text-sm text-muted-foreground">Valid Orders</div>
        </div>
        <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950">
          <div className="text-2xl font-bold text-red-600">{validation.summary.invalidRows}</div>
          <div className="text-sm text-muted-foreground">Invalid Orders</div>
        </div>
        <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
          <div className="text-2xl font-bold text-yellow-600">
            {validation.summary.internalCustomers}
          </div>
          <div className="text-sm text-muted-foreground">Internal/Warehouse</div>
        </div>
      </div>

      {/* Validation Messages */}
      {validation.summary.invalidRows > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {validation.summary.invalidRows} orders have validation errors.
            Fix errors or remove invalid rows before proceeding.
          </AlertDescription>
        </Alert>
      )}

      {validation.summary.internalCustomers > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {validation.summary.internalCustomers} orders are for internal customers (GDC,
            warehouses). These will create Purchase Orders for inventory receiving, not sales
            orders.
          </AlertDescription>
        </Alert>
      )}

      {/* Data Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Load #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>PO</TableHead>
              <TableHead className="text-right">Qty 38"</TableHead>
              <TableHead className="text-right">Qty 24"</TableHead>
              <TableHead className="text-right">Price 38"</TableHead>
              <TableHead className="text-right">Price 24"</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.rawRows.map((row, idx) => {
              const isEditing = editingRow === row.rowIndex;
              const total = row.qty38 * row.price38 + row.qty24 * row.price24;

              return (
                <TableRow
                  key={`${row.loadNumber}-${idx}`}
                  className={
                    row.isInternalCustomer
                      ? 'bg-yellow-50 dark:bg-yellow-950/20'
                      : !row.isValid || !row.customerExists
                      ? 'bg-red-50 dark:bg-red-950/20'
                      : ''
                  }
                >
                  <TableCell className="font-mono text-sm">{row.loadNumber}</TableCell>

                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editData.customer || ''}
                        onChange={(e) => setEditData({ ...editData, customer: e.target.value })}
                        className="h-8"
                      />
                    ) : (
                      <div>
                        <div>{row.customer}</div>
                        {!row.customerExists && !row.isInternalCustomer && (
                          <div className="text-xs text-red-600">Not found in database</div>
                        )}
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editData.customerPO || ''}
                        onChange={(e) => setEditData({ ...editData, customerPO: e.target.value })}
                        className="h-8"
                      />
                    ) : (
                      row.customerPO
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData.qty38 || 0}
                        onChange={(e) =>
                          setEditData({ ...editData, qty38: parseInt(e.target.value) || 0 })
                        }
                        className="h-8 w-20"
                      />
                    ) : (
                      row.qty38
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editData.qty24 || 0}
                        onChange={(e) =>
                          setEditData({ ...editData, qty24: parseInt(e.target.value) || 0 })
                        }
                        className="h-8 w-20"
                      />
                    ) : (
                      row.qty24
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.price38 || 0}
                        onChange={(e) =>
                          setEditData({ ...editData, price38: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 w-24"
                      />
                    ) : (
                      `$${row.price38.toFixed(2)}`
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editData.price24 || 0}
                        onChange={(e) =>
                          setEditData({ ...editData, price24: parseFloat(e.target.value) || 0 })
                        }
                        className="h-8 w-24"
                      />
                    ) : (
                      `$${row.price24.toFixed(2)}`
                    )}
                  </TableCell>

                  <TableCell className="text-right font-semibold">
                    ${total.toFixed(2)}
                  </TableCell>

                  <TableCell>{getRowStatusBadge(row)}</TableCell>

                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={saveEdit}>
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEdit(row)}
                        disabled={editingRow !== null}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next: Preview Quotes
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
