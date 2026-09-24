'use client';

/**
 * Product Form Dialog
 *
 * Modal for creating and editing products. Both modes share the same
 * ProductForm; the only difference is whether an existing product is loaded
 * first and which server action the submit calls.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

import { ProductForm } from './ProductForm';
import { getProduct, createProductFromData, updateProductFromData } from '../actions';
import { formToCreateDTO, type ProductFormInput } from '../lib/schemas';
import type { ProductWithFormattedPrices } from '../types';

// ============================================
// PROPS
// ============================================

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing, null/undefined when creating */
  productId?: string | null;
  /** Called after a successful create or update */
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

function ProductFormDialogComponent({
  open,
  onOpenChange,
  productId,
  onSuccess,
}: ProductFormDialogProps) {
  const isEditing = Boolean(productId);

  const [product, setProduct] = useState<ProductWithFormattedPrices | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Table rows only carry a summary, so the full product is loaded on open
  useEffect(() => {
    if (!open || !productId) {
      setProduct(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    getProduct(productId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.success && result.data) {
          setProduct(result.data);
        } else {
          toast.error(result.error || 'Failed to load product');
          onOpenChange(false);
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
  }, [open, productId, onOpenChange]);

  const handleSubmit = useCallback(
    async (data: ProductFormInput) => {
      setIsSaving(true);
      try {
        const dto = formToCreateDTO(data);
        const result = productId
          ? await updateProductFromData(productId, dto)
          : await createProductFromData(dto);

        if (result.success && result.data) {
          toast.success(productId ? 'Product updated' : 'Product created');
          onOpenChange(false);
          onSuccess?.();
        } else if (result.errors) {
          const messages = Object.values(result.errors).flat();
          toast.error(messages[0] || 'Validation failed');
        } else {
          toast.error(result.error || 'Failed to save product');
        }
      } catch {
        toast.error('An error occurred while saving the product');
      } finally {
        setIsSaving(false);
      }
    },
    [productId, onOpenChange, onSuccess]
  );

  const handleCancel = useCallback(() => {
    if (!isSaving) {
      onOpenChange(false);
    }
  }, [isSaving, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Product' : 'New Product'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the product information. Fields marked with * are required.'
              : 'Enter the details for the new product. Fields marked with * are required.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          // Remount when switching between products so the form picks up the
          // new defaults instead of keeping the previous product's values.
          <ProductForm
            key={productId ?? 'new'}
            initialData={product ?? undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSaving}
            submitLabel={isEditing ? 'Update Product' : 'Create Product'}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export const ProductFormDialog = memo(ProductFormDialogComponent);
