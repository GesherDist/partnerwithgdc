'use client';

/**
 * Supplier Form Dialog
 *
 * Modal dialog for creating and editing suppliers.
 * In create mode, optionally creates a user account for portal access.
 */

import { useState, useTransition, useEffect } from 'react';
import { Building2, User, MapPin, Settings, Loader2, KeyRound } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Switch } from '@/shared/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { toast } from 'sonner';
import { createSupplierAction, updateSupplierAction } from '../actions';
import type { Supplier, CreateSupplierInput, SupplierStatus } from '../types';

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSuccess?: (updatedSupplier?: Supplier) => void;
}

const initialFormData: CreateSupplierInput = {
  name: '',
  legalName: '',
  primaryContactName: '',
  primaryContactEmail: '',
  primaryContactPhone: '',
  addressStreet: '',
  addressCity: '',
  addressState: '',
  addressPostalCode: '',
  addressCountry: 'US',
  paymentTerms: '',
  currencyCode: 'USD',
  taxId: '',
  status: 'active',
  notes: '',
  createUserAccount: true,
  userPassword: '',
  sendInviteEmail: true,
};

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSuccess,
}: SupplierFormDialogProps) {
  const mode = supplier ? 'edit' : 'create';
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<CreateSupplierInput>(initialFormData);

  // Update form data when supplier changes or dialog opens
  useEffect(() => {
    if (open && supplier) {
      setFormData({
        name: supplier.name || '',
        legalName: supplier.legalName || '',
        primaryContactName: supplier.primaryContactName || '',
        primaryContactEmail: supplier.primaryContactEmail || '',
        primaryContactPhone: supplier.primaryContactPhone || '',
        addressStreet: supplier.addressStreet || '',
        addressCity: supplier.addressCity || '',
        addressState: supplier.addressState || '',
        addressPostalCode: supplier.addressPostalCode || '',
        addressCountry: supplier.addressCountry || 'US',
        paymentTerms: supplier.paymentTerms || '',
        currencyCode: supplier.currencyCode || 'USD',
        taxId: supplier.taxId || '',
        status: supplier.status || 'active',
        notes: supplier.notes || '',
        createUserAccount: false,
        userPassword: '',
        sendInviteEmail: true,
      });
      setErrors({});
    } else if (open && !supplier) {
      setFormData(initialFormData);
      setErrors({});
    }
  }, [open, supplier]);

  // Handle dialog close
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form when closing
      setFormData(initialFormData);
      setErrors({});
    }
    onOpenChange(isOpen);
  };

  const handleChange = (field: keyof CreateSupplierInput, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field changes
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Company name is required
    if (!formData.name.trim()) {
      newErrors.name = 'Company name is required';
    }

    // If creating user account
    if (mode === 'create' && formData.createUserAccount) {
      // Email is required for user account
      if (!formData.primaryContactEmail?.trim()) {
        newErrors.primaryContactEmail = 'Email is required to create user account';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primaryContactEmail)) {
        newErrors.primaryContactEmail = 'Enter a valid email address';
      }

      // Contact name is required for user account
      if (!formData.primaryContactName?.trim()) {
        newErrors.primaryContactName = 'Contact name is required to create user account';
      }

      // Password validation (if not sending invite)
      if (!formData.sendInviteEmail) {
        if (!formData.userPassword) {
          newErrors.userPassword = 'Password is required';
        } else if (formData.userPassword.length < 8) {
          newErrors.userPassword = 'Password must be at least 8 characters';
        } else if (!/[a-z]/.test(formData.userPassword)) {
          newErrors.userPassword = 'Password must contain a lowercase letter';
        } else if (!/[A-Z]/.test(formData.userPassword)) {
          newErrors.userPassword = 'Password must contain an uppercase letter';
        } else if (!/[0-9]/.test(formData.userPassword)) {
          newErrors.userPassword = 'Password must contain a number';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createSupplierAction(formData)
          : await updateSupplierAction({ id: supplier!.id, ...formData });

      if (result.error) {
        toast.error(result.error);
      } else {
        const message = mode === 'create'
          ? formData.createUserAccount
            ? `${formData.name} created with user account for ${formData.primaryContactEmail}`
            : `${formData.name} has been created.`
          : `${formData.name} has been updated.`;
        toast.success(message);
        onOpenChange(false);
        // Pass the updated supplier data to the parent
        onSuccess?.(result.data || undefined);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>
            {mode === 'create' ? 'New Supplier' : `Edit ${supplier?.name}`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {/* Company Information */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                <Building2 className="h-4 w-4" />
                Company Information
              </h3>
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
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
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
            </div>

            {/* Primary Contact */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                <User className="h-4 w-4" />
                Primary Contact
                {mode === 'create' && formData.createUserAccount && (
                  <span className="text-xs font-normal text-amber-600 ml-2">
                    (Used for portal login)
                  </span>
                )}
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="primaryContactName">
                    Name {mode === 'create' && formData.createUserAccount && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="primaryContactName"
                    value={formData.primaryContactName || ''}
                    onChange={(e) => handleChange('primaryContactName', e.target.value)}
                    placeholder="Contact name"
                    className={errors.primaryContactName ? 'border-red-500' : ''}
                  />
                  {errors.primaryContactName && (
                    <p className="text-sm text-red-500">{errors.primaryContactName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryContactEmail">
                    Email {mode === 'create' && formData.createUserAccount && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="primaryContactEmail"
                    type="email"
                    value={formData.primaryContactEmail || ''}
                    onChange={(e) => handleChange('primaryContactEmail', e.target.value)}
                    placeholder="email@example.com"
                    className={errors.primaryContactEmail ? 'border-red-500' : ''}
                  />
                  {errors.primaryContactEmail && (
                    <p className="text-sm text-red-500">{errors.primaryContactEmail}</p>
                  )}
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
            </div>

            {/* Portal Access - Only show in create mode */}
            {mode === 'create' && (
              <div className="space-y-4">
                <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  <KeyRound className="h-4 w-4" />
                  Portal Access
                </h3>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Create user account</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow this supplier to login to the portal
                    </p>
                  </div>
                  <Switch
                    checked={formData.createUserAccount}
                    onCheckedChange={(checked) => handleChange('createUserAccount', checked)}
                  />
                </div>

                {formData.createUserAccount && (
                  <>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label className="text-base">Send invite email</Label>
                        <p className="text-sm text-muted-foreground">
                          User will set their own password via email
                        </p>
                      </div>
                      <Switch
                        checked={formData.sendInviteEmail}
                        onCheckedChange={(checked) => handleChange('sendInviteEmail', checked)}
                      />
                    </div>

                    {!formData.sendInviteEmail && (
                      <div className="space-y-2">
                        <Label htmlFor="userPassword">
                          Password <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="userPassword"
                          type="password"
                          value={formData.userPassword || ''}
                          onChange={(e) => handleChange('userPassword', e.target.value)}
                          placeholder="Min 8 chars, uppercase, lowercase, number"
                          className={errors.userPassword ? 'border-red-500' : ''}
                        />
                        {errors.userPassword && (
                          <p className="text-sm text-red-500">{errors.userPassword}</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Address */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                <MapPin className="h-4 w-4" />
                Address
              </h3>
              <div className="space-y-4">
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
              </div>
            </div>

            {/* Business Settings */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                <Settings className="h-4 w-4" />
                Business Settings
              </h3>
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
                  rows={3}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
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
                  formData.createUserAccount ? 'Create Supplier & User' : 'Create Supplier'
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
