'use client';

/**
 * Adjust Inventory Dialog
 *
 * Dialog for adjusting inventory on-hand quantities.
 * Allows adding or subtracting from current quantity.
 */

import { useState } from 'react';
import { Loader2, Plus, Minus, Package, MapPin } from 'lucide-react';

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

import { adjustInventory } from '../actions';
import type { InventoryListItem } from '../types';

interface AdjustInventoryDialogProps {
  open: boolean;
  item: InventoryListItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdjustInventoryDialog({
  open,
  item,
  onClose,
  onSuccess,
}: AdjustInventoryDialogProps) {
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setAdjustmentType('add');
    setQuantity('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!item) {
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    // Calculate adjustment (positive for add, negative for subtract)
    const adjustment = adjustmentType === 'add' ? qty : -qty;

    // Validate we're not going negative
    if (item.onHand + adjustment < 0) {
      setError(`Cannot subtract ${qty} - only ${item.onHand} on hand`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await adjustInventory(item.id, adjustment);

      if (result.success) {
        onSuccess?.();
        handleClose();
      } else {
        setError(result.error || 'Failed to adjust inventory');
      }
    } catch (err) {
      console.error('Error adjusting inventory:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!item) {
    return null;
  }

  const newOnHand = item.onHand + (adjustmentType === 'add' ? (parseInt(quantity) || 0) : -(parseInt(quantity) || 0));

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Adjust Inventory</DialogTitle>
          <DialogDescription>
            Adjust the on-hand quantity for this inventory item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Item Info */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">{item.productSku}</span>
            </div>
            <p className="text-sm font-medium">{item.productName}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{item.locationName} ({item.locationCode})</span>
            </div>
          </div>

          {/* Current Quantity */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">On Hand</p>
              <p className="text-xl font-bold text-emerald-600">{item.onHand}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Allocated</p>
              <p className="text-xl font-bold text-amber-600">{item.allocated}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Available</p>
              <p className="text-xl font-bold text-sky-600">{item.available}</p>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={(v) => setAdjustmentType(v as 'add' | 'subtract')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-emerald-600" />
                    Add to Inventory
                  </div>
                </SelectItem>
                <SelectItem value="subtract">
                  <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4 text-red-600" />
                    Subtract from Inventory
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Preview */}
          {quantity && parseInt(quantity) > 0 && (
            <div className="rounded-lg border border-dashed p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">New On Hand Quantity</p>
              <p className={`text-2xl font-bold ${newOnHand < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {newOnHand}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {item.onHand} {adjustmentType === 'add' ? '+' : '-'} {quantity} = {newOnHand}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !quantity}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? 'Adjusting...' : 'Adjust Inventory'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
