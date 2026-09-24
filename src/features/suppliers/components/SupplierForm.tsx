'use client';

/**
 * Supplier Form
 *
 * Form for creating and editing suppliers.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, MapPin, Settings, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { toast } from 'sonner';
import { createSupplierAction, updateSupplierAction } from '../actions';
import type { Supplier, CreateSupplierInput, SupplierStatus } from '../types';

interface SupplierFormProps {
  supplier?: Supplier;
  mode: 'create' | 'edit';
}

export function SupplierForm({ supplier, mode }: SupplierFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<CreateSupplierInput>({
    name: supplier?.name || '',
    legalName: supplier?.legalName || '',
    primaryContactName: supplier?.primaryContactName || '',
    primaryContactEmail: supplier?.primaryContactEmail || '',
    primaryContactPhone: supplier?.primaryContactPhone || '',
    addressStreet: supplier?.addressStreet || '',
    addressCity: supplier?.addressCity || '',
    addressState: supplier?.addressState || '',
    addressPostalCode: supplier?.addressPostalCode || '',
    addressCountry: supplier?.addressCountry || 'US',
    paymentTerms: supplier?.paymentTerms || '',
    currencyCode: supplier?.currencyCode || 'USD',
    taxId: supplier?.taxId || '',
    status: supplier?.status || 'active',
    notes: supplier?.notes || '',
  });

  const handleChange = (field: keyof CreateSupplierInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createSupplierAction(formData)
          : await updateSupplierAction({ id: supplier!.id, ...formData });

      if (result.error) {
        toast.error('Error', {
          description: result.error,
        });
      } else {
        toast.success(mode === 'create' ? 'Supplier Created' : 'Supplier Updated', {
          description: `${formData.name} has been ${mode === 'create' ? 'created' : 'updated'}.`,
        });
        router.push('/suppliers');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Company Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Galileo Manufacturing"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input
                id="legalName"
                value={formData.legalName || ''}
                onChange={(e) => handleChange('legalName', e.target.value)}
                placeholder="Legal/registered name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value as SupplierStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID</Label>
              <Input
                id="taxId"
                value={formData.taxId || ''}
                onChange={(e) => handleChange('taxId', e.target.value)}
                placeholder="Tax identification number"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Primary Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="primaryContactName">Name</Label>
              <Input
                id="primaryContactName"
                value={formData.primaryContactName || ''}
                onChange={(e) => handleChange('primaryContactName', e.target.value)}
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryContactEmail">Email</Label>
              <Input
                id="primaryContactEmail"
                type="email"
                value={formData.primaryContactEmail || ''}
                onChange={(e) => handleChange('primaryContactEmail', e.target.value)}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primaryContactPhone">Phone</Label>
              <Input
                id="primaryContactPhone"
                value={formData.primaryContactPhone || ''}
                onChange={(e) => handleChange('primaryContactPhone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Address
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressStreet">Street Address</Label>
            <Input
              id="addressStreet"
              value={formData.addressStreet || ''}
              onChange={(e) => handleChange('addressStreet', e.target.value)}
              placeholder="123 Main Street"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="addressCity">City</Label>
              <Input
                id="addressCity"
                value={formData.addressCity || ''}
                onChange={(e) => handleChange('addressCity', e.target.value)}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressState">State/Province</Label>
              <Input
                id="addressState"
                value={formData.addressState || ''}
                onChange={(e) => handleChange('addressState', e.target.value)}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressPostalCode">Postal Code</Label>
              <Input
                id="addressPostalCode"
                value={formData.addressPostalCode || ''}
                onChange={(e) => handleChange('addressPostalCode', e.target.value)}
                placeholder="12345"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressCountry">Country</Label>
            <Input
              id="addressCountry"
              value={formData.addressCountry || ''}
              onChange={(e) => handleChange('addressCountry', e.target.value)}
              placeholder="Country"
            />
          </div>
        </CardContent>
      </Card>

      {/* Business Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Business Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currencyCode">Currency</Label>
              <Select
                value={formData.currencyCode}
                onValueChange={(value) => handleChange('currencyCode', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="ILS">ILS - Israeli Shekel</SelectItem>
                  <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Input
                id="paymentTerms"
                value={formData.paymentTerms || ''}
                onChange={(e) => handleChange('paymentTerms', e.target.value)}
                placeholder="e.g., Net 30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Internal notes about this supplier..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === 'create' ? 'Creating...' : 'Saving...'}
            </>
          ) : mode === 'create' ? (
            'Create Supplier'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
