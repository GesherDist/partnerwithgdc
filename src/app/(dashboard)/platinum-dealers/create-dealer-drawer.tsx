'use client';

/**
 * Create Dealer Drawer Component
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { createDealerAction } from '@/features/platinum-dealers/actions';
import { toast } from 'sonner';

interface CreateDealerDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface DealerFormData {
  dealerName: string;
  code?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  status: 'active' | 'inactive';
}

export function CreateDealerDrawer({ open, onClose, onSuccess }: CreateDealerDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<DealerFormData>({
    defaultValues: {
      status: 'active',
      addressCountry: 'US',
    },
  });

  async function onSubmit(data: DealerFormData) {
    try {
      setIsSubmitting(true);

      const result = await createDealerAction({
        dealerName: data.dealerName,
        code: data.code || undefined,
        contactName: data.contactName || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        addressStreet: data.addressStreet || undefined,
        addressCity: data.addressCity || undefined,
        addressState: data.addressState || undefined,
        addressPostalCode: data.addressPostalCode || undefined,
        addressCountry: data.addressCountry || 'US',
      });

      if (result.success) {
        toast.success('Dealer created successfully');
        reset();
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error(result.error || 'Failed to create dealer');
      }
    } catch (error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="sm:max-w-[540px]">
        <SheetHeader>
          <SheetTitle>Add Platinum Dealer</SheetTitle>
          <SheetDescription>
            Create a new platinum dealer in your network
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-200px)] pr-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-6">
            {/* Dealer Name */}
            <div className="space-y-2">
              <Label htmlFor="dealerName">Dealer Name *</Label>
              <Input
                id="dealerName"
                {...register('dealerName', { required: 'Dealer name is required' })}
                placeholder="ABC Tire Distributors"
              />
              {errors.dealerName && (
                <p className="text-sm text-destructive">{errors.dealerName.message}</p>
              )}
            </div>

            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code">Dealer Code</Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="ABC-001"
              />
            </div>

            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                {...register('contactName')}
                placeholder="John Doe"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="contact@abctire.com"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+1-555-0123"
              />
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Address</h4>

              <div className="space-y-2">
                <Label htmlFor="addressStreet">Street</Label>
                <Input
                  id="addressStreet"
                  {...register('addressStreet')}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addressCity">City</Label>
                  <Input
                    id="addressCity"
                    {...register('addressCity')}
                    placeholder="Kansas City"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressState">State</Label>
                  <Input
                    id="addressState"
                    {...register('addressState')}
                    placeholder="MO"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addressPostalCode">Postal Code</Label>
                  <Input
                    id="addressPostalCode"
                    {...register('addressPostalCode')}
                    placeholder="64101"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressCountry">Country</Label>
                  <Input
                    id="addressCountry"
                    {...register('addressCountry')}
                    placeholder="US"
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select defaultValue="active" onValueChange={(value) => register('status').onChange({ target: { value } })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  onClose();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Dealer
              </Button>
            </div>
          </form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
