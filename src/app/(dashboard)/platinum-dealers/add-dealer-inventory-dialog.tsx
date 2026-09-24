'use client';

/**
 * AddDealerInventoryDialog Component
 *
 * Dialog for adding new product inventory to a dealer location.
 * Follows the same pattern as main Inventory module's AddInventoryDrawer.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';

import { updateDealerInventoryAction } from '@/features/platinum-dealers/actions';
import { getProducts } from '@/features/products/actions';

// ============================================
// TYPES
// ============================================

interface AddDealerInventoryDialogProps {
  open: boolean;
  dealerId: string | null;
  dealerLocationId: string | null;
  locationName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
}

// ============================================
// COMPONENT
// ============================================

export function AddDealerInventoryDialog({
  open,
  dealerId,
  dealerLocationId,
  locationName,
  onClose,
  onSuccess,
}: AddDealerInventoryDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Options
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Form state
  const [productId, setProductId] = useState('');
  const [onHand, setOnHand] = useState('0');

  // Fetch products when dialog opens
  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const result = await getProducts({ limit: 100, itemType: 'inventory' });

      if (result.success && result.data) {
        setProducts(
          result.data.data.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProductId('');
    setOnHand('0');
  };

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dealerId || !dealerLocationId) {
      return;
    }

    if (!productId) {
      toast.error('Please select a product');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateDealerInventoryAction({
        dealerId,
        dealerLocationId,
        productId,
        onHand: parseInt(onHand) || 0,
      });

      if (result.success) {
        toast.success('Inventory record created successfully');
        resetForm();
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to create inventory record');
      }
    } catch (error) {
      console.error('Create inventory error:', error);
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="w-full max-w-md">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Add Inventory</DialogTitle>
          <DialogDescription>
            Add inventory for a product at {locationName}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="product">Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.sku} - {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                value={locationName}
                disabled
                className="bg-muted"
              />
            </div>

            <Separator />

            {/* Quantities */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="onHand">On Hand</Label>
                <Input
                  id="onHand"
                  type="number"
                  min="0"
                  value={onHand}
                  onChange={(e) => setOnHand(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Allocated</Label>
                <Input type="number" value="0" disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Available</Label>
                <Input
                  type="number"
                  value={onHand}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Inventory
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
