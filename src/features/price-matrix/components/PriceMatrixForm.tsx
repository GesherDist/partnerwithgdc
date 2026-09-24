'use client';

/**
 * Price Matrix Form Component
 *
 * Form for creating and editing price matrix entries.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/shared/components/ui/input';
import { Switch } from '@/shared/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { priceMatrixFormSchema } from '../lib/schemas';
import type { PriceMatrixFormValues, PriceMatrixFormProps } from '../types';
import { DEFAULT_PRICE_MATRIX_FORM_VALUES } from '../types';
import { CUSTOMER_CHANNEL_LABELS } from '@/features/customers/types';

export function PriceMatrixForm({
  productId,
  initialData,
  onSubmit,
  isLoading: _isLoading = false,
  mode = 'create',
}: PriceMatrixFormProps) {
  const form = useForm<PriceMatrixFormValues>({
    resolver: zodResolver(priceMatrixFormSchema),
    defaultValues: {
      ...DEFAULT_PRICE_MATRIX_FORM_VALUES,
      ...initialData,
      productId: productId || initialData?.productId || '',
    },
  });

  const handleSubmit = async (data: PriceMatrixFormValues) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form
        id="price-matrix-form"
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5"
      >
        {/* Channel & Quantity Section */}
        <div className="space-y-3">
          <h3 className="text-base font-medium">Channel & Quantity</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Channel */}
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={mode === 'edit'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="oem">{CUSTOMER_CHANNEL_LABELS.oem}</SelectItem>
                      <SelectItem value="dealer">{CUSTOMER_CHANNEL_LABELS.dealer}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Min Quantity */}
            <FormField
              control={form.control}
              name="minQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      placeholder="1"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Max Quantity */}
            <FormField
              control={form.control}
              name="maxQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Quantity</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                    />
                  </FormControl>
                  <FormDescription>Leave empty for unlimited</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Pricing Section */}
        <div className="space-y-3">
          <h3 className="text-base font-medium">Pricing</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Cost */}
            <FormField
              control={form.control}
              name="cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Your cost per unit</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price */}
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Selling price per unit</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Effective Dates Section */}
        <div className="space-y-3">
          <h3 className="text-base font-medium">Effective Period</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Effective From */}
            <FormField
              control={form.control}
              name="effectiveFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective From *</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Effective To */}
            <FormField
              control={form.control}
              name="effectiveTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Effective To</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" />
                  </FormControl>
                  <FormDescription>Leave empty for no expiration</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Status Section */}
        <div className="space-y-3">
          <h3 className="text-base font-medium">Status</h3>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active</FormLabel>
                  <FormDescription>
                    Enable this price tier for use in quotes and orders
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value === 'active'}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? 'active' : 'inactive')
                    }
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Hidden product ID field */}
        <input type="hidden" {...form.register('productId')} />
      </form>
    </Form>
  );
}
