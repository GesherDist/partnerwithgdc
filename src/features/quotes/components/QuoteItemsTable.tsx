'use client';

/**
 * QuoteItemsTable Component
 *
 * Section 3 of the Quote form.
 * Editable table for quote line items.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 * - Optimized row rendering
 */

import { memo, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  itemType: 'inventory' | 'non_inventory' | 'service';
}

interface QuoteItem {
  id?: string;
  productId: string;
  sku: string;
  description: string;
  quantity: number;
  unitId: string;
  unitPrice: number;
  discountPercent: number;
  taxRateId: string;
  lineTotal: number;
}

interface ItemError {
  productId?: string;
  sku?: string;
  quantity?: string;
  unitPrice?: string;
}

interface QuoteItemsTableProps {
  products: Product[];
  items: QuoteItem[];
  onItemsChange: (items: QuoteItem[]) => void;
  onProductSelect?: (index: number, productId: string) => void;
  itemErrors?: ItemError[];
  itemsError?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createEmptyItem(): QuoteItem {
  return {
    id: generateId(),
    productId: '',
    sku: '',
    description: '',
    quantity: 1,
    unitId: 'EA',
    unitPrice: 0,
    discountPercent: 0,
    taxRateId: '',
    lineTotal: 0,
  };
}

function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number
): number {
  const subtotal = quantity * unitPrice;
  const discount = subtotal * (discountPercent / 100);
  return subtotal - discount;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

// ============================================
// ROW COMPONENT (Memoized)
// ============================================

interface QuoteItemRowProps {
  item: QuoteItem;
  index: number;
  products: Product[];
  rowErrors: ItemError;
  isLastItem: boolean;
  onItemChange: (index: number, field: keyof QuoteItem, value: string | number) => void;
  onRemove: (index: number) => void;
}

const QuoteItemRow = memo(function QuoteItemRow({
  item,
  index,
  products,
  rowErrors,
  isLastItem,
  onItemChange,
  onRemove,
}: QuoteItemRowProps) {
  // Get the selected product's itemType
  const selectedProduct = products.find((p) => p.id === item.productId);
  const isServiceOrNonInventory = selectedProduct?.itemType === 'service' || selectedProduct?.itemType === 'non_inventory';

  const handleProductChange = useCallback(
    (value: string) => onItemChange(index, 'productId', value),
    [index, onItemChange]
  );

  const handleSkuChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(index, 'sku', e.target.value),
    [index, onItemChange]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(index, 'description', e.target.value),
    [index, onItemChange]
  );

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(index, 'quantity', Number(e.target.value)),
    [index, onItemChange]
  );

  const handleUnitPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(index, 'unitPrice', Number(e.target.value)),
    [index, onItemChange]
  );

  const handleDiscountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(index, 'discountPercent', Number(e.target.value)),
    [index, onItemChange]
  );

  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);

  return (
    <TableRow>
      {/* Product Selection */}
      <TableCell>
        <div className="space-y-1">
          <Select value={item.productId} onValueChange={handleProductChange}>
            <SelectTrigger className={`h-9 ${rowErrors.productId ? 'border-destructive' : ''}`}>
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rowErrors.productId && (
            <p className="text-xs text-destructive">{rowErrors.productId}</p>
          )}
        </div>
      </TableCell>

      {/* SKU */}
      <TableCell>
        <div className="space-y-1">
          <Input
            value={item.sku}
            onChange={handleSkuChange}
            className={`h-9 ${rowErrors.sku ? 'border-destructive' : ''}`}
            readOnly
          />
          {rowErrors.sku && (
            <p className="text-xs text-destructive">{rowErrors.sku}</p>
          )}
        </div>
      </TableCell>

      {/* Description */}
      <TableCell>
        <Input
          value={item.description}
          onChange={handleDescriptionChange}
          className="h-9"
          placeholder="Description"
        />
      </TableCell>

      {/* Quantity - Hidden for service/non_inventory products */}
      <TableCell>
        {isServiceOrNonInventory ? (
          <div className="h-9 flex items-center justify-end text-sm text-muted-foreground">
            -
          </div>
        ) : (
          <div className="space-y-1">
            <Input
              type="number"
              min="1"
              value={item.quantity}
              onChange={handleQuantityChange}
              className={`h-9 text-right ${rowErrors.quantity ? 'border-destructive' : ''}`}
            />
            {rowErrors.quantity && (
              <p className="text-xs text-destructive">{rowErrors.quantity}</p>
            )}
          </div>
        )}
      </TableCell>

      {/* Unit Price */}
      <TableCell>
        <div className="space-y-1">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={item.unitPrice}
            onChange={handleUnitPriceChange}
            className={`h-9 text-right ${rowErrors.unitPrice ? 'border-destructive' : ''}`}
          />
          {rowErrors.unitPrice && (
            <p className="text-xs text-destructive">{rowErrors.unitPrice}</p>
          )}
        </div>
      </TableCell>

      {/* Discount - Hidden for service/non_inventory products */}
      <TableCell>
        {isServiceOrNonInventory ? (
          <div className="h-9 flex items-center justify-end text-sm text-muted-foreground">
            -
          </div>
        ) : (
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={item.discountPercent}
            onChange={handleDiscountChange}
            className="h-9 text-right"
          />
        )}
      </TableCell>

      {/* Line Total */}
      <TableCell className="text-right font-medium">
        {formatCurrency(item.lineTotal || 0)}
      </TableCell>

      {/* Actions */}
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={handleRemove}
          disabled={isLastItem}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function QuoteItemsTableComponent({
  products,
  items,
  onItemsChange,
  onProductSelect,
  itemErrors = [],
  itemsError,
}: QuoteItemsTableProps) {
  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleAddLine = useCallback(() => {
    const newItem = createEmptyItem();
    onItemsChange([...items, newItem]);
  }, [items, onItemsChange]);

  const handleRemoveLine = useCallback((index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  }, [items, onItemsChange]);

  const handleItemChange = useCallback((
    index: number,
    field: keyof QuoteItem,
    value: string | number
  ) => {
    const updatedItems = items.map((item, i) => {
      if (i !== index) {return item;}

      const updatedItem = { ...item, [field]: value };

      // When product is selected, trigger callback
      if (field === 'productId' && typeof value === 'string') {
        const product = products.find((p) => p.id === value);

        // For service/non_inventory products, auto-set qty=1 and discount=0
        if (product && (product.itemType === 'service' || product.itemType === 'non_inventory')) {
          updatedItem.quantity = 1;
          updatedItem.discountPercent = 0;
        }

        if (onProductSelect) {
          onProductSelect(index, value);
        } else {
          // Fallback to local product data
          if (product) {
            updatedItem.sku = product.sku;
            updatedItem.description = product.description || product.name; // Use description if available, fallback to name
            updatedItem.unitPrice = product.unitPrice / 100;
          }
        }
      }

      // Recalculate line total
      if (['quantity', 'unitPrice', 'discountPercent'].includes(field)) {
        updatedItem.lineTotal = calculateLineTotal(
          Number(updatedItem.quantity) || 0,
          Number(updatedItem.unitPrice) || 0,
          Number(updatedItem.discountPercent) || 0
        );
      }

      return updatedItem;
    });

    onItemsChange(updatedItems);
  }, [items, onItemsChange, onProductSelect, products]);

  // Memoize whether it's the last item
  const isLastItem = items.length === 1;

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Line Items</h3>
          <p className="text-sm text-muted-foreground">
            Add products and quantities to the quote.
          </p>
          {itemsError && (
            <p className="text-sm text-destructive mt-1">{itemsError}</p>
          )}
        </div>
        <Button type="button" onClick={handleAddLine} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      <Separator />

      {/* Items Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[200px]">Product</TableHead>
              <TableHead className="w-[100px]">SKU</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[80px] text-right">Qty</TableHead>
              <TableHead className="w-[120px] text-right">Unit Price</TableHead>
              <TableHead className="w-[80px] text-right">Disc %</TableHead>
              <TableHead className="w-[120px] text-right">Total</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <QuoteItemRow
                key={item.id || index}
                item={item}
                index={index}
                products={products}
                rowErrors={itemErrors[index] || {}}
                isLastItem={isLastItem}
                onItemChange={handleItemChange}
                onRemove={handleRemoveLine}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Export memoized component
export const QuoteItemsTable = memo(QuoteItemsTableComponent);
