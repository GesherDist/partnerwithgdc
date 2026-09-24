'use client';

/**
 * Operations Dashboard Filters Component
 *
 * Filter toolbar for the operations dashboard with dropdowns for:
 * - Customer
 * - Product
 * - Status
 * - Sales Order
 * - Customer PO Number
 */

import { X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import type { OperationsFilters, FilterOptions, ShipmentStatus } from '../types';

// ============================================
// TYPES
// ============================================

interface OperationsFiltersProps {
  filters: OperationsFilters;
  onFiltersChange: (filters: OperationsFilters) => void;
  filterOptions: FilterOptions;
  isLoading?: boolean;
}

// Status options for the dropdown
const STATUS_OPTIONS: { value: ShipmentStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'OPEN', label: 'Open' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'IN_TRANSIT', label: 'In Transit' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'INVOICED', label: 'Invoiced' },
  { value: 'NOT_INVOICED', label: 'Not Invoiced' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'DISPUTED', label: 'Disputed' },
  { value: 'PO_NEEDED', label: 'PO Needed' },
  { value: 'DELIVERED', label: 'Delivered' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function OperationsFilters({
  filters,
  onFiltersChange,
  filterOptions,
  isLoading = false,
}: OperationsFiltersProps) {
  const handleFilterChange = (key: keyof OperationsFilters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '');

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      {/* Customer Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Customer</label>
        <Select
          value={filters.customerId || ''}
          onValueChange={(value) => handleFilterChange('customerId', value || undefined)}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Customers</SelectItem>
            {filterOptions.customers.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Product Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Product</label>
        <Select
          value={filters.productId || ''}
          onValueChange={(value) => handleFilterChange('productId', value || undefined)}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Products</SelectItem>
            {filterOptions.products.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select
          value={filters.status || ''}
          onValueChange={(value) => handleFilterChange('status', value || undefined)}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Sales Order Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Sales Order</label>
        <Select
          value={filters.salesOrderId || ''}
          onValueChange={(value) => handleFilterChange('salesOrderId', value || undefined)}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Orders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Orders</SelectItem>
            {filterOptions.salesOrders.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Customer PO Number Filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Customer PO</label>
        <Select
          value={filters.customerPoNumber || ''}
          onValueChange={(value) => handleFilterChange('customerPoNumber', value || undefined)}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All POs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All POs</SelectItem>
            {filterOptions.customerPoNumbers.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-transparent">Clear</label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-9 px-3"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
