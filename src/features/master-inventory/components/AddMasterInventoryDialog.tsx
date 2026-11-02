'use client';

/**
 * AddMasterInventoryDialog Component
 *
 * Master Inventory stock dialog for either source:
 * - Warehouse/GDC ("Update Stock"): pick product + warehouse, see the current
 *   stock, then add or remove tires with a reason and set the low stock alert.
 *   Works whether or not the product already has stock at that warehouse.
 * - Platinum Dealer: product + dealer + dealer location + on hand (new record)
 */

import { useState, useEffect, useMemo } from 'react';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';

import {
  createMasterInventory,
  getMasterInventoryFormOptions,
  getWarehouseStock,
  updateWarehouseStock,
} from '../actions';
import {
  INVENTORY_SOURCE_LABELS,
  STOCK_CHANGE_REASONS,
  type InventorySource,
  type MasterInventoryFormOptions,
  type StockChangeDirection,
  type WarehouseStockLevel,
} from '../types';

// ============================================
// TYPES
// ============================================

interface AddMasterInventoryDialogProps {
  open: boolean;
  defaultSource?: InventorySource;
  /** Preselect a warehouse stock row (e.g. Update Stock from a table row) */
  defaultProductId?: string;
  defaultLocationId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const EMPTY_OPTIONS: MasterInventoryFormOptions = {
  products: [],
  warehouses: [],
  dealers: [],
};

/** Parse a whole number >= 0; returns null when invalid */
function parseQty(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ============================================
// COMPONENT
// ============================================

export function AddMasterInventoryDialog({
  open,
  defaultSource = 'warehouse',
  defaultProductId,
  defaultLocationId,
  onClose,
  onSuccess,
}: AddMasterInventoryDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [options, setOptions] =
    useState<MasterInventoryFormOptions>(EMPTY_OPTIONS);

  // Form state
  const [sourceType, setSourceType] = useState<InventorySource>(defaultSource);
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dealerId, setDealerId] = useState('');
  const [dealerLocationId, setDealerLocationId] = useState('');
  const [onHand, setOnHand] = useState('0');

  // Warehouse: Update Stock
  const [stock, setStock] = useState<WarehouseStockLevel | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [direction, setDirection] = useState<StockChangeDirection>('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [lowStockAlertAt, setLowStockAlertAt] = useState('0');

  // Load options and reset the form each time the dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    setSourceType(defaultSource);
    setProductId(defaultProductId ?? '');
    setLocationId(defaultLocationId ?? '');
    setDealerId('');
    setDealerLocationId('');
    setOnHand('0');
    setStock(null);
    setDirection('add');
    setQuantity('');
    setReason('');
    setNote('');
    setLowStockAlertAt('0');

    let cancelled = false;
    setIsLoading(true);
    getMasterInventoryFormOptions()
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success) {
          setOptions(result.data);
        } else {
          setOptions(EMPTY_OPTIONS);
          toast.error(result.error || 'Failed to load products and locations');
        }
      })
      .catch((error) => {
        console.error('Failed to load Add Inventory options:', error);
        if (!cancelled) {
          toast.error('Failed to load products and locations');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, defaultSource, defaultProductId, defaultLocationId]);

  // Warehouse: load the current stock whenever product + warehouse are both picked
  useEffect(() => {
    if (!open || sourceType !== 'warehouse' || !productId || !locationId) {
      setStock(null);
      return;
    }

    let cancelled = false;
    setIsLoadingStock(true);
    getWarehouseStock(productId, locationId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.success) {
          setStock(result.data);
          setLowStockAlertAt(String(result.data.lowStockAlertAt));
          // Nothing to remove from a warehouse without stock
          if (!result.data.exists) {
            setDirection('add');
          }
        } else {
          setStock(null);
          toast.error(result.error || 'Failed to load current stock');
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load current stock');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingStock(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, sourceType, productId, locationId]);

  const reasonOptions = STOCK_CHANGE_REASONS.filter(
    (r) => r.direction === 'both' || r.direction === direction
  );
  const changeQty = parseQty(quantity) ?? 0;
  const newOnHand = stock
    ? stock.onHand + (direction === 'add' ? changeQty : -changeQty)
    : null;

  const handleDirectionChange = (value: string) => {
    setDirection(value as StockChangeDirection);
    setReason('');
  };

  const selectedDealer = useMemo(
    () => options.dealers.find((d) => d.id === dealerId) ?? null,
    [options.dealers, dealerId]
  );

  const handleDealerChange = (value: string) => {
    setDealerId(value);
    setDealerLocationId('');
  };

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productId) {
      toast.error('Please select a product');
      return;
    }

    if (sourceType === 'warehouse') {
      await submitWarehouseStock();
      return;
    }

    const onHandQty = parseQty(onHand);
    if (onHandQty === null) {
      toast.error('On Hand must be a whole number of 0 or more');
      return;
    }

    if (!dealerId || !dealerLocationId) {
      toast.error('Please select a dealer and dealer location');
      return;
    }
    const input: Parameters<typeof createMasterInventory>[0] = {
      sourceType: 'platinum_dealer',
      productId,
      dealerId,
      dealerLocationId,
      onHand: onHandQty,
    };

    setIsSubmitting(true);
    try {
      const result = await createMasterInventory(input);
      if (result.success) {
        toast.success('Inventory record created successfully');
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to create inventory record');
      }
    } catch (error) {
      console.error('Create master inventory error:', error);
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitWarehouseStock = async () => {
    if (!locationId) {
      toast.error('Please select a warehouse');
      return;
    }
    const qty = parseQty(quantity || '0');
    const alertAt = parseQty(lowStockAlertAt);
    if (qty === null || alertAt === null) {
      toast.error('Quantities must be whole numbers of 0 or more');
      return;
    }
    if (qty === 0 && stock && alertAt === stock.lowStockAlertAt) {
      toast.error('Enter a quantity to add or remove');
      return;
    }
    if (direction === 'remove' && stock && qty > stock.available) {
      toast.error(
        `Only ${stock.available} available to remove (${stock.allocated} allocated to orders)`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateWarehouseStock({
        productId,
        locationId,
        direction,
        quantity: qty,
        reason,
        note,
        lowStockAlertAt: alertAt,
      });
      if (result.success) {
        toast.success(`Stock updated. On hand is now ${result.data.onHand}`);
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.error || 'Failed to update stock');
      }
    } catch (error) {
      console.error('Update stock error:', error);
      toast.error(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isWarehouse = sourceType === 'warehouse';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleCancel()}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 border-b px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            {isWarehouse ? 'Update Stock' : 'Add Inventory'}
          </DialogTitle>
          <DialogDescription>
            {isWarehouse
              ? 'Add or remove tires at a warehouse and set its low stock alert.'
              : 'Add inventory for a product at a platinum dealer location.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center px-6 py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              {/* Source + Product */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Source *</Label>
                  <Select
                    value={sourceType}
                    onValueChange={(value) =>
                      setSourceType(value as InventorySource)
                    }
                  >
                    <SelectTrigger id="source">
                      <SelectValue placeholder="Select a source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warehouse">
                        {INVENTORY_SOURCE_LABELS.warehouse}
                      </SelectItem>
                      <SelectItem value="platinum_dealer">
                        {INVENTORY_SOURCE_LABELS.platinum_dealer}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Product */}
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="product">Product *</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger id="product">
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.sku} - {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {sourceType === 'warehouse' ? (
                <div className="space-y-2">
                  <Label htmlFor="location">Warehouse Location *</Label>
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger id="location">
                      <SelectValue placeholder="Select a warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.warehouses.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.locationCode} - {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {options.warehouses.length === 0 && (
                    <p className="text-muted-foreground text-xs">
                      No active warehouse locations found.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="dealer">Platinum Dealer *</Label>
                    <Select value={dealerId} onValueChange={handleDealerChange}>
                      <SelectTrigger id="dealer">
                        <SelectValue placeholder="Select a dealer" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.dealers.map((dealer) => (
                          <SelectItem key={dealer.id} value={dealer.id}>
                            {dealer.dealerName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {options.dealers.length === 0 && (
                      <p className="text-muted-foreground text-xs">
                        No active platinum dealers found.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dealerLocation">Dealer Location *</Label>
                    <Select
                      value={dealerLocationId}
                      onValueChange={setDealerLocationId}
                      disabled={!selectedDealer}
                    >
                      <SelectTrigger id="dealerLocation">
                        <SelectValue
                          placeholder={
                            selectedDealer
                              ? 'Select a location'
                              : 'Select a dealer first'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDealer?.locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.locationCode
                              ? `${location.locationCode} - ${location.locationName}`
                              : location.locationName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDealer &&
                      selectedDealer.locations.length === 0 && (
                        <p className="text-muted-foreground text-xs">
                          This dealer has no active locations. Add one on the
                          Platinum Dealers page.
                        </p>
                      )}
                  </div>
                </>
              )}

              <Separator />

              {/* Quantities */}
              {isWarehouse ? (
                <div className="space-y-4">
                  {/* Current stock (read-only) */}
                  <div className="bg-muted/30 rounded-lg border p-3">
                    <p className="text-muted-foreground mb-2 text-xs font-medium">
                      Current stock
                    </p>
                    {!productId || !locationId ? (
                      <p className="text-muted-foreground text-sm">
                        Select a product and a warehouse.
                      </p>
                    ) : isLoadingStock || !stock ? (
                      <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-muted-foreground text-xs">
                              On Hand
                            </p>
                            <p className="text-lg font-semibold">
                              {stock.onHand}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">
                              Allocated
                            </p>
                            <p className="text-lg font-semibold text-amber-600">
                              {stock.allocated}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs">
                              Available
                            </p>
                            <p className="text-lg font-semibold text-sky-600">
                              {stock.available}
                            </p>
                          </div>
                        </div>
                        {!stock.exists && (
                          <p className="text-muted-foreground mt-2 text-xs">
                            No stock of this product at this warehouse yet.
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Add / Remove */}
                  <RadioGroup
                    value={direction}
                    onValueChange={handleDirectionChange}
                    className="flex gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="add" id="dir-add" />
                      <Label htmlFor="dir-add" className="font-normal">
                        Add stock
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem
                        value="remove"
                        id="dir-remove"
                        disabled={!stock?.exists}
                      />
                      <Label htmlFor="dir-remove" className="font-normal">
                        Remove stock
                      </Label>
                    </div>
                  </RadioGroup>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason (optional)</Label>
                      <Select value={reason} onValueChange={setReason}>
                        <SelectTrigger id="reason">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {reasonOptions.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="note">Note</Label>
                    <Textarea
                      id="note"
                      rows={2}
                      placeholder="e.g. PO-2600039 container delivered to Kansas"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  {stock && changeQty > 0 && newOnHand !== null && (
                    <p
                      className={`text-sm font-medium ${newOnHand < stock.allocated ? 'text-red-600' : 'text-emerald-600'}`}
                    >
                      New On Hand: {stock.onHand}{' '}
                      {direction === 'add' ? '+' : '-'} {changeQty} ={' '}
                      {newOnHand}
                    </p>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 items-end gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lowStockAlertAt">
                        Low stock alert at
                      </Label>
                      <Input
                        id="lowStockAlertAt"
                        type="number"
                        min="0"
                        step="1"
                        value={lowStockAlertAt}
                        onChange={(e) => setLowStockAlertAt(e.target.value)}
                      />
                    </div>
                    <p className="text-muted-foreground pb-2 text-xs">
                      Shows as Low Stock when available tires drop to this
                      number or below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="onHand">On Hand</Label>
                    <Input
                      id="onHand"
                      type="number"
                      min="0"
                      step="1"
                      value={onHand}
                      onChange={(e) => setOnHand(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Allocated</Label>
                    <Input
                      type="number"
                      value="0"
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Available</Label>
                    <Input
                      type="number"
                      value={parseQty(onHand) ?? 0}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex-shrink-0 border-t px-6 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting || (isWarehouse && (isLoadingStock || !stock))
                }
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isWarehouse ? 'Save' : 'Add Inventory'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
