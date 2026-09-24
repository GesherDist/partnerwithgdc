'use client';

/**
 * SalesOrderInfoSection Component
 *
 * Section 1 of the Sales Order form.
 * Contains order information fields.
 *
 * Uses react-hook-form context for form state management.
 * All data is received via props - no internal data fetching.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 */

import { memo, useMemo, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Wand2 } from 'lucide-react';

import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';
import { getNextOrderNumber } from '../actions';

import type { SalesOrderInfoSectionProps } from '../types';
import { ORDER_STATUS_LABELS, type OrderStatus } from '../types';
import type { SalesOrderFormInput } from '../lib/schemas';
import { ORDER_SERIES } from '@/shared/lib/global-data';

// ============================================
// COMPONENT
// ============================================

function SalesOrderInfoSectionComponent({
  customers,
  salesReps,
  warehouses,
  currencies,
}: SalesOrderInfoSectionProps) {
  const { register, control, formState: { errors }, setValue } = useFormContext<SalesOrderFormInput>();
  const [isGenerating, setIsGenerating] = useState(false);

  // Auto-generate order number
  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await getNextOrderNumber();
      if (result.success && result.data) {
        setValue('orderNumber', result.data);
      }
    } catch (error) {
      console.error('Failed to generate order number:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Memoized order statuses
  const orderStatuses = useMemo<OrderStatus[]>(() => [
    'draft',
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ], []);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Sales Order Information
        </h3>
        <p className="text-sm text-muted-foreground">
          Basic order details and customer information.
        </p>
      </div>

      <Separator />

      {/* Form Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Sales Order Number */}
        <div className="space-y-2">
          <Label htmlFor="orderNumber">Sales Order Number</Label>
          <div className="flex gap-2">
            <Input
              id="orderNumber"
              placeholder="Enter or auto-generate"
              className={errors.orderNumber ? 'border-destructive' : ''}
              {...register('orderNumber')}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAutoGenerate}
              disabled={isGenerating}
              title="Auto-generate order number"
            >
              <Wand2 className={`h-4 w-4 ${isGenerating ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a custom number or click the wand to auto-generate
          </p>
          {errors.orderNumber && (
            <p className="text-sm text-destructive">{errors.orderNumber.message}</p>
          )}
        </div>

        {/* Order Date */}
        <div className="space-y-2">
          <Label htmlFor="orderDate">Order Date *</Label>
          <Input
            id="orderDate"
            type="date"
            className={errors.orderDate ? 'border-destructive' : ''}
            {...register('orderDate')}
          />
          {errors.orderDate && (
            <p className="text-sm text-destructive">{errors.orderDate.message}</p>
          )}
        </div>

        {/* Requested Delivery Date */}
        <div className="space-y-2">
          <Label htmlFor="requestedDeliveryDate">Requested Delivery Date *</Label>
          <Input
            id="requestedDeliveryDate"
            type="date"
            min={new Date().toISOString().split('T')[0]}
            className={errors.requestedDeliveryDate ? 'border-destructive' : ''}
            {...register('requestedDeliveryDate')}
          />
          {errors.requestedDeliveryDate && (
            <p className="text-sm text-destructive">{errors.requestedDeliveryDate.message}</p>
          )}
        </div>

        {/* Customer */}
        <div className="space-y-2">
          <Label htmlFor="customerId">Customer *</Label>
          <Controller
            name="customerId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="customerId" className={errors.customerId ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.customerId && (
            <p className="text-sm text-destructive">{errors.customerId.message}</p>
          )}
        </div>

        {/* Sales Representative */}
        <div className="space-y-2">
          <Label htmlFor="salesRepId">Sales Representative</Label>
          <Controller
            name="salesRepId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger id="salesRepId">
                  <SelectValue placeholder="Select sales rep" />
                </SelectTrigger>
                <SelectContent>
                  {salesReps.map((rep) => (
                    <SelectItem key={rep.id} value={rep.id}>
                      {rep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Warehouse */}
        <div className="space-y-2">
          <Label htmlFor="warehouseId">Warehouse</Label>
          <Controller
            name="warehouseId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger id="warehouseId">
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currencyId">Currency</Label>
          <Controller
            name="currencyId"
            control={control}
            render={({ field }) => (
              <Select value={field.value || 'USD'} onValueChange={field.onChange}>
                <SelectTrigger id="currencyId">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {/* Customer PO Number */}
        <div className="space-y-2">
          <Label htmlFor="customerPoNumber">Customer PO Number</Label>
          <Input
            id="customerPoNumber"
            placeholder="Enter PO number"
            {...register('customerPoNumber')}
          />
        </div>

        {/* Order Series */}
        <div className="space-y-2">
          <Label htmlFor="orderSeries">Order Series *</Label>
          <Controller
            name="orderSeries"
            control={control}
            render={({ field }) => (
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger id="orderSeries" className={errors.orderSeries ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select order series" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_SERIES.map((series) => (
                    <SelectItem key={series.id} value={series.code}>
                      {series.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.orderSeries && (
            <p className="text-sm text-destructive">{errors.orderSeries.message}</p>
          )}
        </div>

        {/* Order Status */}
        <div className="space-y-2">
          <Label htmlFor="status">Order Status</Label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value || 'draft'} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {orderStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {ORDER_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
    </div>
  );
}

// Export memoized component
export const SalesOrderInfoSection = memo(SalesOrderInfoSectionComponent);
