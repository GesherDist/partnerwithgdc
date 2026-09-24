'use client';

/**
 * QuoteForm Component
 *
 * Main form component that composes all sections.
 * Manages form state and coordinates section components.
 *
 * Performance Optimizations:
 * - Uses React.memo for child components
 * - Memoized callbacks with useCallback
 * - Memoized computed values with useMemo
 */

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { QuoteInfoSection } from './QuoteInfoSection';
import { QuoteAddressSection } from './QuoteAddressSection';
import { QuoteItemsTable } from './QuoteItemsTable';
import { QuoteSummaryCards } from './QuoteSummaryCards';
import { QuoteNotesSection } from './QuoteNotesSection';
import { CreditWarning } from '@/shared/components/ui/credit-warning';

import { quoteFormSchema, type QuoteFormInput } from '../lib/schemas';
import { getCustomerAddresses, getProductPrice } from '../actions';

// ============================================
// TYPES
// ============================================

// Re-export types for component props
interface Customer {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  itemType: 'inventory' | 'non_inventory' | 'service';
}

interface SalesRep {
  id: string;
  name: string;
  email: string;
}

interface QuoteFormProps {
  mode: 'create' | 'edit';
  initialData?: Partial<QuoteFormInput>;
  customers: Customer[];
  products: Product[];
  salesReps: SalesRep[];
  onSubmit: (data: QuoteFormInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  serverErrors?: Record<string, string[]>;
  onValidationChange?: (isValid: boolean) => void;
}

// ============================================
// DEFAULT VALUES
// ============================================

const createDefaultItem = () => ({
  productId: '',
  sku: '',
  description: '',
  quantity: 1,
  unitId: 'EA',
  unitPrice: 0,
  discountPercent: 0,
  taxRateId: '',
  lineTotal: 0,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getDefaultValues = (initialData?: Partial<QuoteFormInput>): any => {
  const today = new Date().toISOString().split('T')[0];
  const validUntilDate = new Date();
  validUntilDate.setDate(validUntilDate.getDate() + 30);
  const validUntil = validUntilDate.toISOString().split('T')[0];

  const defaultAddress = {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
  };

  return {
    quoteNumber: initialData?.quoteNumber || '',
    quoteDate: initialData?.quoteDate || today,
    validUntil: initialData?.validUntil || validUntil,
    customerId: initialData?.customerId || '',
    salesRepId: initialData?.salesRepId || '',
    currencyId: initialData?.currencyId || 'USD',
    status: initialData?.status || 'draft',
    billingAddress: {
      street: initialData?.billingAddress?.street || defaultAddress.street,
      city: initialData?.billingAddress?.city || defaultAddress.city,
      state: initialData?.billingAddress?.state || defaultAddress.state,
      postalCode: initialData?.billingAddress?.postalCode || defaultAddress.postalCode,
      country: initialData?.billingAddress?.country || defaultAddress.country,
    },
    shippingAddress: {
      street: initialData?.shippingAddress?.street || defaultAddress.street,
      city: initialData?.shippingAddress?.city || defaultAddress.city,
      state: initialData?.shippingAddress?.state || defaultAddress.state,
      postalCode: initialData?.shippingAddress?.postalCode || defaultAddress.postalCode,
      country: initialData?.shippingAddress?.country || defaultAddress.country,
    },
    items: initialData?.items?.map(item => ({
      id: item.id,
      productId: item.productId || '',
      sku: item.sku || '',
      description: item.description || '',
      quantity: item.quantity ?? 1,
      unitId: item.unitId || 'EA',
      unitPrice: item.unitPrice ?? 0,
      discountPercent: item.discountPercent ?? 0,
      taxRateId: item.taxRateId || '',
      lineTotal: item.lineTotal ?? 0,
    })) || [createDefaultItem()],
    customerNotes: initialData?.customerNotes || '',
    internalNotes: initialData?.internalNotes || '',
    termsAndConditions: initialData?.termsAndConditions || '',
    customerPoNumber: initialData?.customerPoNumber || '',
  };
};

// ============================================
// COMPONENT
// ============================================

function QuoteFormComponent({
  mode: _mode,
  initialData,
  customers,
  products,
  salesReps,
  onSubmit,
  onCancel: _onCancel,
  isSubmitting: _isSubmitting = false,
  serverErrors,
  onValidationChange,
}: QuoteFormProps) {
  // ----------------------------------------
  // FORM SETUP
  // ----------------------------------------

  const defaultValues = useMemo(() => getDefaultValues(initialData), [initialData]);

  const methods = useForm<QuoteFormInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(quoteFormSchema) as any,
    defaultValues,
    mode: 'onTouched', // Validates after field is touched, then continues with onChange
  });

  const { watch, setValue, handleSubmit, setError, clearErrors, formState: { errors, isValid } } = methods;

  // ----------------------------------------
  // VALIDATION STATE TRACKING
  // ----------------------------------------

  // Notify parent component when validation state changes
  useEffect(() => {
    if (onValidationChange) {
      onValidationChange(isValid);
    }
  }, [isValid, onValidationChange]);

  // ----------------------------------------
  // SET SERVER ERRORS
  // ----------------------------------------

  useEffect(() => {
    if (serverErrors) {
      Object.entries(serverErrors).forEach(([field, messages]) => {
        if (messages && messages.length > 0) {
          setError(field as keyof QuoteFormInput, {
            type: 'server',
            message: messages[0],
          });
        }
      });
    }
  }, [serverErrors, setError]);

  // Watch form values for auto-calculations
  const items = watch('items');

  // ----------------------------------------
  // STATE
  // ----------------------------------------

  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);

