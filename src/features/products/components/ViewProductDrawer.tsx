'use client';

/**
 * ViewProductDrawer Component
 *
 * Read-only drawer to view product details.
 * Fetches the full product when opened - table rows only carry a summary.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Package, Ruler, Weight, Trash2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { useAuthStore } from '@/shared/stores';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import { getProduct } from '../actions';
// import { lookupQboAccountNames } from '../actions'; // COMMENTED OUT - QBO disabled
import type { ProductWithFormattedPrices, ProductStatus, ProductItemType } from '../types';
import { ProductPriceMatrix } from '@/features/price-matrix/components';

// ============================================
// TYPES
// ============================================

interface ViewProductDrawerProps {
  productId: string | null;
  open: boolean;
  onClose: () => void;
  /** Shown when the user may edit; receives the product id */
  onEdit?: (productId: string) => void;
  /** Shown when the user may delete; receives the product id */
  onDelete?: (productId: string) => void;
}

// ============================================
// CONSTANTS
// ============================================

const STATUS_VARIANTS: Record<ProductStatus, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  discontinued: 'destructive',
};

const ITEM_TYPE_LABELS: Record<ProductItemType, string> = {
  inventory: 'Inventory',
  non_inventory: 'Non-Inventory',
  service: 'Service',
};

const ITEM_TYPE_VARIANTS: Record<ProductItemType, 'default' | 'secondary' | 'outline'> = {
  inventory: 'outline',
  non_inventory: 'secondary',
  service: 'secondary',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDateTime(date: Date | string | null): string {
  if (!date) {return '-';}
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  if (value === null || value === undefined || value === '' || value === '-') {return null;}
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm font-medium text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  );
}

// ============================================
// COMPONENT
// ============================================

