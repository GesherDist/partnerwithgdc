'use client';

/**
 * AddInventoryDrawer Component
 *
 * Dialog for adding inventory for a product at a location.
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
import { Separator } from '@/shared/components/ui/separator';

import { createInventory } from '../actions';
import { getProducts } from '@/features/products/actions';
import { getActiveLocations } from '@/features/locations/actions';

// ============================================
// TYPES
// ============================================

interface AddInventoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
}

interface LocationOption {
  id: string;
  locationCode: string;
  name: string;
}

// ============================================
// COMPONENT
// ============================================

export function AddInventoryDrawer({
  open,
  onClose,
  onSuccess,
}: AddInventoryDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Options
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  // Form state
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [onHand, setOnHand] = useState('0');
  const [reorderPoint, setReorderPoint] = useState('0');
  const [reorderQty, setReorderQty] = useState('0');

  // Fetch products and locations when drawer opens
  useEffect(() => {
    if (open) {
      fetchOptions();
    }
  }, [open]);

  const fetchOptions = async () => {
    setIsLoading(true);
    try {
      const [productsResult, locationsResult] = await Promise.all([
        getProducts({ limit: 100, itemType: 'inventory' }),
        getActiveLocations(),
      ]);

      if (productsResult.success && productsResult.data) {
        setProducts(
          productsResult.data.data.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
          }))
        );
      }

      if (locationsResult.success && locationsResult.data) {
        setLocations(
          locationsResult.data.map((l) => ({
            id: l.id,
            locationCode: l.locationCode,
            name: l.name,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch options:', error);
      toast.error('Failed to load products and locations');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setProductId('');
    setLocationId('');
    setOnHand('0');
    setReorderPoint('0');
    setReorderQty('0');
  };

  const handleCancel = () => {
    if (isSubmitting) { return; }
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId || !locationId) {
      toast.error('Please select a product and location');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createInventory({
        productId,
        locationId,
        onHand: parseInt(onHand) || 0,
        allocated: 0,
        reorderPoint: parseInt(reorderPoint) || 0,
        reorderQty: parseInt(reorderQty) || 0,
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
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="w-full max-w-md">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Add Inventory
          </DialogTitle>
          <DialogDescription>
            Add inventory for a product at a specific location.
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

            {/* Location Selection */}
            <div className="space-y-2">
              <Label htmlFor="location">Location *</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.locationCode} - {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label htmlFor="reorderPoint">Reorder Point</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  min="0"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderQty">Reorder Qty</Label>
                <Input
                  id="reorderQty"
                  type="number"
                  min="0"
                  value={reorderQty}
                  onChange={(e) => setReorderQty(e.target.value)}
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
