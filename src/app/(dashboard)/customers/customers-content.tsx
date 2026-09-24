'use client';

/**
 * Customers Page Content
 *
 * Client component for managing customers.
 * Uses server actions to fetch real data.
 *
 * State Management:
 * - Page component owns drawer state
 * - Customers are fetched via useCustomers hook
 * - Data flows down via props
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, RefreshCw, Download } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAuthStore } from '@/shared/stores';

import {
  CustomersTable,
  CreateCustomerDrawer,
  EditCustomerDrawer,
  useCustomers,
} from '@/features/customers';
import type { CustomerTableRow, CustomerStatus } from '@/features/customers/types';
import { CUSTOMER_STATUS_LABELS } from '@/features/customers/types';
import { SyncFromPipedriveDialog } from '@/features/pipedrive/components';

// ============================================
// COMPONENT
// ============================================

export function CustomersPageContent() {
  const router = useRouter();
  const { hasPermission } = useAuthStore();

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

  const canCreate = hasMounted && hasPermission('customers.create');
  const canViewDetail = hasMounted && hasPermission('customers.view_detail');
  const canEdit = hasMounted && hasPermission('customers.edit');
  const canDelete = hasMounted && hasPermission('customers.delete');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'all'>('all');
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ----------------------------------------
  // DATA HOOKS
  // ----------------------------------------

  // Memoize params to prevent unnecessary re-renders
  const customersParams = useMemo(() => ({
    ...(statusFilter !== 'all' && { status: statusFilter }),
    page,
    limit: pageSize,
  }), [statusFilter, page, pageSize]);

  // Customers list with status filter
  const {
    data: customers,
    meta,
    isLoading: isCustomersLoading,
    refetch: refetchCustomers,
  } = useCustomers(customersParams);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleCreateClick = () => {
    setIsCreateDrawerOpen(true);
  };

  const handleCreateDrawerClose = useCallback(() => {
    setIsCreateDrawerOpen(false);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    refetchCustomers();
  }, [refetchCustomers]);

  const handleRowClick = (customer: CustomerTableRow) => {
    router.push(`/customers/${customer.id}`);
  };

  const handleEdit = (customer: CustomerTableRow) => {
    setEditCustomerId(customer.id);
  };

  const handleEditDrawerClose = useCallback(() => {
    setEditCustomerId(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    refetchCustomers();
  }, [refetchCustomers]);

  const handleDelete = (_customer: CustomerTableRow) => {
    // Deletion is handled by the table component
    // Just refetch after deletion
    refetchCustomers();
  };

  const handleRefresh = () => {
    refetchCustomers();
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as CustomerStatus | 'all');
  };

  const handleSyncClick = () => {
    setIsSyncDialogOpen(true);
  };

  const handleSyncClose = () => {
    setIsSyncDialogOpen(false);
  };

  const handleSyncSuccess = () => {
    refetchCustomers();
  };

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <PageHeader
        title="Customers"
        description="Manage your customer database."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isCustomersLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isCustomersLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncClick}
            >
              <Download className="mr-2 h-4 w-4" />
              Sync from Pipedrive
            </Button>
            {canCreate && (
              <Button onClick={handleCreateClick}>
                <Plus className="mr-2 h-4 w-4" />
                Add Customer
              </Button>
            )}
          </div>
        }
      />

      {/* Customers Table */}
      <CustomersTable
        data={customers}
        isLoading={isCustomersLoading}
        onRowClick={canViewDetail ? handleRowClick : undefined}
        onEdit={canEdit ? handleEdit : undefined}
        onDelete={canDelete ? handleDelete : undefined}
        toolbarContent={
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        pagination={{
          page: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          totalPages: meta.totalPages,
          onPageChange: setPage,
          onPageSizeChange: (newSize) => {
            setPageSize(newSize);
            setPage(1);
          },
        }}
      />

      {/* Create Customer Drawer */}
      <CreateCustomerDrawer
        open={isCreateDrawerOpen}
        onClose={handleCreateDrawerClose}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Customer Drawer */}
      <EditCustomerDrawer
        customerId={editCustomerId}
        open={!!editCustomerId}
        onClose={handleEditDrawerClose}
        onSuccess={handleEditSuccess}
      />

      {/* Sync from Pipedrive Dialog */}
      <SyncFromPipedriveDialog
        open={isSyncDialogOpen}
        onClose={handleSyncClose}
        onSuccess={handleSyncSuccess}
        syncType="customers"
      />
    </div>
  );
}