export function ViewProductDrawer({
  productId,
  open,
  onClose,
  onEdit,
  onDelete,
}: ViewProductDrawerProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const [product, setProduct] = useState<ProductWithFormattedPrices | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const [accountNames, setAccountNames] = useState<Record<string, string>>({}); // COMMENTED OUT - QBO disabled

  const canEdit = hasPermission('products.edit');
  const canDelete = hasPermission('products.delete');

  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const fetchProduct = useCallback(async () => {
    if (!productId) {return;}

    setIsLoading(true);
    setError(null);

    try {
      const result = await getProduct(productId);
      if (result.success && result.data) {
        setProduct(result.data);

        // Fetch account names if there are QBO account IDs - COMMENTED OUT - QBO disabled
        // const accountIds = [
        //   result.data.qboIncomeAccount,
        //   result.data.qboExpenseAccount,
        //   result.data.qboInventoryAssetAccount,
        // ].filter((id): id is string => !!id);

        // if (accountIds.length > 0) {
        //   const namesResult = await lookupQboAccountNames(accountIds);
        //   if (namesResult.success && namesResult.data) {
        //     setAccountNames(namesResult.data);
        //   }
        // }
      } else {
        console.error('Failed to load product:', result);
        setError(result.error || 'Failed to load product');
      }
    } catch (err) {
      console.error('Error loading product:', err);
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (open && productId) {
      fetchProduct();
    } else {
      setProduct(null);
      setError(null);
      // setAccountNames({}); // COMMENTED OUT - QBO disabled
    }
  }, [open, productId, fetchProduct]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-[600px] md:max-w-[700px]"
      >
        {/* Header */}
        <SheetHeader className="flex-shrink-0 border-b px-6 py-4">
          <SheetTitle className="text-xl font-semibold">
            {isLoading ? 'Loading...' : product?.name || 'Product Details'}
          </SheetTitle>
          <SheetDescription>
            {product ? `SKU: ${product.sku}` : 'View product information'}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={fetchProduct} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : product ? (
              <div className="space-y-4">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={STATUS_VARIANTS[product.status]}>
                    {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                  </Badge>
                  <Badge variant={ITEM_TYPE_VARIANTS[product.itemType]}>
                    {ITEM_TYPE_LABELS[product.itemType]}
                  </Badge>
                  <Badge variant={product.isSellable ? 'default' : 'outline'}>
                    {product.isSellable ? 'Sellable' : 'Not sellable'}
                  </Badge>
                  {product.category && <Badge variant="outline">{product.category}</Badge>}
                </div>

                {/* Product Information */}
                <Section title="Product Information">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        label="SKU"
                        value={<span className="font-mono">{product.sku}</span>}
                        icon={<Package className="h-4 w-4" />}
                      />
                      <InfoItem
                        label="Item Type"
                        value={
                          <Badge variant={ITEM_TYPE_VARIANTS[product.itemType]}>
                            {ITEM_TYPE_LABELS[product.itemType]}
                          </Badge>
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem label="Category" value={product.category} />
                    </div>
                    <InfoItem label="Name" value={product.name} />
                    <InfoItem label="Short Description" value={product.shortDescription} />
                    <InfoItem
                      label="Description"
                      value={
                        product.description ? (
                          <span className="whitespace-pre-wrap">{product.description}</span>
                        ) : null
                      }
                    />
                  </div>
                </Section>

                {/* Base Pricing */}
                <Section title="Base Pricing">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem
                      label="Base Cost"
                      value={<span className="text-lg font-bold">{product.formattedBaseCost}</span>}
                    />
                    <InfoItem
                      label="Base Price"
                      value={<span className="text-lg font-bold">{product.formattedBasePrice}</span>}
                    />
                    <InfoItem
                      label="Margin"
                      value={<span className="font-mono">{formatCurrency(product.margin)}</span>}
                    />
                    <InfoItem
                      label="Margin %"
                      value={
                        <Badge
                          variant={
                            product.marginPercent >= 20
                              ? 'default'
                              : product.marginPercent >= 10
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="font-mono"
                        >
                          {product.marginPercent.toFixed(1)}%
                        </Badge>
                      }
                    />
                  </div>
                </Section>

                {/* Channel Pricing (Price Matrix) */}
                <ProductPriceMatrix productId={product.id} />

                {/* Specifications */}
                <Section title="Specifications">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem
                      label="Rim Size"
                      value={product.rimSize}
                      icon={<Ruler className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Tire Size"
                      value={product.tireSize}
                      icon={<Ruler className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Weight"
                      value={product.weightLbs ? `${product.weightLbs} lbs` : null}
                      icon={<Weight className="h-4 w-4" />}
                    />
                    <InfoItem
                      label="Barcode"
                      value={product.barcode}
                    />
                  </div>
                </Section>

                {/* QuickBooks Accounts - COMMENTED OUT FOR NOW
                {(product.qboIncomeAccount || product.qboExpenseAccount || product.qboInventoryAssetAccount) && (
                  <Section title="QuickBooks Accounts">
                    <div className="grid grid-cols-3 gap-4">
                      <InfoItem
                        label="Income Account"
                        value={product.qboIncomeAccount ? (accountNames[product.qboIncomeAccount] || product.qboIncomeAccount) : null}
                      />
                      <InfoItem
                        label="Expense Account"
                        value={product.qboExpenseAccount ? (accountNames[product.qboExpenseAccount] || product.qboExpenseAccount) : null}
                      />
                      <InfoItem
                        label="Inventory Asset Account"
                        value={product.qboInventoryAssetAccount ? (accountNames[product.qboInventoryAssetAccount] || product.qboInventoryAssetAccount) : null}
                      />
                    </div>
                  </Section>
                )}
                */}

                {/* Descriptions - COMMENTED OUT FOR NOW
                {(product.salesDescription || product.purchaseDescription) && (
                  <Section title="Descriptions">
                    <div className="grid grid-cols-2 gap-4">
                      <InfoItem
                        label="Sales Description"
                        value={product.salesDescription ? (
                          <span className="whitespace-pre-wrap">{product.salesDescription}</span>
                        ) : null}
                      />
                      <InfoItem
                        label="Purchase Description"
                        value={product.purchaseDescription ? (
                          <span className="whitespace-pre-wrap">{product.purchaseDescription}</span>
                        ) : null}
                      />
                    </div>
                  </Section>
                )}
                */}

                {/* Tax Status - COMMENTED OUT FOR NOW
                {product.isTaxable !== undefined && (
                  <Section title="Tax Information">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Taxable:</span>
                      <Badge variant={product.isTaxable ? 'default' : 'secondary'}>
                        {product.isTaxable ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </Section>
                )}
                */}

                {/* Metadata */}
                <Section title="Metadata">
                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem label="Created" value={formatDateTime(product.createdAt)} />
                    <InfoItem label="Updated" value={formatDateTime(product.updatedAt)} />
                    <InfoItem
                      label="Product ID"
                      value={
                        <span className="font-mono text-xs text-muted-foreground">{product.id}</span>
                      }
                    />
                  </div>
                </Section>
              </div>
            ) : null}
          </div>
        </ScrollArea>

        {/* Footer */}
        {product && (
          <div className="flex-shrink-0 border-t bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              {canDelete && onDelete && (
                <Button variant="destructive" onClick={() => onDelete(product.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
              {canEdit && onEdit && (
                <Button onClick={() => onEdit(product.id)}>Edit Product</Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
