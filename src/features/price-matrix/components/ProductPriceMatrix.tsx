'use client';

/**
 * ProductPriceMatrix Component
 *
 * Displays and manages price matrix entries for a specific product.
 * Intended to be embedded in the product detail view.
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PriceMatrixTable } from './PriceMatrixTable';
import { CreatePriceMatrixDrawer } from './CreatePriceMatrixDrawer';
import type { PriceMatrixTableRow } from '../types';
import { getPriceMatrixByProduct } from '../actions';

interface ProductPriceMatrixProps {
  productId: string;
  productName?: string;
}

export function ProductPriceMatrix({ productId, productName: _productName }: ProductPriceMatrixProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<PriceMatrixTableRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getPriceMatrixByProduct(productId);
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load pricing');
      }
    } catch {
      setError('Failed to load pricing');
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = () => {
    fetchData();
  };

  const handleRefresh = () => {
    fetchData();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Channel Pricing
        </CardTitle>
        <Button
          size="sm"
          onClick={() => setCreateDrawerOpen(true)}
          disabled={isLoading}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Tier
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="mt-3">
              Try Again
            </Button>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No pricing tiers configured for this product.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add pricing tiers for OEM and Dealer channels.
            </p>
          </div>
        ) : (
          <PriceMatrixTable
            data={data}
            isLoading={isLoading}
            showProduct={false}
            onRefresh={handleRefresh}
          />
        )}
      </CardContent>

      {/* Create Drawer */}
      <CreatePriceMatrixDrawer
        open={createDrawerOpen}
        productId={productId}
        onClose={() => setCreateDrawerOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </Card>
  );
}
