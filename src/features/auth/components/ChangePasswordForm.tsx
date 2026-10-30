'use client';

/**
 * ChangePasswordForm Component
 *
 * Lets the signed-in user change their password after confirming the
 * current one.
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { changePasswordSchema, type ChangePasswordFormData } from '../lib/schemas';
import { changeMyPassword } from '../actions/profile';

const EMPTY: ChangePasswordFormData = { currentPassword: '', newPassword: '', confirmNewPassword: '' };

const FIELDS: Array<{ name: keyof ChangePasswordFormData; label: string; placeholder: string; autoComplete: string }> = [
  { name: 'currentPassword', label: 'Current Password', placeholder: 'Enter current password', autoComplete: 'current-password' },
  { name: 'newPassword', label: 'New Password', placeholder: 'Enter new password', autoComplete: 'new-password' },
  { name: 'confirmNewPassword', label: 'Confirm Password', placeholder: 'Confirm new password', autoComplete: 'new-password' },
];

export function ChangePasswordForm() {
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  async function onSubmit(values: ChangePasswordFormData) {
    setIsSaving(true);
    try {
      const result = await changeMyPassword(values);

      if (!result.success) {
        Object.entries(result.errors ?? {}).forEach(([field, messages]) => {
          form.setError(field as keyof ChangePasswordFormData, { message: messages[0] });
        });
        toast.error(result.error || 'Failed to update your password');
        return;
      }

      form.reset(EMPTY);
      toast.success('Password updated');
    } catch {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-3">
          {FIELDS.map((item) => (
            <FormField
              key={item.name}
              control={form.control}
              name={item.name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{item.label} *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type={showPasswords ? 'text' : 'password'}
                      placeholder={item.placeholder}
                      autoComplete={item.autoComplete}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          At least 8 characters, with an uppercase letter, a lowercase letter and a number.
        </p>

        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPasswords((value) => !value)}>
            {showPasswords ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </Button>
          <Button type="submit" variant="outline" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </div>
      </form>
    </Form>
  );
}
