'use client';

/**
 * ProfileDetailsForm Component
 *
 * Lets the signed-in user update their own first name, last name and phone.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PhoneInput } from '@/shared/components/ui/phone-input';
import { Separator } from '@/shared/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { useAuthStore } from '@/shared/stores';
import { profileSchema, type ProfileFormData } from '../lib/schemas';
import { updateMyProfile } from '../actions/profile';

interface ProfileDetailsFormProps {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
}

export function ProfileDetailsForm({ email, firstName, lastName, phone }: ProfileDetailsFormProps) {
  const router = useRouter();
  const updateAppUser = useAuthStore((state) => state.updateAppUser);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName, lastName, phone: phone ?? '' },
  });

  async function onSubmit(values: ProfileFormData) {
    setIsSaving(true);
    try {
      const result = await updateMyProfile(values);

      if (!result.success) {
        Object.entries(result.errors ?? {}).forEach(([field, messages]) => {
          form.setError(field as keyof ProfileFormData, { message: messages[0] });
        });
        toast.error(result.error || 'Failed to update your profile');
        return;
      }

      const saved = result.data!;
      form.reset({ firstName: saved.firstName, lastName: saved.lastName, phone: saved.phone ?? '' });
      updateAppUser({ firstName: saved.firstName, lastName: saved.lastName });
      toast.success('Profile updated');
      router.refresh();
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter your first name" autoComplete="given-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter your last name" autoComplete="family-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" type="email" value={email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">Contact an administrator to change your email address.</p>
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <PhoneInput {...field} placeholder="(555) 123-4567" autoComplete="tel" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
