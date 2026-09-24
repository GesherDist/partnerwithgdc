'use client';

/**
 * Role Form Dialog
 *
 * Dialog for creating and editing roles.
 * Only handles basic role info - permissions are managed separately on the main page.
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Loader2 } from 'lucide-react';
import { useCreateRole, useUpdateRole } from '../hooks/use-role-mutations';
import type { RoleDetail, CreateRoleData, UpdateRoleData, RoleScope } from '../types';

// ============================================
// SCHEMA
// ============================================

const roleFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(500).optional(),
  scope: z.enum(['user', 'customer', 'supplier']),
});

type RoleFormValues = {
  name: string;
  description?: string;
  scope: RoleScope;
};

// ============================================
// PROPS
// ============================================

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleDetail | null;
  onSuccess?: () => void;
}

// ============================================
// COMPONENT
// ============================================

function RoleFormDialogComponent({
  open,
  onOpenChange,
  role,
  onSuccess,
}: RoleFormDialogProps) {
  const isEditing = !!role;
  const [submitting, setSubmitting] = useState(false);

  const { createRole } = useCreateRole();
  const { updateRole } = useUpdateRole();

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      scope: 'user',
    },
  });

  // Reset form when role changes
  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description || '',
        scope: role.scope,
      });
    } else {
      form.reset({
        name: '',
        description: '',
        scope: 'user',
      });
    }
  }, [role, form]);

  const onSubmit = useCallback(async (values: RoleFormValues) => {
    try {
      setSubmitting(true);

      if (isEditing && role) {
        const updateData: UpdateRoleData = {
          name: values.name,
          description: values.description || undefined,
          scope: values.scope,
        };
        await updateRole(role.id, updateData);
      } else {
        const createData: CreateRoleData = {
          name: values.name,
          description: values.description || undefined,
          scope: values.scope,
        };
        await createRole(createData);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to save role:', error);
    } finally {
      setSubmitting(false);
    }
  }, [isEditing, role, updateRole, createRole, onOpenChange, onSuccess]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update role details.'
              : 'Create a new role. You can assign permissions after creating.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., Sales Manager"
                      disabled={role?.isSystemRole}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scope */}
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    User roles for internal users, Customer roles for external customers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe what this role can do..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Role' : 'Create Role'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Export memoized component
export const RoleFormDialog = memo(RoleFormDialogComponent);
