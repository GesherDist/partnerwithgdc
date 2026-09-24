'use client';

/**
 * POItemsTable Component
 *
 * Inline editable table for Purchase Order line items.
 * Similar to Sales Order's OrderItemsTable.
 */

import { memo, useCallback, useState, useEffect } from 'react';
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

import { getProducts } from '@/features/products/actions';
import { UNITS } from '@/shared/lib/global-data';
import type { CreatePOItemDTO } from '../types';

// ============================================
// TYPES
// ============================================

interface POItem extends CreatePOItemDTO {
  id: string;
  lineTotal: number;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  baseCost: number;
  itemType: 'inventory' | 'non_inventory' | 'service';
}

interface POItemsTableProps {
  items: POItem[];
  onItemsChange: (items: POItem[]) => void;
}

interface POItemRowProps {
  item: POItem;
  index: number;
  products: ProductOption[];
  onItemChange: (itemId: string, field: string, value: string | number) => void;
  onRemove: (itemId: string) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createEmptyPOItem(): POItem {
  return {
    id: `poi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    productId: '',
    sku: '',
    description: null,
    quantityOrdered: 1,
    unitCode: 'EA',
    unitPrice: 0,
    taxRate: 0,
    lineTotal: 0,
  };
}

function formatCurrency(amountInCents: number): string {
  return `$${(amountInCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ============================================
// MEMOIZED ROW COMPONENT
// ============================================

const POItemRow = memo(function POItemRow({
  item,
  products,
  onItemChange,
  onRemove,
}: POItemRowProps) {
  const itemId = item.id || '';

  // Check if product is service or non_inventory
  const selectedProduct = products.find((p) => p.id === item.productId);
  const isServiceOrNonInventory = selectedProduct?.itemType === 'service' || selectedProduct?.itemType === 'non_inventory';

  // Handlers
  const handleProductChange = useCallback(
    (value: string) => onItemChange(itemId, 'productId', value),
    [itemId, onItemChange]
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(itemId, 'description', e.target.value),
    [itemId, onItemChange]
  );

  const handleQuantityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onItemChange(itemId, 'quantityOrdered', Number(e.target.value)),
    [itemId, onItemChange]
  );

  const handleUnitChange = useCallback(
    (value: string) => onItemChange(itemId, 'unitCode', value),
    [itemId, onItemChange]
  );

  const handleUnitPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Convert dollars to cents
      const dollars = Number(e.target.value);
      onItemChange(itemId, 'unitPrice', Math.round(dollars * 100));
    },
    [itemId, onItemChange]
  );

  const handleRemove = useCallback(
    () => onRemove(itemId),
    [itemId, onRemove]
  );

  return (
    <TableRow>
      {/* Product Select */}
      <TableCell>
        <Select
          value={item.productId || undefined}
          onValueChange={handleProductChange}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select product" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* SKU (Read-only) */}
      <TableCell>
        <Input
          value={item.sku || ''}
          readOnly
          className="h-9 bg-muted font-mono text-sm w-full"
        />
      </TableCell>

      {/* Description */}
      <TableCell className="max-w-[140px]">
        <Input
          value={item.description || ''}
          onChange={handleDescriptionChange}
          className="h-9 w-full truncate"
          placeholder="Description"
          title={item.description || ''}
        />
      </TableCell>

      {/* Quantity */}
      <TableCell className="w-[80px]">
        {isServiceOrNonInventory ? (
          <div className="h-9 flex items-center justify-end text-sm text-muted-foreground">-</div>
        ) : (
          <Input
            type="number"
            min={1}
            value={item.quantityOrdered || ''}
            onChange={handleQuantityChange}
            className="h-9 text-right w-full"
          />
        )}
      </TableCell>

      {/* Unit */}
      <TableCell>
        <Select
          value={item.unitCode || 'EA'}
          onValueChange={handleUnitChange}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((unit) => (
              <SelectItem key={unit.id} value={unit.code}>
                {unit.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Unit Price (display in dollars, store in cents) */}
      <TableCell>
        <Input
          type="number"
          min={0}
          step={1}
          value={Math.round(item.unitPrice / 100)}
          onChange={handleUnitPriceChange}
          className="h-9 text-right"
        />
      </TableCell>

      {/* Line Total (Read-only) */}
      <TableCell className="text-right font-medium">
        {formatCurrency(item.lineTotal)}
      </TableCell>

      {/* Remove Button */}
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove line</span>
        </Button>
      </TableCell>
    </TableRow>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

function POItemsTableComponent({
  items,
  onItemsChange,
}: POItemsTableProps) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const result = await getProducts({ limit: 500, status: 'active' });
      if (result.success && result.data) {
        setProducts(
          result.data.data.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            baseCost: p.baseCost,
            itemType: p.itemType as 'inventory' | 'non_inventory' | 'service',
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers
  const handleAddLine = useCallback(() => {
    const newItem = createEmptyPOItem();
    onItemsChange([...items, newItem]);
  }, [items, onItemsChange]);

  const handleRemoveLine = useCallback((itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId));
  }, [items, onItemsChange]);

  const handleItemChange = useCallback((
    itemId: string,
    field: string,
    value: string | number
  ) => {
    onItemsChange(
      items.map((item) => {
        if (item.id !== itemId) return item;

        const updatedItem = { ...item, [field]: value };

        // When product is selected, auto-fill SKU, description, and price
        if (field === 'productId' && typeof value === 'string') {
          const product = products.find((p) => p.id === value);
          if (product) {
            updatedItem.sku = product.sku;
            updatedItem.description = product.name;
            updatedItem.unitPrice = product.baseCost;
            updatedItem.itemType = product.itemType;

            // Set quantity to 1 for service/non_inventory
            if (product.itemType === 'service' || product.itemType === 'non_inventory') {
              updatedItem.quantityOrdered = 1;
            }
          }
        }

        // Recalculate line total
        const quantity = field === 'quantityOrdered' ? Number(value) : updatedItem.quantityOrdered;
        const unitPrice = field === 'unitPrice' ? Number(value) : updatedItem.unitPrice;
        updatedItem.lineTotal = quantity * unitPrice;

        return updatedItem;
      })
    );
  }, [items, onItemsChange, products]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Items</h3>
          <p className="text-sm text-muted-foreground">
            Add products to this purchase order.
          </p>
        </div>
        <Button type="button" onClick={handleAddLine} size="sm" disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Add Line
        </Button>
      </div>

      <Separator />

      {/* Items Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[180px]">Product</TableHead>
              <TableHead className="w-[110px]">SKU</TableHead>
              <TableHead className="w-[140px]">Description</TableHead>
              <TableHead className="w-[80px] text-right">Qty</TableHead>
              <TableHead className="w-[70px]">Unit</TableHead>
              <TableHead className="w-[100px] text-right">Unit Price</TableHead>
              <TableHead className="w-[110px] text-right">Line Total</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No items added. Click &quot;Add Line&quot; to add products.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <POItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  products={products}
                  onItemChange={handleItemChange}
                  onRemove={handleRemoveLine}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Line Button (Bottom) */}
      {items.length > 0 && (
        <div className="flex justify-start">
          <Button type="button" variant="outline" onClick={handleAddLine} size="sm" disabled={isLoading}>
            <Plus className="mr-2 h-4 w-4" />
            Add Line
          </Button>
        </div>
      )}
    </div>
  );
}

// Export memoized component
export const POItemsTable = memo(POItemsTableComponent);