  // Watch customer for credit check
  const customerId = watch('customerId');

  // ----------------------------------------
  // AUTO-FILL: Customer Addresses
  // ----------------------------------------

  const handleCustomerChange = useCallback(async (customerId: string) => {
    if (!customerId) {
      const defaultAddress = {
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
      };
      setValue('billingAddress', defaultAddress);
      setValue('shippingAddress', defaultAddress);
      return;
    }

    setIsLoadingAddresses(true);
    try {
      const result = await getCustomerAddresses(customerId);

      if (result.success && result.data) {
        const { billing, shipping } = result.data;

        setValue('billingAddress', {
          street: billing.street || '',
          city: billing.city || '',
          state: billing.state || '',
          postalCode: billing.postalCode || '',
          country: billing.country || 'US',
        });

        setValue('shippingAddress', {
          street: shipping.street || '',
          city: shipping.city || '',
          state: shipping.state || '',
          postalCode: shipping.postalCode || '',
          country: shipping.country || 'US',
        });
      }
    } catch (error) {
      console.error('Failed to fetch customer addresses:', error);
    } finally {
      setIsLoadingAddresses(false);
    }
  }, [setValue]);

  // ----------------------------------------
  // AUTO-FILL: Product Price (uses price matrix based on customer channel)
  // ----------------------------------------

  const handleProductSelect = useCallback(async (
    itemIndex: number,
    productId: string
  ) => {
    if (!productId) { return; }

    try {
      const currentItems = methods.getValues('items');
      const currentItem = currentItems[itemIndex];
      const quantity = currentItem?.quantity ?? 1;

      // Pass customerId for price matrix lookup
      const result = await getProductPrice(productId, customerId || undefined, quantity);

      if (result.success && result.data) {
        const updatedItems = [...currentItems];
        const discountPercent = currentItem?.discountPercent ?? 0;
        const unitPrice = result.data.unitPrice / 100; // Convert cents to dollars

        const lineTotal = quantity * unitPrice * (1 - discountPercent / 100);

        updatedItems[itemIndex] = {
          id: currentItem?.id,
          productId,
          sku: result.data.sku,
          description: result.data.description || result.data.name || '', // Use description if available, fallback to name
          quantity,
          unitId: currentItem?.unitId ?? 'EA',
          unitPrice,
          discountPercent,
          taxRateId: currentItem?.taxRateId ?? '',
          lineTotal,
        };
        setValue('items', updatedItems, { shouldValidate: true });
      }
    } catch (error) {
      console.error('Failed to fetch product price:', error);
    }
  }, [methods, setValue, customerId]);

  // ----------------------------------------
  // COMPUTED VALUES
  // ----------------------------------------

  const quoteSummary = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;

    for (const item of items) {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountPercent = Number(item.discountPercent) || 0;

      const lineSubtotal = quantity * unitPrice;
      const lineDiscount = lineSubtotal * (discountPercent / 100);

      subtotal += lineSubtotal - lineDiscount;
      discountTotal += lineDiscount;
    }

    const taxTotal = 0; // TODO: Calculate tax when tax rates are implemented
    const grandTotal = subtotal;

