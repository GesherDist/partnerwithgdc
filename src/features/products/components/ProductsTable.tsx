'use client';

/**
 * Products Table
 *
 * Server-paginated products table with view / edit / delete actions.
 * Searching, filtering and paging are all done by the API, so the table only
 * ever holds the current page.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { PaginationState } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { DataTable } from '@/shared/components/data-table/DataTable';
import { useAuthStore } from '@/shared/stores';

import { useProducts, useProductCategories } from '../hooks/use-products';
import { deleteProduct } from '../actions';
import { getProductsTableColumns } from './ProductsTableColumns';
import { ProductFormDialog } from './ProductFormDialog';
import { ViewProductDrawer } from './ViewProductDrawer';
import { PRODUCT_STATUS_OPTIONS, type ProductStatus, type ProductTableRow } from '../types';

// ============================================
// CONSTANTS
// ============================================

const ALL_STATUSES = 'all';
const ALL_CATEGORIES = 'all';
const SEARCH_DEBOUNCE_MS = 300;

// ============================================
// PROPS
// ============================================

interface ProductsTableProps {
  /** Initial page of products from the server, for React Query hydration */
  initialData?: unknown;
  /** Initial category list from the server */
  initialCategories?: string[];
}

// ============================================
// COMPONENT
// ============================================

function ProductsTableComponent({ initialData, initialCategories }: ProductsTableProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);

  // ----------------------------------------
  // HYDRATION GUARD
  // ----------------------------------------

  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // ----------------------------------------
  // PERMISSIONS (only check after hydration)
  // ----------------------------------------

  const canViewDetail = hasMounted && hasPermission('products.view_detail');
  const canCreate = hasMounted && hasPermission('products.create');
  const canEdit = hasMounted && hasPermission('products.edit');
  const canDelete = hasMounted && hasPermission('products.delete');

  // ----------------------------------------
  // QUERY STATE
  // ----------------------------------------

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  // Debounce the search box so typing does not fire a request per keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const hasFilters = search !== '' || status !== ALL_STATUSES || category !== ALL_CATEGORIES;

  // Only hydrate from server data when showing the unfiltered first page
  const isInitialQuery = page === 1 && limit === 10 && !hasFilters;

  const { products, meta, loading, refetch } = useProducts(
    {
      page,
      limit,
      search: search || undefined,
      status: status === ALL_STATUSES ? undefined : (status as ProductStatus),
      category: category === ALL_CATEGORIES ? undefined : category,
    },
    isInitialQuery ? initialData : undefined
  );

  const { categories } = useProductCategories(initialCategories);

  // ----------------------------------------
  // DIALOG STATE
  // ----------------------------------------

  const [viewProduct, setViewProduct] = useState<ProductTableRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleView = useCallback((product: ProductTableRow) => {
    setViewProduct(product);
  }, []);

  const handleEdit = useCallback((product: ProductTableRow) => {
    setEditingProductId(product.id);
    setFormOpen(true);
  }, []);

  // From the drawer footer: close it and hand over to the form / delete dialog
  const handleEditFromDrawer = useCallback((id: string) => {
    setViewProduct(null);
    setEditingProductId(id);
    setFormOpen(true);
  }, []);

  const handleDeleteFromDrawer = useCallback(() => {
    if (!viewProduct) {
      return;
    }
    setDeleteTarget(viewProduct);
    setViewProduct(null);
  }, [viewProduct]);

  const handleCreate = useCallback(() => {
    setEditingProductId(null);
    setFormOpen(true);
  }, []);

  const handleFormSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteProduct(deleteTarget.id);

      if (result.success) {
        toast.success(`${deleteTarget.name} deleted`);
        setDeleteTarget(null);
        await refetch();
      } else {
        toast.error(result.error || 'Failed to delete product');
      }
    } catch {
      toast.error('An error occurred while deleting the product');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, refetch]);

  // The table reports 0-based pages; the API is 1-based
  const handlePaginationChange = useCallback((pagination: PaginationState) => {
    setPage(pagination.pageIndex + 1);
    setLimit(pagination.pageSize);
  }, []);

  const columns = useMemo(
    () =>
      getProductsTableColumns({
        onView: canViewDetail ? handleView : undefined,
        onEdit: canEdit ? handleEdit : undefined,
        onDelete: canDelete ? setDeleteTarget : undefined,
      }),
    [handleView, handleEdit, canViewDetail, canEdit, canDelete]
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <>
      <DataTable
        // DataTable owns its pagination state, so changing a filter has to
        // remount it - otherwise it would keep showing "page 3" for page 1 data.
        key={`${search}|${status}|${category}`}
        columns={columns}
        data={products}
        loading={loading}
        getRowId={(row) => row.id}
        enableRowSelection
        onRowClick={canViewDetail ? handleView : undefined}
        // Searching and filtering are done by the API, so the built-in
        // client-side filter would only ever search the current page.
        enableGlobalFilter={false}
        manualPagination
        rowCount={meta?.total ?? 0}
        defaultPageSize={limit}
        onPaginationChange={handlePaginationChange}
        emptyState={
          hasFilters
            ? 'No products match these filters.'
            : 'No products yet. Add the first one.'
        }
        toolbarContent={
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              placeholder="Search SKU, name or category…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 w-[240px]"
            />

            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
                {PRODUCT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                {categories.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canCreate && (
              <div className="ml-auto">
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Product
                </Button>
              </div>
            )}
          </div>
        }
      />

      <ViewProductDrawer
        productId={viewProduct?.id ?? null}
        open={Boolean(viewProduct)}
        onClose={() => setViewProduct(null)}
        onEdit={canEdit ? handleEditFromDrawer : undefined}
        onDelete={canDelete ? handleDeleteFromDrawer : undefined}
      />

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        productId={editingProductId}
        onSuccess={handleFormSuccess}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deleteTarget?.name}</span> ({deleteTarget?.sku})
              will be hidden from the catalog. It is only soft-deleted, so an administrator
              can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog up until the request settles
                event.preventDefault();
                handleConfirmDelete();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Export memoized component
export const ProductsTable = memo(ProductsTableComponent);
