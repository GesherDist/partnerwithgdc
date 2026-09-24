'use client';

/**
 * Add PO Item Dialog
 *
 * Dialog for adding items to a Purchase Order.
 * Allows product selection with auto-fill of SKU, description, and price.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import { getProducts } from '@/features/products/actions';
import type { CreatePOItemDTO } from '../types';

// ============================================
// TYPES
// ============================================

interface AddPOItemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (item: CreatePOItemDTO) => void;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  baseCost: number; // cents
  itemType: 'inventory' | 'non_inventory' | 'service';
}

// ============================================
// COMPONENT
// ============================================

export function AddPOItemDialog({
  open,
  onClose,
  onAdd,
}: AddPOItemDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');

  // Fetch products when dialog opens
  useEffect(() => {
    if (open) {
      fetchProducts();
      resetForm();
    }
  }, [open]);

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
            description: p.name, // Use name as description since ProductTableRow doesn't have description
            baseCost: p.baseCost,
            itemType: p.itemType as 'inventory' | 'non_inventory' | 'service',
          }))
        );
      } else {
        toast.error('Failed to load products');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedProductId('');
    setSelectedProduct(null);
    setQuantity('1');
    setUnitPrice('');
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id === productId);
    setSelectedProduct(product || null);

    if (product) {
      // Auto-fill unit price from base cost (convert cents to dollars for display)
      setUnitPrice((product.baseCost / 100).toFixed(2));

      // Set quantity to 1 for service/non_inventory items
      if (product.itemType === 'service' || product.itemType === 'non_inventory') {
        setQuantity('1');
      }
    }
  };

  const handleAdd = () => {
    if (!selectedProduct) {
      toast.error('Please select a product');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid unit price');
      return;
    }

    const item: CreatePOItemDTO = {
      productId: selectedProduct.id,
      sku: selectedProduct.sku,
      description: selectedProduct.description,
      quantityOrdered: qty,
      unitCode: 'EA',
      unitPrice: Math.round(price * 100), // Convert to cents
      taxRate: 0,
      itemType: selectedProduct.itemType,
    };

    onAdd(item);
    resetForm();
    onClose();
  };

  const isServiceOrNonInventory = selectedProduct?.itemType === 'service' || selectedProduct?.itemType === 'non_inventory';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
          <DialogDescription>
            Select a product to add to the purchase order.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="product">Product *</Label>
              <Select value={selectedProductId} onValueChange={handleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <span className="font-mono text-xs mr-2">{product.sku}</span>
                      <span>{product.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* SKU (Read-only) */}
            {selectedProduct && (
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={selectedProduct.sku} readOnly className="bg-muted font-mono" />
              </div>
            )}

            {/* Description (Read-only) */}
            {selectedProduct && selectedProduct.description && (
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={selectedProduct.description} readOnly className="bg-muted" />
              </div>
            )}

            {/* Quantity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                {isServiceOrNonInventory ? (
                  <Input value="1" readOnly className="bg-muted" />
                ) : (
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                  />
                )}
              </div>

              {/* Unit Price */}
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price ($) *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min={0}
                  step={0.01}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Line Total Preview */}
            {selectedProduct && unitPrice && (
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Line Total:</span>
                  <span className="font-semibold">
                    ${(parseInt(quantity || '0', 10) * parseFloat(unitPrice || '0')).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={isLoading || !selectedProduct}
          >
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
