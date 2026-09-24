'use client';

/**
 * CustomerForm Component
 *
 * Main form component that composes all sections.
 * Uses FormProvider to share form context with child sections.
 *
 * Sections:
 * 1. Basic Info (name, legal name, channel)
 * 2. Addresses (billing & shipping)
 * 3. Contact Info (phone, email, website)
 * 4. Tax Settings
 * 5. Credit Settings
 * 6. Status & Notes
 */

import { useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';

import { CustomerBasicInfoSection } from './CustomerBasicInfoSection';
import { CustomerAddressSection } from './CustomerAddressSection';
import { CustomerContactSection } from './CustomerContactSection';
import { CustomerTaxSection } from './CustomerTaxSection';
import { CustomerCreditSection } from './CustomerCreditSection';
import { CustomerStatusSection } from './CustomerStatusSection';

import { customerFormSchema, type CustomerFormInput } from '../lib/schemas';

// ============================================
// TYPES
// ============================================

interface ServerErrors {
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

interface CustomerFormProps {
  initialData?: Partial<CustomerFormInput>;
  onSubmit?: (data: CustomerFormInput) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
  serverErrors?: ServerErrors | null;
}

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_FORM_VALUES: CustomerFormInput = {
  customerCode: '',
  name: '',
  legalName: '',
  channel: 'dealer',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: 'US',
  shippingAddress1: '',
  shippingAddress2: '',
  shippingCity: '',
  shippingState: '',
  shippingZip: '',
  shippingCountry: 'US',
  useSeparateShipping: false,
  phone: '',
  email: '',
  website: '',
  taxId: '',
  taxExempt: false,
  taxExemptNumber: '',
  taxExemptExpiryAt: '',
  creditStatus: 'pending',
  creditLimit: '0',
  openBalance: '0',
  creditTerms: 'Net 30',
  preferredLocationId: '',
  defaultPaymentMethod: '',
  status: 'active',
  internalNotes: '',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format field name for display in error messages
 */
function formatFieldName(field: string): string {
  const fieldLabels: Record<string, string> = {
    name: 'Company Name',
    legalName: 'Legal Name',
    channel: 'Channel',
    address1: 'Billing Address Line 1',
    address2: 'Billing Address Line 2',
    city: 'Billing City',
    state: 'Billing State',
    zip: 'Billing ZIP',
    country: 'Billing Country',
    shippingAddress1: 'Shipping Address Line 1',
    shippingAddress2: 'Shipping Address Line 2',
    shippingCity: 'Shipping City',
    shippingState: 'Shipping State',
    shippingZip: 'Shipping ZIP',
    shippingCountry: 'Shipping Country',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    taxId: 'Tax ID',
    taxExemptNumber: 'Tax Exempt Number',
    taxExemptExpiryAt: 'Tax Exempt Expiry',
    creditStatus: 'Credit Status',
    creditLimit: 'Credit Limit',
    creditTerms: 'Credit Terms',
    status: 'Status',
    internalNotes: 'Internal Notes',
  };

  return fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

// ============================================
// COMPONENT
// ============================================

export function CustomerForm({
  initialData,
  onSubmit,
  onCancel: _onCancel,
  isLoading: _isLoading = false,
  mode: _mode = 'create',
  serverErrors,
}: CustomerFormProps) {
  // ----------------------------------------
  // FORM SETUP
  // ----------------------------------------

  const methods = useForm<CustomerFormInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(customerFormSchema) as any,
    defaultValues: {
      ...DEFAULT_FORM_VALUES,
      ...initialData,
    },
    mode: 'onBlur',
  });

  const { handleSubmit, setError, formState: { errors } } = methods;

  // ----------------------------------------
  // EFFECTS
  // ----------------------------------------

  // Set server errors on form fields when they change
  useEffect(() => {
    if (serverErrors?.fieldErrors) {
      Object.entries(serverErrors.fieldErrors).forEach(([field, messages]) => {
        if (messages && messages.length > 0) {
          setError(field as keyof CustomerFormInput, {
            type: 'server',
            message: messages[0],
          });
        }
      });
    }
  }, [serverErrors, setError]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleFormSubmit = handleSubmit(async (data) => {
    await onSubmit?.(data);
  });

  // ----------------------------------------
  // COMPUTED VALUES
  // ----------------------------------------

  // Get all field errors for the error summary
  const fieldErrorList = Object.entries(errors)
    .filter(([, error]) => error?.message)
    .map(([field, error]) => ({
      field: formatFieldName(field),
      message: error?.message || '',
    }));

  // ----------------------------------------
  // RENDER
  // ----------------------------------------

  return (
    <FormProvider {...methods}>
      <form
        id="customer-form"
        onSubmit={handleFormSubmit}
        className="space-y-10"
      >
        {/* Server Error Alert */}
        {serverErrors?.message && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{serverErrors.message}</AlertDescription>
          </Alert>
        )}

        {/* Validation Errors Summary */}
        {fieldErrorList.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Please fix the following errors</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {fieldErrorList.map(({ field, message }) => (
                  <li key={field}>
                    <span className="font-medium">{field}:</span> {message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Section 1: Basic Information */}
        <CustomerBasicInfoSection />

        {/* Section 2: Addresses */}
        <CustomerAddressSection />

        {/* Section 3: Contact Information */}
        <CustomerContactSection />

        {/* Section 4: Tax Settings */}
        <CustomerTaxSection />

        {/* Section 5: Credit Settings */}
        <CustomerCreditSection />

        {/* Section 6: Status & Notes */}
        <CustomerStatusSection />
      </form>
    </FormProvider>
  );
}