    return {
      subtotal,
      discount: discountTotal,
      tax: taxTotal,
      grandTotal,
    };
  }, [items]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleItemsChange = useCallback((updatedItems: typeof items) => {
    // Detect if this is an add operation (new item added)
    const isAddOperation = updatedItems.length > items.length;

    // Recalculate line totals
    const itemsWithTotals = updatedItems.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountPercent = Number(item.discountPercent) || 0;
      const lineTotal = quantity * unitPrice * (1 - discountPercent / 100);
      return { ...item, lineTotal };
    });

    if (isAddOperation) {
      // For add operation, don't validate immediately
      setValue('items', itemsWithTotals, { shouldValidate: false });

      // Clear errors for the newly added item (last item in array)
      const newItemIndex = itemsWithTotals.length - 1;
      clearErrors(`items.${newItemIndex}.productId`);
      clearErrors(`items.${newItemIndex}.unitPrice`);
      clearErrors(`items.${newItemIndex}.quantity`);
    } else {
      // For edit/delete operations, validate normally
      setValue('items', itemsWithTotals, { shouldValidate: true });
    }
  }, [setValue, clearErrors, items.length]);

  const handleCustomerChangeWithPriceUpdate = useCallback(async (newCustomerId: string) => {
    await handleCustomerChange(newCustomerId);

    // Re-fetch prices for existing items based on new customer's channel
    const currentItems = methods.getValues('items');
    if (currentItems && currentItems.length > 0 && newCustomerId) {
      const updatedItems = await Promise.all(
        currentItems.map(async (item) => {
          if (!item.productId) { return item; }

          try {
            const result = await getProductPrice(item.productId, newCustomerId, item.quantity || 1);
            if (result.success && result.data) {
              const unitPrice = result.data.unitPrice / 100;
              const discountPercent = item.discountPercent ?? 0;
              const quantity = item.quantity ?? 1;
              const lineTotal = quantity * unitPrice * (1 - discountPercent / 100);

              return {
                ...item,
                unitPrice,
                lineTotal,
              };
            }
          } catch (error) {
            console.error('Failed to update price for product:', item.productId, error);
          }
          return item;
        })
      );
      // Don't validate here - only validate on submit
      setValue('items', updatedItems);
    }
  }, [handleCustomerChange, methods, setValue]);

  // ----------------------------------------
  // CREDIT CHECK (read-only display in Quote form)
  // Credit is only enforced at Quote → Sales Order conversion
  // ----------------------------------------

  const handleFormSubmit = useCallback(
    handleSubmit(async (data: QuoteFormInput) => {
      try {
        await onSubmit(data);
      } catch {
        toast.error('Failed to save quote');
      }
    }),
    [handleSubmit, onSubmit]
  );

  // ----------------------------------------
  // ITEM ERRORS
  // ----------------------------------------

  const itemErrors = useMemo(() => {
    const itemsErrors = errors.items;
    if (!itemsErrors || !Array.isArray(itemsErrors)) {return [];}

    return itemsErrors.map((itemError) => {
      if (!itemError || typeof itemError !== 'object') {return {};}

      const result: Record<string, string> = {};

      if ('productId' in itemError && itemError.productId?.message) {
        result.productId = itemError.productId.message as string;
      }
      if ('sku' in itemError && itemError.sku?.message) {
        result.sku = itemError.sku.message as string;
      }
      if ('quantity' in itemError && itemError.quantity?.message) {
        result.quantity = itemError.quantity.message as string;
      }
      if ('unitPrice' in itemError && itemError.unitPrice?.message) {
        result.unitPrice = itemError.unitPrice.message as string;
      }

      return result;
    });
  }, [errors.items]);

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <FormProvider {...methods}>
      <form
        id="quote-form"
        onSubmit={handleFormSubmit}
        className="space-y-10"
      >
        {/* Section 1: Quote Information */}
        <QuoteInfoSection
          customers={customers}
          salesReps={salesReps}
          onCustomerChange={handleCustomerChangeWithPriceUpdate}
        />

        {/* Section 2: Billing & Shipping */}
        <QuoteAddressSection
          isLoadingAddresses={isLoadingAddresses}
        />

        {/* Section 3: Line Items */}
        <QuoteItemsTable
          products={products}
          items={items}
          onItemsChange={handleItemsChange}
          onProductSelect={handleProductSelect}
          itemErrors={itemErrors}
          itemsError={errors.items?.message || errors.items?.root?.message}
        />

        {/* Section 4: Quote Summary with Credit Check */}
        <QuoteSummaryCards
          subtotal={quoteSummary.subtotal}
          discount={quoteSummary.discount}
          tax={quoteSummary.tax}
          grandTotal={quoteSummary.grandTotal}
          currencySymbol="$"
          creditSlot={
            customerId ? (
              <CreditWarning
                customerId={customerId}
                orderTotal={quoteSummary.grandTotal}
                readOnly={true}
              />
            ) : undefined
          }
        />

        {/* Section 5: Notes */}
        <QuoteNotesSection />
      </form>
    </FormProvider>
  );
}

// Export memoized component
export const QuoteForm = memo(QuoteFormComponent);

// Re-export types for backward compatibility
export type { QuoteFormInput } from '../lib/schemas';
