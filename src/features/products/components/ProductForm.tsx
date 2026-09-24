'use client';

/**
 * Product Form Component
 *
 * Form for creating and editing products.
 */

// import { useEffect, useState } from 'react'; // COMMENTED OUT - QBO disabled
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
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
import { productFormSchema, type ProductFormInput, productToFormValues } from '../lib/schemas';
import { DEFAULT_PRODUCT_FORM_VALUES, PRODUCT_STATUS_OPTIONS, PRODUCT_ITEM_TYPE_OPTIONS } from '../types';
// import { getQboAccountsForProduct } from '../actions'; // COMMENTED OUT - QBO disabled
// import type { AccountOption } from '@/modules/integrations/quickbooks'; // COMMENTED OUT - QBO disabled

interface ProductFormProps {
  initialData?: {
    sku: string;
    name: string;
    description: string | null;
    shortDescription: string | null;
    category: string | null;
    rimSize: string | null;
    tireSize: string | null;
    weightLbs: number | null;
    baseCost: number;
    basePrice: number;
    status: 'active' | 'inactive' | 'discontinued';
    itemType: 'inventory' | 'non_inventory' | 'service';
    isSellable: boolean;
    imageUrl: string | null;
    // QuickBooks Account Fields
    qboIncomeAccount: string | null;
    qboExpenseAccount: string | null;
    qboInventoryAssetAccount: string | null;
    // Description Fields
    salesDescription: string | null;
    purchaseDescription: string | null;
    // Other Fields
    barcode: string | null;
    isTaxable: boolean;
  };
  onSubmit: (data: ProductFormInput) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = 'Save Product',
}: ProductFormProps) {
  // QBO accounts state - COMMENTED OUT FOR NOW
  // const [incomeAccounts, setIncomeAccounts] = useState<AccountOption[]>([]);
  // const [expenseAccounts, setExpenseAccounts] = useState<AccountOption[]>([]);
  // const [assetAccounts, setAssetAccounts] = useState<AccountOption[]>([]);
  // const [accountsLoading, setAccountsLoading] = useState(true);

  // Fetch QBO accounts on mount - COMMENTED OUT FOR NOW
  // useEffect(() => {
  //   async function fetchAccounts() {
  //     try {
  //       const result = await getQboAccountsForProduct();
  //       if (result.success && result.data) {
  //         setIncomeAccounts(result.data.income || []);
  //         setExpenseAccounts(result.data.expense || []);
  //         setAssetAccounts(result.data.asset || []);
  //       }
  //     } catch (error) {
  //       console.error('Failed to fetch QBO accounts:', error);
  //     } finally {
  //       setAccountsLoading(false);
  //     }
  //   }
  //   fetchAccounts();
  // }, []);

  const form = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData
      ? productToFormValues(initialData)
      : DEFAULT_PRODUCT_FORM_VALUES,
  });

  const handleSubmit = async (data: ProductFormInput) => {
    await onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="TIRE-38-IPT"
                      className="uppercase"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    Unique product identifier (letters, numbers, hyphens)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="38&quot; Irrigation Pivot Tire" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="shortDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Short Description</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Brief product summary" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Detailed product description..."
                    rows={4}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

        {/* Specifications Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Specifications</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Tires" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rimSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rim Size</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='38"' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tireSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tire Size</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="14.9-38" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="weightLbs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (lbs)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" step="0.01" placeholder="125.00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input {...field} type="url" placeholder="https://..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Pricing Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Pricing</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="baseCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Cost *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-7"
                        placeholder="350.00"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Your cost per unit</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="basePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Price *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-7"
                        placeholder="450.00"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Default selling price</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Status Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Status</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="itemType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PRODUCT_ITEM_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    QuickBooks item type for syncing
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="isSellable"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Sellable</FormLabel>
                  <FormDescription>
                    Allow this product to be added to orders
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Taxable - COMMENTED OUT FOR NOW
          <FormField
            control={form.control}
            name="isTaxable"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Taxable</FormLabel>
                  <FormDescription>
                    Product is subject to sales tax
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
          */}
        </div>

        {/* QuickBooks Accounts Section - COMMENTED OUT FOR NOW
        <div className="space-y-4">
          <h3 className="text-lg font-medium">QuickBooks Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Map this product to QuickBooks accounts for proper financial tracking
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FormField
              control={form.control}
              name="qboIncomeAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Income Account</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={accountsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={accountsLoading ? "Loading..." : "Select income account"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="">None</SelectItem>
                      {incomeAccounts.map((account, index) => (
                        <SelectItem key={`income-${account.value}-${index}`} value={account.value}>
                          {account.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Revenue account for sales
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qboExpenseAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Account</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={accountsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={accountsLoading ? "Loading..." : "Select expense account"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="">None</SelectItem>
                      {expenseAccounts.map((account, index) => (
                        <SelectItem key={`expense-${account.value}-${index}`} value={account.value}>
                          {account.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    COGS account for purchases
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="qboInventoryAssetAccount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory Asset Account</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={accountsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={accountsLoading ? "Loading..." : "Select asset account"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      <SelectItem value="">None</SelectItem>
                      {assetAccounts.map((account, index) => (
                        <SelectItem key={`asset-${account.value}-${index}`} value={account.value}>
                          {account.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    For inventory items only
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        */}

        {/* Descriptions Section - COMMENTED OUT FOR NOW
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Descriptions</h3>
          <p className="text-sm text-muted-foreground">
            Descriptions for sales and purchase documents
          </p>

          <FormField
            control={form.control}
            name="salesDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sales Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Description shown on invoices, quotes, and sales receipts..."
                    rows={3}
                  />
                </FormControl>
                <FormDescription>
                  Appears on customer-facing documents
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="purchaseDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Description</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Description shown on purchase orders..."
                    rows={3}
                  />
                </FormControl>
                <FormDescription>
                  Appears on supplier-facing documents
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        */}

        {/* Additional Fields Section - COMMENTED OUT FOR NOW
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Additional Information</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Barcode</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="UPC, EAN, or custom barcode" />
                  </FormControl>
                  <FormDescription>
                    Product barcode for scanning
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        */}

        {/* Form Actions */}
        <div className="flex justify-end gap-3 border-t pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
