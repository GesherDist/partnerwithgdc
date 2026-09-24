'use client';

/**
 * CustomerContactForm Component
 *
 * Form for creating and editing customer contacts.
 * Per client doc: contacts have role (purchasing, AP, receiving)
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Phone } from 'lucide-react';

import { Form } from '@/shared/components/ui/form';
import { FormInput } from '@/shared/components/forms/form-input';
import { FormSelect } from '@/shared/components/forms/form-select';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';

import {
  CONTACT_TYPES,
  CONTACT_TYPE_LABELS,
  type CustomerContact,
} from '../types';

// ============================================
// SCHEMA
// ============================================

const customerContactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  contactType: z.enum(['purchasing', 'accounts_payable', 'receiving']),
  email: z.union([
    z.string().email('Invalid email'),
    z.literal(''),
  ]),
  phone: z.string().max(20),
  mobile: z.string().max(20),
});

// Schema-inferred type for form (exported for use in CustomerContactsList)
export type ContactFormInput = z.infer<typeof customerContactFormSchema>;

// Default form values
const DEFAULT_FORM_VALUES: ContactFormInput = {
  firstName: '',
  lastName: '',
  contactType: 'purchasing',
  email: '',
  phone: '',
  mobile: '',
};

// ============================================
// CONSTANTS
// ============================================

const CONTACT_TYPE_OPTIONS = CONTACT_TYPES.map((type) => ({
  value: type,
  label: CONTACT_TYPE_LABELS[type],
}));

// ============================================
// TYPES
// ============================================

interface CustomerContactFormProps {
  initialData?: Partial<ContactFormInput>;
  onSubmit: (data: ContactFormInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode?: 'create' | 'edit';
}

// ============================================
// COMPONENT
// ============================================

export function CustomerContactForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  mode = 'create',
}: CustomerContactFormProps) {
  const form = useForm<ContactFormInput>({
    resolver: zodResolver(customerContactFormSchema),
    defaultValues: {
      ...DEFAULT_FORM_VALUES,
      ...initialData,
    },
  });

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-muted-foreground" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                control={form.control}
                name="firstName"
                label="First Name"
                placeholder="John"
                required
                disabled={isLoading}
              />
              <FormInput
                control={form.control}
                name="lastName"
                label="Last Name"
                placeholder="Doe"
                required
                disabled={isLoading}
              />
            </div>
            <FormSelect
              control={form.control}
              name="contactType"
              label="Role"
              options={CONTACT_TYPE_OPTIONS}
              required
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Contact Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormInput
              control={form.control}
              name="email"
              label="Email"
              type="email"
              placeholder="john@company.com"
              disabled={isLoading}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput
                control={form.control}
                name="phone"
                label="Phone"
                type="tel"
                placeholder="(555) 123-4567"
                disabled={isLoading}
              />
              <FormInput
                control={form.control}
                name="mobile"
                label="Mobile"
                type="tel"
                placeholder="(555) 987-6543"
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Separator />
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : mode === 'create' ? 'Add Contact' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ============================================
// UTILITY: Convert Contact to Form Values
// ============================================

export function contactToFormValues(contact: CustomerContact): ContactFormInput {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    contactType: contact.contactType,
    email: contact.email || '',
    phone: contact.phone || '',
    mobile: contact.mobile || '',
  };
}
