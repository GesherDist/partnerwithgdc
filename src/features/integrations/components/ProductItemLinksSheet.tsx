'use client';

/**
 * Products ↔ QuickBooks items — link each ERP product to its QuickBooks item
 *
 * Invoices pushed to QuickBooks use the linked item, so revenue and cost land
 * in the item's accounts (e.g. 4100 Sales Revenue - Product / 5000 Cost of
 * Goods Sold - Product). QuickBooks is only read; linking saves the item and
 * its accounts on the product. Products match by exact name and item type.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Link2, Loader2, RefreshCw, Unlink } from 'lucide-react';
import { toast } from 'sonner';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { useAuthStore } from '@/shared/stores';
import { cn } from '@/shared/lib/utils';

import {
  getProductItemLinks,
  linkProductsToQboItems,
  unlinkProductFromQboItem,
  type ItemLinkStatus,
  type ProductItemLinksView,
} from '../actions/product-item-links.actions';

interface ProductItemLinksSheetProps {
  open: boolean;
  onClose: () => void;
}

const STATUS: Record<ItemLinkStatus, { label: string; className: string }> = {
  linked: { label: 'Linked', className: 'border-green-300 bg-green-50 text-green-800' },
  match: { label: 'Ready to link', className: 'border-blue-300 bg-blue-50 text-blue-800' },
  type_mismatch: { label: 'Type differs', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  ambiguous: { label: 'Several items', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  no_match: { label: 'Not in QuickBooks', className: 'border-red-300 bg-red-50 text-red-800' },
  stale: { label: 'Item missing', className: 'border-red-300 bg-red-50 text-red-800' },
};

const TYPE_LABEL: Record<string, string> = { inventory: 'Inventory', non_inventory: 'Non-inventory', service: 'Service' };

export function ProductItemLinksSheet({ open, onClose }: ProductItemLinksSheetProps) {
  const { hasPermission } = useAuthStore();
  const canEdit = hasPermission('settings.edit');

  const [view, setView] = useState<ProductItemLinksView | null>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getProductItemLinks();
      if (result.success) {
        setView(result.data);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Failed to read QuickBooks items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  const ready = useMemo(() => (view?.links ?? []).filter((l) => l.status === 'match'), [view]);

  const handleLink = async () => {
    setLinking(true);
    try {
      const result = await linkProductsToQboItems(ready.map((l) => l.productId));
      if (result.success) {
        toast.success(`Linked ${result.data.linked} product(s) to QuickBooks items`);
        if (result.data.skipped.length) {
          toast.warning(`Skipped: ${result.data.skipped.join('; ')}`);
        }
        await load();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Linking failed');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (productId: string) => {
    setUnlinkingId(productId);
    try {
      const result = await unlinkProductFromQboItem(productId);
      if (result.success) {
        await load();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error('Unlink failed');
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-6xl overflow-y-auto">
        <SheetHeader className="space-y-1 pb-4">
          <SheetTitle>Products ↔ QuickBooks Items</SheetTitle>
          <SheetDescription>
            Link each product to its QuickBooks item, so pushed invoices use that item and its income, expense
            and inventory asset accounts. QuickBooks is only read; products match by exact name and type.
          </SheetDescription>
        </SheetHeader>

        {loading && !view ? (
          <div className="flex items-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading QuickBooks items...
          </div>
        ) : !view?.connected ? (
          <p className="py-12 text-center text-muted-foreground">Connect QuickBooks to link products.</p>
        ) : (
          <div className="space-y-4">
            {view.environment === 'sandbox' && (
              <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                These are QuickBooks <b>sandbox</b> (test) items. Link products after the company&apos;s real
                QuickBooks is connected.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {view.links.filter((l) => l.status === 'linked').length} of {view.links.length} products linked
                {ready.length > 0 && ` · ${ready.length} ready to link`}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={load} disabled={loading}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
                  Refresh
                </Button>
                {canEdit && (
                  <Button onClick={handleLink} disabled={linking || ready.length === 0}>
                    {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Link {ready.length} product{ready.length === 1 ? '' : 's'}
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ERP product</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead>QuickBooks item</TableHead>
                    <TableHead>Income account</TableHead>
                    <TableHead>Expense account</TableHead>
                    <TableHead>Inventory asset</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {view.links.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No products
                      </TableCell>
                    </TableRow>
                  ) : (
                    view.links.map((link) => (
                      <TableRow key={link.productId}>
                        <TableCell>
                          <p className="font-medium">{link.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {link.sku} · {TYPE_LABEL[link.itemType] ?? link.itemType}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-[11px]', STATUS[link.status].className)}>
                            {STATUS[link.status].label}
                          </Badge>
                          {link.message && <p className="mt-1 text-[11px] text-muted-foreground">{link.message}</p>}
                        </TableCell>
                        <TableCell>
                          {link.item ? (
                            <>
                              <p>{link.item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {TYPE_LABEL[link.item.type] ?? link.item.type}
                                {link.item.sku ? ` · ${link.item.sku}` : ''}
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{link.item?.incomeAccount ?? '—'}</TableCell>
                        <TableCell className="text-sm">{link.item?.expenseAccount ?? '—'}</TableCell>
                        <TableCell className="text-sm">{link.item?.assetAccount ?? '—'}</TableCell>
                        <TableCell>
                          {canEdit && (link.status === 'linked' || link.status === 'stale') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Unlink"
                              disabled={unlinkingId === link.productId}
                              onClick={() => handleUnlink(link.productId)}
                            >
                              {unlinkingId === link.productId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Unlink className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {view.unusedItems.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">QuickBooks items with no ERP product</p>
                <p className="text-xs text-muted-foreground">
                  {view.unusedItems.map((i) => `${i.name} (${TYPE_LABEL[i.type] ?? i.type})`).join(' · ')}
                </p>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
